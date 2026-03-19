import { useChatStore } from '../store/chatStore'
import type { WS_Payload, ChatMessage } from '../types/chat.types'
import { WS_ERROR_CODES } from '../types/chat.types'
import { addMessage, updateMessageStatus, getRoomKey, markDeleted } from '../utils/db'
import { api } from '../lib/api'
import { CryptoClient } from '../workers/cryptoClient'
import { isRoomKeyMessage, parseRoomKeyAAD, handleIncomingRoomKey, distributeRoomKey } from './e2ee-key-manager'
import { showBrowserNotification } from '../utils/notification'
import { queryClient } from '../lib/queryClient'

const AUTH_TIMEOUT_MS = 3000 // Server expects auth within 3 seconds

class SocketService {
    private static instance: SocketService;
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private reconnectTimeout: number | null = null;
    private authTimeout: number | null = null;
    private url: string;
    private isPaused = false;

    private constructor() {
        this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public connect(token?: string) {
        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            return;
        }

        const currentToken = token || useChatStore.getState().accessToken || '';

        useChatStore.getState().setConnectionStatus('connecting');

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            useChatStore.getState().setConnectionStatus('connected');

            // Push auth payload — must arrive within 3 seconds
            this.sendPayload({
                type: 'auth',
                token: currentToken
            });

            // Set auth timeout — server closes connection if auth not received in time
            this.authTimeout = window.setTimeout(() => {
                console.warn('[SocketService] Auth timeout — no response within 3s');
            }, AUTH_TIMEOUT_MS);

            // Flush offline queue if any
            this.flushQueue();
        };

        this.socket.onmessage = (event) => {
            try {
                const payload: WS_Payload = JSON.parse(event.data);

                // Clear auth timeout on any successful server response
                if (this.authTimeout) {
                    clearTimeout(this.authTimeout);
                    this.authTimeout = null;
                }

                this.handleMessage(payload);
            } catch (error) {
                console.error('Failed to parse WS message', error);
            }
        };

        this.socket.onclose = (event) => {
            this.clearAuthTimeout();
            useChatStore.getState().setConnectionStatus('disconnected');
            if (event.code !== 1000) { // Normal closure
                this.reconnect();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            // Wait for onclose to trigger reconnect logic
        };
    }

    private clearAuthTimeout() {
        if (this.authTimeout) {
            clearTimeout(this.authTimeout);
            this.authTimeout = null;
        }
    }

    private async handleMessage(payload: WS_Payload) {
        if (payload.type === 'error') {
            this.handleError(payload);
            return;
        }

        const chatStore = useChatStore.getState();

        switch (payload.type) {
            case 'ack':
                if (payload.room_id && payload.message_id) {
                    updateMessageStatus(payload.message_id, 'sent', payload.server_ts);
                }
                break;
            case 'message':
                if (payload.room_id && payload.message_id && payload.data) {
                    // Phase 02: Check if this is a room key distribution message
                    if (isRoomKeyMessage(payload.data.aad_data)) {
                        const aad = parseRoomKeyAAD(payload.data.aad_data);
                        if (aad && payload.data.ciphertext) {
                            const success = await handleIncomingRoomKey(
                                payload.room_id,
                                payload.data.sender_id || 'unknown',
                                payload.data.ciphertext,
                                aad
                            );
                            if (success) {
                                // Refresh room list when new room key is received (usually means added to a new room)
                                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                            }
                        }
                        // Do NOT render room key messages as chat messages
                        break;
                    }

                    // Normal message: decrypt ciphertext using room key from DB
                    let decryptedText: string | undefined;

                    if (payload.data.ciphertext) {
                        try {
                            const roomKey = await getRoomKey(payload.room_id);
                            if (roomKey) {
                                decryptedText = await CryptoClient.decryptText(
                                    payload.data.ciphertext,
                                    roomKey.shared_key
                                );
                            } else {
                                decryptedText = '[E2EE key not found]';
                                console.warn(`[E2EE] No room key for ${payload.room_id} — cannot decrypt`);
                            }
                        } catch (err) {
                            console.error('[E2EE] Decryption failed:', err);
                            decryptedText = '[Decryption failed]';
                        }
                    }

                    // Phase 05: Check if this is a delete tombstone
                    if (payload.data.aad_data) {
                        try {
                            const aad = JSON.parse(payload.data.aad_data);
                            if (aad.type === 'm.room.message.delete' && decryptedText) {
                                const parsed = JSON.parse(decryptedText);
                                if (parsed.target_id) {
                                    await markDeleted(parsed.target_id);
                                    break; // Don't render tombstone as a normal message
                                }
                            }
                        } catch {
                            // Not a tombstone — continue normal flow
                        }
                    }

                    addMessage({
                        message_id: payload.message_id,
                        room_id: payload.room_id,
                        sender_id: payload.data.sender_id || 'unknown',
                        server_ts: payload.server_ts || Date.now(),
                        ciphertext: payload.data.ciphertext,
                        text: decryptedText,
                        aad_data: payload.data.aad_data,
                        status: 'sent'
                    });

                    // Browser notification for messages in non-active rooms
                    if (chatStore.currentRoomId !== payload.room_id) {
                        showBrowserNotification(
                            `New message in ${payload.room_id}`,
                            decryptedText?.slice(0, 100) || 'Encrypted message',
                            payload.room_id
                        )
                    }
                }
                break;
            case 'system':
                console.log('System message:', payload.data);
                break;
            case 'room_member_joined':
                console.log(`[SocketService] User ${payload.data?.user_id} joined room ${payload.room_id}`);
                this.handleMemberJoined(payload.room_id!, payload.data?.user_id);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                break;
            case 'room_member_left':
                console.log(`[SocketService] User ${payload.data?.user_id} left room ${payload.room_id}`);
                this.handleMemberLeft(payload.room_id!, payload.data?.user_id);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                break;

            // Phase 04: Ephemeral UX events
            case 'typing':
                if (payload.room_id && payload.data?.sender_id) {
                    chatStore.setTyping(payload.room_id, payload.data.sender_id, true)
                    // Auto-clear after 4s if typing_stop never arrives
                    setTimeout(() => {
                        useChatStore.getState().setTyping(payload.room_id!, payload.data.sender_id, false)
                    }, 4000)
                }
                break;
            case 'typing_stop':
                if (payload.room_id && payload.data?.sender_id) {
                    chatStore.setTyping(payload.room_id, payload.data.sender_id, false)
                }
                break;
            case 'user_online':
                if (payload.data?.user_id) {
                    chatStore.setPresence(payload.data.user_id, 'online')
                }
                break;
            case 'user_offline':
                if (payload.data?.user_id) {
                    chatStore.setPresence(payload.data.user_id, 'offline')
                }
                break;
            case 'read':
                if (payload.data?.message_id && payload.data?.reader_id) {
                    chatStore.markMessageRead(payload.data.message_id, payload.data.reader_id)
                    updateMessageStatus(payload.data.message_id, 'read')
                }
                break;

            case 'room_added':
                console.log(`[SocketService] User added to room ${payload.room?.room_id || payload.room_id}`);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                if (payload.added_by) {
                    showBrowserNotification('Bảng tin nhóm', 'Bạn vừa được thêm vào một nhóm mới', payload.room?.room_id || payload.room_id || '');
                }
                if (payload.room?.room_id) {
                    this.sendPayload({ type: 'join', room_id: payload.room.room_id });
                }
                break;

            case 'room_removed':
                console.log(`[SocketService] User removed from room ${payload.room_id}`);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                
                if (chatStore.currentRoomId === payload.room_id) {
                    chatStore.setCurrentRoomId(null);
                    showBrowserNotification('Thông báo nhóm', 'Bạn vừa bị quản trị viên mời ra khỏi nhóm', payload.room_id || '');
                }
                if (payload.room_id) {
                    this.sendPayload({ type: 'leave', room_id: payload.room_id });
                }
                break;

            case 'room_updated':
                console.log(`[SocketService] Room ${payload.room_id} updated`);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                if (payload.room_id) {
                    queryClient.invalidateQueries({ queryKey: ['room', payload.room_id] });
                }
                break;

            default:
                break;
        }
    }

    private async handleMemberJoined(roomId: string, newUserId: string) {
        if (!roomId || !newUserId) return;

        const currentUserId = useChatStore.getState().currentUserId;
        if (newUserId === currentUserId) return; // We joined — key comes from existing member

        // Check if we have a room key to distribute
        const roomKey = await getRoomKey(roomId);
        if (!roomKey) {
            console.log(`[E2EE] No room key for ${roomId} — cannot distribute to new member`);
            return;
        }

        console.log(`[E2EE] Distributing room key to new member ${newUserId} in room ${roomId}`);
        try {
            await distributeRoomKey(roomId, [newUserId]);
        } catch (err) {
            console.error('[E2EE] Failed to distribute key to new member:', err);
        }
    }

    private async handleMemberLeft(roomId: string, leftUserId: string) {
        if (!roomId || !leftUserId) return;

        const currentUserId = useChatStore.getState().currentUserId;
        if (leftUserId === currentUserId) return; // We left — nothing to rotate

        // Check if we have a room key (only existing members can rotate)
        const roomKey = await getRoomKey(roomId);
        if (!roomKey) return;

        console.log(`[E2EE] Member ${leftUserId} left room ${roomId}. Rotating room key...`);

        try {
            // Fetch remaining members
            const detail = await api.getRoomDetail(roomId);
            const remainingMemberIds = detail.members
                .map(m => m.room_id) // member's user_id field — depends on API shape
                .filter(id => id !== leftUserId && id !== currentUserId);

            // Generate new key + distribute to remaining members
            if (remainingMemberIds.length > 0) {
                await distributeRoomKey(roomId, remainingMemberIds);
            }
            console.log(`[E2EE] Room key rotated for ${roomId}`);
        } catch (err) {
            console.error('[E2EE] Failed to rotate key after member left:', err);
        }
    }

    private handleError(payload: WS_Payload) {
        switch (payload.code) {
            case WS_ERROR_CODES.TOKEN_EXPIRED:
                this.handleTokenExpired();
                break;
            case WS_ERROR_CODES.INVALID_AUTH_FRAME:
                console.error('[SocketService] Invalid auth frame format — disconnecting');
                this.disconnect();
                break;
            case WS_ERROR_CODES.NOT_A_MEMBER:
                console.warn(`[SocketService] Not a member: ${payload.data?.message || payload.room_id}`);
                break;
            default:
                console.error('[SocketService] WS Error:', payload.code, payload.data);
                break;
        }
    }

    private async handleTokenExpired() {
        this.isPaused = true;
        const chatStore = useChatStore.getState();
        const currentRefreshToken = chatStore.refreshToken;

        if (!currentRefreshToken) {
            console.error('[SocketService] No refresh token available — disconnecting');
            chatStore.clearAuth();
            this.disconnect();
            return;
        }

        try {
            // Use api.refreshToken() with correct endpoint /api/v1/auth/refresh
            const data = await api.refreshToken(currentRefreshToken);

            // Token rotation: save BOTH new tokens immediately
            chatStore.setTokens(data.access_token, data.refresh_token);

            // Re-authenticate current WS with new access token
            this.sendPayload({
                type: 'auth',
                token: data.access_token
            });
            this.isPaused = false;
            this.flushQueue();
        } catch (err) {
            console.error('[SocketService] Failed to refresh token', err);
            chatStore.clearAuth();
            this.disconnect();
        }
    }

    private reconnect() {
        useChatStore.getState().setConnectionStatus('reconnecting');

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached');
            useChatStore.getState().setConnectionStatus('error');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Max 10s
        this.reconnectAttempts++;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = window.setTimeout(() => {
            this.connect();
        }, delay);
    }

    public disconnect() {
        this.clearAuthTimeout();
        if (this.socket) {
            this.socket.close(1000, 'User triggered disconnect');
            this.socket = null;
        }
    }

    public sendPayload(payload: WS_Payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.isPaused) {
            this.socket.send(JSON.stringify(payload));
        } else if (payload.type === 'message') {
            console.warn('Socket offline/paused. Cannot send raw payload directly. Use sendMessage to queue.');
        }
    }

    public sendMessage(message: ChatMessage) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.isPaused) {
            const payload: WS_Payload = {
                type: 'message',
                room_id: message.room_id,
                message_id: message.message_id,
                data: {
                    ciphertext: message.ciphertext,
                    text: message.text, // Normally only ciphertext
                    aad_data: message.aad_data
                }
            };
            this.socket.send(JSON.stringify(payload));
        } else {
            useChatStore.getState().enqueueMessage(message);
        }
    }

    private flushQueue() {
        const queue = useChatStore.getState().sendQueue;
        if (queue.length > 0) {
            queue.forEach(msg => {
                this.sendMessage(msg);
                useChatStore.getState().dequeueMessage(msg.message_id);
            });
        }
    }
}

export const socketService = SocketService.getInstance();

