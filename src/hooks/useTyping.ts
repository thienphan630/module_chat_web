import { useRef, useCallback } from 'react'
import { socketService } from '../services/SocketService'

/**
 * Hook that emits debounced typing/typing_stop WS events.
 * Usage: call emitTyping() on every keystroke in InputArea.
 */
export function useTyping(roomId: string) {
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isTypingRef = useRef(false)

    const emitTyping = useCallback(() => {
        if (!roomId) return

        // Send 'typing' event if not already flagged
        if (!isTypingRef.current) {
            isTypingRef.current = true
            socketService.sendPayload({ type: 'typing', room_id: roomId, is_typing: true })
        }

        // Reset the stop timer
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Auto-send typing stop after 3s of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false
            socketService.sendPayload({ type: 'typing', room_id: roomId, is_typing: false })
        }, 3000)
    }, [roomId])

    return { emitTyping }
}
