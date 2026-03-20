import { useChatStore } from '../../store/chatStore'
import { socketService } from '../../services/SocketService'
import { Avatar } from '../ui/Avatar'
import { LogOut, Shield } from 'lucide-react'

export const UserProfileCard = () => {
    const currentUserId = useChatStore((state) => state.currentUserId)
    const userEmail = useChatStore((state) => state.userEmail)
    const userName = useChatStore((state) => state.userName)

    const handleLogout = () => {
        socketService.disconnect()
        useChatStore.getState().clearAuth()
    }

    const displayName = userName || userEmail?.split('@')[0] || currentUserId
    const shortId = currentUserId.length > 12
        ? `${currentUserId.slice(0, 6)}...${currentUserId.slice(-4)}`
        : currentUserId

    return (
        <div className="p-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-3 group">
                {/* Avatar with online indicator */}
                <div className="relative">
                    <Avatar userId={currentUserId} name={displayName} size="md" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-zinc-900 shadow-lg shadow-emerald-500/20" />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-zinc-200 truncate">
                            {displayName}
                        </p>
                        <Shield size={12} className="text-emerald-500/60 shrink-0" />
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate" title={userEmail || shortId}>
                        {userEmail || shortId}
                    </p>
                </div>

                {/* Logout button */}
                <button
                    onClick={handleLogout}
                    title="Đăng xuất"
                    className="p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all duration-200 active:scale-95 shrink-0"
                >
                    <LogOut size={15} />
                </button>
            </div>
        </div>
    )
}
