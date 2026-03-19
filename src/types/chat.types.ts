export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface MessageAttachment {
    file_path: string          // URL to encrypted blob on storage
    file_name: string          // Original filename
    file_type: string          // MIME type
    file_size: number          // Size in bytes
    file_key_encrypted: string // File key encrypted with room key
}

export interface ChatMessage {
    message_id: string // UUIDv7
    room_id: string
    sender_id: string
    server_ts: number // Timestamp from server (used for sorting and gap detection), can be local timestamp if pending
    ciphertext?: string // Encrypted message payload from server
    text?: string // Decrypted plaintext for rendering
    status: MessageStatus
    aad_data?: string // Additional authenticated data
    is_deleted?: boolean // Tombstone flag
    attachment?: MessageAttachment // E2EE file attachment metadata
}

export interface RoomKey {
    room_id: string
    shared_key: string // Base64 encoded or hex encoded symmetric key for the room
    created_at: number
}

export type WS_Event_Type = 'auth' | 'join' | 'leave' | 'ack' | 'message' | 'error' | 'system' | 'room_member_joined' | 'room_member_left' | 'typing' | 'typing_stop' | 'user_online' | 'user_offline' | 'read' | 'room_added' | 'room_removed' | 'room_updated';
export interface WS_Payload {
    type: WS_Event_Type;
    token?: string;
    room_id?: string;
    message_id?: string;
    server_ts?: number;
    code?: string;
    data?: any; // Ciphertext từ user khác khi nhận event message
    room?: any; // Room payload for room_added
    reason?: string; // Reason for room_removed
    removed_by?: string; // Admin ID who removed
    added_by?: string; // Admin ID who added
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

export interface UserSearchResult {
    user_id: string
    username: string
    email: string
    avatar_url?: string
}
// --- WebSocket Error Codes ---

export const WS_ERROR_CODES = {
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_AUTH_FRAME: 'INVALID_AUTH_FRAME',
    NOT_A_MEMBER: 'Not a member of this room',
} as const

export type WsErrorCode = typeof WS_ERROR_CODES[keyof typeof WS_ERROR_CODES]

// --- E2EE Key Management Types ---

export interface UploadKeysPayload {
    identity_key: string;
    signed_pre_key: {
        key_id: number;
        public_key: string;
        signature: string;
    };
    one_time_pre_keys: Array<{
        key_id: number;
        public_key: string;
    }>;
}

export interface FetchKeysPayload {
    user_ids: string[];
}

export interface UserPreKeyBundle {
    user_id: string;
    identity_key: string;
    signed_pre_key: {
        key_id: number;
        public_key: string;
        signature: string;
    };
    one_time_pre_key?: {
        key_id: number;
        public_key: string;
    };
}

export interface FetchKeysResponse {
    keys: Record<string, UserPreKeyBundle>;
}

// --- E2EE Room Key Distribution (via messages) ---

/** AAD type used to tag room key distribution messages */
export const E2EE_AAD_TYPE = 'e2ee.room_key' as const

/** Structure of aad_data for room key messages */
export interface RoomKeyAAD {
    type: typeof E2EE_AAD_TYPE
    target_user_id: string            // Recipient of the wrapped key
    sender_identity_key: string       // Sender's identity public key (for verification)
    sender_signed_pre_key_pub: string // Sender's X25519 signed pre-key (for ECDH unwrap)
}

