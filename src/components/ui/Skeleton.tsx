interface SkeletonProps {
    className?: string
    count?: number
}

export const Skeleton = ({ className = '', count = 1 }: SkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`animate-pulse bg-zinc-800/60 rounded-xl ${className}`}
                />
            ))}
        </>
    )
}

export const MessageSkeleton = () => (
    <div className="flex gap-3 p-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-zinc-800/60 shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-3 bg-zinc-800/60 rounded-lg w-24" />
            <div className="h-4 bg-zinc-800/60 rounded-lg w-3/4" />
            <div className="h-4 bg-zinc-800/60 rounded-lg w-1/2" />
        </div>
    </div>
)

export const RoomSkeleton = () => (
    <div className="flex items-center gap-3 p-4 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-zinc-800/60 shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-800/60 rounded-lg w-32" />
            <div className="h-3 bg-zinc-800/60 rounded-lg w-20" />
        </div>
    </div>
)
