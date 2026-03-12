# Frontend Integration Guide (Web, Desktop, Mobile)

Tài liệu này hướng dẫn cách kết nối và thao tác với **Core Chat Backend** từ các nền tảng Frontend (Web/Next.js, Desktop/Electron, Mobile/Flutter).

Hệ thống được thiết kế theo chuẩn bảo mật **E2EE (End-to-End Encryption)**, Server hoàn toàn "mù" và chỉ nhận/phát/lưu trữ Ciphertext. Mọi thao tác sinh ID (`UUIDv7`) tĩnh và mã hóa phải được thực hiện trên thiết bị của User (Client-side).

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

> ⚠️ **Token Rotation:** Refresh token cũ bị vô hiệu sau khi dùng. Nếu dùng lại token cũ → Server trả 401. Client **phải** lưu trữ cả `access_token` và `refresh_token` mới ngay lập tức.

### 1.4 Token Storage (Khuyến nghị)

| Platform | Lưu trữ |
|----------|---------|
| Web (Production) | `httpOnly cookie` hoặc in-memory (KHÔNG `localStorage`) |
| Web (Development) | `localStorage` chấp nhận được cho dev/testing |
| Flutter | `flutter_secure_storage` |
| Electron | `safeStorage` API |

### 1.5 Auto-Refresh Strategy

Kiểm tra token trước mỗi request hoặc kết nối WebSocket. Refresh khi còn dưới 1 phút:

```javascript
async function getValidToken() {
    const payload = decodeJwt(accessToken);
    const expiresIn = payload.exp * 1000 - Date.now();

    if (expiresIn < 60_000) { // < 1 phút → refresh
        const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await res.json();
        // Token rotation: lưu NGAY cả 2 token mới
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
    }
    return accessToken;
}
```

---

## 2. Kết nối Real-Time (WebSocket)

Mọi Real-time Event (Gửi nhận chat, nhận thông báo) đều đi qua WebSocket Gateway.  
**Bảo mật:** KHÔNG truyền JWT Token qua URL Query String để tránh rò rỉ log trên Server. Token phải được đính kèm ở bản tin Payload `auth` đầu tiên.

### Endpoint
* **URL:** `ws://<domain-cua-ban>:8080` *(Môi trường dev: `ws://localhost:8080`)*

> ⚠️ **Auth Timeout:** Server yêu cầu client gửi payload `auth` **trong vòng 3 giây** sau khi kết nối. Nếu không, server sẽ tự động ngắt kết nối.

### Flutter (Dart) Example
```dart
import 'package:web_socket_channel/web_socket_channel.dart';

final channel = WebSocketChannel.connect(
  Uri.parse('ws://localhost:8080'),
);

// Ngay sau khi kết nối, bắn Payload Auth trước
channel.sink.add(jsonEncode({
  "type": "auth",
  "token": "YOUR_JWT_TOKEN"
}));

// Lắng nghe tin nhắn từ Server
channel.stream.listen((message) {
  final payload = jsonDecode(message);
  if (payload['type'] == 'error' && payload['code'] == 'TOKEN_EXPIRED') {
    // Xử lý refresh token qua HTTP rồi chép lại vào đây, hoặc reconnect
  }
  handleServerEvent(payload);
});
```

### Web/ReactJS/Vue Example
```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
   ws.send(JSON.stringify({
      type: "auth",
      token: "YOUR_JWT_TOKEN"
   }));
};

ws.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  handleServerEvent(payload);
};
```

### Reconnect Strategy khi Token hết hạn

```
TOKEN_EXPIRED nhận được
    → ws.close()
    → POST /api/v1/auth/refresh { refresh_token }
    → Nhận token mới (lưu NGAY cả access + refresh)
    → new WebSocket(...) → gửi auth với token mới
```

---

## 3. Room Management (REST API)

Tất cả Room API yêu cầu header `Authorization: Bearer <access_token>`.

> **QUAN TRỌNG VỀ METADATA:** Tên phòng, Ảnh đại diện (Avatar), và User Profile **KHÔNG áp dụng mã hóa E2EE**. Việc Render danh sách Room sẽ sử dụng REST API thông thường bằng Plaintext (bảo vệ bằng TLS/HTTPS). E2EE **CHỈ** áp dụng cho "Thân Tin Nhắn" (`ciphertext`).

### 3.1 Tạo Room

```
POST /api/v1/rooms
Authorization: Bearer <token>
Content-Type: application/json

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

### 3.2 Danh sách Rooms của tôi

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
Content-Type: application/json

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

## 5. Gửi Tin Nhắn (Bảo Mật E2EE)

**QUAN TRỌNG:** Client PHẢI tự sinh `message_id` theo chuẩn **UUIDv7** (để đảm bảo có chứa Time-based sorting). Server sẽ từ chối các UUIDv4 hoặc String thường để chốt chặn Hack.

Bước 1: Tạo UUIDv7 và mã hóa Text.
Bước 2: Bắn chuỗi JSON gửi đi qua WebSocket.

Mẫu dữ liệu chuẩn gửi đi (Client -> Server):
```json
{
  "message_id": "019cdabd-8069-704e-90f5-e929dcbbb33e", // Bắt buộc UUIDv7
  "room_id": "ROOM_VIP_1",
  "ciphertext": "uO8bU9z+4QmBfA==", // Dữ liệu bị mã hoá (ChaCha20-Poly1305 / AES-GCM)
  "aad_data": "header_metadata" // Dữ liệu đính kèm dạng plain (tùy chọn)
}
```

### Flutter (Dart) Example
Sử dụng package `uuid` (bản mới nhất hỗ trợ v7) để sinh mã.
```dart
import 'package:uuid/uuid.dart';

void sendText(String rawText, String roomId) {
    var uuid = const Uuid();
    
    // 1. Sinh UUIDv7
    String messageId = uuid.v7();
    
    // 2. Encryption (Minh họa sử dụng Crypto)
    String encryptedMsg = encrypt(text: rawText, key: myRoomSharedKey);
    
    // 3. Gửi đi
    final msgParams = jsonEncode({
        "message_id": messageId,
        "room_id": roomId,
        "ciphertext": encryptedMsg,
        "aad_data": ""
    });
    
    channel.sink.add(msgParams);
    
    // Thêm tin nhắn vào mảng UI ngay lập tức với trạng thái "Đang Gửi..." (Optimistic Update)
    appendMessageToUI(messageId, rawText, status: "pending");
}
```

---

## 6. Xử Lý Phản Hồi Từ Server

NodeJS Server trả về cho App của bạn 3 loại sự kiện (Events) chính liên quan tới luồng Chat:

* **Sự kiện `ack` (Acknowledge):** Dành riêng cho người GỬI. Ngay khi Server nhét tin nhắn thành công vào Kafka, server sẽ báo cho bạn biết để bạn chớp UI từ trạng thái `Đang Gửi` sang `Đã Gửi`. Nó kèm theo `server_ts` (thời điểm server xác nhận).
* **Sự kiện `message`:** Dành cho NHỮNG NGƯỜI CÒN LẠI trong phòng. Báo có 1 tin nhắn ai đó vừa gửi Realtime cho nhóm. Bạn cần bắt lấy, giải mã (Decrypt), rồi nhét vào Bubble chat hiển thị lên màn hình.
* **Sự kiện `system` / `error`:** Cảnh báo hoặc cập nhật từ cục hệ thống.

```javascript
// Minh hoạ hàm handleServerEvent(payload) viết JS/Dart
function handleServerEvent(payload) {
   switch (payload.type) {
      case 'ack':
        // Cập nhật dao diện tại dòng có message_id thành công
        updateMessageStatus(payload.message_id, 'sent', payload.server_ts);
        break;
        
      case 'message':
        // Có tin nhắn vừa đáp tới group
        const incomingData = payload.data; 
        /* 
           incomingData gồm: message_id, room_id, ciphertext, sender_id, server_ts, aad_data 
        */
        const plainText = decrypt(incomingData.ciphertext);
        drawNewBubbleToScreen(incomingData.sender_id, plainText);
        break;
        
      case 'error':
        // Cảnh báo: "Invalid Message ID" do sinh sai chuẩn UUIDv7 hoặc bị Timeout
        alert(payload.message);
        break;
   }
}
```

---

## 7. Đồng Bộ Lịch Sử & Paging (Offline Sync API)

Khi App bị đóng, hoặc mất kết nối mạng, người dùng truy cập lại sẽ bị thiết hụt vài tin nhắn lúc nghỉ trưa. FE/Mobile không được Fetch tất cả, mà thực hiện cơ chế Pagination qua HTTP REST API với `after_server_ts`.

### Endpoint GET
`GET /api/v1/messages/sync?room_id=ROOM_VIP_1&limit=50&after_server_ts=1773196184426`

* `room_id`: Mã định danh phòng chat (Bắt buộc)
* `limit`: Tối đa lấy 100 dòng mỗi lần lướt ngón tay. (Default: 50)
* `after_server_ts`: Timestamp (`server_ts`) của dòng text **Cuối Cùng** mà App của bạn đang lưu. Nếu đây là lần đầu mở App (chưa cache ở local sqlite), bạn không truyển param này để Server chủ động trả về 50 tin nhắn mới nhất đổ xuống.

### Mẫu trả về (Response - Status 200 OK)
```json
{
  "success": true,
  "data": [
    {
      "message_id": "019cdaba-8b67-77bf-899f-b8790385574d",
      "room_id": "ROOM_VIP_1",
      "sender_id": "user_Alice",
      "server_ts": 1773196184426,
      "ciphertext": "uO8bU9z+4Q...",
      "aad_data": "group_header_info"
    },
    ...
  ]
}
```

### Kiến Trúc Fetching (Gap Strategy)
**Tuyệt đối không đệ quy móc sạch data của 1 năm tải về.**

1. User mở ứng dụng và ấn vào group `ROOM_VIP_1`.
2. Truy vấn cache nội tại (SQLite) để load nhanh UI. Lấy 50 dòng mới nhất.
3. Song song đó, gọi HTTP tải về 50 tin nhắn **mới nhất** lúc này từ Server.
4. Giữa thời điểm User đóng App hôm qua đến lúc mở App lấy 50 tin hôm nay, có thể sẽ "hụt" (Gap) mất 200 tin nhắn nhắn buổi đêm. Frontend KHÔNG tự động đệ quy tải 200 tin này.
5. Ui sẽ sinh ra một thẻ "Khoảng Trống" (Gap Marker) ví dụ: *"Có x tin nhắn ở giữa. Nhấn để tải"*.
6. CHỈ KHI User lấy tay kéo màn hình (Scroll) lên chui vào khe hụt đó, Client mới gọi API HTTP bắt đầu ở Timestamp của "Mép dưới của Gap", lấy từng block 50 tin đắp vào.

---

## 8. Error Codes Reference

### HTTP Status Codes

| HTTP Status | Ý nghĩa | Khi nào |
|-------------|----------|---------|
| 400 | Bad Request | Thiếu field, sai format |
| 401 | Unauthorized | Token hết hạn, sai password, missing auth |
| 403 | Forbidden | Không phải member / không phải admin |
| 405 | Method Not Allowed | Sai HTTP method |
| 409 | Conflict | Email đã tồn tại |

### WebSocket Error Codes

| WS Error Code | Ý nghĩa |
|----------------|---------|
| `TOKEN_EXPIRED` | JWT hết hạn hoặc invalid |
| `INVALID_AUTH_FRAME` | Frame auth sai format (expected `{ type: "auth", token: "<jwt>" }`) |
| `Not a member of this room` | Join/gửi tin vào room không phải thành viên |

