# Frontend Integration Guide: User Search API

Tài liệu này mô tả cách tích hợp API tìm kiếm người dùng (`/api/v1/users/search`) vào Frontend.

---

## 1. Endpoint

```
GET /api/v1/users/search?q={query}
```

| Thuộc tính | Giá trị |
|---|---|
| Method | `GET` |
| Auth | `Authorization: Bearer <access_token>` (Bắt buộc) |
| Query Param | `q` — chuỗi tìm kiếm (tối thiểu 1 ký tự) |

---

## 2. Response

### 2.1. Thành công (200 OK)

Trả về mảng JSON chứa danh sách user khớp với từ khóa.  
**Lưu ý:** User đang đăng nhập (người gửi request) sẽ **tự động bị loại** khỏi kết quả trả về.

```json
[
  {
    "user_id": "019d06cf-dc73-73f6-b487-c4a27ec164c1",
    "username": "nguyen_van_a",
    "email": "a@example.com"
  },
  {
    "user_id": "019d070d-48d9-7822-8eb2-07456895a1b0",
    "username": "tran_van_b",
    "email": "b@example.com"
  }
]
```

### 2.2. Thiếu query (400 Bad Request)

```json
{ "error": "Search query is required (q parameter)" }
```

### 2.3. Không có token (401 Unauthorized)

```json
{ "error": "Missing or invalid token" }
```

---

## 3. Cơ chế tìm kiếm

- Tìm kiếm **không phân biệt hoa thường** (case-insensitive).
- So khớp **substring** trên hai trường: `username` và `email`.
- Ví dụ: Gõ `"ngu"` sẽ khớp user có `username: "nguyen_van_a"`.
- Trả tối đa **20 kết quả**.

---

## 4. Hướng dẫn tích hợp cho FE

### 4.1. Khai báo hàm gọi API (ví dụ trong `lib/api.ts`)

```typescript
async searchUsers(query: string): Promise<UserSearchResult[]> {
  const res = await fetch(
    `${BASE_URL}/api/v1/users/search?q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    }
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}
```

### 4.2. Sử dụng trong Component tìm kiếm

```tsx
const handleSearch = async () => {
  if (!query.trim()) return;
  setIsSearching(true);
  try {
    const users = await api.searchUsers(query);
    setResults(users);
  } catch (err) {
    console.error('Search failed:', err);
    setResults([]); // Không dùng fallback giả user_id nữa
  } finally {
    setIsSearching(false);
  }
};
```

> ⚠️ **QUAN TRỌNG:** Tuyệt đối **KHÔNG** sử dụng fallback lấy chuỗi người dùng gõ làm `user_id` giả khi API lỗi. Điều này sẽ dẫn tới tạo room ảo mà không có thành viên thực.

### 4.3. Type Definition

```typescript
interface UserSearchResult {
  user_id: string;   // UUID v7
  username: string;
  email: string;
}
```

---

## 5. Luồng hoạt động đầy đủ: Tạo nhóm mới

```
┌──────────────────────────────────────────────────────┐
│  User gõ tên vào ô tìm kiếm                         │
│  ↓                                                   │
│  FE gọi: GET /api/v1/users/search?q=nguyen           │
│  ↓                                                   │
│  BE trả về: [{ user_id: "019d...", username: ... }]   │
│  ↓                                                   │
│  User chọn người muốn thêm từ danh sách              │
│  ↓                                                   │
│  FE gọi: POST /api/v1/rooms                          │
│  Body: { type: "group", name: "...",                  │
│          member_ids: ["019d06cf-..."] }                │
│  ↓                                                   │
│  BE validate tất cả member_ids tồn tại trong DB      │
│  ↓                                                   │
│  Tạo room thành công → Tất cả thành viên nhận được   │
│  event "room_added" qua WebSocket                    │
└──────────────────────────────────────────────────────┘
```

---

## 6. Error Handling từ phía Backend khi tạo Room

| Tình huống | HTTP Status | Error Message |
|---|---|---|
| Không có `member_ids` hoặc rỗng | `400` | `Group room requires at least one other member` |
| Tất cả member_ids đều không tồn tại | `400` | `None of the specified members exist` |
| Chỉ thêm chính mình vào nhóm | `400` | `Group room requires at least one other member` |
| Direct chat thiếu người | `400` | `Direct room requires exactly one other member` |
| Direct chat với user không tồn tại | `400` | `Target user not found` |

FE nên hiển thị `error` message từ response body dưới dạng toast/alert cho người dùng.
