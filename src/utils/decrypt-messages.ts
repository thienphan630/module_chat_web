import type { ChatMessage } from '../types/chat.types'
import { getRoomKey, markDeleted } from './db'
import { isRoomKeyMessage, parseRoomKeyAAD, handleIncomingRoomKey } from '../services/e2ee-key-manager'
import { CryptoClient } from '../workers/cryptoClient'

/**
 * Decrypt and process a batch of E2EE messages.
 * Handles: room key distribution, message decryption, delete tombstones.
 * Mutates messages in-place (adds `text`, `is_deleted` fields).
 */
export async function decryptAndProcessMessages(roomId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
    for (const msg of messages) {
        // Handle room key distribution messages
        if (isRoomKeyMessage(msg.aad_data)) {
            const aad = parseRoomKeyAAD(msg.aad_data || '')
            if (aad && msg.ciphertext) {
                await handleIncomingRoomKey(roomId, msg.sender_id || 'unknown', msg.ciphertext, aad)
            }
            continue
        }

        // Decrypt ciphertext
        if (msg.ciphertext && !msg.text) {
            try {
                const roomKey = await getRoomKey(roomId)
                if (roomKey) {
                    msg.text = await CryptoClient.decryptText(msg.ciphertext, roomKey.shared_key)
                } else {
                    msg.text = '[E2EE key not found]'
                    console.warn(`[E2EE] No room key for ${roomId} — cannot decrypt`)
                }
            } catch (err) {
                console.error('[E2EE] Decryption failed:', err)
                msg.text = '[Decryption failed]'
            }
        }

        // Handle delete tombstones
        if (msg.aad_data && !isRoomKeyMessage(msg.aad_data)) {
            try {
                const aad = JSON.parse(msg.aad_data)
                if (aad.type === 'm.room.message.delete' && msg.text) {
                    const parsed = JSON.parse(msg.text)
                    if (parsed.target_id) {
                        await markDeleted(parsed.target_id)
                        msg.is_deleted = true
                    }
                }
            } catch {
                // Not a tombstone — continue
            }
        }
    }

    return messages
}
