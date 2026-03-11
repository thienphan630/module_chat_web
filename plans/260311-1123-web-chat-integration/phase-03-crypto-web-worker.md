# Phase 3: Crypto Engine (Web Worker)

## Context Links
- Blueprint: `brainstormer-260311-1120-web-chat-integration-final.md`

## Overview
**Priority:** High
**Status:** Not Started
**Description:** Chuyển tải thuật toán sinh định danh `UUIDv7`, cùng logic E2E Encrypt/Decrypt Text Message và Media (`FileKey`) sang một Background Web Worker để UI không bị treo cứng (Drop Frame) khi nhận/gửi số lượng lớn message lúc Fetch API Gap.

## Requirements
- Dùng `Web Crypto API` chạy độc lập, giao tiếp với luồng chính bằng `postMessage`/`onmessage`.
- Sinh FileKey ảo bằng `AES-256-GCM`, mã hóa File Blob trước khi upload S3. Mã hóa ngược Text (mang thông tin URL S3 file + fileKey) bằng Shared Room Key.
- Sinh `UUIDv7` tại Client chuẩn time-based sortable.

## Architecture / Structure
```typescript
// Dữ liệu trao đổi giữa UI (Main Thread) và Cryptography Worker.
interface WorkerRequest {
  id: string; // tracking task
  action: 'ENCRYPT_TEXT' | 'DECRYPT_TEXT' | 'ENCRYPT_FILE' | 'GEN_UUID';
  payload: any;
  roomKey?: string;
}

interface WorkerResponse {
  id: string;
  result: any;
  error?: string;
}
```

## Implementation Steps
1. Khởi tạo file `crypto.worker.ts`.
2. Trong worker, implement hàm tạo UUIDv7, hàm Encrypt Plaintext -> Ciphertext, hàm Decrypt Ciphertext -> Plaintext, và FileKey Encryption (Blob payload).
3. Đính vào ứng dụng qua `new Worker(...)` (cấu hình của Vite cho phép `export default Worker from ...?worker`).
4. Thiết lập Wrapper kiểu Promise (Promise-based Message Wrapper) để Main Thread React gọi code như hàm `Async/Await` thay vì phải hứng `onmessage` hỗn loạn.
Ví dụ: `const ciphertext = await runWorkerTask('ENCRYPT_TEXT', payload, groupKey);`

## Todo List
- [ ] Setup `crypto.worker.ts` & Configure Vite build for worker
- [ ] Implement `UUIDv7` generation function
- [ ] Implement Web Crypto API `AES-GCM` encrypt/decrypt logic
- [ ] Create Promise Request-Reply flow helper cho giao tiếp Main-Worker
- [ ] Viết UnitTest (Test Worker logic độc lập không cần UI).

## Security Considerations
- Đảm bảo Master Keys gửi vào Worker để giải mã sẽ bị giới hạn quyền truy xuất. File Worker không nhúng Script mờ ám thứ 3 (tránh đánh cắp Khóa qua CDN lạ bị tấn công).
