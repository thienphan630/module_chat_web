import { format } from 'date-fns'
import { Check, Clock } from 'lucide-react'
import type { ChatMessage } from '../../types/chat.types'

export const MessageBubble = ({ data }: { data: ChatMessage }) => {
    const isMe = data.sender_id === 'me'

    // Status render
    let statusIcon = null
    if (isMe) {
        if (data.status === 'pending') {
            statusIcon = <Clock size={12} className="text-zinc-400" />
        } else if (data.status === 'sent') {
            statusIcon = <Check size={12} className="text-zinc-800" />
        } else {
            // failed
            statusIcon = <span className="text-red-400 text-xs">!</span>
        }
    }

    return (
        <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} my-3`}>
            <div className={`max-w-[70%] rounded-2xl p-3 ${isMe ? 'bg-emerald-500 text-zinc-950 rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'} shadow-sm flex flex-col`}>
                <span className="leading-relaxed whitespace-pre-wrap flex items-end gap-3">
                    {data.text || data.ciphertext || '[Decryption Error]'}

                    <span className={`text-[10px] flex gap-1 items-center shrink-0 ${isMe ? 'text-zinc-800/70' : 'text-zinc-500'}`}>
                        {format(new Date(data.server_ts), 'HH:mm')}
                        {isMe && statusIcon}
                    </span>
                </span>
            </div>
        </div>
    )
}
