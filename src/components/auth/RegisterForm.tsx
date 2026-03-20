import { useState } from 'react'
import { api } from '../../lib/api'
import { useChatStore } from '../../store/chatStore'
import { socketService } from '../../services/SocketService'
import { Loader2, UserPlus } from 'lucide-react'

interface RegisterFormProps {
    onSwitchToLogin: () => void
}

export const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const data = await api.register({ username, email, password })

            // Store tokens + user info
            useChatStore.getState().setTokens(data.access_token, data.refresh_token)
            useChatStore.getState().setCurrentUserId(data.user_id)
            useChatStore.getState().setUserProfile(email, username)
            localStorage.setItem('userId', data.user_id)

            // Initialize E2EE keys (generate + upload on first registration)
            await useChatStore.getState().initializeE2EEKeys()

            // Connect WebSocket
            socketService.connect(data.access_token)
        } catch (err: any) {
            setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
                    <UserPlus size={32} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-100">Tạo tài khoản</h1>
                <p className="text-zinc-500 text-sm mt-1">Tham gia cùng cộng đồng trò chuyện bảo mật</p>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Tên đăng nhập (3-30 ký tự)"
                    required
                    minLength={3}
                    maxLength={30}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-zinc-800/80 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition disabled:opacity-50"
                />
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
                    placeholder="Mật khẩu (ít nhất 6 ký tự)"
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-zinc-800/80 text-zinc-100 rounded-xl border border-zinc-700/50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition disabled:opacity-50"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading || !username.trim() || !email.trim() || !password.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {isLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>

            <p className="text-center text-zinc-500 text-sm">
                Đã có tài khoản?{' '}
                <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                    Đăng nhập
                </button>
            </p>
        </form>
    )
}
