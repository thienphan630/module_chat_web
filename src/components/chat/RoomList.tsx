import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { socketService } from '../../services/SocketService'
import { LogOut } from 'lucide-react'

export const RoomList = () => {
    const { currentRoomId, setCurrentRoomId } = useChatStore()

    const { data: rooms, isLoading } = useQuery({
        queryKey: ['rooms'],
        queryFn: api.getRooms
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
        <div className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-zinc-100">Messages</h2>
                <button title="Logout" className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400">
                    <LogOut size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 text-zinc-500 text-sm">Loading rooms...</div>
                ) : (
                    <ul className="divide-y divide-zinc-800/50">
                        {rooms?.map(room => (
                            <li
                                key={room.id}
                                onClick={() => handleJoinRoom(room.id)}
                                className={`cursor-pointer p-4 transition-colors hover:bg-zinc-900 ${currentRoomId === room.id ? 'bg-zinc-900/80 border-l-4 border-emerald-500' : 'border-l-4 border-transparent'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                        {room.avatarUrl ? (
                                            <img src={room.avatarUrl} alt={room.name} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <span className="text-zinc-400 font-medium">
                                                {room.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-medium text-zinc-200 truncate pr-2">{room.name}</h3>
                                        </div>
                                        <p className="text-sm text-zinc-500 truncate">{room.lastMessagePreview}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
