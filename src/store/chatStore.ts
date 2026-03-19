import { create } from 'zustand'
import type { ChatMessage } from '../types/chat.types'
import { CryptoClient } from '../workers/cryptoClient'
import { getE2EEKeys, saveE2EEKeys } from '../utils/db'
import { api } from '../lib/api'

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

    // Ephemeral UX state (not persisted — lost on refresh)
    typingUsers: Record<string, string[]>              // roomId → [userId, ...]
    presenceMap: Record<string, 'online' | 'offline'>  // userId → status
    readReceipts: Record<string, string[]>             // messageId → [readerId, ...]

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

    // Ephemeral UX actions
    setTyping: (roomId: string, userId: string, isTyping: boolean) => void
    setPresence: (userId: string, status: 'online' | 'offline') => void
    markMessageRead: (messageId: string, readerId: string) => void

    // Initialization routine for post-login
    initializeE2EEKeys: () => Promise<void>
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

    // Ephemeral UX state
    typingUsers: {},
    presenceMap: {},
    readReceipts: {},

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

    clearQueue: () => set({ sendQueue: [] }),

    // Ephemeral UX actions
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

    initializeE2EEKeys: async () => {
        const state = useChatStore.getState();
        if (!state.currentUserId || state.currentUserId === 'default-user') return;

        const existingKeys = await getE2EEKeys(state.currentUserId);
        if (!existingKeys) {
            console.log('[E2EE] Generating Keys for new session...');
            const { uploadPayload, privateData } = await CryptoClient.genKeys();
            
            await saveE2EEKeys({
                userId: state.currentUserId,
                identity_key_private: privateData.identity_key_private,
                signed_pre_key_private: privateData.signed_pre_key_private,
                one_time_pre_keys_private: privateData.one_time_pre_keys_private
            });

            await api.uploadKeys(uploadPayload);
            console.log('[E2EE] Keys generated and uploaded successfully.');
        } else {
            console.log('[E2EE] Keys already exist for user.');
        }
    }
}))

