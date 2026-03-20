import type {
    RegisterPayload, LoginPayload, AuthResponse,
    Room, RoomMember, CreateRoomPayload, InviteMembersPayload,
    UploadKeysPayload, FetchKeysPayload, FetchKeysResponse, ChatMessage,
    UserSearchResult
} from '../types/chat.types'
import { apiClient } from './axios-instance'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/** Convert raw network errors to user-friendly messages */
function handleNetworkError(err: unknown): never {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server. Please check your connection and try again.')
    }
    throw err
}


export const api = {
    // --- Authentication ---

    async register(payload: RegisterPayload): Promise<AuthResponse> {
        let response: Response
        try {
            response = await fetch(`${API_BASE}/api/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
        } catch (err) {
            handleNetworkError(err)
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Registration failed' }))
            throw new Error(error.message || `Register failed: ${response.status}`)
        }

        return response.json()
    },

    async login(payload: LoginPayload): Promise<AuthResponse> {
        let response: Response
        try {
            response = await fetch(`${API_BASE}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
        } catch (err) {
            handleNetworkError(err)
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Login failed' }))
            throw new Error(error.message || `Login failed: ${response.status}`)
        }

        return response.json()
    },

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        let response: Response
        try {
            response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            })
        } catch (err) {
            handleNetworkError(err)
        }

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

    async searchUsers(query: string): Promise<UserSearchResult[]> {
        if (!query.trim()) return []
        const { data } = await apiClient.get('/api/v1/users/search', { params: { q: query } })
        return data
    },

    // --- Message Sync & History ---

    /**
     * Sync messages from server.
     * - Without afterServerTs: returns latest N messages (initial load)
     * - With afterServerTs: returns messages newer than timestamp (incremental sync)
     */
    async syncMessages(roomId: string, afterServerTs?: number, limit: number = 50): Promise<{ data: ChatMessage[] }> {
        const params: Record<string, any> = { room_id: roomId, limit }
        if (afterServerTs) params.after_server_ts = afterServerTs
        const { data } = await apiClient.get('/api/v1/messages/sync', { params })
        return data
    },




    async uploadFile(_blob: Blob): Promise<string> {
        await new Promise(r => setTimeout(r, 1500));
        return 'https://mock-s3.url/' + crypto.randomUUID();
    }
}

