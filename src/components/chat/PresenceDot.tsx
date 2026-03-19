import { useChatStore } from '../../store/chatStore'

interface PresenceDotProps {
    userId: string
    size?: number
}

export const PresenceDot = ({ userId, size = 10 }: PresenceDotProps) => {
    const status = useChatStore(s => s.presenceMap[userId])

    return (
        <span
            className={`inline-block rounded-full border-2 border-zinc-950 ${
                status === 'online'
                    ? 'bg-emerald-400'
                    : 'bg-zinc-600'
            }`}
            style={{ width: size, height: size }}
            title={status || 'offline'}
        />
    )
}
