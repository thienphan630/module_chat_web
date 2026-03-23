import { useState } from 'react'
import { LoginForm } from '../components/auth/LoginForm'
import { RegisterForm } from '../components/auth/RegisterForm'
import { MessageSquare } from 'lucide-react'

type AuthMode = 'login' | 'register'

export const AuthPage = () => {
    const [mode, setMode] = useState<AuthMode>('login')

    return (
        <div className="min-h-screen w-screen bg-zinc-950 flex items-center justify-center p-4 overflow-hidden">
            {/* Animated background layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/15 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-900/8 via-transparent to-transparent" />

            {/* Floating decorative orbs */}
            <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
            <div className="absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full bg-emerald-600/5 blur-3xl" />

            <div className="relative z-10 w-full max-w-sm animate-fade-in">
                {/* Logo area */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4 animate-pulse-glow">
                        <MessageSquare size={28} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Core Chat</h1>
                    <p className="text-zinc-500 text-sm mt-2">Nhắn tin nhanh, an toàn.</p>
                </div>

                {/* Form card — glass morphism */}
                <div className="glass rounded-2xl p-8 shadow-2xl shadow-black/30">
                    {mode === 'login' ? (
                        <LoginForm onSwitchToRegister={() => setMode('register')} />
                    ) : (
                        <RegisterForm onSwitchToLogin={() => setMode('login')} />
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6 space-y-1">
                    <p className="text-zinc-700 text-[10px]">
                        © 2026 Core Chat
                    </p>
                </div>
            </div>
        </div>
    )
}
