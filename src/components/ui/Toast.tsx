import { create } from 'zustand'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: number
    message: string
    type: ToastType
}

interface ToastStore {
    toasts: Toast[]
    addToast: (message: string, type: ToastType) => void
    removeToast: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (message, type) => {
        const id = nextId++
        set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
        // Auto-dismiss after 4s
        setTimeout(() => {
            set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
        }, 4000)
    },
    removeToast: (id) => set(state => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),
}))

// Global helper — call from anywhere
export const showToast = (message: string, type: ToastType = 'info') => {
    useToastStore.getState().addToast(message, type)
}

const iconMap = {
    success: <CheckCircle size={16} className="text-emerald-400 shrink-0" />,
    error: <XCircle size={16} className="text-red-400 shrink-0" />,
    info: <Info size={16} className="text-blue-400 shrink-0" />,
}

const bgMap = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    error: 'border-red-500/20 bg-red-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
}

export const ToastContainer = () => {
    const { toasts, removeToast } = useToastStore()

    if (toasts.length === 0) return null

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`animate-toast flex items-center gap-3 px-4 py-3 rounded-xl border ${bgMap[toast.type]} glass shadow-xl`}
                >
                    {iconMap[toast.type]}
                    <p className="text-sm text-zinc-200 flex-1">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    )
}
