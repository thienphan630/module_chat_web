import { useChatStore } from '../store/chatStore'
import type { WS_Payload, ChatMessage } from '../types/chat.types'
import { addMessage, updateMessageStatus } from '../utils/db'

class SocketService {
    private static instance: SocketService;
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private reconnectTimeout: number | null = null;
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

        const currentToken = token || localStorage.getItem('token') || '';

        useChatStore.getState().setConnectionStatus('connecting');

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            useChatStore.getState().setConnectionStatus('connected');

            // Push auth payload to avoid URI leak
            this.sendPayload({
                type: 'auth',
                token: currentToken
            });

            // Flush offline queue if any
            this.flushQueue();
        };

        this.socket.onmessage = (event) => {
            try {
                const payload: WS_Payload = JSON.parse(event.data);
                this.handleMessage(payload);
            } catch (error) {
                console.error('Failed to parse WS message', error);
            }
        };

        this.socket.onclose = (event) => {
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

    private handleMessage(payload: WS_Payload) {
        if (payload.type === 'error' && payload.code === 'TOKEN_EXPIRED') {
            this.handleTokenExpired();
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
            default:
                break;
        }
    }

    private async handleTokenExpired() {
        this.isPaused = true;
        try {
            // Simulated REST API call for refresh token
            const response = await fetch('/api/refresh', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                // Re-authenticate current WS
                this.sendPayload({
                    type: 'auth',
                    token: data.token
                });
                this.isPaused = false;
                this.flushQueue();
            } else {
                // If refresh fails, disconnect and probably push to login
                this.disconnect();
            }
        } catch (err) {
            console.error('Failed to refresh token', err);
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
