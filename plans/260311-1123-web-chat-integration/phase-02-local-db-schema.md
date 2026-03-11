# Phase 2: Local Database (IndexedDB) & Schema

## Context Links
- Blueprint: `brainstormer-260311-1120-web-chat-integration-final.md`

## Overview
**Priority:** High
**Status:** Completed
**Description:** Thiết lập `Dexie.js` quản lý IndexedDB. Tối ưu hóa Table Schema để có thể lọc dữ liệu tốc độ cao (indexing) cho thuật toán Gap Strategy (Tìm khoảng trống tin nhắn).

## Requirements
- Dữ liệu lưu xuống IndexDB KHÔNG bao gồm text thô (plaintext) trừ trường hợp đã giải mã thành công (tùy vào luồng xử lý), tốt nhất là lưu dưới dạng Plaintext khi đã tải xuống và Worker đã giải mã, giúp App Offline vẫn đọc lại lịch sử cũ mà không cần chạy lại giải mã.
- Index khép kín kết hợp Compound Index cho truy vấn: `room_id` + `server_ts`.
- Bảo quản E2EE Keys bằng Store riêng.

## Architecture / Schema Design
```typescript
class ChatDatabase extends Dexie {
    messages!: Table<Message, string>; // uuidv7 làm khóa chính
    roomKeys!: Table<GroupKey, string>; // room_id làm khóa chính
    
    constructor() {
        super('CoreChatDB');
        this.version(1).stores({
            // Sắp xếp Index bằng server_ts (để load pagination) và status
            messages: 'message_id, [room_id+server_ts], status',
            roomKeys: 'room_id'
        });
    }
}
```

## Implementation Steps
1. Cài đặt file `db.ts` (hoặc module tương tự).
2. Xây dựng Data Access Objects (DAO) hoặc helper function: `getLatestMessages(roomId, limit)`, `insertMessages(messages)`, `clearRoom(roomId)`.
3. Cài đặt Hàm dò Gap Marker: `detectGap(roomId, newServerMessageBatch)`. So sánh `server_ts` cổ nhất của batch với `server_ts` mới nhất của Local DB. Nếu lệch quá lớn, trả về `hasGap: true`.
4. Tạo Table trư trữ SharedGroupKey để Worker xài lúc mã hóa/giải mã.

## Todo List
- [x] Setup file `db.ts` chứa Dexie Schema.
- [x] Define Message interfaces (ID, Text, Sender, Timestamp, Status).
- [x] Viết hàm `fetchMessages(roomId, limit)`.
- [x] Viết hàm lưu và cập nhật trạng thái `pending -> sent`.

## Risk Assessment
- Xóa Cache trình duyệt sẽ bay mất Database, mất mọi Key mã hóa -> Cần phải tính phương án người dùng xuất Backup File (JSON).
