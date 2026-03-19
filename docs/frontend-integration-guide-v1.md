# Frontend Integration Guide (Web, Desktop, Mobile)

Tài liệu hướng dẫn kết nối và thao tác với **Core Chat Backend** từ các nền tảng Frontend (Web/React, Desktop/Electron, Mobile/Flutter).

Hệ thống áp dụng **E2EE (End-to-End Encryption)** cho nội dung tin nhắn. Server chỉ nhận/phát/lưu trữ Ciphertext. Metadata (tên phòng, avatar) truyền Plaintext qua TLS.

---

## 1. Authentication Flow

### 1.1 Đăng ký tài khoản

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "alice",           // 3-30 ký tự
  "email": "alice@example.com",  // Email hợp lệ, unique
  "password": "securePass123"    // Tối thiểu 6 ký tự
}
```

**Response 201:**
```json
{
  "success": true,
  "user_id": "019ce0ac-cf14-7ff1-a75b-17674801d041",
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci..."
}
```

### 1.2 Đăng nhập

```
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "alice@example.com", "password": "securePass123" }
```

**Response 200:** Tương tự register — trả `user_id`, `access_token`, `refresh_token`.

### 1.3 Refresh Token (Rotation)

Khi `access_token` hết hạn (mặc định 15 phút), gọi endpoint này để lấy cặp token mới:

```
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refresh_token": "eyJhbGci..." }
```

**Response 200:**
```json
{
  "success": true,
  "access_token": "eyJhbGci...(mới)",
  "refresh_token": "eyJhbGci...(mới)"
}
```

> ⚠️ **Token Rotation:** Refresh token cũ bị vô hiệu sau khi dùng. Nếu dùng lại token cũ → Server trả 401. Client phải lưu trữ token mới ngay.

### 1.4 Token Storage (Khuyến nghị)

| Platform | Lưu trữ |
|----------|---------|
| Web | `httpOnly cookie` hoặc memory (KHÔNG localStorage) |
| Flutter | `flutter_secure_storage` |
| Electron | `safeStorage` API |

### 1.5 Auto-Refresh Strategy

```javascript
// Pseudo-code: kiểm tra token trước mỗi request
async function getValidToken() {
    const payload = decodeJwt(accessToken);
    const expiresIn = payload.exp * 1000 - Date.now();

    if (expiresIn < 60_000) { // < 1 phút → refresh
        const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await res.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
    }
    return accessToken;
}
```

---

## 2. Kết nối Real-Time (WebSocket)

Mọi Real-time Event đi qua WebSocket Gateway. Token phải được gửi qua payload `auth`, **KHÔNG** qua URL query string.

### 2.1 Kết nối & Xác thực

**Endpoint:** `ws://localhost:8080` (dev) | `wss://domain.com` (production)

**Bước 1:** Kết nối WebSocket  
**Bước 2:** Gửi auth payload trong vòng **3 giây**

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = async () => {
    const token = await getValidToken();
    ws.send(JSON.stringify({ type: 'auth', token }));
};
```

**Server phản hồi:**
```json
// Thành công
{ "type": "welcome", "message": "Connected to Gateway as 019ce0ac-..." }

// Token hết hạn
{ "type": "error", "code": "TOKEN_EXPIRED", "message": "Invalid or expired token" }

// Sai format
{ "type": "error", "code": "INVALID_AUTH_FRAME", "message": "Expected { type: \"auth\", token: \"<jwt>\" }" }
```

### 2.2 Flutter Example

```dart
import 'package:web_socket_channel/web_socket_channel.dart';

final channel = WebSocketChannel.connect(Uri.parse('ws://localhost:8080'));

// Auth
channel.sink.add(jsonEncode({
    "type": "auth",
    "token": accessToken,
}));

channel.stream.listen((message) {
    final payload = jsonDecode(message);
    if (payload['type'] == 'error' && payload['code'] == 'TOKEN_EXPIRED') {
        // Refresh token → reconnect
        refreshAndReconnect();
        return;
    }
    handleServerEvent(payload);
});
```

### 2.3 Reconnect Strategy khi Token hết hạn

```
TOKEN_EXPIRED nhận được
    → ws.close()
    → POST /api/v1/auth/refresh
    → Nhận token mới
    → new WebSocket(...) → gửi auth với token mới
```

---

## 3. Room Management (REST API)

Tất cả Room API yêu cầu header `Authorization: Bearer <access_token>`.

### 3.1 Tạo Room

```
POST /api/v1/rooms
Authorization: Bearer <token>

{
  "name": "Team Alpha",           // Bắt buộc cho group
  "type": "group",                // "group" hoặc "direct"
  "member_ids": ["user_id_1", "user_id_2"]  // Optional: mời ngay
}
```

**Response 201:**
```json
{
  "success": true,
  "room": { "room_id": "019ce0b1-...", "name": "Team Alpha", "type": "group", "created_by": "..." },
  "members": ["creator_id", "user_id_1", "user_id_2"]
}
```

### 3.2 Xem danh sách Rooms của tôi

```
GET /api/v1/rooms
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "rooms": [
    { "room_id": "...", "room_name": "Team Alpha", "room_type": "group", "role": "admin", "joined_at": "..." }
  ]
}
```

### 3.3 Chi tiết Room + Danh sách thành viên

```
GET /api/v1/rooms/<room_id>
Authorization: Bearer <token>
```

> Yêu cầu là **thành viên** của room. Non-member → 403 Forbidden.

### 3.4 Mời thành viên (Admin only)

```
POST /api/v1/rooms/<room_id>/members
Authorization: Bearer <token>

{ "user_ids": ["user_id_3", "user_id_4"] }
```

### 3.5 Xoá thành viên

```
DELETE /api/v1/rooms/<room_id>/members/<user_id>
Authorization: Bearer <token>
```

> Admin có thể xoá bất kỳ ai. User thường chỉ có thể tự rời (xoá chính mình).

---

## 4. Tham gia / Rời phòng (WebSocket)

Sau khi xác thực WS thành công, gửi `join` để nhận real-time messages từ room:

```json
{ "type": "join", "room_id": "<room_id>" }
{ "type": "leave", "room_id": "<room_id>" }
```

> **Authorization:** Server kiểm tra membership — chỉ thành viên (đã được invite hoặc tạo room) mới được `join`. Non-member nhận error.

---

## 5. Gửi Tin Nhắn (E2EE)

Client **PHẢI** tự sinh `message_id` theo chuẩn **UUIDv7**. Server từ chối UUIDv4 hoặc timestamp bất hợp lệ.

```json
{
  "message_id": "019cdabd-8069-704e-90f5-e929dcbbb33e",
  "room_id": "<room_id>",
  "ciphertext": "uO8bU9z+4QmBfA==",
  "aad_data": "header_metadata"
}
```

> **Authorization:** Server kiểm tra sender là thành viên của `room_id`. Non-member → message bị reject.

### Flutter Example

```dart
void sendText(String rawText, String roomId) {
    String messageId = const Uuid().v7();
    String encryptedMsg = encrypt(text: rawText, key: roomSharedKey);

    channel.sink.add(jsonEncode({
        "message_id": messageId,
        "room_id": roomId,
        "ciphertext": encryptedMsg,
        "aad_data": "",
    }));

    // Optimistic Update — hiển thị ngay với status "pending"
    appendMessageToUI(messageId, rawText, status: "pending");
}
```

---

## 6. Xử Lý Events Từ Server

| Event | Đối tượng | Mô tả |
|-------|-----------|-------|
| `welcome` | Người kết nối | Xác thực WS thành công |
| `ack` | Người gửi | Server nhận tin nhắn → kèm `server_ts` |
| `message` | Người nhận | Tin nhắn realtime từ thành viên khác |
| `system` | Mọi người | Join/leave room confirmation |
| `error` | Mọi người | Lỗi (TOKEN_EXPIRED, auth, membership...) |

```javascript
function handleServerEvent(payload) {
    switch (payload.type) {
        case 'ack':
            updateMessageStatus(payload.message_id, 'sent', payload.server_ts);
            break;

        case 'message':
            const data = payload.data;
            const plainText = decrypt(data.ciphertext);
            drawNewBubble(data.sender_id, plainText, data.server_ts);
            break;

        case 'error':
            if (payload.code === 'TOKEN_EXPIRED') {
                refreshAndReconnect();
            } else {
                showError(payload.message);
            }
            break;
    }
}
```

---

## 7. Đồng Bộ Lịch Sử (Offline Sync API)

**Yêu cầu:** Bearer JWT + Membership (chỉ thành viên mới lấy được lịch sử).

```
GET /api/v1/messages/sync?room_id=<id>&limit=50&after_server_ts=<timestamp>
Authorization: Bearer <token>
```

| Param | Mô tả | Bắt buộc |
|-------|-------|----------|
| `room_id` | ID phòng chat | ✅ |
| `after_server_ts` | Timestamp cuối cùng client đã có (cursor) | Không |
| `limit` | Số lượng (max 100, default 50) | Không |

### Gap Strategy (Pagination)

1. User mở room → load cache SQLite (50 tin mới nhất)
2. Song song gọi API lấy 50 tin mới nhất từ server
3. Nếu có gap (tin nhắn bị miss khi offline) → hiển thị **Gap Marker**: *"Có x tin ở giữa. Nhấn để tải"*
4. User scroll vào gap → gọi API với `after_server_ts` = timestamp mép dưới của gap
5. **KHÔNG** tự động fetch toàn bộ — chỉ load khi user scroll

---

## 8. Error Codes Reference

| HTTP Status | Ý nghĩa | Khi nào |
|-------------|----------|---------|
| 400 | Bad Request | Thiếu field, sai format |
| 401 | Unauthorized | Token hết hạn, sai password, missing auth |
| 403 | Forbidden | Không phải member / không phải admin |
| 405 | Method Not Allowed | Sai HTTP method |
| 409 | Conflict | Email đã tồn tại |

| WS Error Code | Ý nghĩa |
|----------------|---------|
| `TOKEN_EXPIRED` | JWT hết hạn hoặc invalid |
| `INVALID_AUTH_FRAME` | Frame auth sai format |
| `Not a member of this room` | Join/gửi tin vào room không phải thành viên |
