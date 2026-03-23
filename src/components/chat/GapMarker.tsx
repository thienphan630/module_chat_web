import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { insertMessages } from '../../utils/db'
import { LoaderCircle, AlertCircle } from 'lucide-react'
import type { ChatMessage } from '../../types/chat.types'

export const GapMarker = ({ roomId, fromTs }: { roomId: string, fromTs: number, toTs: number }) => {
    const markerRef = useRef<HTMLDivElement>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(false)
    const hasFetched = useRef(false)

    const fetchGapMessages = useCallback(async () => {
        if (isLoading || hasFetched.current) return
        setIsLoading(true)
        setError(false)
        try {
            const res = await api.syncMessages(roomId, { afterServerTs: fromTs }, 50)
            const msgs: ChatMessage[] = res.data || []

            if (msgs.length > 0) {
                await insertMessages(msgs)
            }

            hasFetched.current = true
        } catch (err) {
            console.error('[GapMarker] Failed to fetch gap messages:', err)
            setError(true)
        } finally {
            setIsLoading(false)
        }
    }, [roomId, fromTs, isLoading])

    // IntersectionObserver — auto-fetch when visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasFetched.current) {
                    fetchGapMessages()
                }
            },
            { threshold: 0.1 }
        )
        if (markerRef.current) observer.observe(markerRef.current)
        return () => observer.disconnect()
    }, [fetchGapMessages])

    // Hide after successful fetch
    if (hasFetched.current) return null

    return (
        <div ref={markerRef} className="py-4 my-2 flex justify-center items-center gap-2 border border-zinc-700/50 bg-zinc-800/20 rounded-lg text-zinc-400 text-sm italic">
            {isLoading ? (
                <>
                    <LoaderCircle size={14} className="animate-spin text-zinc-500" />
                    <span>Đang tải tin nhắn...</span>
                </>
            ) : error ? (
                <button onClick={fetchGapMessages} className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
                    <AlertCircle size={14} />
                    <span>Tải lại tin nhắn</span>
                </button>
            ) : (
                <span>Đang tải tin nhắn...</span>
            )}
        </div>
    )
}
