import { format } from 'date-fns'
import { Check, Clock } from 'lucide-react'
import type { ChatMessage } from '../../types/chat.types'
import { useChatStore } from '../../store/chatStore'
import { MessageContextMenu } from './MessageContextMenu'
import { Avatar } from '../ui/Avatar'
import { api } from '../../lib/api'
import { markDeleted } from '../../utils/db'

export const MessageBubble = ({ data, senderName }: { data: ChatMessage; senderName?: string }) => {
    const currentUserId = useChatStore((s) => s.currentUserId)
    const isMe = data.sender_id === currentUserId

    // Status render — pending → sent (brown ✓) → delivered (brown ✓✓) → read (blue ✓✓)
    let statusIcon = null
    if (isMe) {
        if (data.status === 'pending') {
            statusIcon = <Clock size={11} className="text-white/40" />
        } else if (data.status === 'sent') {
            statusIcon = <Check size={11} className="text-amber-200/90" />
        } else if (data.status === 'delivered') {
            statusIcon = (
                <span className="flex -space-x-1.5">
                    <Check size={11} className="text-amber-200/90" />
                    <Check size={11} className="text-amber-200/90" />
                </span>
            )
        } else if (data.status === 'read') {
            statusIcon = (
                <span className="flex -space-x-1.5">
                    <Check size={11} className="text-blue-300" />
                    <Check size={11} className="text-blue-300" />
                </span>
            )
        } else {
            statusIcon = <span className="text-red-300 text-[10px]">!</span>
        }
    }

    // Delete handler — REST API (only sender can delete)
    const handleDelete = async () => {
        try {
            await markDeleted(data.message_id)
            await api.deleteMessage(data.room_id, data.message_id)
        } catch (err) {
            console.error('[MessageBubble] Delete failed:', err)
        }
    }

    // Tombstone
    if (data.is_deleted) {
        return (
            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} my-1.5`}>
                <div className="max-w-[70%] rounded-2xl px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/30">
                    <span className="text-[11px] italic text-zinc-600">🚫 Tin nhắn đã bị xóa</span>
                </div>
            </div>
        )
    }

    return (
        <MessageContextMenu isMe={isMe} messageText={data.content} onDelete={handleDelete}>
            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} my-1 group`}>
                {/* Avatar for received messages */}
                {!isMe && (
                    <div className="mr-2 mt-auto mb-1">
                        <Avatar userId={data.sender_id} name={senderName} size="sm" />
                    </div>
                )}

                <div className={`max-w-[65%] rounded-2xl px-3.5 py-2.5 flex flex-col shadow-sm ${
                    isMe
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-br-sm'
                        : 'bg-zinc-800/80 text-zinc-100 rounded-bl-sm border border-zinc-700/20'
                }`}>
                    {!isMe && (
                        <span className="text-[10px] font-semibold text-emerald-400/80 mb-0.5">{senderName || data.sender_id}</span>
                    )}

                    <span className="leading-relaxed text-[13.5px] whitespace-pre-wrap flex items-end gap-3">
                        {data.content}

                        <span className={`text-[9px] flex gap-0.5 items-center shrink-0 ${
                            isMe ? 'text-white/50' : 'text-zinc-500'
                        }`}>
                            {format(new Date(data.server_ts), 'HH:mm')}
                            {isMe && statusIcon}
                        </span>
                    </span>
                </div>
            </div>
        </MessageContextMenu>
    )
}
