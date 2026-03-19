# Core Chat E2EE — Web Client

Ứng dụng chat thời gian thực với mã hóa đầu cuối (End-to-End Encryption) sử dụng React, TypeScript và Vite.

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

**Core Chat E2EE** là web client cho hệ thống chat bảo mật. Toàn bộ nội dung tin nhắn được mã hóa trên thiết bị người dùng (client-side) trước khi gửi lên server — server chỉ nhận/phát/lưu trữ ciphertext mà không thể đọc được nội dung.

### Tính năng chính

- 🔒 **End-to-End Encryption** — Mã hóa ChaCha20-Poly1305 / AES-GCM qua Web Worker
- 🇻🇳 **Giao diện Tiếng Việt** — Toàn bộ UI được Việt hóa ngôn từ ngắn gọn, dễ hiểu
- ⚡ **Real-time Messaging** — WebSocket với auto-reconnect và exponential backoff
- 📂 **Offline-first** — Lưu trữ cục bộ bằng IndexedDB (Dexie.js), hoạt động khi mất mạng
- 🔄 **Optimistic UI** — Tin nhắn hiển thị ngay khi gửi, cập nhật trạng thái khi server xác nhận
- 📜 **Gap Detection** — Tự động phát hiện khoảng trống tin nhắn khi offline, hỗ trợ tải bổ sung
- 🗃️ **Message Queue** — Hàng đợi tin nhắn khi mất kết nối, tự động gửi lại khi reconnect

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
| [libsodium](https://doc.libsodium.org) | Cryptographic operations (E2EE) |
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
├── api/                       # (Reserved) API integration layer
├── assets/                    # Static assets (images, fonts)
│
├── components/                # UI Components
│   ├── chat/
│   │   ├── ChatWindow.tsx     # Khung chat chính — hiển thị tin nhắn theo room
│   │   ├── InputArea.tsx      # Ô nhập tin nhắn + gửi
│   │   ├── MessageBubble.tsx  # Bóng chat đơn lẻ (sent/received)
│   │   ├── GapMarker.tsx      # Thẻ "Có x tin nhắn ở giữa. Nhấn để tải"
│   │   └── RoomList.tsx       # Sidebar danh sách phòng chat
│   └── layout/                # (Reserved) Layout components
│
├── features/                  # Feature modules
│   ├── chat/                  # (Reserved) Chat feature logic
│   └── rooms/                 # (Reserved) Room management logic
│
├── hooks/                     # Custom React hooks
│
├── lib/
│   └── api.ts                 # API client — mock REST endpoints (getRooms, syncMessages, uploadFile)
│
├── services/
│   └── SocketService.ts       # WebSocket singleton — connect, auth, send, reconnect, queue flush
│
├── store/
│   └── chatStore.ts           # Zustand store — connectionStatus, currentRoomId, sendQueue
│
├── types/
│   └── chat.types.ts          # TypeScript types — ChatMessage, RoomKey, WS_Payload
│
├── utils/
│   └── db.ts                  # Dexie.js database — CRUD messages, room keys, gap detection
│
└── workers/
    ├── crypto.worker.ts       # Web Worker — encrypt/decrypt operations (libsodium)
    ├── cryptoClient.ts        # Client wrapper giao tiếp với crypto worker
    ├── crypto.types.ts        # Types cho worker messages
    └── crypto.test.ts         # Unit tests cho crypto
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

Tạo file `.env` ở thư mục gốc (hoặc chỉnh sửa file có sẵn):

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
| `VITE_API_URL` | Base URL cho REST API (đồng bộ tin nhắn, upload, rooms) | `http://localhost:3000` |
| `VITE_WS_URL` | URL WebSocket Gateway (real-time messaging) | `ws://localhost:8080` |

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
[Crypto Worker] ──► Mã hóa text → ciphertext (ChaCha20-Poly1305)
    │
    ▼
[SocketService] ──► Gửi WS payload { message_id, room_id, ciphertext }
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
[Crypto Worker] ──► Giải mã ciphertext → plaintext
    │
    ▼
[Dexie DB] ──► Lưu message vào IndexedDB
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
    └── Có gap → Hiển thị GapMarker: "Có x tin nhắn. Nhấn để tải"
                      │
                      ▼
                 User tap "Tải" → Fetch thêm block 50 tin
```

### WebSocket Events

| Event | Hướng | Mô tả |
|---|---|---|
| `auth` | Client → Server | Xác thực JWT token sau khi connect |
| `join` | Client → Server | Tham gia lắng nghe events của room |
| `leave` | Client → Server | Rời room, thu hồi tài nguyên mạng |
| `message` | Cả hai chiều | Gửi/nhận tin nhắn mã hóa |
| `ack` | Server → Client | Xác nhận server đã nhận tin nhắn thành công |
| `error` | Server → Client | Thông báo lỗi (TOKEN_EXPIRED, INVALID_UUID, ...) |
| `system` | Server → Client | Thông báo hệ thống |

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

- **Zustand** (`chatStore.ts`) — Quản lý trạng thái global: connection status, current room, send queue
- **TanStack Query** — Server state: danh sách rooms, sync messages
- **Dexie.js** (`db.ts`) — Persistent storage: messages, room keys (IndexedDB)

### Mã Hóa (E2EE)

- Mọi thao tác mã hóa/giải mã chạy trong **Web Worker** (`crypto.worker.ts`) để không block UI thread
- Sử dụng **libsodium** (ChaCha20-Poly1305)
- Client tự sinh `message_id` theo chuẩn **UUIDv7** (time-based sorting)
- Server **không bao giờ** nhìn thấy plaintext

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
  ciphertext: '...',
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
await addMessage({ message_id: '...', room_id: '...', ... })

// Cập nhật trạng thái
await updateMessageStatus('message-id', 'sent', serverTimestamp)
```

---

## Tài Liệu Liên Quan

- [Frontend Integration Guide](./docs/frontend-integration-guide.md) — Hướng dẫn tích hợp chi tiết với Backend (WebSocket, REST API, E2EE flow)
