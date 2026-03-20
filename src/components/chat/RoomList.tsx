import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { socketService } from '../../services/SocketService'
import { Plus, MessageSquarePlus } from 'lucide-react'
import { CreateRoomModal } from '../room/CreateRoomModal'
import { Avatar } from '../ui/Avatar'
import { ConnectionBadge } from '../ui/ConnectionBadge'
import { RoomSkeleton } from '../ui/Skeleton'
import { UserProfileCard } from './UserProfileCard'

export const RoomList = () => {
    const { currentRoomId, setCurrentRoomId } = useChatStore()
    const [showCreateRoom, setShowCreateRoom] = useState(false)

    const { data: rooms, isLoading } = useQuery({
        queryKey: ['my-rooms'],
        queryFn: api.getMyRooms,
        refetchInterval: 10000, // Poll every 10s to discover new rooms since backend doesn't broadcast 'room_invited'
    })

    const handleJoinRoom = (roomId: string) => {
        if (currentRoomId === roomId) return
        if (currentRoomId) {
            socketService.sendPayload({ type: 'leave', room_id: currentRoomId })
        }
        setCurrentRoomId(roomId)
        socketService.sendPayload({ type: 'join', room_id: roomId })
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
                ) : !rooms || rooms.length === 0 ? (
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
                        {rooms.map((room, idx) => (
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
                                    <Avatar userId={room.room_id} name={room.room_name} size="lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h3 className="font-medium text-zinc-200 truncate pr-2 text-sm">
                                                {room.room_name || room.room_id}
                                            </h3>
                                            <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-md font-medium ${
                                                room.room_type === 'direct'
                                                    ? 'text-blue-400 bg-blue-500/10'
                                                    : 'text-purple-400 bg-purple-500/10'
                                            }`}>
                                                {room.room_type === 'direct' ? 'Cá nhân' : 'Nhóm'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 truncate">
                                            🔒 E2EE • {room.role}
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
