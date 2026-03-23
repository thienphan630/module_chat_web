import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { Plus, MessageSquarePlus } from 'lucide-react'
import { CreateRoomModal } from '../room/CreateRoomModal'
import { Avatar } from '../ui/Avatar'
import { ConnectionBadge } from '../ui/ConnectionBadge'
import { RoomSkeleton } from '../ui/Skeleton'
import { UserProfileCard } from './UserProfileCard'

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'vừa xong'
    if (mins < 60) return `${mins}p`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export const RoomList = () => {
    const { currentRoomId, setCurrentRoomId } = useChatStore()
    const [showCreateRoom, setShowCreateRoom] = useState(false)

    const { data: rooms, isLoading } = useQuery({
        queryKey: ['my-rooms'],
        queryFn: api.getMyRooms,
        refetchInterval: 10000,
    })

    // Sort rooms: latest message activity first
    const sortedRooms = useMemo(() => {
        if (!rooms) return []
        return [...rooms].sort((a, b) => {
            const tsA = a.last_message?.server_ts ?? 0
            const tsB = b.last_message?.server_ts ?? 0
            return tsB - tsA
        })
    }, [rooms])

    const handleJoinRoom = (roomId: string) => {
        if (currentRoomId === roomId) return
        setCurrentRoomId(roomId)
    }

    return (
        <div className="w-80 border-r border-zinc-800/50 glass flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-zinc-100">Trò chuyện</h2>
                    <button
                        onClick={() => setShowCreateRoom(true)}
                        title="Tạo nhóm/chát"
                        className="p-2 hover:bg-zinc-800/60 rounded-xl transition-all text-zinc-400 hover:text-emerald-400 active:scale-95"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                <ConnectionBadge />
            </div>

            <CreateRoomModal isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} />

            {/* Room list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-1">
                        <RoomSkeleton />
                        <RoomSkeleton />
                        <RoomSkeleton />
                    </div>
                ) : !sortedRooms || sortedRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center mt-16 px-6">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                            <MessageSquarePlus size={24} className="text-zinc-600" />
                        </div>
                        <p className="text-zinc-400 text-sm font-medium">Chưa có trò chuyện</p>
                        <p className="text-xs mt-1.5 text-zinc-600">
                            Nhấn <span className="text-emerald-400">+</span> để bắt đầu nhắn tin.
                        </p>
                    </div>
                ) : (
                    <ul>
                        {sortedRooms.map((room, idx) => (
                            <li
                                key={room.room_id}
                                onClick={() => handleJoinRoom(room.room_id)}
                                className={`cursor-pointer px-3 py-3 transition-all duration-150 animate-slide-up ${
                                    currentRoomId === room.room_id
                                        ? 'bg-emerald-500/5 border-l-3 border-emerald-500'
                                        : 'border-l-3 border-transparent hover:bg-zinc-800/30'
                                }`}
                                style={{ animationDelay: `${idx * 30}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar userId={room.room_id} name={room.room_name} size="lg" />
                                        {/* Unread dot */}
                                        {room.unread_count > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900 shadow-lg shadow-emerald-500/20" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h3 className={`font-medium truncate pr-2 text-sm ${
                                                room.unread_count > 0 ? 'text-zinc-100' : 'text-zinc-200'
                                            }`}>
                                                {room.room_name || room.room_id}
                                            </h3>
                                            {room.last_message && (
                                                <span className="text-[10px] text-zinc-600 shrink-0">
                                                    {formatRelativeTime(room.last_message.server_ts)}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-xs truncate ${
                                            room.unread_count > 0 ? 'text-zinc-300 font-medium' : 'text-zinc-500'
                                        }`}>
                                            {room.last_message
                                                ? room.last_message.content
                                                : room.room_type === 'direct' ? 'Cá nhân' : 'Nhóm'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* User profile footer */}
            <UserProfileCard />
        </div>
    )
}
