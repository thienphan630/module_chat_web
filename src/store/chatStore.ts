import { create } from 'zustand'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface ChatState {
    connectionStatus: ConnectionStatus
    currentRoomId: string | null

    setConnectionStatus: (status: ConnectionStatus) => void
    setCurrentRoomId: (roomId: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
    connectionStatus: 'disconnected',
    currentRoomId: null,

    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
}))
