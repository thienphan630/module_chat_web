import Dexie, { type Table } from 'dexie'
import type { ChatMessage, RoomKey, MessageStatus } from '@/types/chat.types'

export interface E2EEKeyBundle {
    userId: string;
    identity_key_private: string;
    signed_pre_key_private: string;
    one_time_pre_keys_private: any[];
}

export class CoreChatDatabase extends Dexie {
    messages!: Table<ChatMessage, string>
    roomKeys!: Table<RoomKey, string>
    e2eeKeys!: Table<E2EEKeyBundle, string>

    constructor() {
        super('CoreChatDB')
        this.version(1).stores({
            messages: 'message_id, [room_id+server_ts], status',
            roomKeys: 'room_id',
            e2eeKeys: 'userId',
        })
    }
}

export const db = new CoreChatDatabase()

/**
 * Fetch latest messages for a room, sorted by server_ts (oldest to newest in the limited set).
 */
export async function getLatestMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    const msgs = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .limit(limit)
        .toArray()
    return msgs.reverse() // Return chronological order suitable for UI chat list
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
 * Update message status specifically (e.g pending -> sent)
 */
export async function updateMessageStatus(messageId: string, status: MessageStatus, server_ts?: number) {
    const changes: Partial<ChatMessage> = { status }
    if (server_ts !== undefined) {
        changes.server_ts = server_ts
    }
    return await db.messages.update(messageId, changes)
}

/**
 * Get Room Shared Key
 */
export async function getRoomKey(roomId: string) {
    return await db.roomKeys.get(roomId)
}

/**
 * Save Room Shared Key
 */
export async function saveRoomKey(roomId: string, shared_key: string) {
    return await db.roomKeys.put({ room_id: roomId, shared_key, created_at: Date.now() })
}

export async function getE2EEKeys(userId: string) {
    return await db.e2eeKeys.get(userId)
}

export async function saveE2EEKeys(bundle: E2EEKeyBundle) {
    return await db.e2eeKeys.put(bundle)
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
 * Example: Returns true if there might be missing messages between
 * the newest local message and the oldest message in the fresh batch.
 */
export async function detectGap(roomId: string, newServerMessageBatch: ChatMessage[]): Promise<boolean> {
    if (newServerMessageBatch.length === 0) return false

    const oldestInBatch = newServerMessageBatch.reduce((min, msg) =>
        msg.server_ts < min.server_ts ? msg : min
        , newServerMessageBatch[0])

    // Get newest single message locally
    const newestLocalMsg = await db.messages
        .where('[room_id+server_ts]')
        .between([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .first()

    if (!newestLocalMsg) {
        // No local message, so no 'gap' relative to local state, it's just fresh download.
        return false
    }

    // If newest local is strictly earlier than oldest server message AND the difference is non-trivial.
    // Actually, if we use strict tracking, even 1ms delay implies we don't know if messages exist between them.
    // A simple gap formula is oldestInBatch.server_ts > newestLocalMsg.server_ts without contiguous verification.
    const gapExists = oldestInBatch.server_ts > newestLocalMsg.server_ts
    return gapExists
}
