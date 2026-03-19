import { useChatStore } from '../../store/chatStore'
import { ShieldCheck, Wifi, WifiOff, Loader2 } from 'lucide-react'

export const ConnectionBadge = () => {
    const status = useChatStore(s => s.connectionStatus)

    const config = {
        connected:    { dot: 'bg-emerald-400', text: 'Bảo mật', icon: ShieldCheck, pulse: false },
        connecting:   { dot: 'bg-yellow-400', text: 'Đang kết nối...', icon: Loader2, pulse: true },
        reconnecting: { dot: 'bg-yellow-400', text: 'Đang kết nối lại...', icon: Loader2, pulse: true },
        error:        { dot: 'bg-red-400', text: 'Lỗi kết nối', icon: WifiOff, pulse: false },
        disconnected: { dot: 'bg-zinc-600', text: 'Ngoại tuyến', icon: Wifi, pulse: false },
    }[status]

    const Icon = config.icon

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/50 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
            <Icon size={12} className={`${config.pulse ? 'animate-spin' : ''} ${
                status === 'connected' ? 'text-emerald-400' :
                status === 'error' ? 'text-red-400' : 'text-zinc-400'
            }`} />
            <span className="text-zinc-400">{config.text}</span>
        </div>
    )
}
