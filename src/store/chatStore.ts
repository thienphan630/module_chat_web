import { create } from 'zustand'
import type { ChatMessage } from '../types/chat.types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface ChatState {
    connectionStatus: ConnectionStatus
    currentRoomId: string | null
    sendQueue: ChatMessage[] // Queue to hold localized un-acknowledged messages

    setConnectionStatus: (status: ConnectionStatus) => void
    setCurrentRoomId: (roomId: string | null) => void

    // Queue features
    enqueueMessage: (message: ChatMessage) => void
    dequeueMessage: (messageId: string) => void
    clearQueue: () => void
}

export const useChatStore = create<ChatState>((set) => ({
    connectionStatus: 'disconnected',
    currentRoomId: null,
    sendQueue: [],

    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),

    enqueueMessage: (message) => set((state) => {
        if (state.sendQueue.some(m => m.message_id === message.message_id)) return state;
        return { sendQueue: [...state.sendQueue, message] }
    }),

    dequeueMessage: (messageId) => set((state) => ({
        sendQueue: state.sendQueue.filter(m => m.message_id !== messageId)
    })),

    clearQueue: () => set({ sendQueue: [] })
}))
