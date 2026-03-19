import { useState, useEffect, useRef } from 'react'
import { Trash2, Copy } from 'lucide-react'

interface MessageContextMenuProps {
    isMe: boolean
    messageText?: string
    onDelete: () => void
    children: React.ReactNode
}

export const MessageContextMenu = ({ isMe, messageText, onDelete, children }: MessageContextMenuProps) => {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const menuRef = useRef<HTMLDivElement>(null)

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setPos({ x: e.clientX, y: e.clientY })
        setShow(true)
    }

    useEffect(() => {
        if (!show) return
        const close = () => setShow(false)
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [show])

    const handleCopy = () => {
        if (messageText) navigator.clipboard.writeText(messageText)
        setShow(false)
    }

    const handleDelete = () => {
        onDelete()
        setShow(false)
    }

    return (
        <div onContextMenu={handleContextMenu}>
            {children}
            {show && (
                <div
                    ref={menuRef}
                    className="fixed z-50 min-w-[140px] bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-1 overflow-hidden"
                    style={{ top: pos.y, left: pos.x }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                    >
                        <Copy size={14} /> Sao chép
                    </button>
                    {isMe && (
                        <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                        >
                            <Trash2 size={14} /> Xóa
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
