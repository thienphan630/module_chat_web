import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useChatStore } from '../store/chatStore'
import { socketService } from '../services/SocketService'
import { api } from '../lib/api'

/**
 * Auto-join ALL rooms the user belongs to when WebSocket connects.
 *
 * Why: Server only broadcasts messages to clients that sent `{ type: "join" }`.
 * Without this, user only receives messages from the currently active room.
 *
 * Re-joins on reconnect automatically via connectionStatus dependency.
 */
export function useAutoJoinRooms() {
    const connectionStatus = useChatStore(s => s.connectionStatus)
    const joinedRef = useRef<Set<string>>(new Set())

    const { data: rooms } = useQuery({
        queryKey: ['my-rooms'],
        queryFn: api.getMyRooms,
        refetchInterval: 10000,
    })

    useEffect(() => {
        if (connectionStatus !== 'connected' || !rooms || rooms.length === 0) {
            // Reset joined set on disconnect so we re-join on reconnect
            if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
                joinedRef.current.clear()
            }
            return
        }

        for (const room of rooms) {
            if (!joinedRef.current.has(room.room_id)) {
                socketService.sendPayload({ type: 'join', room_id: room.room_id })
                joinedRef.current.add(room.room_id)
            }
        }
    }, [connectionStatus, rooms])
}
