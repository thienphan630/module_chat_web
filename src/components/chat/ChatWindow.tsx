import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../utils/db'
import { GapMarker } from './GapMarker'
import { MessageBubble } from './MessageBubble'
import { InputArea } from './InputArea'
import { TypingIndicator } from './TypingIndicator'
import { RoomDetailPanel } from '../room/RoomDetailPanel'
import { Avatar } from '../ui/Avatar'
import { MessageSkeleton } from '../ui/Skeleton'
import { Info, ChevronDown, MessageSquare } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { insertMessages } from '../../utils/db'
import { useChatStore } from '../../store/chatStore'
import type { ChatMessage } from '../../types/chat.types'
import { useMemo } from 'react'

export const ChatWindow = ({ roomId }: { roomId: string }) => {
    const bottomRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const messages = useLiveQuery(
        () => db.messages.where('[room_id+server_ts]').between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]).sortBy('server_ts'),
        [roomId],
        []
    )

    const [isSyncing, setIsSyncing] = useState(false)
    const [hasReachedStart, setHasReachedStart] = useState(false)
    const [showDetail, setShowDetail] = useState(false)
    const [showScrollFab, setShowScrollFab] = useState(false)

    const { data: roomDetail } = useQuery({
        queryKey: ['room-detail', roomId],
        queryFn: () => api.getRoomDetail(roomId),
    })
    const roomName = roomDetail?.room?.name || roomId
    const memberCount = roomDetail?.room?.member_count || 0

    // Fetch members via dedicated paginated API
    const { data: membersData } = useQuery({
        queryKey: ['room-members', roomId],
        queryFn: () => api.fetchRoomMembers(roomId),
    })

    // Build sender_id → username lookup map from room members
    const memberNameMap = useMemo(() => {
        const map: Record<string, string> = {}
        if (membersData?.members) {
            for (const m of membersData.members) {
                if (m.user_id && m.username) {
                    map[m.user_id] = m.username
                }
            }
        }
        return map
    }, [membersData?.members])

    useEffect(() => {
        setHasReachedStart(false)
        setShowDetail(false)
    }, [roomId])

    // Sync messages from server (initial load + incremental forward sync)
    const syncMessages = async () => {
        if (isSyncing) return
        setIsSyncing(true)
        try {
            const newestTs = messages && messages.length > 0
                ? messages[messages.length - 1].server_ts
                : undefined

            const res = await api.syncMessages(
                roomId,
                newestTs ? { afterServerTs: newestTs } : undefined,
                50
            )
            const serverMsgs: ChatMessage[] = res.data || []

            if (serverMsgs.length > 0) {
                await insertMessages(serverMsgs)
            }

            if (!newestTs && serverMsgs.length < 50) {
                setHasReachedStart(true)
            }
        } catch (err) {
            console.error('[Sync] Failed to sync messages:', err)
        } finally {
            setIsSyncing(false)
        }
    }

    // Load older messages: backward pagination from oldest local message
    const loadOlderMessages = async () => {
        if (isSyncing || hasReachedStart) return
        setIsSyncing(true)
        try {
            const oldestTs = messages && messages.length > 0
                ? messages[0].server_ts
                : undefined

            if (!oldestTs) {
                setIsSyncing(false)
                return
            }

            const res = await api.syncMessages(
                roomId,
                { beforeServerTs: oldestTs },
                50
            )
            const serverMsgs: ChatMessage[] = res.data || []

            if (serverMsgs.length > 0) {
                await insertMessages(serverMsgs)
            }
            if (serverMsgs.length < 50) {
                setHasReachedStart(true)
            }
        } catch (err) {
            console.error('[Sync] Failed to load older messages:', err)
        } finally {
            setIsSyncing(false)
        }
    }

    // Sync on room open
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isSyncing) return
        syncMessages()
    }, [roomId])

    // Sync on WS reconnect
    const connectionStatus = useChatStore(s => s.connectionStatus)
    const prevConnectionRef = useRef(connectionStatus)

    useEffect(() => {
        const prev = prevConnectionRef.current
        prevConnectionRef.current = connectionStatus

        if (prev !== 'connected' && connectionStatus === 'connected') {
            syncMessages()
        }
    }, [connectionStatus]) // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => { scrollToBottom() }, [messages.length, scrollToBottom])

    // Show/hide scroll-to-bottom FAB
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current
        if (!container) return
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        setShowScrollFab(distFromBottom > 200)
    }, [])

    // Read receipts — track last sent to avoid duplicate 400s
    const currentUserId = useChatStore(s => s.currentUserId)
    const lastReceiptRef = useRef<Record<string, string>>({})
    useEffect(() => {
        if (messages.length === 0) return
        const lastMsg = messages[messages.length - 1]

        // Skip own messages, already-read messages, and pending/unsent messages
        if (!lastMsg.message_id) return
        if (lastMsg.sender_id === currentUserId) return
        if (lastMsg.status === 'read') return
        if (lastMsg.status === 'pending' || lastMsg.status === 'failed') return

        // Skip if we already sent a receipt for this message in this room
        if (lastReceiptRef.current[roomId] === lastMsg.message_id) return

        const timer = setTimeout(() => {
            lastReceiptRef.current[roomId] = lastMsg.message_id
            api.sendReceipt(roomId, lastMsg.message_id).catch((err) => {
                // Revert so it can retry next time
                delete lastReceiptRef.current[roomId]
                console.warn('[ReadReceipt] Failed to send receipt:', err?.response?.status, err?.response?.data)
            })
        }, 500)
        return () => clearTimeout(timer)
    }, [messages.length, roomId, currentUserId])

    if (!roomId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
                <MessageSquare size={48} className="mb-4 text-zinc-800" />
                <h3 className="text-xl">Chọn một cuộc trò chuyện</h3>
            </div>
        )
    }

    return (
        <div className="flex-1 flex bg-zinc-950">
            <div className="flex-1 flex flex-col animate-fade-in">
                {/* Header */}
                <div className="px-4 py-3 border-b border-zinc-800/50 flex justify-between items-center glass sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Avatar userId={roomId} name={roomName} size="md" />
                        <div>
                            <h2 className="text-base font-semibold text-zinc-100">{roomName}</h2>
                            {memberCount > 0 && (
                                <span className="text-[10px] text-zinc-500">{memberCount} thành viên</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowDetail(!showDetail)}
                        title="Chi tiết Nhóm"
                        className={`p-2 rounded-xl transition-all active:scale-95 ${
                            showDetail
                                ? 'bg-emerald-600/20 text-emerald-400'
                                : 'hover:bg-zinc-800/60 text-zinc-400'
                        }`}
                    >
                        <Info size={18} />
                    </button>
                </div>

                {/* Messages Area */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-4 py-2 flex flex-col relative"
                >
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
                            <p className="text-zinc-400 text-sm font-medium">Chưa có tin nhắn</p>
                            <p className="text-xs text-zinc-600 mt-1">Hãy gửi tin nhắn đầu tiên!</p>
                        </div>
                    ) : (
                        <>
                            {!hasReachedStart && (
                                <div className="flex justify-center mb-4">
                                    {isSyncing ? (
                                        <div className="space-y-2 w-full">
                                            <MessageSkeleton />
                                            <MessageSkeleton />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={loadOlderMessages}
                                            className="px-4 py-2 bg-zinc-800/50 text-zinc-400 rounded-xl text-xs hover:bg-zinc-800 transition-colors"
                                        >
                                            Tải thêm tin nhắn cũ
                                        </button>
                                    )}
                                </div>
                            )}
                            {messages.map((msg, index) => {
                                const prevMsg = messages[index - 1]
                                const timeDiff = prevMsg ? msg.server_ts - prevMsg.server_ts : 0
                                const hasFakeGap = prevMsg && timeDiff > 1000 * 60 * 60 * 2

                                return (
                                    <div key={msg.message_id} className="animate-slide-up">
                                        {hasFakeGap && (
                                            <GapMarker
                                                roomId={roomId}
                                                fromTs={prevMsg!.server_ts}
                                                toTs={msg.server_ts}
                                            />
                                        )}
                                        <MessageBubble data={msg} senderName={memberNameMap[msg.sender_id]} />
                                    </div>
                                )
                            })}
                        </>
                    )}
                    <div ref={bottomRef} className="h-1" />
                </div>

                {/* Scroll-to-bottom FAB */}
                {showScrollFab && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-32 right-6 z-20 p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full shadow-xl text-zinc-300 transition-all animate-slide-up border border-zinc-700/50"
                    >
                        <ChevronDown size={18} />
                    </button>
                )}

                <TypingIndicator roomId={roomId} />
                <InputArea roomId={roomId} />
            </div>

            {/* Room Detail Side Panel */}
            {showDetail && (
                <div className="animate-slide-right">
                    <RoomDetailPanel
                        roomId={roomId}
                        isOpen={showDetail}
                        onClose={() => setShowDetail(false)}
                    />
                </div>
            )}
        </div>
    )
}
