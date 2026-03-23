import Dexie, { type Table } from 'dexie'
import type { ChatMessage, MessageStatus } from '@/types/chat.types'

export class CoreChatDatabase extends Dexie {
    messages!: Table<ChatMessage, string>

    constructor() {
        super('CoreChatDB')
        // Version 1-2 existed for E2EE schema — now removed
        this.version(1).stores({
            messages: 'message_id, [room_id+server_ts], status',
            roomKeys: 'room_id',
            e2eeKeys: 'userId',
        })
        this.version(2).stores({
            messages: 'message_id, [room_id+server_ts], status, is_deleted',
            roomKeys: 'room_id',
            e2eeKeys: 'userId',
        })
        // Version 3: post-E2EE removal — drop roomKeys and e2eeKeys tables
        this.version(3).stores({
            messages: 'message_id, [room_id+server_ts], status, is_deleted',
            roomKeys: null,
            e2eeKeys: null,
        })
    }
}

export const db = new CoreChatDatabase()

/**
 * Fetch latest messages for a room, sorted by server_ts (oldest to newest).
 */
export async function getLatestMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    const msgs = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .limit(limit)
        .toArray()
    return msgs.reverse()
}

/**
 * Insert or replace multiple messages
 */
export async function insertMessages(messages: ChatMessage[]) {
    return await db.messages.bulkPut(messages)
}

/**
 * Insert a single message (ideal for optimistic UI updates)
 */
export async function addMessage(message: ChatMessage) {
    return await db.messages.put(message)
}

/**
 * Update message status (e.g pending -> sent)
 */
export async function updateMessageStatus(messageId: string, status: MessageStatus, server_ts?: number) {
    const changes: Partial<ChatMessage> = { status }
    if (server_ts !== undefined) {
        changes.server_ts = server_ts
    }
    return await db.messages.update(messageId, changes)
}

/**
 * Mark all messages in a room up to the given message as 'read'.
 */
export async function markMessagesReadUpTo(messageId: string) {
    const targetMsg = await db.messages.get(messageId)
    if (!targetMsg) return 0

    const roomId = targetMsg.room_id
    const ts = targetMsg.server_ts

    const staleMessages = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, ts], true, true)
        .filter(msg => msg.status !== 'read')
        .toArray()

    if (staleMessages.length === 0) return 0

    await db.messages.bulkPut(
        staleMessages.map(msg => ({ ...msg, status: 'read' as MessageStatus }))
    )
    return staleMessages.length
}

/**
 * Clear room messages
 */
export async function clearRoom(roomId: string) {
    const keys = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER])
        .primaryKeys()
    return await db.messages.bulkDelete(keys)
}

/**
 * Detect gap between local messages and incoming server batch.
 */
export async function detectGap(roomId: string, newServerMessageBatch: ChatMessage[]): Promise<boolean> {
    if (newServerMessageBatch.length === 0) return false

    const oldestInBatch = newServerMessageBatch.reduce((min, msg) =>
        msg.server_ts < min.server_ts ? msg : min
        , newServerMessageBatch[0])

    const newestLocalMsg = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .first()

    if (!newestLocalMsg) return false

    return oldestInBatch.server_ts > newestLocalMsg.server_ts
}

/**
 * Mark a message as deleted (tombstone) — clears content
 */
export async function markDeleted(messageId: string) {
    return await db.messages.update(messageId, {
        is_deleted: true,
        content: '',
    })
}
