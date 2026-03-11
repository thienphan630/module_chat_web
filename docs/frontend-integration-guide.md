# Frontend Integration Guide (Web, Desktop, Mobile)

Tài liệu này hướng dẫn cách kết nối và thao tác với **Core Chat Backend** từ các nền tảng Frontend (Web/Next.js, Desktop/Electron, Mobile/Flutter).

Hệ thống được thiết kế theo chuẩn bảo mật **E2EE (End-to-End Encryption)**, Server hoàn toàn "mù" và chỉ nhận/phát/lưu trữ Ciphertext. Mọi thao tác sinh ID (`UUIDv7`) tĩnh và mã hóa phải được thực hiện trên thiết bị của User (Client-side).

---

## 1. Kết nối Real-Time (WebSocket)

Mọi Real-time Event (Gửi nhận chat, nhận thông báo) đều đi qua WebSocket Gateway.  
**Bảo mật:** KHÔNG truyền JWT Token qua URL Query String để tránh rò rỉ log trên Server. Token phải được đính kèm ở bản tin Payload `auth` đầu tiên.

### Endpoint
* **URL:** `ws://<domain-cua-ban>:8080` *(Môi trường dev: `ws://localhost:8080`)*

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

---

## 2. Quản lý Phòng Chat (Rooms) và Metadata

*   **QUAN TRỌNG VỀ METADATA:** Tên phòng, Ảnh đại diện (Avatar), và User Profile **KHÔNG áp dụng mã hóa E2EE**. Việc Render danh sách Room sẽ sử dụng REST API thông thường bằng Plaintext (bảo vệ bằng TLS/HTTPS) để đảm bảo hiệu năng tối ưu nhất trên Mobile/Web. E2EE **CHỈ** áp dụng cho "Thân Tin Nhắn" (`ciphertext`).

Kiến trúc backend hiện tại giới hạn người dùng chỉ nhận dòng sự kiện chat từ những nhóm/phòng (Rooms) mà họ chủ động Báo Cáo "JOIN" lên server.

Mẫu lệnh JSON gửi đi (Client -> Server):
```json
// Khi người dùng bấm vào 1 Group Chat
{
   "type": "join",
   "room_id": "ROOM_VIP_1"
}

// Khi người dùng thoát khỏi màn hình Group Chat (Thu hồi tài nguyên mạng)
{
   "type": "leave",
   "room_id": "ROOM_VIP_1"
}
```

---

## 3. Gửi Tin Nhắn (Bảo Mật E2EE)

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

## 4. Xử Lý Phản Hồi Từ Server

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

## 5. Đồng Bộ Lịch Sử & Paging (Offline Sync API)

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
