export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface ChatMessage {
    message_id: string // UUIDv7
    room_id: string
    sender_id: string
    server_ts: number // Timestamp from server (used for sorting and gap detection), can be local timestamp if pending
    ciphertext?: string // Encrypted message payload from server
    text?: string // Decrypted plaintext for rendering
    status: MessageStatus
    aad_data?: string // Additional authenticated data
}

export interface RoomKey {
    room_id: string
    shared_key: string // Base64 encoded or hex encoded symmetric key for the room
    created_at: number
}
