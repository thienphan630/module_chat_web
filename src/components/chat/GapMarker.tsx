import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoaderCircle } from 'lucide-react'

export const GapMarker = ({ roomId, fromTs, toTs }: { roomId: string, fromTs: number, toTs: number }) => {
    const markerRef = useRef<HTMLDivElement>(null)
    const queryClient = useQueryClient()

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    console.log(`Gap detected! Firing sync between ${fromTs} -> ${toTs}`)

                    // Actually handle sync API call here...
                    api.syncMessages(roomId, fromTs).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['messages', roomId] })
                    })
                }
            },
            { threshold: 0 }
        )

        if (markerRef.current) {
            observer.observe(markerRef.current)
        }

        return () => observer.disconnect()
    }, [roomId, fromTs, toTs, queryClient])

    return (
        <div ref={markerRef} className="py-4 my-2 flex justify-center items-center gap-2 border border-zinc-700/50 bg-zinc-800/20 rounded-lg text-zinc-400 text-sm italic">
            <LoaderCircle size={14} className="animate-spin text-zinc-500" />
            <span>Loading older messages...</span>
        </div>
    )
}
