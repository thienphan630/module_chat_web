# Core Chat — Web Client

Ứng dụng chat thời gian thực sử dụng React, TypeScript và Vite.

## Mục Lục

- [Tổng Quan](#tổng-quan)
- [Tech Stack](#tech-stack)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Biến Môi Trường](#biến-môi-trường)
- [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
- [Scripts](#scripts)
- [Hướng Dẫn Phát Triển](#hướng-dẫn-phát-triển)

---

## Tổng Quan

**Core Chat** là web client cho hệ thống chat thời gian thực. Hỗ trợ nhắn tin nhóm và cá nhân qua WebSocket, đồng bộ tin nhắn offline-first, và quản lý nhóm chat.

### Tính năng chính

- 🇻🇳 **Giao diện Tiếng Việt** — Toàn bộ UI được Việt hóa ngôn từ ngắn gọn, dễ hiểu
- ⚡ **Real-time Messaging** — WebSocket với auto-reconnect và exponential backoff
- 📂 **Offline-first** — Lưu trữ cục bộ bằng IndexedDB (Dexie.js), hoạt động khi mất mạng
- 🔄 **Optimistic UI** — Tin nhắn hiển thị ngay khi gửi, cập nhật trạng thái khi server xác nhận
- 📜 **Gap Detection** — Tự động phát hiện khoảng trống tin nhắn khi offline, hỗ trợ tải bổ sung
- 🗃️ **Message Queue** — Hàng đợi tin nhắn khi mất kết nối, tự động gửi lại khi reconnect
- 💬 **Room List** — Preview tin nhắn cuối, badge chưa đọc, sắp xếp theo hoạt động mới nhất
- 🗑️ **Message Delete** — Xóa tin nhắn qua REST API, cập nhật real-time qua WebSocket
- 👤 **User Profile** — Fetch profile sau login, cập nhật username/avatar

---

## Tech Stack

| Công nghệ | Mục đích |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [TypeScript 5.9](https://www.typescriptlang.org) | Type safety |
| [Vite 7](https://vite.dev) | Build tool & dev server |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling |
| [Zustand](https://zustand.docs.pmnd.rs) | State management (connection status, send queue) |
| [TanStack React Query](https://tanstack.com/query) | Server state & data fetching |
| [Dexie.js](https://dexie.org) | IndexedDB wrapper (offline storage) |
| [Lucide React](https://lucide.dev) | Icon library |
| [Axios](https://axios-http.com) | HTTP client |
| [uuid](https://github.com/uuidjs/uuid) | UUIDv7 generation (message ID) |

---

## Cấu Trúc Thư Mục

```
src/
├── App.tsx                    # Root component — layout chính (sidebar + chat window)
├── main.tsx                   # Entry point — React root, QueryClientProvider
├── index.css                  # Global styles (Tailwind)
│
├── components/                # UI Components
│   ├── auth/
│   │   ├── LoginForm.tsx     # Form đăng nhập
│   │   └── RegisterForm.tsx  # Form đăng ký
│   ├── chat/
│   │   ├── ChatWindow.tsx    # Khung chat chính — hiển thị tin nhắn theo room
│   │   ├── InputArea.tsx     # Ô nhập tin nhắn + gửi
│   │   ├── MessageBubble.tsx # Bóng chat đơn lẻ (sent/received)
│   │   ├── GapMarker.tsx     # Thẻ tải thêm tin nhắn bị bỏ lỡ
│   │   ├── RoomList.tsx      # Sidebar danh sách phòng chat + preview
│   │   ├── UserProfileCard.tsx # Thẻ profile user + nút logout
│   │   ├── MessageContextMenu.tsx # Menu chuột phải: sao chép, xóa
│   │   └── TypingIndicator.tsx # Hiện khi ai đó đang gõ
│   ├── room/
│   │   ├── RoomDetailPanel.tsx # Panel chi tiết nhóm (members, invite, leave)
│   │   ├── CreateRoomModal.tsx # Modal tạo phòng/chat mới
│   │   └── UserSearchModal.tsx # Modal tìm kiếm người dùng
│   └── ui/                    # Reusable UI primitives
│
├── hooks/                     # Custom React hooks
│
├── lib/
│   ├── api.ts                # API client — REST endpoints (auth, rooms, messages, users)
│   ├── axios-instance.ts     # Axios instance với token interceptor
│   └── queryClient.ts        # TanStack Query client
│
├── pages/
│   └── AuthPage.tsx          # Trang đăng nhập/đăng ký
│
├── services/
│   └── SocketService.ts      # WebSocket singleton — connect, auth, send, reconnect
│
├── store/
│   └── chatStore.ts          # Zustand store — auth, connection, profile, queue
│
├── types/
│   └── chat.types.ts         # TypeScript types — ChatMessage, UserProfile, WS_Payload
│
└── utils/
    ├── db.ts                 # Dexie.js database — CRUD messages, gap detection
    └── notification.ts       # Browser notification helper
```

---

## Cài Đặt & Chạy

### Yêu Cầu

- **Node.js** >= 18.x
- **npm** >= 9.x (hoặc tương đương pnpm/yarn)
- **Backend server** đang chạy (WebSocket + REST API)

### Bước 1: Clone & cài dependencies

```bash
git clone <repository-url>
cd chat/web
npm install
```

### Bước 2: Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc:

```bash
cp .env.example .env
# Chỉnh sửa các giá trị phù hợp
```

### Bước 3: Chạy dev server

```bash
npm run dev
```

Mở trình duyệt tại **http://localhost:5173**

### Bước 4: Build cho production

```bash
npm run build
npm run preview   # Preview bản build
```

---

## Biến Môi Trường

Tạo file `.env` ở thư mục gốc project:

```env
# URL của REST API backend
VITE_API_URL=http://localhost:8080

# URL của WebSocket Gateway
VITE_WS_URL=ws://localhost:8080
```

| Biến | Mô tả | Mặc định |
|---|---|---|
| `VITE_API_URL` | Base URL cho REST API | `http://localhost:8080` |
| `VITE_WS_URL` | URL WebSocket Gateway | `ws://localhost:8080` |

> **Lưu ý:** Tất cả biến môi trường dùng trong client phải có prefix `VITE_` để Vite nhận diện.

---

## Kiến Trúc Hệ Thống

### Luồng Gửi Tin Nhắn

```
User nhập text
    │
    ▼
[InputArea] ──► Sinh UUIDv7 (message_id)
    │
    ▼
[SocketService] ──► Gửi WS payload { message_id, room_id, content }
    │                    │
    │                    ├── Online → Gửi ngay
    │                    └── Offline → Đẩy vào sendQueue (Zustand)
    ▼
[Dexie DB] ──► Lưu message local với status: "pending" (Optimistic UI)
    │
    ▼
Server xử lý → Trả "ack" event
    │
    ▼
[SocketService.handleMessage] ──► Cập nhật status: "sent" + server_ts
```

### Luồng Nhận Tin Nhắn

```
Server broadcast event "message"
    │
    ▼
[SocketService.onmessage] ──► Parse WS_Payload
    │
    ▼
[Dexie DB] ──► Lưu message (plaintext content) vào IndexedDB
    │
    ▼
[ChatWindow] ──► Re-render UI với tin nhắn mới
```

### Luồng Đồng Bộ Khi Offline → Online

```
User mở app sau thời gian offline
    │
    ▼
[Dexie DB] ──► Load 50 tin nhắn local mới nhất
    │
    ▼
[REST API] ──► GET /api/v1/messages/sync?room_id=...&limit=50
    │
    ▼
[Gap Detection] ──► So sánh newest_local_ts vs oldest_server_ts
    │
    ├── Không gap → Merge và hiển thị
    └── Có gap → Hiển thị GapMarker: "Nhấn để tải"
                      │
                      ▼
                 User tap "Tải" → Fetch thêm block 50 tin
```

### WebSocket Events

| Event | Hướng | Mô tả |
|---|---|---|
| `auth` | Client → Server | Xác thực JWT token sau khi connect |
| `join` | Client → Server | Tham gia lắng nghe events của room |
| `leave` | Client → Server | Rời room |
| `message` | Cả hai chiều | Gửi/nhận tin nhắn plaintext |
| `ack` | Server → Client | Xác nhận server đã nhận tin nhắn |
| `message_deleted` | Server → Client | Thông báo tin nhắn đã bị xóa |
| `room_updated` | Server → Client | Metadata nhóm thay đổi |
| `room_added` | Server → Client | User được thêm vào nhóm |
| `room_removed` | Server → Client | User bị mời ra khỏi nhóm |
| `typing` / `typing_stop` | Cả hai | Trạng thái đang gõ |
| `user_online` / `user_offline` | Server → Client | Presence |
| `receipt` | Server → Client | Đã đọc tin nhắn |
| `error` | Server → Client | Thông báo lỗi (TOKEN_EXPIRED, ...) |

### REST API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/auth/login` | Đăng nhập |
| POST | `/api/v1/auth/register` | Đăng ký |
| POST | `/api/v1/auth/refresh` | Refresh token |
| POST | `/api/v1/auth/logout` | Đăng xuất |
| GET | `/api/v1/users/me` | Profile hiện tại |
| GET | `/api/v1/users/:id` | Profile public |
| PATCH | `/api/v1/users/me` | Cập nhật profile |
| GET | `/api/v1/rooms` | Danh sách rooms + last_message + unread_count |
| POST | `/api/v1/rooms` | Tạo room mới |
| GET | `/api/v1/rooms/:id` | Chi tiết room |
| PATCH | `/api/v1/rooms/:id` | Cập nhật room (admin) |
| GET | `/api/v1/rooms/:id/members` | Thành viên (paginated) |
| POST | `/api/v1/rooms/:id/members` | Mời thành viên |
| DELETE | `/api/v1/rooms/:id/members/:userId` | Rời/xóa thành viên |
| GET | `/api/v1/messages/sync` | Đồng bộ tin nhắn |
| DELETE | `/api/v1/rooms/:roomId/messages/:messageId` | Xóa tin nhắn |
| POST | `/api/v1/rooms/:roomId/receipts` | Gửi read receipt |

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Khởi chạy dev server (HMR) tại `localhost:5173` |
| `npm run build` | Type-check + build production bundle vào `dist/` |
| `npm run preview` | Preview bản build production |
| `npm run lint` | Chạy ESLint kiểm tra code |

---

## Hướng Dẫn Phát Triển

### Path Alias

Project sử dụng alias `@` trỏ tới thư mục `src/`:

```typescript
// Thay vì:
import { useChatStore } from '../../../store/chatStore'

// Sử dụng:
import { useChatStore } from '@/store/chatStore'
```

### State Management

- **Zustand** (`chatStore.ts`) — Quản lý trạng thái global: auth, connection status, user profile, send queue
- **TanStack Query** — Server state: danh sách rooms, sync messages, room members
- **Dexie.js** (`db.ts`) — Persistent storage: messages (IndexedDB)

### Thêm Component Mới

1. Tạo file trong `src/components/<feature>/`
2. Sử dụng Tailwind CSS cho styling
3. Import types từ `src/types/`
4. Giữ mỗi file dưới **200 dòng** — tách nhỏ nếu cần

### WebSocket Connection

```typescript
import { socketService } from '@/services/SocketService'

// Connect (thường gọi lúc app init)
socketService.connect('your-jwt-token')

// Gửi tin nhắn
socketService.sendMessage({
  message_id: uuidv7(),
  room_id: 'room-1',
  sender_id: 'user-1',
  content: 'Hello!',
  server_ts: Date.now(),
  status: 'pending'
})

// Disconnect
socketService.disconnect()
```

### Database Operations

```typescript
import { getLatestMessages, addMessage, updateMessageStatus } from '@/utils/db'

// Lấy 50 tin nhắn mới nhất
const messages = await getLatestMessages('room-1', 50)

// Thêm tin nhắn mới (optimistic)
await addMessage({ message_id: '...', room_id: '...', content: '...', ... })

// Cập nhật trạng thái
await updateMessageStatus('message-id', 'sent', serverTimestamp)
```

---

## Tài Liệu Liên Quan

- [Frontend Integration Guide](./docs/frontend-integration-guide.md) — Hướng dẫn tích hợp chi tiết với Backend
- [Changelog: Remove E2EE](./docs/changelog-remove-e2ee-complete-api.md) — Chi tiết breaking changes
