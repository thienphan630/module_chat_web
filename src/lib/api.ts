import type {
    RegisterPayload, LoginPayload, AuthResponse,
    Room, RoomMember, CreateRoomPayload, InviteMembersPayload,
    UploadKeysPayload, FetchKeysPayload, FetchKeysResponse, ChatMessage,
    UserSearchResult
} from '../types/chat.types'
import { apiClient } from './axios-instance'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export interface RoomMetaData {
    room_id: string;  // Aligned with V1 API spec (was 'id')
    name: string;
    avatarUrl?: string;
    lastMessagePreview?: string;
    updatedAt: number;
}

// Mocked fetch logic since server is not implemented in full
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const api = {
    // --- Authentication ---

    async register(payload: RegisterPayload): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Registration failed' }))
            throw new Error(error.message || `Register failed: ${response.status}`)
        }

        return response.json()
    },

    async login(payload: LoginPayload): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Login failed' }))
            throw new Error(error.message || `Login failed: ${response.status}`)
        }

        return response.json()
    },

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Token refresh failed' }))
            throw new Error(error.message || `Refresh failed: ${response.status}`)
        }

        return response.json()
    },

    // --- E2EE Key Management ---

    async uploadKeys(payload: UploadKeysPayload): Promise<void> {
        await apiClient.post('/api/v1/e2ee/keys', payload)
    },

    async fetchKeys(payload: FetchKeysPayload): Promise<FetchKeysResponse> {
        const { data } = await apiClient.post('/api/v1/e2ee/keys/fetch', payload)
        return data
    },

    // --- Room Management (REST API with auth) ---

    async createRoom(payload: CreateRoomPayload): Promise<{ room: Room; members: string[] }> {
        const { data } = await apiClient.post('/api/v1/rooms', payload)
        return data
    },

    async getMyRooms(): Promise<RoomMember[]> {
        const { data } = await apiClient.get('/api/v1/rooms')
        return data.rooms
    },

    async getRoomDetail(roomId: string): Promise<{ room: Room; members: RoomMember[] }> {
        const { data } = await apiClient.get(`/api/v1/rooms/${roomId}`)
        return data
    },

    async inviteMembers(roomId: string, payload: InviteMembersPayload): Promise<void> {
        await apiClient.post(`/api/v1/rooms/${roomId}/members`, payload)
    },

    async removeMember(roomId: string, userId: string): Promise<void> {
        await apiClient.delete(`/api/v1/rooms/${roomId}/members/${userId}`)
    },

    // User search — fallback to exact user_id when BE endpoint missing
    async searchUsers(query: string): Promise<UserSearchResult[]> {
        if (!query.trim()) return []
        try {
            const { data } = await apiClient.get('/api/v1/users/search', { params: { q: query } })
            return data.users
        } catch {
            // Fallback: treat query as exact user_id
            return [{ user_id: query.trim(), username: query.trim(), email: '' }]
        }
    },

    // --- Rooms (Mock fallback) & Messages ---

    async getRooms(): Promise<RoomMetaData[]> {
        await sleep(500); // simulate network
        return [
            { room_id: 'room-1', name: 'General Chat', lastMessagePreview: 'Hello world!', updatedAt: Date.now() },
            { room_id: 'room-2', name: 'Secret Encrypted Group', lastMessagePreview: '[Ciphertext]', updatedAt: Date.now() - 3600000 },
        ];
    },

    async syncMessages(roomId: string, afterServerTs: number) {
        await sleep(1000); // simulate network delay
        console.log(`[API Mock] Sync requested for room ${roomId} after ${afterServerTs}`);
        return {
            messages: [] // Simulate returning empty or fetched old messages
        };
    },

    async getHistoricalMessages(roomId: string, beforeMsgId: string, limit: number = 50): Promise<{ messages: ChatMessage[] }> {
        const { data } = await apiClient.get(`/api/v1/rooms/${roomId}/messages`, {
            params: {
                before_msg_id: beforeMsgId,
                limit
            }
        });
        return data;
    },
    async uploadFile(_blob: Blob): Promise<string> {
        await sleep(1500);
        return 'https://mock-s3.url/' + crypto.randomUUID();
    }
}

