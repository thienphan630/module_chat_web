# Changelog: Remove E2EE & Complete API — FE Integration Guide

> **Date:** 2026-03-23
> **Type:** Breaking Change + New Features
> **Backend version:** post-E2EE removal

---

## ⚠️ Breaking Changes

### 1. E2EE đã bị loại bỏ hoàn toàn

FE **không cần** thực hiện bất kỳ thao tác nào liên quan đến:
- Encrypt/decrypt message
- Key exchange (public keys, room keys)
- Device key management
- Key rotation

**Xóa toàn bộ code E2EE phía FE** nếu có.

### 2. Message payload: `ciphertext` → `content`

**Gửi tin nhắn (WebSocket):**

```diff
 {
   "message_id": "<UUIDv7>",
   "room_id": "<room_id>",
-  "ciphertext": "<encrypted_content>",
-  "aad_data": "<additional_authenticated_data>"
+  "content": "Hello world!"
 }
```

**Nhận tin nhắn (WebSocket event `new_message`):**

```diff
 {
   "type": "new_message",
   "room_id": "...",
   "message_id": "...",
   "sender_id": "...",
   "server_ts": 1711152000000,
-  "ciphertext": "uO8bU9z+4QmBfA==",
-  "aad_data": "header_metadata"
+  "content": "Hello world!"
 }
```

**Sync API response (`GET /api/v1/messages/sync`):**

```diff
 {
   "message_id": "...",
   "room_id": "...",
   "sender_id": "...",
   "server_ts": 1711152000000,
-  "ciphertext": "...",
-  "aad_data": "..."
+  "content": "..."
 }
```

### 3. API đã xóa

| API | Trạng thái |
|-----|-----------|
| `POST /api/v1/e2ee/keys` | ❌ Đã xóa |
| `POST /api/v1/e2ee/keys/fetch` | ❌ Đã xóa |
| `POST /api/v1/rooms/:id/keys` | ❌ Đã xóa |
| `GET /api/v1/rooms/:id/keys` | ❌ Đã xóa |

### 4. WebSocket event đã xóa

| Event | Trạng thái |
|-------|-----------|
| `key_rotation_needed` | ❌ Đã xóa |

---

## ✅ API Mới

### 1. `GET /api/v1/users/me` — Profile hiện tại

```
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{
  "success": true,
  "user": {
    "user_id": "019cdabd-...",
    "username": "thienphan",
    "email": "thien@example.com",
    "avatar_url": "https://...",
    "created_at": "2026-03-20T10:00:00.000Z"
  }
}
```

> **Use case:** Gọi ngay sau login/refresh để lấy thông tin user hiện tại.

---

### 2. `GET /api/v1/users/:id` — Profile user khác (public)

```
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{
  "success": true,
  "user": {
    "user_id": "019cdabd-...",
    "username": "otheruser",
    "avatar_url": "https://..."
  }
}
```

> **Lưu ý:** Không trả `email` — chỉ thông tin public.
> **Use case:** Hiển thị tên/avatar user trong chat bubble, member list.

---

### 3. `PATCH /api/v1/users/me` — Cập nhật profile

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body** (tất cả field đều optional, gửi ít nhất 1):
```json
{
  "username": "new_name",
  "avatar_url": "https://new-avatar.jpg"
}
```

**Validation:**
- `username`: string, 3-30 ký tự
- `avatar_url`: string hoặc `null` (xóa avatar)

**Response 200:**
```json
{
  "success": true,
  "user": {
    "user_id": "...",
    "username": "new_name",
    "email": "thien@example.com",
    "avatar_url": "https://new-avatar.jpg"
  }
}
```

---

### 4. `PATCH /api/v1/rooms/:id` — Cập nhật room (Admin only)

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "New Room Name",
  "avatar_url": "https://room-avatar.jpg"
}
```

**Response 200:**
```json
{
  "success": true,
  "room": {
    "room_id": "...",
    "name": "New Room Name",
    "type": "group",
    "avatar_url": "https://room-avatar.jpg",
    "created_by": "...",
    "created_at": "2026-03-20T10:00:00.000Z"
  }
}
```

**Response 403** (không phải admin):
```json
{ "error": "Only admins can update room" }
```

**WebSocket broadcast** (tất cả members nhận được):
```json
{
  "type": "room_updated",
  "room_id": "...",
  "updates": { "name": "New Room Name" },
  "updated_by": "<user_id>"
}
```

---

### 5. `POST /api/v1/auth/logout` — Đăng xuất

```
Content-Type: application/json
```

**Request body:**
```json
{
  "refresh_token": "<refresh_token>"
}
```

**Response 200:**
```json
{ "success": true }
```

> **Lưu ý:** Luôn trả success=true dù token invalid (idempotent).
> FE nên clear local storage sau khi gọi.

---

### 6. `DELETE /api/v1/rooms/:roomId/messages/:messageId` — Xóa tin nhắn

```
Authorization: Bearer <access_token>
```

**Rules:**
- Chỉ **sender** mới được xóa tin nhắn của mình
- Soft delete — tin nhắn bị ẩn khỏi sync response, không xóa vật lý

**Response 200:**
```json
{ "success": true }
```

**Response 403:**
```json
{ "error": "Can only delete own messages" }
```

**WebSocket broadcast** (tất cả members nhận được):
```json
{
  "type": "message_deleted",
  "room_id": "...",
  "message_id": "...",
  "deleted_by": "<user_id>"
}
```

> **FE handling:** Khi nhận `message_deleted` event, xóa/ẩn tin nhắn tương ứng khỏi UI.

---

## 🔄 API Thay Đổi

### `GET /api/v1/rooms` — Room list (Enhanced)

Response bây giờ bao gồm `last_message` và `unread_count`:

**Response 200:**
```json
{
  "success": true,
  "rooms": [
    {
      "room_id": "...",
      "room_name": "Team Chat",
      "room_type": "group",
      "room_avatar_url": "https://...",
      "role": "admin",
      "joined_at": "2026-03-20T10:00:00.000Z",
      "last_message": {
        "message_id": "...",
        "sender_id": "...",
        "content": "Hello!",
        "server_ts": 1711152000000
      },
      "unread_count": 1
    },
    {
      "room_id": "...",
      "room_name": "DM with Thien",
      "room_type": "direct",
      "room_avatar_url": null,
      "role": "member",
      "joined_at": "...",
      "last_message": null,
      "unread_count": 0
    }
  ]
}
```

**Lưu ý về `unread_count`:**
- `0` = đã đọc hết hoặc room trống
- `1` = có tin nhắn chưa đọc (binary indicator, không phải exact count)
- `null` `last_message` = room chưa có tin nhắn

> **FE use case:** Hiển thị badge "có tin mới" trên room list. Dùng `last_message.content` làm preview text.

---

## 📡 WebSocket Events — Tổng hợp

### Events FE cần xử lý

| Event | Mô tả | Data |
|-------|-------|------|
| `new_message` | Tin nhắn mới | `{ room_id, message_id, sender_id, content, server_ts }` |
| `ack` | Server xác nhận đã nhận tin | `{ message_id }` |
| `typing` | User đang gõ | `{ room_id, user_id }` |
| `presence` | Online/offline | `{ user_id, status, rooms }` |
| `receipt` | Đã đọc | `{ room_id, user_id, last_read_message_id }` |
| `member_joined` | Thành viên mới | `{ room_id, user_id }` |
| `member_left` | Thành viên rời nhóm | `{ room_id, user_id }` |
| `room_removed` | Bị kick khỏi room | `{ room_id, reason, removed_by }` |
| **`room_updated`** | 🆕 Room metadata đổi | `{ room_id, updates, updated_by }` |
| **`message_deleted`** | 🆕 Tin nhắn bị xóa | `{ room_id, message_id, deleted_by }` |

### Events đã xóa

| Event | Lý do |
|-------|-------|
| ~~`key_rotation_needed`~~ | E2EE đã bị loại bỏ |

---

## 🔧 FE Migration Checklist

### Bắt buộc (Breaking)

- [ ] Đổi `ciphertext` → `content` trong message send payload
- [ ] Đổi `ciphertext` → `content` trong message receive handler
- [ ] Xóa `aad_data` khỏi message payload
- [ ] Xóa toàn bộ code encrypt/decrypt
- [ ] Xóa code E2EE key exchange (upload keys, fetch keys, room keys)
- [ ] Xóa handler cho event `key_rotation_needed`

### Tích hợp API mới

- [ ] Gọi `GET /users/me` sau login → lưu profile vào state
- [ ] Dùng `GET /users/:id` khi cần hiển thị user info
- [ ] Tích hợp `PATCH /users/me` vào màn hình profile settings
- [ ] Tích hợp `PATCH /rooms/:id` vào room settings (chỉ admin thấy)
- [ ] Thêm nút "Đăng xuất" → gọi `POST /auth/logout`
- [ ] Thêm chức năng xóa tin nhắn → `DELETE /rooms/:id/messages/:id`
- [ ] Cập nhật room list để dùng `last_message` + `unread_count`

### WebSocket events mới

- [ ] Handle `room_updated` → cập nhật room name/avatar trong UI
- [ ] Handle `message_deleted` → xóa/ẩn tin nhắn khỏi chat window

---

## 📋 API Reference — Tổng hợp đầy đủ

### Authentication (Không cần auth)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/auth/register` | `{ username, email, password }` | `{ user_id, access_token, refresh_token }` |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ user_id, access_token, refresh_token }` |
| POST | `/api/v1/auth/refresh` | `{ refresh_token }` | `{ access_token, refresh_token }` |
| POST | `/api/v1/auth/logout` | `{ refresh_token }` | `{ success: true }` |

### Users (Bearer JWT)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/v1/users/me` | — | `{ user: { user_id, username, email, avatar_url, created_at } }` |
| GET | `/api/v1/users/:id` | — | `{ user: { user_id, username, avatar_url } }` |
| PATCH | `/api/v1/users/me` | `{ username?, avatar_url? }` | `{ user: { ... } }` |
| GET | `/api/v1/users/search?q=` | — | `[{ user_id, username, email }]` |

### Rooms (Bearer JWT)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/rooms` | `{ name, type, member_ids }` | `{ room }` |
| GET | `/api/v1/rooms` | — | `{ rooms: [{ ..., last_message, unread_count }] }` |
| GET | `/api/v1/rooms/:id` | — | `{ room, members }` |
| PATCH | `/api/v1/rooms/:id` | `{ name?, avatar_url? }` | `{ room }` |
| POST | `/api/v1/rooms/:id/members` | `{ user_ids }` | `{ success }` |
| GET | `/api/v1/rooms/:id/members?limit=&cursor=` | — | `{ members, next_cursor, total }` |
| DELETE | `/api/v1/rooms/:id/members/:uid` | — | `{ success }` |

### Messages (Bearer JWT + Member)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/v1/messages/sync?room_id=&after=&limit=` | — | `{ data: [{ message_id, content, ... }] }` |
| DELETE | `/api/v1/rooms/:id/messages/:msgId` | — | `{ success }` |

### Read Receipts (Bearer JWT + Member)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/rooms/:id/receipts` | `{ last_read_message_id }` | `{ success }` |
| GET | `/api/v1/rooms/:id/receipts` | — | `{ receipts: [...] }` |

### Attachments (Bearer JWT + Member)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/rooms/:id/attachments/upload` | `{ filename, content_type }` | `{ upload_url, key }` |
| GET | `/api/v1/rooms/:id/attachments/:key` | — | `{ download_url }` |
