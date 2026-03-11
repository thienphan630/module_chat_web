# Phase 4: Hạ tầng WebSocket & Xác thực (Networking Lifecycle)

## Context Links
- Blueprint: `brainstormer-260311-1120-web-chat-integration-final.md`
- Frontend Guide: `frontend-integration-guide.md`

## Overview
**Priority:** High
**Status:** Not Started
**Description:** Thiết lập kết nối Real-time, truyền tải Ciphertext đến Gateway. Không bao giờ lộ JWT qua URL Query bằng cách đóng khung Payload Event Auth đầu tiên ngay khi mở Socket. Quản lý Life-cycle (Tái kết nối ngầm khi mạng rớt/Token hết hạn).

## Requirements
- Thư viện Reconnecting-WebSocket (tự code Exponential Backoff hoặc xài sẵn).
- Phân luồng sự kiện: Auth, Room Join/Leave, Send, Receive (Ack, Message, System, Error).
- Zustand Action: Trạng thái Socket (Connecting, Online, Offline).

## Architecture / Networking Diagram
```typescript
interface WS_Payload {
   type: 'auth' | 'join' | 'leave' | 'ack' | 'message' | 'error' | 'system';
   token?: string;
   room_id?: string;
   message_id?: string;
   server_ts?: number;
   data?: any; // Ciphertext từ user khác khi nhận event message
}
```

## Implementation Steps
1. Xây dựng class/service Singleton: `SocketService.ts` chứa đối tượng `new WebSocket()`.
2. Map Store của Zustand vào: Khi `socket.onopen() -> setIsOnline(true)` và tự push Payload: `{"type": "auth", "token": "..."}`.
3. Listener Event: Bắt `socket.onmessage` parse ra Payload.
   - Nếu `type: 'error', code: 'TOKEN_EXPIRED'` -> Tạm dừng Queue Socket -> Gọi API Axios (REST) lấy JWT mới (`/api/refresh`) -> Cập nhật Local Storage -> Bắn lại lệnh JSON `auth` qua WS hiện tại.
   - Nếu Type `ack` -> Bắn vô Reducer Zustand để gỡ status "Pending" thành "Sent" của dòng Message Text.
   - Nếu Type `message` -> Nhét JSON vào mảng UI và báo hiệu Push Notification nếu khác Room.
4. Triển khai phương án đẩy Queue `Message` nếu rớt mạng. Các lệnh sendText sẽ bị lưu lại trong Object Queue local. Khi mạng có lại `onopen`, nã tuần tự từng tin nhánh (Idempotent UUIDv7).

## Todo List
- [ ] Xây dựng Singleton Socket Service (WebSocket Controller).
- [ ] Connect với Zustand store `ConnectionState`.
- [ ] Code logic Authentication Payload on-connect (tránh leak URI Query).
- [ ] Viết hàm Token Refresh ngầm thay thế khi gặp lỗi "Expired".
- [ ] Viết bộ lọc Dispatch sự kiện (Event Router) (dispatch to UI Reducer).

## Success Criteria
- URL Console Log tuyệt đối sạch sẽ với định dạng thuần `ws://domain:8080/`.
- Cắt mạng Wifi, bật lại, ngầm khôi phục kết nối và nã hàng chờ Send Queue. Cập nhật được các sự kiện Ack server_ts mới để lưu vào Db.
