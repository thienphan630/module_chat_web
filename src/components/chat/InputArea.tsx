import { useState, useRef } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { socketService } from '../../services/SocketService'
import type { ChatMessage } from '../../types/chat.types'
import { SendHorizontal, Paperclip, LoaderCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { addMessage as addMessageToDB } from '../../utils/db'
import { useChatStore } from '../../store/chatStore'

export const InputArea = ({ roomId }: { roomId: string }) => {
    const currentUserId = useChatStore((s) => s.currentUserId)
    const [text, setText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // In real app, we use `encodeMessage` from worker
    const handleSend = async () => {
        if (!text.trim()) return

        const messageId = uuidv7()
        const fakeCipher = btoa(text) // Placeholder since phase 3 crypto worker is mocked or separate

        const msg: ChatMessage = {
            message_id: messageId,
            room_id: roomId,
            sender_id: currentUserId, // Normally from auth ctx
            server_ts: Date.now(), // Optimistic TS
            text: text, // Store plaintext for immediate render locally
            ciphertext: fakeCipher,
            status: 'pending'
        }

        // Display immediately on local UI directly to indexedDB
        await addMessageToDB(msg)

        // Queue to send via ws
        socketService.sendMessage(msg)

        setText('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setIsUploading(true)
            // Call API to upload. In real app, worker encrypts this first.
            const url = await api.uploadFile(file)
            console.log("File uploaded to:", url)

            // Send system message or file message (same flow)
            const messageId = uuidv7()
            const fakeCipher = btoa(`[File] ${file.name}`)
            const msg: ChatMessage = {
                message_id: messageId,
                room_id: roomId,
                sender_id: currentUserId,
                server_ts: Date.now(),
                text: `📎 ${file.name}`,
                ciphertext: fakeCipher,
                status: 'pending'
            }
            await addMessageToDB(msg)
            socketService.sendMessage(msg)
        } catch (error) {
            console.error('Upload failed', error)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-3 items-end relative">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                disabled={isUploading}
                onChange={handleFileChange}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-zinc-400 flex items-center justify-center transition-colors"
            >
                {isUploading ? <LoaderCircle size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </button>
            <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type an E2EE message..."
                className="flex-1 bg-zinc-800 text-zinc-100 rounded-xl p-3 max-h-32 min-h-12 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                rows={1}
            />
            <button
                onClick={handleSend}
                disabled={!text.trim() || isUploading}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-white flex items-center justify-center transition-colors"
            >
                <SendHorizontal size={20} />
            </button>
        </div>
    )
}
