/**
 * E2EE Key Manager — orchestrates room key distribution via encrypted messages.
 *
 * Since backend does NOT have dedicated /rooms/:id/keys endpoints,
 * we distribute wrapped room keys as regular WS messages with special `aad_data`.
 *
 * Flow:
 *   distributeRoomKey() — Room creator wraps roomKey per-member, sends via WS messages
 *   handleIncomingRoomKey() — Recipient detects aad_data.type, unwraps, saves to Dexie
 */

import { v7 as uuidv7 } from 'uuid'
import { CryptoClient } from '../workers/cryptoClient'
import { api } from '../lib/api'
import { getE2EEKeys, saveRoomKey } from '../utils/db'
import { useChatStore } from '../store/chatStore'
import { socketService } from './SocketService'
import type { RoomKeyAAD, ChatMessage } from '../types/chat.types'
import { E2EE_AAD_TYPE } from '../types/chat.types'

/**
 * Generate a random AES-256 room key and distribute it to specified members
 * by wrapping it with each member's X25519 signed pre-key via ECDH.
 */
export async function distributeRoomKey(roomId: string, memberIds: string[]): Promise<void> {
    const currentUserId = useChatStore.getState().currentUserId

    // 1. Get our private keys from Dexie
    const ourKeys = await getE2EEKeys(currentUserId)
    if (!ourKeys) {
        console.error('[E2EE KeyManager] No local E2EE keys found — cannot distribute room key')
        return
    }

    // 2. Generate random AES-256 room key
    const keyBytes = new Uint8Array(32)
    crypto.getRandomValues(keyBytes)
    const roomKeyBase64 = btoa(String.fromCharCode(...keyBytes))

    // 3. Fetch public key bundles for all target members
    const targetMemberIds = memberIds.filter(id => id !== currentUserId)
    if (targetMemberIds.length === 0) {
        // Solo room — just save key locally
        await saveRoomKey(roomId, roomKeyBase64)
        console.log('[E2EE KeyManager] Solo room key saved locally')
        return
    }

    let keyBundles
    try {
        const response = await api.fetchKeys({ user_ids: targetMemberIds })
        keyBundles = response.keys
    } catch (err) {
        console.error('[E2EE KeyManager] Failed to fetch member key bundles:', err)
        // Fallback: save key locally, others won't be able to decrypt until key is distributed
        await saveRoomKey(roomId, roomKeyBase64)
        return
    }

    // 4. For each member: wrap room key and send as special WS message
    for (const memberId of targetMemberIds) {
        const bundle = keyBundles[memberId]
        if (!bundle) {
            console.warn(`[E2EE KeyManager] No key bundle for user ${memberId} — skipping`)
            continue
        }

        try {
            // X25519 ECDH wrap: our signed_pre_key_private × their signed_pre_key public
            const wrappedKey = await CryptoClient.wrapRoomKey(
                roomKeyBase64,
                bundle.signed_pre_key.public_key,
                ourKeys.signed_pre_key_private
            )

            // Build AAD metadata
            const aadData: RoomKeyAAD = {
                type: E2EE_AAD_TYPE,
                target_user_id: memberId,
                sender_identity_key: '', // Could include for verification
                sender_signed_pre_key_pub: '' // Will be fetched by receiver via fetchKeys
            }

            // Send as regular WS message — server stores + broadcasts like any message
            const keyMessage: ChatMessage = {
                message_id: uuidv7(),
                room_id: roomId,
                sender_id: currentUserId,
                server_ts: Date.now(),
                ciphertext: wrappedKey,
                aad_data: JSON.stringify(aadData),
                status: 'pending'
            }

            socketService.sendMessage(keyMessage)
            console.log(`[E2EE KeyManager] Room key wrapped and sent to ${memberId}`)
        } catch (err) {
            console.error(`[E2EE KeyManager] Failed to wrap key for ${memberId}:`, err)
        }
    }

    // 5. Save room key locally
    await saveRoomKey(roomId, roomKeyBase64)
    console.log(`[E2EE KeyManager] Room key distributed to ${targetMemberIds.length} members`)
}

/**
 * Handle an incoming room key message — unwrap and save to Dexie.
 * Called by SocketService when it detects aad_data.type === 'e2ee.room_key'.
 */
export async function handleIncomingRoomKey(
    roomId: string,
    senderId: string,
    ciphertext: string,
    _aadData: RoomKeyAAD
): Promise<boolean> {
    const currentUserId = useChatStore.getState().currentUserId

    // 1. Check if this key message is addressed to us
    if (_aadData.target_user_id !== currentUserId) {
        // Not for us — ignore silently
        return false
    }

    // 2. Get our private keys
    const ourKeys = await getE2EEKeys(currentUserId)
    if (!ourKeys) {
        console.error('[E2EE KeyManager] No local E2EE keys — cannot unwrap room key')
        return false
    }

    // 3. Fetch sender's public key bundle to get their signed_pre_key
    let senderBundle
    try {
        const response = await api.fetchKeys({ user_ids: [senderId] })
        senderBundle = response.keys[senderId]
    } catch (err) {
        console.error('[E2EE KeyManager] Failed to fetch sender key bundle:', err)
        return false
    }

    if (!senderBundle) {
        console.error(`[E2EE KeyManager] No key bundle found for sender ${senderId}`)
        return false
    }

    // 4. X25519 ECDH unwrap: our signed_pre_key_private × sender's signed_pre_key_public
    try {
        const roomKeyBase64 = await CryptoClient.unwrapRoomKey(
            ciphertext,
            senderBundle.signed_pre_key.public_key,
            ourKeys.signed_pre_key_private
        )

        // 5. Save unwrapped room key to Dexie
        await saveRoomKey(roomId, roomKeyBase64)
        console.log(`[E2EE KeyManager] Room key unwrapped and saved for room ${roomId}`)
        return true
    } catch (err) {
        console.error('[E2EE KeyManager] Failed to unwrap room key:', err)
        return false
    }
}

/**
 * Check if an aad_data string indicates a room key message.
 */
export function isRoomKeyMessage(aadData?: string): boolean {
    if (!aadData) return false
    try {
        const parsed = JSON.parse(aadData)
        return parsed.type === E2EE_AAD_TYPE
    } catch {
        return false
    }
}

/**
 * Parse aad_data JSON into RoomKeyAAD.
 */
export function parseRoomKeyAAD(aadData: string): RoomKeyAAD | null {
    try {
        const parsed = JSON.parse(aadData)
        if (parsed.type === E2EE_AAD_TYPE) return parsed as RoomKeyAAD
        return null
    } catch {
        return null
    }
}
