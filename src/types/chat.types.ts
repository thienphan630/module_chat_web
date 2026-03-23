export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ChatMessage {
    message_id: string // UUIDv7
    room_id: string
    sender_id: string
    server_ts: number // Timestamp from server (used for sorting and gap detection)
    content: string   // Plaintext message content
    status: MessageStatus
    is_deleted?: boolean
}

export type WS_Event_Type =
    | 'auth' | 'join' | 'leave' | 'ack'
    | 'message' | 'new_message'
    | 'error' | 'system'
    | 'member_joined' | 'member_left'
    | 'room_member_joined' | 'room_member_left'         // legacy aliases
    | 'typing' | 'typing_stop'
    | 'presence' | 'user_online' | 'user_offline'        // presence variants
    | 'receipt'
    | 'room_added' | 'room_removed' | 'room_updated'
    | 'message_deleted';

export interface WS_Payload {
    type: WS_Event_Type;
    token?: string;
    room_id?: string;
    message_id?: string;
    user_id?: string;
    sender_id?: string;
    server_ts?: number;
    code?: string;
    message?: string;                    // Error/system message text
    content?: string;                    // Plaintext message content
    is_typing?: boolean;                 // Typing indicator flag
    status?: string;                     // Presence status
    last_read_message_id?: string;       // Receipt: last read msg
    rooms?: string[];                    // Presence: affected rooms
    data?: any;                          // Generic data for various events
    room?: any;                          // Room payload for room_added
    reason?: string;                     // Reason for room_removed
    removed_by?: string;                 // Admin ID who removed
    added_by?: string;                   // Admin ID who added
    deleted_by?: string;                 // For message_deleted event
    updates?: Record<string, any>;       // For room_updated event
    updated_by?: string;                 // For room_updated event
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

// --- User Profile Types ---

export interface UserProfile {
    user_id: string
    username: string
    email?: string       // Only present for own profile (GET /users/me)
    avatar_url: string | null
    created_at?: string  // Only present for own profile
}

export interface UpdateProfilePayload {
    username?: string    // 3-30 chars
    avatar_url?: string | null
}

// --- Room Management Types ---

export type RoomType = 'group' | 'direct'
export type MemberRole = 'admin' | 'member'

export interface LastMessage {
    message_id: string
    sender_id: string
    content: string
    server_ts: number
}

export interface Room {
    room_id: string
    name: string
    type: RoomType
    avatar_url?: string | null
    created_by: string
    member_count?: number
}

export interface RoomMember {
    room_id: string
    room_name: string
    room_type: RoomType
    room_avatar_url: string | null
    role: MemberRole
    joined_at: string
    last_message: LastMessage | null
    unread_count: number
}

/** Member detail returned by GET /api/v1/rooms/:roomId/members (paginated) */
export interface RoomMemberDetail {
    user_id: string
    username: string | null
    email: string | null
    avatar_url: string | null
    role: MemberRole
    joined_at: string
}

export interface RoomMembersResponse {
    success: boolean
    members: RoomMemberDetail[]
    next_cursor: string | null
    has_more: boolean
}

export interface CreateRoomPayload {
    name: string        // Required for group
    type: RoomType
    member_ids?: string[]
}

export interface InviteMembersPayload {
    user_ids: string[]
}

export interface UpdateRoomPayload {
    name?: string
    avatar_url?: string | null
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
