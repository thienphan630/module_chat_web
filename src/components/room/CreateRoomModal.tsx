import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, Search, MessageSquare, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { distributeRoomKey } from '../../services/e2ee-key-manager'
import { useQueryClient } from '@tanstack/react-query'
import type { UserSearchResult } from '../../types/chat.types'

interface CreateRoomModalProps {
    isOpen: boolean
    onClose: () => void
}

export const CreateRoomModal = ({ isOpen, onClose }: CreateRoomModalProps) => {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserSearchResult[]>([])
    const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([])
    const [groupName, setGroupName] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState('')
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const queryClient = useQueryClient()
    const currentUserId = useChatStore(s => s.currentUserId)

    // Auto-detect mode
    const isGroupMode = selectedUsers.length >= 2

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) resetForm()
    }, [isOpen])

    // Debounced search
    const executeSearch = useCallback(async (searchQuery: string) => {
        const q = searchQuery.trim()
        if (!q || q.length < 2) { setResults([]); return }

        setIsSearching(true)
        try {
            const users = await api.searchUsers(q)
            const excludeIds = new Set([currentUserId, ...selectedUsers.map(u => u.user_id)])
            setResults(users.filter(u => !excludeIds.has(u.user_id)))
        } catch {
            setResults([])
        } finally {
            setIsSearching(false)
        }
    }, [currentUserId, selectedUsers])

    // Debounce effect — 300ms after typing stops
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        const q = query.trim()
        if (!q || q.length < 2) { setResults([]); return }

        searchTimerRef.current = setTimeout(() => executeSearch(query), 300)
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
    }, [query, executeSearch])

    if (!isOpen) return null

    const toggleUser = (user: UserSearchResult) => {
        setSelectedUsers(prev => {
            const exists = prev.some(u => u.user_id === user.user_id)
            if (exists) return prev.filter(u => u.user_id !== user.user_id)
            return [...prev, user]
        })
        // Remove from visible results after selecting
        setResults(prev => prev.filter(u => u.user_id !== user.user_id))
    }

    const removeUser = (userId: string) => {
        setSelectedUsers(prev => prev.filter(u => u.user_id !== userId))
    }

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return
        setIsCreating(true)
        setError('')

        try {
            const memberIds = selectedUsers.map(u => u.user_id)

            // Safety net: block self-chat
            if (memberIds.includes(currentUserId)) {
                setError('Không thể tạo chat với chính mình')
                setIsCreating(false)
                return
            }

            const result = await api.createRoom({
                name: isGroupMode ? groupName : `DM-${memberIds[0]}`,
                type: isGroupMode ? 'group' : 'direct',
                member_ids: memberIds,
            })

            // E2EE: distribute room key to all members
            const allMemberIds = [currentUserId, ...memberIds]
            await distributeRoomKey(result.room.room_id, allMemberIds)

            // Refresh room list + navigate
            await queryClient.invalidateQueries({ queryKey: ['my-rooms'] })
            useChatStore.getState().setCurrentRoomId(result.room.room_id)

            handleClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Không thể tạo phòng')
        } finally {
            setIsCreating(false)
        }
    }

    const resetForm = () => {
        setQuery('')
        setResults([])
        setSelectedUsers([])
        setGroupName('')
        setIsSearching(false)
        setError('')
    }

    const handleClose = () => {
        onClose()
        resetForm()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
            executeSearch(query)
        }
    }

    const canCreate = selectedUsers.length > 0 && (!isGroupMode || groupName.trim().length > 0)

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-zinc-100">Tạo trò chuyện mới</h3>
                    <button onClick={handleClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
                        <X size={18} />
                    </button>
                </div>

                {/* Search input */}
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tìm theo tên hoặc email..."
                        className="w-full pl-10 pr-10 py-2.5 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm"
                        autoFocus
                    />
                    {isSearching && (
                        <Loader2 size={14} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    )}
                </div>

                {/* Search results */}
                {(results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
                    <div className="max-h-48 overflow-y-auto space-y-0.5 mb-3 scrollbar-thin">
                        {results.length === 0 ? (
                            <p className="text-zinc-500 text-xs text-center py-4">Không tìm thấy người dùng.</p>
                        ) : (
                            results.map(user => (
                                <button
                                    key={user.user_id}
                                    onClick={() => toggleUser(user)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800 transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0">
                                        <span className="text-zinc-400 font-medium text-xs">
                                            {user.username?.charAt(0).toUpperCase() || '?'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-200 truncate">{user.username}</p>
                                        <p className="text-xs text-zinc-500 truncate">{user.email || user.user_id}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                    <div className="mb-3">
                        <p className="text-xs text-zinc-500 mb-1.5">Đã chọn ({selectedUsers.length}):</p>
                        <div className="flex flex-wrap gap-1.5">
                            {selectedUsers.map(u => (
                                <span key={u.user_id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg animate-fade-in">
                                    {u.username}
                                    <button onClick={() => removeUser(u.user_id)} className="hover:text-red-400 transition-colors">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Group name (auto-shown when >= 2 users) */}
                {isGroupMode && (
                    <input
                        type="text"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="Tên nhóm..."
                        className="w-full px-4 py-2.5 mb-3 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm animate-fade-in"
                    />
                )}

                {/* Error */}
                {error && (
                    <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                        {error}
                    </div>
                )}

                {/* Create button */}
                <button
                    onClick={handleCreate}
                    disabled={!canCreate || isCreating}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {isCreating ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang tạo...</>
                    ) : isGroupMode ? (
                        <><Users size={16} /> Tạo Nhóm ({selectedUsers.length} người)</>
                    ) : selectedUsers.length === 1 ? (
                        <><MessageSquare size={16} /> Tạo Chat</>
                    ) : (
                        'Chọn người để bắt đầu'
                    )}
                </button>
            </div>
        </div>
    )
}
