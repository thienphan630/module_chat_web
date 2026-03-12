import { create } from 'zustand'
import type { ChatMessage } from '../types/chat.types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

function getInitialUserId(): string {
    const params = new URLSearchParams(window.location.search)
    return params.get('user') || localStorage.getItem('userId') || 'default-user'
}

interface ChatState {
    connectionStatus: ConnectionStatus
    currentUserId: string
    currentRoomId: string | null
    sendQueue: ChatMessage[] // Queue to hold localized un-acknowledged messages

    // Auth state — production should use httpOnly cookies instead of localStorage
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean

    setConnectionStatus: (status: ConnectionStatus) => void
    setCurrentUserId: (id: string) => void
    setCurrentRoomId: (roomId: string | null) => void

    // Auth actions
    setTokens: (accessToken: string, refreshToken: string) => void
    clearAuth: () => void

    // Queue features
    enqueueMessage: (message: ChatMessage) => void
    dequeueMessage: (messageId: string) => void
    clearQueue: () => void
}

export const useChatStore = create<ChatState>((set) => ({
    connectionStatus: 'disconnected',
    currentUserId: getInitialUserId(),
    currentRoomId: null,
    sendQueue: [],

    // Auth state — dev uses localStorage, production should use httpOnly cookies
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    isAuthenticated: !!localStorage.getItem('accessToken'),

    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCurrentUserId: (id) => set({ currentUserId: id }),
    setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),

    setTokens: (accessToken, refreshToken) => {
        // Dev: persist to localStorage. Production: tokens should come from httpOnly cookies
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ accessToken, refreshToken, isAuthenticated: true })
    },

    clearAuth: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userId')
        set({
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            currentUserId: 'default-user',
        })
    },

    enqueueMessage: (message) => set((state) => {
        if (state.sendQueue.some(m => m.message_id === message.message_id)) return state;
        return { sendQueue: [...state.sendQueue, message] }
    }),

    dequeueMessage: (messageId) => set((state) => ({
        sendQueue: state.sendQueue.filter(m => m.message_id !== messageId)
    })),

    clearQueue: () => set({ sendQueue: [] })
}))

