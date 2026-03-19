import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../utils/db'
import { GapMarker } from './GapMarker'
import { MessageBubble } from './MessageBubble'
import { InputArea } from './InputArea'
import { TypingIndicator } from './TypingIndicator'
import { RoomDetailPanel } from '../room/RoomDetailPanel'
import { Avatar } from '../ui/Avatar'
import { MessageSkeleton } from '../ui/Skeleton'
import { ShieldAlert, Info, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { insertMessages, getRoomKey, markDeleted } from '../../utils/db'
import { isRoomKeyMessage, parseRoomKeyAAD, handleIncomingRoomKey } from '../../services/e2ee-key-manager'
import { CryptoClient } from '../../workers/cryptoClient'
import { socketService } from '../../services/SocketService'
import { useChatStore } from '../../store/chatStore'

export const ChatWindow = ({ roomId }: { roomId: string }) => {
    const bottomRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const allMessages = useLiveQuery(
        () => db.messages.where('[room_id+server_ts]').between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]).sortBy('server_ts'),
        [roomId],
        []
    )

    const messages = useMemo(
        () => allMessages.filter(msg => !isRoomKeyMessage(msg.aad_data)),
        [allMessages]
    )

    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [hasReachedStart, setHasReachedStart] = useState(false)
    const [showDetail, setShowDetail] = useState(false)
    const [showScrollFab, setShowScrollFab] = useState(false)

    const { data: roomDetail } = useQuery({
        queryKey: ['room-detail', roomId],
        queryFn: () => api.getRoomDetail(roomId),
    })
    const roomName = roomDetail?.room?.name || roomId
    const memberCount = roomDetail?.members?.length || 0

    useEffect(() => {
        setHasReachedStart(false)
        setShowDetail(false)
    }, [roomId])

    const loadHistory = async () => {
        if (isLoadingHistory) return
        setIsLoadingHistory(true)
        try {
            const oldestMsgId = messages && messages.length > 0 ? messages[0].message_id : undefined
            const res = await api.getHistoricalMessages(roomId, oldestMsgId, 50)
            if (res.messages.length < 50) setHasReachedStart(true)
            if (res.messages.length > 0) {
                // Decrypt and process E2EE keys inside historical messages
                for (const msg of res.messages) {
                    if (isRoomKeyMessage(msg.aad_data)) {
                        const aad = parseRoomKeyAAD(msg.aad_data || '');
                        if (aad && msg.ciphertext) {
                            await handleIncomingRoomKey(
                                roomId,
                                msg.sender_id || 'unknown',
                                msg.ciphertext,
                                aad
                            );
                        }
                    } else if (msg.ciphertext && !msg.text) {
                        try {
                            const roomKey = await getRoomKey(roomId);
                            if (roomKey) {
                                msg.text = await CryptoClient.decryptText(
                                    msg.ciphertext,
                                    roomKey.shared_key
                                );
                            } else {
                                msg.text = '[E2EE key not found]';
                                console.warn(`[E2EE History] No room key for ${roomId} — cannot decrypt`);
                            }
                        } catch (err) {
                            console.error('[E2EE History] Decryption failed:', err);
                            msg.text = '[Decryption failed]';
                        }
                    }

                    // Handle delete tombstones
                    if (msg.aad_data && !isRoomKeyMessage(msg.aad_data)) {
                        try {
                            const aad = JSON.parse(msg.aad_data);
                            if (aad.type === 'm.room.message.delete' && msg.text) {
                                const parsed = JSON.parse(msg.text);
                                if (parsed.target_id) {
                                    await markDeleted(parsed.target_id);
                                    msg.is_deleted = true;
                                }
                            }
                        } catch {}
                    }
                }
                await insertMessages(res.messages);
            }
        } catch (err) {
            console.error('Failed to load history', err)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    // Auto-fetch if local DB is empty upon entering the room
    useEffect(() => {
        if (messages && messages.length === 0 && !hasReachedStart && !isLoadingHistory) {
            loadHistory()
        }
    }, [roomId, messages, hasReachedStart, isLoadingHistory])

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

    // Read receipts
    const currentUserId = useChatStore(s => s.currentUserId)
    useEffect(() => {
        if (messages.length === 0) return
        const lastMsg = messages[messages.length - 1]
        if (lastMsg.sender_id !== currentUserId && lastMsg.status !== 'read') {
            const timer = setTimeout(() => {
                socketService.sendPayload({
                    type: 'read',
                    room_id: roomId,
                    message_id: lastMsg.message_id,
                })
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [messages.length, roomId, currentUserId])

    if (!roomId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
                <ShieldAlert size={48} className="mb-4 text-zinc-800" />
                <h3 className="text-xl">Chọn một cuộc trò chuyện</h3>
                <p>Nhắn tin an toàn qua mã hóa bảo mật.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex bg-zinc-950">
            <div className="flex-1 flex flex-col animate-fade-in">
                {/* Header — glass */}
                <div className="px-4 py-3 border-b border-zinc-800/50 flex justify-between items-center glass sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Avatar userId={roomId} name={roomName} size="md" />
                        <div>
                            <h2 className="text-base font-semibold text-zinc-100">{roomName}</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-0.5">
                                    <ShieldAlert size={10} /> Bảo mật
                                </span>
                                {memberCount > 0 && (
                                    <span className="text-[10px] text-zinc-500">{memberCount} thành viên</span>
                                )}
                            </div>
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
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/5 flex items-center justify-center mb-3">
                                <ShieldAlert size={24} className="text-emerald-600" />
                            </div>
                            <p className="text-zinc-400 text-sm font-medium">Chưa có tin nhắn</p>
                            <p className="text-xs text-zinc-600 mt-1">Hãy gửi tin nhắn đầu tiên!</p>
                        </div>
                    ) : (
                        <>
                            {!hasReachedStart && (
                                <div className="flex justify-center mb-4">
                                    {isLoadingHistory ? (
                                        <div className="space-y-2 w-full">
                                            <MessageSkeleton />
                                            <MessageSkeleton />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={loadHistory}
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
                                        <MessageBubble data={msg} />
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
