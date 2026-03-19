import { useChatStore } from '../store/chatStore'
import type { WS_Payload, ChatMessage } from '../types/chat.types'
import { WS_ERROR_CODES } from '../types/chat.types'
import { addMessage, updateMessageStatus } from '../utils/db'
import { api } from '../lib/api'

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

    private handleMessage(payload: WS_Payload) {
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
                    // Note: In real app, payload.data is Ciphertext that needs to be decrypted by Web Worker.
                    // For now we add it to state directly. 
                    addMessage({
                        message_id: payload.message_id,
                        room_id: payload.room_id,
                        sender_id: payload.data.sender_id || 'unknown',
                        server_ts: payload.server_ts || Date.now(),
                        ciphertext: payload.data.ciphertext,
                        status: 'sent'
                    });

                    // Trigger notification logic if room isn't current room
                    if (chatStore.currentRoomId !== payload.room_id) {
                        // TODO: trigger Push Notification
                        console.log(`New message in room ${payload.room_id}`);
                    }
                }
                break;
            case 'system':
                console.log('System message:', payload.data);
                break;
            case 'room_member_joined':
                console.log(`[SocketService] User ${payload.data?.user_id} joined room ${payload.room_id}`);
                this.handleMemberJoined(payload.room_id!, payload.data?.user_id);
                break;
            case 'room_member_left':
                console.log(`[SocketService] User ${payload.data?.user_id} left room ${payload.room_id}`);
                this.handleMemberLeft(payload.room_id!, payload.data?.user_id);
                break;
            default:
                break;
        }
    }

    private async handleMemberJoined(roomId: string, newUserId: string) {
        if (!roomId || !newUserId) return;
        
        console.log(`[E2EE] Fetching public keys for new member ${newUserId} in room ${roomId}`);
        
        try {
            // Fetch keys for the new user in bulk (even if it's 1 user, the API is array-based)
            const response = await api.fetchKeys({ user_ids: [newUserId] });
            const userBundle = response.keys[newUserId];

            if (userBundle) {
                console.log(`[E2EE] Got keys for ${newUserId}, generating new Sender Key and sending via Olm...`);
                // TODO: Generate new symmetric Sender Key for the room.
                // TODO: Encrypt Sender Key with newUserId's public keys via Double Ratchet / Olm.
                // TODO: Send via POST /api/v1/messages or Ephemeral WS indicating new E2EE setup.
            }
        } catch (err) {
            console.error('[E2EE] Failed to handle member joined:', err);
        }
    }

    private handleMemberLeft(roomId: string, leftUserId: string) {
        if (!roomId || !leftUserId) return;

        console.log(`[E2EE] Member ${leftUserId} left room ${roomId}. Rotating Sender Key...`);
        // TODO: Generate new Sender Key (so the left member cannot read future messages)
        // TODO: Fetch keys for ALL remaining members in the room 
        // TODO: Encrypt new Sender Key and distribute to remaining members via Olm.
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

