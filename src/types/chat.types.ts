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

export type WS_Event_Type = 'auth' | 'join' | 'leave' | 'ack' | 'message' | 'error' | 'system';

export interface WS_Payload {
    type: WS_Event_Type;
    token?: string;
    room_id?: string;
    message_id?: string;
    server_ts?: number;
    code?: string;
    data?: any; // Ciphertext từ user khác khi nhận event message
}

// --- Authentication Types ---

export interface RegisterPayload {
    username: string  // 3-30 chars
    email: string
    password: string  // min 6 chars
}

export interface LoginPayload {
    email: string
    password: string
}

export interface RefreshPayload {
    refresh_token: string
}

export interface AuthResponse {
    success: boolean
    user_id: string
    access_token: string
    refresh_token: string
}

// --- Room Management Types ---

export type RoomType = 'group' | 'direct'
export type MemberRole = 'admin' | 'member'

export interface Room {
    room_id: string
    name: string
    type: RoomType
    created_by: string
}

export interface RoomMember {
    room_id: string
    room_name: string
    room_type: RoomType
    role: MemberRole
    joined_at: string
}

export interface CreateRoomPayload {
    name: string        // Required for group
    type: RoomType
    member_ids?: string[]
}

export interface InviteMembersPayload {
    user_ids: string[]
}

// --- WebSocket Error Codes ---

export const WS_ERROR_CODES = {
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_AUTH_FRAME: 'INVALID_AUTH_FRAME',
    NOT_A_MEMBER: 'Not a member of this room',
} as const

export type WsErrorCode = typeof WS_ERROR_CODES[keyof typeof WS_ERROR_CODES]

