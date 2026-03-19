import { hashToGradient } from '../../utils/color'

interface AvatarProps {
    userId: string
    name?: string
    size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
    sm: { container: 'w-7 h-7', text: 'text-[10px]' },
    md: { container: 'w-10 h-10', text: 'text-sm' },
    lg: { container: 'w-12 h-12', text: 'text-base' },
}

export const Avatar = ({ userId, name, size = 'md' }: AvatarProps) => {
    const label = name || userId
    const initials = label.slice(0, 2).toUpperCase()
    const gradient = hashToGradient(userId)
    const s = sizeMap[size]

    return (
        <div
            className={`${s.container} rounded-full flex items-center justify-center shrink-0 shadow-sm`}
            style={{ background: gradient }}
        >
            <span className={`${s.text} font-semibold text-white/90 select-none`}>
                {initials}
            </span>
        </div>
    )
}
