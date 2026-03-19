import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { distributeRoomKey } from '../../services/e2ee-key-manager'
import { UserSearchModal } from './UserSearchModal'
import { X, ShieldAlert, UserPlus, LogOut, Loader2, Crown, User } from 'lucide-react'

interface RoomDetailPanelProps {
    roomId: string
    isOpen: boolean
    onClose: () => void
}

export const RoomDetailPanel = ({ roomId, isOpen, onClose }: RoomDetailPanelProps) => {
    const [showInvite, setShowInvite] = useState(false)
    const [isInviting, setIsInviting] = useState(false)
    const [isLeaving, setIsLeaving] = useState(false)
    const currentUserId = useChatStore(s => s.currentUserId)
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['room-detail', roomId],
        queryFn: () => api.getRoomDetail(roomId),
        enabled: isOpen,
    })

    if (!isOpen) return null

    const room = data?.room
    const members = data?.members || []
    const myMembership = members.find(m => m.room_id === roomId) // Depends on API shape
    const isAdmin = myMembership?.role === 'admin'

    const handleInvite = async (users: { user_id: string }[]) => {
        setIsInviting(true)
        try {
            const userIds = users.map(u => u.user_id)
            await api.inviteMembers(roomId, { user_ids: userIds })

            // E2EE: distribute room key to newly invited members
            await distributeRoomKey(roomId, userIds)

            // Refresh detail
            await queryClient.invalidateQueries({ queryKey: ['room-detail', roomId] })
        } catch (err) {
            console.error('Invite failed:', err)
        } finally {
            setIsInviting(false)
            setShowInvite(false)
        }
    }

    const handleLeave = async () => {
        if (!confirm('Rời khỏi nhóm này? Bạn sẽ mất quyền truy cập tin nhắn trong nhóm.')) return
        setIsLeaving(true)
        try {
            await api.removeMember(roomId, currentUserId)
            useChatStore.getState().setCurrentRoomId(null)
            await queryClient.invalidateQueries({ queryKey: ['my-rooms'] })
            onClose()
        } catch (err) {
            console.error('Leave failed:', err)
        } finally {
            setIsLeaving(false)
        }
    }

    return (
        <>
            <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-zinc-100">Thông tin</h3>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
                        <X size={18} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-zinc-500" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        {/* Room info */}
                        <div className="p-4 border-b border-zinc-800">
                            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl text-zinc-400 font-bold">
                                    {room?.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                            <h4 className="text-center text-zinc-100 font-semibold text-lg">{room?.name || roomId}</h4>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-zinc-800 text-emerald-400 text-xs rounded uppercase font-medium flex items-center gap-1">
                                    <ShieldAlert size={10} /> Bảo mật
                                </span>
                                <span className="text-xs text-zinc-500">
                                    {room?.type === 'direct' ? 'Cá nhân' : 'Nhóm'}
                                </span>
                            </div>
                        </div>

                        {/* Members */}
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
                                    Thành viên ({members.length})
                                </h5>
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowInvite(true)}
                                        disabled={isInviting}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors"
                                    >
                                        <UserPlus size={12} />
                                        Thêm người
                                    </button>
                                )}
                            </div>

                            <ul className="space-y-1">
                                {members.map((member, idx) => (
                                    <li key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                            {member.role === 'admin'
                                                ? <Crown size={14} className="text-yellow-500" />
                                                : <User size={14} className="text-zinc-500" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-zinc-200 truncate">{member.room_name || member.room_id}</p>
                                            <p className="text-xs text-zinc-500">{member.role}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Footer actions */}
                <div className="p-4 border-t border-zinc-800">
                    <button
                        onClick={handleLeave}
                        disabled={isLeaving}
                        className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {isLeaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                        {isLeaving ? 'Đang rời...' : 'Rời hợi thoại'}
                    </button>
                </div>
            </div>

            <UserSearchModal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                onSelect={handleInvite}
                multiSelect
                title="Mời Thành Viên"
            />
        </>
    )
}
