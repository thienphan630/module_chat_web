import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../utils/db'
import { GapMarker } from './GapMarker'
import { MessageBubble } from './MessageBubble'
import { InputArea } from './InputArea'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { insertMessages } from '../../utils/db'

export const ChatWindow = ({ roomId }: { roomId: string }) => {
    const bottomRef = useRef<HTMLDivElement>(null)

    const messages = useLiveQuery(
        () => db.messages.where('[room_id+server_ts]').between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]).sortBy('server_ts'),
        [roomId],
        []
    )

    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [hasReachedStart, setHasReachedStart] = useState(false)

    // Reset pagination state when changing room
    useEffect(() => {
        setHasReachedStart(false)
    }, [roomId])

    const loadHistory = async () => {
        if (!messages || messages.length === 0) return;
        setIsLoadingHistory(true);
        try {
            const oldestMsgId = messages[0].message_id;
            const res = await api.getHistoricalMessages(roomId, oldestMsgId, 50);
            
            if (res.messages.length < 50) {
                setHasReachedStart(true);
            }
            
            if (res.messages.length > 0) {
                // In a real flow, you decrypt `ciphertext` here via CryptoClient before inserting
                await insertMessages(res.messages);
            }
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setIsLoadingHistory(false);
        }
    }

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
                    <>
                        {!hasReachedStart && (
                            <div className="flex justify-center mb-4">
                                <button 
                                    onClick={loadHistory}
                                    disabled={isLoadingHistory}
                                    className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoadingHistory ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isLoadingHistory ? 'Loading history...' : 'Load older messages'}
                                </button>
                            </div>
                        )}
                        {messages.map((msg, index) => {
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
                    })}
                    </>
                )}
                <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input Form */}
            <InputArea roomId={roomId} />
        </div>
    )
}
