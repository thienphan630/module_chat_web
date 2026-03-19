import { useState, useRef } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { socketService } from '../../services/SocketService'
import type { ChatMessage } from '../../types/chat.types'
import { SendHorizontal, Paperclip, LoaderCircle } from 'lucide-react'
import { addMessage as addMessageToDB, getRoomKey, saveRoomKey } from '../../utils/db'
import { useChatStore } from '../../store/chatStore'
import { CryptoClient } from '../../workers/cryptoClient'
import { useTyping } from '../../hooks/useTyping'

export const InputArea = ({ roomId }: { roomId: string }) => {
    const currentUserId = useChatStore((s) => s.currentUserId)
    const [text, setText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { emitTyping } = useTyping(roomId)

    // C1 Fix: Real AES-GCM encryption via CryptoWorker
    const handleSend = async () => {
        if (!text.trim()) return

        const messageId = uuidv7()

        // Get or bootstrap room key (Phase 01: ephemeral key for same-session)
        let roomKey = await getRoomKey(roomId)
        if (!roomKey) {
            // Phase 01 bootstrap: generate ephemeral AES-256 key
            const keyBytes = new Uint8Array(32)
            crypto.getRandomValues(keyBytes)
            const keyBase64 = btoa(String.fromCharCode(...keyBytes))
            await saveRoomKey(roomId, keyBase64)
            roomKey = { room_id: roomId, shared_key: keyBase64, created_at: Date.now() }
            console.log('[E2EE] Generated ephemeral room key for', roomId)
        }

        // Encrypt with real AES-GCM
        const ciphertext = await CryptoClient.encryptText(text, roomKey.shared_key)

        const msg: ChatMessage = {
            message_id: messageId,
            room_id: roomId,
            sender_id: currentUserId,
            server_ts: Date.now(),
            text: text, // Store plaintext locally for immediate display
            ciphertext,
            status: 'pending'
        }

        // Display immediately on local UI via IndexedDB
        await addMessageToDB(msg)

        // Queue to send via WS (only ciphertext goes over wire)
        socketService.sendMessage(msg)

        setText('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Phase 05: Real E2EE file encrypt + upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setIsUploading(true)

            let roomKey = await getRoomKey(roomId)
            if (!roomKey) {
                const keyBytes = new Uint8Array(32)
                crypto.getRandomValues(keyBytes)
                const keyBase64 = btoa(String.fromCharCode(...keyBytes))
                await saveRoomKey(roomId, keyBase64)
                roomKey = { room_id: roomId, shared_key: keyBase64, created_at: Date.now() }
            }

            // Encrypt file + prepare attachment metadata
            const { encryptAndUpload } = await import('../../utils/file-upload')
            const attachment = await encryptAndUpload(file, roomKey.shared_key, roomId)

            const messageId = uuidv7()
            const fileText = `📎 ${file.name}`
            const ciphertext = await CryptoClient.encryptText(fileText, roomKey.shared_key)

            const msg: ChatMessage = {
                message_id: messageId,
                room_id: roomId,
                sender_id: currentUserId,
                server_ts: Date.now(),
                text: fileText,
                ciphertext,
                attachment,
                status: 'pending'
            }
            await addMessageToDB(msg)
            socketService.sendMessage(msg)
        } catch (error) {
            console.error('File send failed', error)
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
                onChange={e => { setText(e.target.value); emitTyping() }}
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
