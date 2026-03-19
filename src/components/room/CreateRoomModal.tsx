import { useState } from 'react'
import { X, MessageSquare, Users, Loader2 } from 'lucide-react'
import { UserSearchModal } from './UserSearchModal'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { distributeRoomKey } from '../../services/e2ee-key-manager'
import { useQueryClient } from '@tanstack/react-query'
import type { UserSearchResult } from '../../types/chat.types'

interface CreateRoomModalProps {
    isOpen: boolean
    onClose: () => void
}

type RoomMode = 'dm' | 'group'

export const CreateRoomModal = ({ isOpen, onClose }: CreateRoomModalProps) => {
    const [mode, setMode] = useState<RoomMode>('dm')
    const [groupName, setGroupName] = useState('')
    const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([])
    const [showUserSearch, setShowUserSearch] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState('')
    const queryClient = useQueryClient()
    const currentUserId = useChatStore(s => s.currentUserId)

    if (!isOpen) return null

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return

        setIsCreating(true)
        setError('')

        try {
            const memberIds = selectedUsers.map(u => u.user_id)

            const result = await api.createRoom({
                name: mode === 'group' ? groupName : `DM-${memberIds[0]}`,
                type: mode === 'group' ? 'group' : 'direct',
                member_ids: memberIds,
            })

            // E2EE: distribute room key to all members
            const allMemberIds = [currentUserId, ...memberIds]
            await distributeRoomKey(result.room.room_id, allMemberIds)

            // Refresh room list + navigate to new room
            await queryClient.invalidateQueries({ queryKey: ['my-rooms'] })
            useChatStore.getState().setCurrentRoomId(result.room.room_id)

            onClose()
            resetForm()
        } catch (err: any) {
            setError(err.message || 'Failed to create room')
        } finally {
            setIsCreating(false)
        }
    }

    const resetForm = () => {
        setMode('dm')
        setGroupName('')
        setSelectedUsers([])
        setError('')
    }

    const handleClose = () => {
        onClose()
        resetForm()
    }

    return (
        <>
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-semibold text-zinc-100">New Conversation</h3>
                        <button onClick={handleClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-5">
                        <button
                            onClick={() => { setMode('dm'); setSelectedUsers([]) }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                mode === 'dm'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                        >
                            <MessageSquare size={16} />
                            Direct Message
                        </button>
                        <button
                            onClick={() => { setMode('group'); setSelectedUsers([]) }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                mode === 'group'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                        >
                            <Users size={16} />
                            Group Chat
                        </button>
                    </div>

                    {/* Group name (group mode only) */}
                    {mode === 'group' && (
                        <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Group name"
                            className="w-full px-4 py-2.5 mb-4 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm"
                        />
                    )}

                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs text-zinc-500 mb-2">Selected members:</p>
                            <div className="flex flex-wrap gap-1">
                                {selectedUsers.map(u => (
                                    <span
                                        key={u.user_id}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg"
                                    >
                                        {u.username}
                                        <button
                                            onClick={() => setSelectedUsers(prev => prev.filter(x => x.user_id !== u.user_id))}
                                            className="hover:text-red-400"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add members button */}
                    <button
                        onClick={() => setShowUserSearch(true)}
                        className="w-full py-2.5 mb-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Users size={16} />
                        {selectedUsers.length > 0 ? 'Add more members' : 'Select members'}
                    </button>

                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Create button */}
                    <button
                        onClick={handleCreate}
                        disabled={
                            isCreating ||
                            selectedUsers.length === 0 ||
                            (mode === 'group' && !groupName.trim())
                        }
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isCreating ? 'Creating...' : `Create ${mode === 'dm' ? 'DM' : 'Group'}`}
                    </button>
                </div>
            </div>

            {/* Nested UserSearch modal */}
            <UserSearchModal
                isOpen={showUserSearch}
                onClose={() => setShowUserSearch(false)}
                onSelect={(users) => {
                    setSelectedUsers(prev => {
                        const existing = new Set(prev.map(u => u.user_id))
                        const newUsers = users.filter(u => !existing.has(u.user_id))
                        return [...prev, ...newUsers]
                    })
                }}
                multiSelect={mode === 'group'}
                title={mode === 'dm' ? 'Select User' : 'Add Members'}
            />
        </>
    )
}
