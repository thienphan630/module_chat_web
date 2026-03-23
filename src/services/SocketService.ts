import { useChatStore } from '../store/chatStore'
import type { WS_Payload, ChatMessage } from '../types/chat.types'
import { WS_ERROR_CODES } from '../types/chat.types'
import { addMessage, updateMessageStatus, markDeleted, markMessagesReadUpTo } from '../utils/db'
import { api } from '../lib/api'
import { showBrowserNotification } from '../utils/notification'
import { queryClient } from '../lib/queryClient'

const AUTH_TIMEOUT_MS = 3000

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

            this.sendPayload({ type: 'auth', token: currentToken });

            this.authTimeout = window.setTimeout(() => {
                console.warn('[SocketService] Auth timeout — no response within 3s');
            }, AUTH_TIMEOUT_MS);

            this.flushQueue();
        };

        this.socket.onmessage = (event) => {
            try {
                const payload: WS_Payload = JSON.parse(event.data);
                console.debug('[WS ←]', payload.type, payload);

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
            if (event.code !== 1000) {
                this.reconnect();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
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
                if (payload.message_id) {
                    try {
                        await updateMessageStatus(payload.message_id, 'sent', payload.server_ts);
                    } catch (err) {
                        console.error('[SocketService] Failed to update message status (ack):', err);
                    }
                    queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                }
                break;

            // Server sends 'new_message'; also handle 'message' as fallback
            case 'new_message':
            case 'message': {
                // Defensive: support both flat payload and nested data payload
                const msgData = payload.data || payload;
                const msgId = payload.message_id || msgData.message_id;
                const msgRoomId = payload.room_id || msgData.room_id;

                if (msgRoomId && msgId) {
                    try {
                        await addMessage({
                            message_id: msgId,
                            room_id: msgRoomId,
                            sender_id: payload.sender_id || msgData.sender_id || 'unknown',
                            server_ts: payload.server_ts || msgData.server_ts || Date.now(),
                            content: payload.content || msgData.content || '',
                            status: 'sent'
                        });
                    } catch (err) {
                        console.error('[SocketService] Failed to add message to DB:', err);
                    }

                    queryClient.invalidateQueries({ queryKey: ['my-rooms'] });

                    if (chatStore.currentRoomId !== msgRoomId) {
                        showBrowserNotification(
                            `New message in ${msgRoomId}`,
                            (payload.content || msgData.content || '').slice(0, 100),
                            msgRoomId
                        )
                    }
                }
                break;
            }

            case 'system':
                console.log('[SocketService] System:', JSON.stringify(payload));
                break;

            // Server uses 'member_joined' / 'member_left'; keep legacy aliases too
            case 'member_joined':
            case 'room_member_joined': {
                const joinedUserId = payload.user_id || payload.data?.user_id;
                console.log(`[SocketService] User ${joinedUserId} joined room ${payload.room_id}`);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                if (payload.room_id) queryClient.invalidateQueries({ queryKey: ['room-members', payload.room_id] });
                break;
            }

            case 'member_left':
            case 'room_member_left': {
                const leftUserId = payload.user_id || payload.data?.user_id;
                console.log(`[SocketService] User ${leftUserId} left room ${payload.room_id}`);
                queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                if (payload.room_id) queryClient.invalidateQueries({ queryKey: ['room-members', payload.room_id] });
                break;
            }

            // Server sends typing with { room_id, user_id }
            case 'typing': {
                const typingUserId = payload.user_id || payload.data?.sender_id || payload.data?.user_id;
                if (payload.room_id && typingUserId) {
                    chatStore.setTyping(payload.room_id, typingUserId, true)
                    setTimeout(() => {
                        useChatStore.getState().setTyping(payload.room_id!, typingUserId, false)
                    }, 4000)
                }
                break;
            }

            case 'typing_stop': {
                const stopUserId = payload.user_id || payload.data?.sender_id || payload.data?.user_id;
                if (payload.room_id && stopUserId) {
                    chatStore.setTyping(payload.room_id, stopUserId, false)
                }
                break;
            }

            // Server sends 'presence' with { user_id, status: 'online'|'offline' }
            case 'presence': {
                const presenceUserId = payload.user_id || payload.data?.user_id;
                const presenceStatus = (payload.status || payload.data?.status) as 'online' | 'offline' | undefined;
                if (presenceUserId && presenceStatus) {
                    chatStore.setPresence(presenceUserId, presenceStatus)
                }
                break;
            }

            // Keep legacy event names as fallback
            case 'user_online':
                if (payload.user_id || payload.data?.user_id) {
                    chatStore.setPresence(payload.user_id || payload.data?.user_id, 'online')
                }
                break;

            case 'user_offline':
                if (payload.user_id || payload.data?.user_id) {
                    chatStore.setPresence(payload.user_id || payload.data?.user_id, 'offline')
                }
                break;

            case 'receipt': {
                const receiptMsgId = payload.last_read_message_id || payload.message_id || payload.data?.message_id || payload.data?.last_read_message_id
                const receiptUserId = payload.user_id || payload.data?.user_id
                if (receiptMsgId && receiptUserId) {
                    chatStore.markMessageRead(receiptMsgId, receiptUserId)
                    await markMessagesReadUpTo(receiptMsgId)
                } else {
                    console.warn('[Receipt] Missing msgId or userId — receipt ignored', payload)
                }
                break;
            }

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
                    queryClient.invalidateQueries({ queryKey: ['room-detail', payload.room_id] });
                }
                break;

            case 'message_deleted':
                if (payload.message_id) {
                    try {
                        await markDeleted(payload.message_id);
                    } catch (err) {
                        console.error('[SocketService] Failed to mark message deleted:', err);
                    }
                    queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
                }
                break;

            default:
                console.warn('[SocketService] Unhandled event type:', payload.type, payload);
                break;
        }
    }

    private handleError(payload: WS_Payload) {
        const errorCode = payload.code || (payload as any).error_code || (payload.data as any)?.code;
        const errorMessage = (payload as any).message || payload.data?.message || payload.reason || '';

        console.warn('[SocketService] WS Error payload:', JSON.stringify(payload));

        switch (errorCode) {
            case WS_ERROR_CODES.TOKEN_EXPIRED:
                this.handleTokenExpired();
                break;
            case WS_ERROR_CODES.INVALID_AUTH_FRAME:
                console.error('[SocketService] Invalid auth frame format — disconnecting');
                this.disconnect();
                break;
            case WS_ERROR_CODES.NOT_A_MEMBER:
                console.warn(`[SocketService] Not a member: ${errorMessage || payload.room_id}`);
                break;
            default:
                console.error(`[SocketService] Unhandled error: code=${errorCode}, msg=${errorMessage}`);
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
            const data = await api.refreshToken(currentRefreshToken);
            chatStore.setTokens(data.access_token, data.refresh_token);

            this.sendPayload({ type: 'auth', token: data.access_token });
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

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
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
            console.debug('[WS →]', payload.type, payload);
            this.socket.send(JSON.stringify(payload));
        } else if (payload.type === 'message') {
            console.warn('Socket offline/paused. Use sendMessage to queue.');
        }
    }

    public sendMessage(message: ChatMessage) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.isPaused) {
            const payload: WS_Payload = {
                type: 'message',
                room_id: message.room_id,
                message_id: message.message_id,
                content: message.content
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
