import type {
    RegisterPayload, LoginPayload, AuthResponse,
    Room, RoomMember, CreateRoomPayload, InviteMembersPayload,
    ChatMessage, UserSearchResult, RoomMembersResponse,
    UserProfile, UpdateProfilePayload, UpdateRoomPayload
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

    async logout(refreshToken: string): Promise<void> {
        try {
            await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken })
        } catch {
            // Idempotent — always clear local state regardless
        }
    },

    // --- User Profile ---

    async getMyProfile(): Promise<{ success: boolean; user: UserProfile }> {
        const { data } = await apiClient.get('/api/v1/users/me')
        return data
    },

    async getUserProfile(userId: string): Promise<{ success: boolean; user: UserProfile }> {
        const { data } = await apiClient.get(`/api/v1/users/${userId}`)
        return data
    },

    async updateMyProfile(payload: UpdateProfilePayload): Promise<{ success: boolean; user: UserProfile }> {
        const { data } = await apiClient.patch('/api/v1/users/me', payload)
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

    async getRoomDetail(roomId: string): Promise<{ room: Room }> {
        const { data } = await apiClient.get(`/api/v1/rooms/${roomId}`)
        return data
    },

    async updateRoom(roomId: string, payload: UpdateRoomPayload): Promise<{ room: Room }> {
        const { data } = await apiClient.patch(`/api/v1/rooms/${roomId}`, payload)
        return data
    },

    async fetchRoomMembers(roomId: string, limit = 50, cursor?: string): Promise<RoomMembersResponse> {
        const params: Record<string, any> = { limit }
        if (cursor) params.cursor = cursor
        const { data } = await apiClient.get(`/api/v1/rooms/${roomId}/members`, { params })
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

    async syncMessages(
        roomId: string,
        opts?: { afterServerTs?: number; beforeServerTs?: number },
        limit: number = 50
    ): Promise<{ data: ChatMessage[] }> {
        const params: Record<string, any> = { room_id: roomId, limit }
        if (opts?.afterServerTs) params.after_server_ts = opts.afterServerTs
        if (opts?.beforeServerTs) params.before_server_ts = opts.beforeServerTs
        const { data } = await apiClient.get('/api/v1/messages/sync', { params })
        return data
    },

    async deleteMessage(roomId: string, messageId: string): Promise<void> {
        await apiClient.delete(`/api/v1/rooms/${roomId}/messages/${messageId}`)
    },

    // --- Read Receipts ---

    async sendReceipt(roomId: string, messageId: string): Promise<void> {
        await apiClient.post(`/api/v1/rooms/${roomId}/receipts`, { last_read_message_id: messageId })
    },
}
