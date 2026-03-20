# Frontend Integration Guide: Room Members API

Tài liệu hướng dẫn tích hợp API lấy danh sách thành viên phòng chat với **cursor-based pagination**.

---

## 1. Tại sao tách API Members riêng?

Trước đây, `GET /api/v1/rooms/:id` trả danh sách `members` kèm trong response. Với room có hàng nghìn thành viên, điều này gây:
- **Response quá lớn** (500KB+ JSON)
- **Latency cao** — block cả room metadata
- **FE không thể lazy load** — phải load all-or-nothing

Giải pháp: tách API members riêng với pagination, room detail chỉ trả `member_count`.

---

## 2. Thay đổi API Room Detail (Breaking Change)

### GET /api/v1/rooms/:id

**Trước (cũ):**
```json
{
  "success": true,
  "room": {
    "room_id": "...",
    "name": "Nhóm ABC",
    "type": "group",
    "avatar_url": null,
    "created_by": "...",
    "created_at": "..."
  },
  "members": [
    { "user_id": "...", "role": "admin", "joined_at": "..." },
    { "user_id": "...", "role": "member", "joined_at": "..." }
  ]
}
```

**Sau (mới):**
```json
{
  "success": true,
  "room": {
    "room_id": "...",
    "name": "Nhóm ABC",
    "type": "group",
    "avatar_url": null,
    "created_by": "...",
    "created_at": "...",
    "member_count": 42
  }
}
```

> ⚠️ **BREAKING:** Field `members` đã bị xóa. Dùng API mới bên dưới để lấy danh sách members.

---

## 3. API Mới: Danh sách thành viên (Paginated)

```
GET /api/v1/rooms/:roomId/members?limit=50&cursor=<user_id>
```

| Thuộc tính | Giá trị |
|---|---|
| Method | `GET` |
| Auth | `Authorization: Bearer <access_token>` (Bắt buộc) |
| Quyền | Phải là thành viên của room |

### 3.1. Query Parameters

| Param | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `limit` | number | Không | `50` | Số lượng kết quả mỗi trang (1-100) |
| `cursor` | string | Không | — | `user_id` cuối cùng từ trang trước |

### 3.2. Response thành công (200 OK)

```json
{
  "success": true,
  "members": [
    {
      "user_id": "019d06cf-dc73-73f6-b487-c4a27ec164c1",
      "username": "nguyen_van_a",
      "email": "a@example.com",
      "avatar_url": null,
      "role": "admin",
      "joined_at": "2026-03-20T07:00:00.000Z"
    },
    {
      "user_id": "019d070d-48d9-7822-8eb2-07456895a1b0",
      "username": "tran_van_b",
      "email": "b@example.com",
      "avatar_url": null,
      "role": "member",
      "joined_at": "2026-03-20T07:01:00.000Z"
    }
  ],
  "next_cursor": "019d070d-48d9-7822-8eb2-07456895a1b0",
  "has_more": true
}
```

| Field | Type | Mô tả |
|---|---|---|
| `members` | Array | Danh sách thành viên có đầy đủ thông tin user |
| `next_cursor` | string \| null | `user_id` cuối cùng, dùng cho trang kế tiếp. `null` nếu hết |
| `has_more` | boolean | `true` nếu còn trang tiếp theo |

### 3.3. Errors

| HTTP Status | Error Message | Nguyên nhân |
|---|---|---|
| 401 | `Missing or invalid token` | Thiếu hoặc hết hạn JWT |
| 403 | `Not a member of this room` | User không phải thành viên |
| 404 | `Room not found` | Room ID không tồn tại |

---

## 4. Hướng dẫn tích hợp

### 4.1. Type Definitions

```typescript
interface RoomMember {
  user_id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}

interface RoomMembersResponse {
  success: boolean;
  members: RoomMember[];
  next_cursor: string | null;
  has_more: boolean;
}
```

### 4.2. Hàm gọi API

```typescript
async fetchRoomMembers(
  roomId: string,
  limit: number = 50,
  cursor?: string
): Promise<RoomMembersResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const res = await fetch(
    `${BASE_URL}/api/v1/rooms/${roomId}/members?${params}`,
    {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    }
  );
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}
```

### 4.3. Pagination Flow (Infinite Scroll)

```typescript
// State
let allMembers: RoomMember[] = [];
let nextCursor: string | null = null;
let hasMore = true;
let isLoading = false;

// Load first page
async function loadFirstPage(roomId: string) {
  isLoading = true;
  const data = await api.fetchRoomMembers(roomId);
  allMembers = data.members;
  nextCursor = data.next_cursor;
  hasMore = data.has_more;
  isLoading = false;
}

// Load next page (triggered by scroll)
async function loadNextPage(roomId: string) {
  if (!hasMore || isLoading || !nextCursor) return;

  isLoading = true;
  const data = await api.fetchRoomMembers(roomId, 50, nextCursor);
  allMembers = [...allMembers, ...data.members];
  nextCursor = data.next_cursor;
  hasMore = data.has_more;
  isLoading = false;
}
```

---

## 5. Luồng hoạt động

```
┌──────────────────────────────────────────────────────┐
│  User mở phòng chat                                  │
│  ↓                                                   │
│  FE gọi: GET /api/v1/rooms/:id                       │
│  → Nhận room metadata + member_count                 │
│  ↓                                                   │
│  User mở panel "Danh sách thành viên"                │
│  ↓                                                   │
│  FE gọi: GET /api/v1/rooms/:id/members?limit=50      │
│  → Nhận 50 members đầu tiên + has_more=true          │
│  ↓                                                   │
│  User scroll xuống cuối danh sách                     │
│  ↓                                                   │
│  FE gọi: GET /api/v1/rooms/:id/members               │
│            ?limit=50&cursor=<last_user_id>            │
│  → Nhận 50 members tiếp theo                         │
│  ↓                                                   │
│  Lặp lại cho đến khi has_more=false                  │
└──────────────────────────────────────────────────────┘
```

---

## 6. Migration Checklist cho FE

- [ ] Cập nhật type `RoomDetail` — bỏ field `members`, thêm `member_count` vào `room`
- [ ] Thêm API function `fetchRoomMembers()` vào API layer
- [ ] Nơi nào cần danh sách members → gọi API mới thay vì lấy từ room detail
- [ ] Hiển thị `member_count` trên room header/info
- [ ] (Tùy chọn) Implement infinite scroll cho member list panel
