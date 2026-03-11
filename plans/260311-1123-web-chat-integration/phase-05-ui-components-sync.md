# Phase 5: Giao diện chính (UI Components & Logic Đồng Bộ Gap Strategy)

## Context Links
- Blueprint: `brainstormer-260311-1120-web-chat-integration-final.md`
- Frontend Guide: `frontend-integration-guide.md`

## Overview
**Priority:** High
**Status:** Not Started
**Description:** Lắp ghép giao diện Web Front-end 2 mảng: Mảng Room List Sidebar (Không áp dụng E2EE, nhận từ HTTPS) & Mảng Room Detail Chat (Box hiển thị Tin nhắn E2EE, Scroll lấp Gap). Quản lý Event Gửi/Nhận của User từ UI.

## Requirements
- Dùng `TanStack Query` lấy MetaData Avatar, Room Name (vì server không mã hóa E2EE, truyền qua HTTPS an toàn thông thường).
- Chia React Components thành Sidebar (`<RoomList />`), Nút Bấm, `<ChatWindow />`, `<InputArea />`.
- `<GapMarker/>`: Hiển thị "Tải tin nhắn thiếu..." thay vì tự cuộn vòng đệ quy nát Data. Lazy Loading trên Viewport Intersection Observer.

## Architecture / Render Strategy
```tsx
const ChatWindow = () => {
    // Luồng dữ liệu Local: Lấy trực tiếp từ Zustand Array, hoặc Hook `useLiveQuery` của Dexie.
    const messages = useLiveQuery(() => db.messages.where({ room_id: currentRoom }).sortBy('server_ts'));
    // Render
    return (
       <div className="chat-container overflow-y-auto">
            {messages.map((msg, index) => {
               const hasGap = detectGap(msg, messages[index - 1]);
               return (
                   <>
                       {hasGap && <GapMarker from_ts={msg.server_ts} to_ts={messages[index-1].server_ts} />}
                       <MessageBubble data={msg} />
                   </>
               )
            })}
       </div>
    )
}
```

## Implementation Steps
1. Khởi tạo `TanStack Query Provider` ở root, gọi API `GET /api/v1/rooms` vẽ lên Sidebar bằng Avatar và tên (TLS).
2. Khi User Click 1 Room Sidebar: Bắn tín hiệu WebSocket `{type: "join", room_id: ...}`. Ngắt Room cũ bằng `{type: "leave", room_id: ...}`. Cập nhật Zustand `currentRoomId`.
3. Khi Input Text Area `Enter` -> Bắn hàm UI: Đẩy Chuỗi Input -> Hàm Encrypt Text (Dựng ở Worker Phase 3) -> Async Await -> Ra Mã `ciphertext`.
4. Gọi SocketSend(ciphertext, UUIDv7 gen từ worker). Vẽ ngay Message đỏ (Trạng thái \`pending\`) trên UI. Đợi Ack \`server_ts\` -> Chỉnh thành tick xanh.
5. Setup `IntersectionObserver` cho `<GapMarker />`. Nếu User cuộn trúng, Trigger hàm API: `GET /api/v1/messages/sync?after_server_ts=GAP_END`.

## Todo List
- [ ] Thiết kế `Layout` chính (Sidebar Left, Chat Window Right).
- [ ] Render Room List UI. Hook `useQuery` fetch MetaData.
- [ ] Cài đặt IntersectionObserver Hook & Render Gap Marker node.
- [ ] Render Message Bubble Array từ kết quả `Dexie LiveQuery`. 
- [ ] Xử lý Input Form (`textarea`) và nút Gửi, gửi dữ liệu cho Web Worker lấy Cyphertext.
- [ ] Nút Up file, call Worker mã hóa `AES-GCM` gen Blob up qua API `/api/upload`.

## Success Criteria
- Vuốt lên Gap -> Gap Biến mất -> Cục text xen kẽ đúng Timestamp xuất hiện.
- Thấy Icon Clock "Pending" và Tick Xanh "Sent" khi bắn text. 
- Mượt mà không lag khung hình (Worker gánh E2EE).
