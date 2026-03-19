import { useState } from 'react'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { socketService } from '../../services/SocketService'
import { Loader2, ShieldCheck } from 'lucide-react'

interface LoginFormProps {
    onSwitchToRegister: () => void
}

export const LoginForm = ({ onSwitchToRegister }: LoginFormProps) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const data = await api.login({ email, password })

            // Store tokens + user info
            useChatStore.getState().setTokens(data.access_token, data.refresh_token)
            useChatStore.getState().setCurrentUserId(data.user_id)
            localStorage.setItem('userId', data.user_id)

            // Initialize E2EE keys (generate + upload if first time)
            await useChatStore.getState().initializeE2EEKeys()

            // Connect WebSocket with fresh token
            socketService.connect(data.access_token)
        } catch (err: any) {
            setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
                    <ShieldCheck size={32} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-100">Chào mừng trở lại</h1>
                <p className="text-zinc-500 text-sm mt-1">Đăng nhập để vào trò chuyện</p>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Địa chỉ Email"
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-zinc-800/80 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition disabled:opacity-50"
                />
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mật khẩu"
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-zinc-800/80 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition disabled:opacity-50"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading || !email.trim() || !password.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>

            <p className="text-center text-zinc-500 text-sm">
                Chưa có tài khoản?{' '}
                <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                    Tạo mới ngay
                </button>
            </p>
        </form>
    )
}
