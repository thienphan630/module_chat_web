import { useChatStore } from '../../store/chatStore'

const EMPTY_ARRAY: string[] = []

export const TypingIndicator = ({ roomId }: { roomId: string }) => {
    const typingUsers = useChatStore(s => s.typingUsers[roomId] ?? EMPTY_ARRAY)
    const currentUserId = useChatStore(s => s.currentUserId)

    // Filter out self
    const others = typingUsers.filter(id => id !== currentUserId)

    if (others.length === 0) return null

    const text =
        others.length === 1
            ? `${others[0]} đang gõ...`
            : `${others.slice(0, 2).join(', ')} ${others.length > 2 ? `+${others.length - 2}` : ''} đang gõ...`

    return (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400">
            <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{text}</span>
        </div>
    )
}
