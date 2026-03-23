import { create } from 'zustand'
import type { ChatMessage, UserProfile } from '../types/chat.types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

function getInitialUserId(): string {
    const params = new URLSearchParams(window.location.search)
    return params.get('user') || localStorage.getItem('userId') || 'default-user'
}

interface ChatState {
    connectionStatus: ConnectionStatus
    currentUserId: string
    currentRoomId: string | null
    sendQueue: ChatMessage[]

    // Auth state
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean

    // User profile info (persisted to localStorage)
    userEmail: string | null
    userName: string | null
    avatarUrl: string | null

    // Ephemeral UX state (not persisted)
    typingUsers: Record<string, string[]>
    presenceMap: Record<string, 'online' | 'offline'>
    readReceipts: Record<string, string[]>

    setConnectionStatus: (status: ConnectionStatus) => void
    setCurrentUserId: (id: string) => void
    setCurrentRoomId: (roomId: string | null) => void

    // Auth actions
    setTokens: (accessToken: string, refreshToken: string) => void
    setUserProfile: (email: string, username?: string) => void
    setUserFromAPI: (user: UserProfile) => void
    clearAuth: () => void

    // Queue features
    enqueueMessage: (message: ChatMessage) => void
    dequeueMessage: (messageId: string) => void
    clearQueue: () => void

    // Ephemeral UX actions
    setTyping: (roomId: string, userId: string, isTyping: boolean) => void
    setPresence: (userId: string, status: 'online' | 'offline') => void
    markMessageRead: (messageId: string, readerId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
    connectionStatus: 'disconnected',
    currentUserId: getInitialUserId(),
    currentRoomId: null,
    sendQueue: [],

    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    isAuthenticated: !!localStorage.getItem('accessToken'),

    userEmail: localStorage.getItem('userEmail'),
    userName: localStorage.getItem('userName'),
    avatarUrl: localStorage.getItem('avatarUrl'),

    typingUsers: {},
    presenceMap: {},
    readReceipts: {},

    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCurrentUserId: (id) => set({ currentUserId: id }),
    setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),

    setTokens: (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ accessToken, refreshToken, isAuthenticated: true })
    },

    setUserProfile: (email: string, username?: string) => {
        localStorage.setItem('userEmail', email)
        if (username) localStorage.setItem('userName', username)
        set({ userEmail: email, userName: username || null })
    },

    setUserFromAPI: (user: UserProfile) => {
        localStorage.setItem('userId', user.user_id)
        localStorage.setItem('userName', user.username)
        if (user.email) localStorage.setItem('userEmail', user.email)
        if (user.avatar_url) {
            localStorage.setItem('avatarUrl', user.avatar_url)
        } else {
            localStorage.removeItem('avatarUrl')
        }
        set({
            currentUserId: user.user_id,
            userName: user.username,
            userEmail: user.email || null,
            avatarUrl: user.avatar_url,
        })
    },

    clearAuth: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userId')
        localStorage.removeItem('userEmail')
        localStorage.removeItem('userName')
        localStorage.removeItem('avatarUrl')
        set({
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            currentUserId: 'default-user',
            userEmail: null,
            userName: null,
            avatarUrl: null,
        })
    },

    enqueueMessage: (message) => set((state) => {
        if (state.sendQueue.some(m => m.message_id === message.message_id)) return state;
        return { sendQueue: [...state.sendQueue, message] }
    }),

    dequeueMessage: (messageId) => set((state) => ({
        sendQueue: state.sendQueue.filter(m => m.message_id !== messageId)
    })),

    clearQueue: () => set({ sendQueue: [] }),

    setTyping: (roomId, userId, isTyping) => set(state => {
        const current = state.typingUsers[roomId] || []
        return {
            typingUsers: {
                ...state.typingUsers,
                [roomId]: isTyping
                    ? [...new Set([...current, userId])]
                    : current.filter(id => id !== userId)
            }
        }
    }),

    setPresence: (userId, status) => set(state => ({
        presenceMap: { ...state.presenceMap, [userId]: status }
    })),

    markMessageRead: (messageId, readerId) => set(state => {
        const current = state.readReceipts[messageId] || []
        if (current.includes(readerId)) return state
        return {
            readReceipts: {
                ...state.readReceipts,
                [messageId]: [...current, readerId]
            }
        }
    }),
}))
