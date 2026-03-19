import { useState, useEffect, useCallback, useRef } from 'react'
import { X, UserPlus, Loader2, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { UserSearchResult } from '../../types/chat.types'

interface UserSearchModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (users: UserSearchResult[]) => void
    multiSelect?: boolean
    title?: string
}

export const UserSearchModal = ({
    isOpen,
    onClose,
    onSelect,
    multiSelect = false,
    title = 'Tìm Người Dùng'
}: UserSearchModalProps) => {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserSearchResult[]>([])
    const [selected, setSelected] = useState<UserSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState('')
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setResults([])
            setSelected([])
            setSearchError('')
        }
    }, [isOpen])

    // Debounced search — auto search after 300ms of typing
    const executeSearch = useCallback(async (searchQuery: string) => {
        const q = searchQuery.trim()
        if (!q || q.length < 2) {
            setResults([])
            setSearchError('')
            return
        }

        setIsSearching(true)
        setSearchError('')
        try {
            const users = await api.searchUsers(q)
            setResults(users)
        } catch (err) {
            console.error('Search failed:', err)
            setResults([])
            setSearchError('Không thể tìm kiếm. Vui lòng thử lại.')
        } finally {
            setIsSearching(false)
        }
    }, [])

    // Debounce effect — triggers search 300ms after typing stops
    useEffect(() => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
        }

        const q = query.trim()
        if (!q) {
            setResults([])
            setSearchError('')
            return
        }

        if (q.length < 2) return

        searchTimerRef.current = setTimeout(() => {
            executeSearch(query)
        }, 300)

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current)
            }
        }
    }, [query, executeSearch])

    if (!isOpen) return null

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            // Immediate search on Enter (bypass debounce)
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current)
            }
            executeSearch(query)
        }
    }

    const toggleUser = (user: UserSearchResult) => {
        if (multiSelect) {
            setSelected(prev =>
                prev.some(u => u.user_id === user.user_id)
                    ? prev.filter(u => u.user_id !== user.user_id)
                    : [...prev, user]
            )
        } else {
            onSelect([user])
            onClose()
        }
    }

    const handleConfirm = () => {
        if (selected.length > 0) {
            onSelect(selected)
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                        <UserPlus size={20} className="text-emerald-400" />
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
                        <X size={18} />
                    </button>
                </div>

                {/* Search input with inline spinner */}
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập tên hoặc email..."
                            className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm pr-10"
                            autoFocus
                        />
                        {isSearching && (
                            <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        )}
                    </div>
                    <button
                        onClick={() => executeSearch(query)}
                        disabled={!query.trim() || query.trim().length < 2 || isSearching}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        <Search size={16} />
                    </button>
                </div>

                {/* Error message */}
                {searchError && (
                    <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                        {searchError}
                    </div>
                )}

                {/* Results */}
                <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
                    {results.length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-8">
                            {isSearching
                                ? 'Đang tìm kiếm...'
                                : query.trim().length >= 2
                                    ? 'Không tìm thấy người dùng.'
                                    : 'Nhập ít nhất 2 ký tự để tìm.'}
                        </p>
                    ) : (
                        results.map(user => {
                            const isSelected = selected.some(u => u.user_id === user.user_id)
                            return (
                                <button
                                    key={user.user_id}
                                    onClick={() => toggleUser(user)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                                        isSelected
                                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                                            : 'hover:bg-zinc-800 border border-transparent'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                        <span className="text-zinc-400 font-medium text-sm">
                                            {user.username?.charAt(0).toUpperCase() || '?'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-200 truncate">{user.username}</p>
                                        <p className="text-xs text-zinc-500 truncate">{user.email || user.user_id}</p>
                                    </div>
                                    {multiSelect && isSelected && (
                                        <span className="text-emerald-400 text-xs font-medium">✓</span>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>

                {/* Selected chips + confirm (multi-select) */}
                {multiSelect && (
                    <div>
                        {selected.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {selected.map(u => (
                                    <span
                                        key={u.user_id}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg"
                                    >
                                        {u.username}
                                        <button onClick={() => toggleUser(u)} className="hover:text-red-400">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={selected.length === 0}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                            Lưu ({selected.length}) người
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
