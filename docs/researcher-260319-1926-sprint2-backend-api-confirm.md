# Sprint 2 — Xác Nhận Backend API (Bàn Giao FE)

> **Ngày:** 2026-03-19 | **Phiên bản:** 1.0  
> **Mục đích:** Danh sách các API/WS event FE cần confirm với Backend trước khi triển khai Sprint 2.  
> **Codebase phân tích:** `module_chat` — Node.js + WebSocket + Kafka + Redis + Cassandra

---

## 1. Phân Phối Room Keys — E2EE Key Distribution

### ❌ `POST /api/v1/rooms/{roomId}/keys` — CHƯA IMPLEMENT

**Trạng thái hiện tại:**  
`src/api/rooms.ts` chỉ có 5 endpoints. `parseRoomUrl()` không xử lý segment `/keys`. Endpoint này chưa tồn tại.

**Yêu cầu FE → BE:**

```
POST /api/v1/rooms/:roomId/keys
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body (đề xuất):**
```json
{
  "keys": [
    { "user_id": "019ce0ac-...", "wrapped_key": "<base64_encrypted_room_key>" },
    { "user_id": "019ce0b1-...", "wrapped_key": "<base64_encrypted_room_key>" }
  ]
}
```

**Response 200 (đề xuất):**
```json
{
  "success": true,
  "distributed_to": ["019ce0ac-...", "019ce0b1-..."]
}
```

**Cần confirm với BE:**
- [ ] Endpoint path có đúng `/rooms/:roomId/keys` không?
- [ ] Chỉ admin mới được distribute, hay tất cả member?
- [ ] Schema lưu trữ key trong Cassandra như thế nào?
- [ ] GET `/rooms/:roomId/keys` để fetch key khi member mới join?

---

## 2. WebSocket Events — Typing / Online / Read

### ❌ `typing` — CHƯA IMPLEMENT

**Trạng thái hiện tại:**  
`src/index.ts` chỉ xử lý WS events: `auth`, `join`, `leave`, và raw message. Không có typing logic.

**Yêu cầu FE → BE (Client → Server):**
```json
{ "type": "typing", "room_id": "<room_id>", "is_typing": true }
{ "type": "typing", "room_id": "<room_id>", "is_typing": false }
```

**Server broadcast tới các thành viên khác (Server → Client):**
```json
{ "type": "typing", "room_id": "<room_id>", "user_id": "<sender_id>", "is_typing": true }
```

**Cần confirm với BE:**
- [ ] BE có implement throttle/debounce typing broadcast không? (tránh spam)
- [ ] Timeout tự động `is_typing: false` nếu client disconnect?

---

### ❌ `user_online` — CHƯA IMPLEMENT

**Trạng thái hiện tại:**  
`ConnectionTracker.ts` có track connection theo `userId`, nhưng không phát sự kiện presence ra ngoài.

**Yêu cầu FE → BE:**  
FE không cần gửi — server tự phát khi user connect/disconnect.

**Server broadcast (Server → Client):**
```json
{ "type": "user_online", "user_id": "<user_id>", "status": "online" }
{ "type": "user_online", "user_id": "<user_id>", "status": "offline" }
```

**Cần confirm với BE:**
- [ ] Broadcast presence đến room cụ thể, hay global?
- [ ] BE có lưu last_seen vào DB không?
- [ ] Có endpoint REST `GET /api/v1/users/:userId/status` để poll không?

---

### ❌ `read` (Read Receipts) — CHƯA IMPLEMENT

**Trạng thái hiện tại:**  
Không có bất kỳ read receipt logic nào trong codebase.

**Yêu cầu FE → BE (Client → Server):**
```json
{ "type": "read", "room_id": "<room_id>", "message_id": "<last_read_message_id>" }
```

**Server broadcast tới sender (Server → Client):**
```json
{
  "type": "read",
  "room_id": "<room_id>",
  "user_id": "<reader_id>",
  "message_id": "<last_read_message_id>",
  "read_at": 1710857178000
}
```

**Cần confirm với BE:**
- [ ] Lưu read receipt trong Cassandra hay chỉ in-memory/Redis?
- [ ] BE broadcast read receipt đến tất cả member hay chỉ sender gốc?
- [ ] Schema: per-message hay chỉ store `last_read_message_id` per user per room?

---

## 3. Presigned URL Upload — File Attachments

### ❌ `POST /api/v1/rooms/{roomId}/attachments/upload-url` — CHƯA IMPLEMENT

**Trạng thái hiện tại:**  
Không có file `attachments.ts`, không có routing cho `/attachments`. Chưa có cloud storage integration.

**Yêu cầu FE → BE:**

```
POST /api/v1/rooms/:roomId/attachments/upload-url
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "file_name": "photo.jpg",
  "file_size": 204800,
  "mime_type": "image/jpeg"
}
```

**Response 200 (đề xuất):**
```json
{
  "success": true,
  "upload_url": "https://storage.provider.com/...",
  "attachment_id": "019ce100-...",
  "expires_at": 1710857778000
}
```

**Flow hoàn chỉnh:**
```
FE → POST /rooms/:id/attachments/upload-url  → nhận presigned_url + attachment_id
FE → PUT <presigned_url> (direct to storage)  → upload file
FE → WS send message với attachment_id        → server lưu & broadcast
```

**Cần confirm với BE:**
- [ ] Storage provider là gì? (AWS S3 / Cloudflare R2 / MinIO)
- [ ] Presigned URL expire sau bao lâu? (5 phút, 15 phút?)
- [ ] File size limit tối đa?
- [ ] Có cần whitelist MIME types không?
- [ ] WS payload gửi attachment như thế nào? (thêm field `attachment_id` vào message?)

---

## 4. Tổng Kết — Checklist Confirm Với Backend

| # | Hạng mục | Endpoint / Event | Trạng thái | Priority |
|---|----------|-----------------|------------|---------|
| 1 | E2EE Key Distribution | `POST /rooms/:id/keys` | ❌ Chưa có | 🔴 P0 |
| 2 | Fetch Room Key (new member) | `GET /rooms/:id/keys` | ❌ Chưa rõ | 🔴 P0 |
| 3 | WS Typing Indicator | `type: "typing"` | ❌ Chưa có | 🟡 P1 |
| 4 | WS User Online/Offline | `type: "user_online"` | ❌ Chưa có | 🟡 P1 |
| 5 | WS Read Receipts | `type: "read"` | ❌ Chưa có | 🟡 P1 |
| 6 | Presigned Upload URL | `POST /rooms/:id/attachments/upload-url` | ❌ Chưa có | 🟠 P2 |

> **P0** = FE bị blocked, không thể tiến hành nếu thiếu  
> **P1** = Sprint 2 core features, cần confirm sớm  
> **P2** = Nice-to-have Sprint 2, có thể defer sang Sprint 3

---

## 5. API Đã Implement (Sprint 1 — Reference)

Các endpoint đã sẵn sàng, FE có thể dùng ngay:

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/api/v1/auth/register` | Đăng ký |
| `POST` | `/api/v1/auth/login` | Đăng nhập |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `POST` | `/api/v1/rooms` | Tạo room |
| `GET` | `/api/v1/rooms` | Danh sách rooms |
| `GET` | `/api/v1/rooms/:id` | Chi tiết room + members |
| `POST` | `/api/v1/rooms/:id/members` | Thêm thành viên (admin) |
| `DELETE` | `/api/v1/rooms/:id/members/:userId` | Xoá thành viên |
| `GET` | `/api/v1/messages/sync` | Lịch sử tin nhắn (pagination) |

**WS Events đã có:**

| Direction | Event | Mô tả |
|-----------|-------|-------|
| C→S | `auth` | Xác thực JWT |
| C→S | `join` | Tham gia room |
| C→S | `leave` | Rời room |
| S→C | `welcome` | Xác thực thành công |
| S→C | `ack` | Server nhận tin nhắn |
| S→C | `message` | Tin nhắn realtime |
| S→C | `system` | Join/leave confirmation |
| S→C | `error` | Lỗi |

---

*Tài liệu được tạo từ phân tích trực tiếp codebase `module_chat` — 2026-03-19 19:26 ICT*
