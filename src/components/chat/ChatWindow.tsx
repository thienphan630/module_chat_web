import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../utils/db'
import { GapMarker } from './GapMarker'
import { MessageBubble } from './MessageBubble'
import { InputArea } from './InputArea'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

export const ChatWindow = ({ roomId }: { roomId: string }) => {
    const bottomRef = useRef<HTMLDivElement>(null)

    const messages = useLiveQuery(
        () => db.messages.where('[room_id+server_ts]').between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]).sortBy('server_ts'),
        [roomId],
        []
    )

    // Scroll to bottom mechanism 
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages.length])

    if (!roomId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
                <ShieldAlert size={48} className="mb-4 text-zinc-800" />
                <h3 className="text-xl">Select a conversation</h3>
                <p>E2EE Chats are secured and synced instantly.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-zinc-950">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-zinc-100">Room: {roomId}</h2>
                    <span className="px-2 py-1 bg-zinc-800 text-emerald-400 text-xs rounded uppercase font-semibold flex items-center gap-1"><ShieldAlert size={12} /> E2EE secured</span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {messages.length === 0 ? (
                    <div className="text-center text-zinc-500 italic mt-8">No messages yet. Send the first encrypted message!</div>
                ) : (
                    messages.map((msg, index) => {
                        const prevMsg = messages[index - 1]

                        // Fake Gap logic: if diff is > 2000 ms, render a Gap. 
                        // In reality, this detects if there is missing data between synced markers from DB.
                        const timeDiff = prevMsg ? msg.server_ts - prevMsg.server_ts : 0
                        const hasFakeGap = prevMsg && timeDiff > 1000 * 60 * 60 * 2 // a 2-hour gap simulating missing sync gap

                        return (
                            <div key={msg.message_id}>
                                {hasFakeGap && (
                                    <GapMarker
                                        roomId={roomId}
                                        fromTs={prevMsg!.server_ts}
                                        toTs={msg.server_ts}
                                    />
                                )}
                                <MessageBubble data={msg} />
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input Form */}
            <InputArea roomId={roomId} />
        </div>
    )
}
