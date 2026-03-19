# Frontend Integration Guide: Realtime Room Events

Tài liệu này mô tả cách tích hợp các luồng Realtime (qua WebSocket) liên quan đến quản lý nhóm (Room Management).
Bên cạnh các WebSocket Event cũ (`auth`, `message`, `typing`), Backend sẽ phát thêm các Event mới thuộc nhóm **System / Personal Management.**

## 1. Flow Tổng Quan

Trước đây, FE hoàn toàn dựa vào API `GET /api/v1/rooms` (hoặc refresh app) để thấy được mình đang ở trong các nhóm nào.
Sắp tới, Server sẽ chủ động push thông tin về thiết bị FE ngay khi có sự thay đổi.

**Nhiệm Vụ của FE:**
Lắng nghe message từ WebSocket. Nếu type là `room_added` hoặc `room_removed`, thì cập nhật lại Global State (Redux / Context / Zustand / Riverpod).

---

## 2. Personal Events (Được nhận ngay cả khi chưa Join Room socket)

Các event này định tuyến đích danh vào thiết bị của bạn. Không cần biết bạn đang mở màn hình chat nào, miễn là WebSocket còn sống, thông báo sẽ về.

### 2.1. Event: `room_added` (Bạn được đưa vào một phòng mới)
Trigger: 
- Ai đó tạo phòng (group/direct) và có chứa id của bạn.
- Ai đó sử dụng tính năng Add Members và mời bạn vào nhóm.

**Payload nhận được từ WebSocket:**
```json
{
  "type": "room_added",
  "room": {
    "room_id": "018e5a7b-3b3a-7f12-9c31-90a1b2c3d4e5",
    "name": "Team Backend",
    "type": "group",
    "avatar_url": null,
    "role": "member",
    "joined_at": "2024-03-20T00:00:00.000Z"
  },
  "added_by": "user_id_nguoi_moi" 
}
```

**Hành động của FE:**
1. Thêm object `room` vào danh sách List Rooms trên UI ngay lập tức.
2. (Tùy chọn) Show popup/toast notification: *"User ABC vừa thêm bạn vào nhóm Team Backend"*.
3. Nếu FE architecture yêu cầu phải Join socket cho tất cả các room đang hiện diện để nghe tin nhắn, **hãy bắn ngay ngược lên server một lệnh JOIN**:
   `{ "type": "join", "room_id": "<new_room_id>" }`

### 2.2. Event: `room_removed` (Bạn bị xóa hoặc tự rời khỏi phòng)
Trigger:
- Bạn bị Admin của phòng đá ra ngoài (Kick).
- (Optional) Phòng chat bị giải tán toàn bộ.

**Payload nhận được từ WebSocket:**
```json
{
  "type": "room_removed",
  "room_id": "018e5a7b-...",
  "reason": "kicked",
  "removed_by": "user_id_cua_admin"
}
```

**Hành động của FE:**
1. Rút (Delete) phòng chat này khỏi danh sách List Rooms trên UI.
2. Nếu người dùng đang đứng ở trong màn hình chat của phòng này, hãy văng họ ra trang chủ (Home) và bắn thông báo: *"Bạn đã bị xóa khỏi nhóm"*.
3. Chủ động gửi thông điệp LEAVE socket cho server bằng cách bắn ngược lên:
   `{ "type": "leave", "room_id": "<room_id_bị_xóa>" }`

---

## 3. Room-level Events (Chỉ nhận được nếu đã gọi lệnh `{ type: "join" }` cho room đó)

Đây là những thông báo liên quan đến **người khác**, diễn ra bên trong phòng chat. Bạn phải gọi lệnh Join trước thì server mới push những event này giới hạn về cho bạn.

### 3.1. Event: `member_joined` (Có người khác vào phòng)
**Payload:**
```json
{
  "type": "member_joined",
  "room_id": "018e5a7b-...",
  "user_id": "id_nguoi_moi",
  "role": "member",
  "joined_at": "2024-03-20T..."
}
```
**Hành động của FE:**
Cập nhật danh sách thành viên của màn hình "Room Details". Hoặc in ra màn hình chat một bong bóng mờ: *"Người dùng XYZ vừa tham gia"*.

### 3.2. Event: `member_left` (Có người khác bị kick / tự thoát)
**Payload:**
```json
{
  "type": "member_left",
  "room_id": "018e5a7b-...",
  "user_id": "id_nguoi_bi_xoa"
}
```
**Hành động của FE:**
Xóa member đó khỏi danh sách nội bộ trên UX. In ra màn hình chat: *"Người dùng XYZ đã rời nhóm"*.

---

## Tổng kết đối với FE
1. Code xử lý WebSocket Reducer/Switch-case cần đẻ thêm 4 type: `room_added`, `room_removed`, `member_joined`, `member_left`.
2. Giao diện thay vì phải Fetch API List Rooms lù đù, giờ đây sẽ chạy "Tức thì" (Instant).
3. Khi nhận `room_added`, FE phải chủ động gửi lên lệnh `join` để tiếp tục bắt sóng Event nội tại (message, typing) của room đó. Server không tự nhồi FE vào channel đó đâu (Separation of Concerns).
