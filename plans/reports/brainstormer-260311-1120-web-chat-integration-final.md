# Brainstorm: Tích hợp Module Chat Frontend Web (Đã Gộp Toàn Diện)

## 1. Yêu cầu & Bài toán (Problem & Requirements)
Dựa trên tất cả các thống nhất kiến trúc mới nhất từ Backend (tham khảo `frontend-integration-guide.md` & `brainstormer-260311-1030-backend-clarifications.md`), mục tiêu của hệ thống là xây dựng ứng dụng Chat Frontend (Web) hỗ trợ **E2EE (End-to-End Encryption)** với yêu cầu khắt khe:
- **WebSocket Gateway:** Giao tiếp thời gian thực, truyền/nhận Ciphertext.
- **Tính năng E2EE Cốt lõi:** Message Body (`ciphertext`) bắt buộc mã hóa/giải mã ở trình duyệt. Mọi việc từ sinh key, mã hóa, đến tạo định danh `UUIDv7` phải thực hiện Client-side.
- **Bảo mật Auth chặt chẽ:** JWT Token dùng để định danh kết nối WS phải được đẩy qua Payload JSON khung đầu tiên (Initial Frame) của WebSocket, tuyệt đối không chèn trực tiếp vào URI Query String vì lý do bảo mật rò rỉ Log Proxy.
- **Giới hạn E2EE (Trọng tâm Tối ưu hóa):** Metadata (Thông tin hiển thị Nhóm, Avatar, Profile người dùng, tên Group) **KHÔNG** mã hóa E2EE mà truyền qua giao thức HTTPS thông thường. Yếu tố này giúp tăng tốc độ tải UI cho Frontend.
- **Quản lý Media/File Tự thân:** Tệp tin lớn phải được mã hóa tại Client, gửi qua S3 và truyền Key nhúng trong tin nhắn chat. Server chối từ trung chuyển File plain-text.
- **Đồng bộ Dữ liệu Cục bộ (Gap Marker):** Nghiêm cấm Frontend vòng lặp đệ quy tải cạn kiệt lịch sử khi tái kết nối sau thời gian Offline. Phải xử lý UI cuộn mượt bằng phương thức Lazy-load đè khoảng trống "History Gaps".

## 2. Các hướng tiếp cận & Đề xuất Giải pháp Kỹ thuật (Evaluated & Recommended Solution)

Dựa trên phân tích sâu các giới hạn và đặc tính, đây là Tech Stack và Kiến trúc hoàn thiện nhất:

### a. Kiến trúc UI & FrameWork
- **Chọn:** **React (Vite) MPA/SPA Mode**.
- **Lý do:** E2EE đồng nghĩa với việc Server-Side Rendering (Next.js) hoàn toàn vô dụng cho component chat, vì mọi text trên server đều vô nghĩa (Ciphertext). React thuần (Vite) sẽ giảm bớt độ phức tạp về Boundary giữa Server/Client.
- **Luồng Render phân tách:**
  - **Sidebar (Room List & Search):** Call API truyền thống, áp dụng `TanStack Query` caching nhanh, vì Metadata không bị mã hóa E2EE.
  - **Chat Area (Message Box):** Luồng độc lập bám vào sự kiện E2EE, nhận Text qua Stream độc quyền từ Web Worker.

### b. Crypto Engine, File Encoding & "Web Worker"
- **Chọn:** Web Crypto API kết hợp giao thức **Signal / OLM (Megolm)**, chạy 100% trong **Web Worker** (`worker.js`).
- **Lý do:** Hàm hash mật mã, giải thuật AES-GCM, sinh UUID, và mã hóa Blob File rất ngốn CPU. Đưa xuống Background Worker giải phóng Main Thread (Trình duyệt UI chạy mượt 60fps).
- **Phân phối Khóa (Key Management):** Thay vì dùng AES tự chế, Frontend/Backend tích hợp chuẩn Megolm. Người Setup phòng khởi tạo "Shared Group Key" truyền đi bằng Asymmetric Key (Lấy Public Key của mems qua `GET /api/v1/keys/:user_id`).
- **File Flow:** User up File -> Worker sinh FileKey (AES-256) -> Mã hóa file -> Upload HTTP S3 -> Lấy S3 URL -> Đóng hộp `{url, fileKey}` vô thân chíp Ciphertext -> Nhả qua Socket.

### c. Cấu trúc Vòng đời Kết nối (Auth Socket Lifecycle)
- **Cơ chế:** Quản lý Connection bằng `Zustand`.
- **Luồng Seamless Auth:** `new WebSocket(...)` -> Vừa onOpen lập tức bắn `{ "type": "auth", "token": "..." }`. Lỡ nhận về Error `TOKEN_EXPIRED` -> Store tự trích xuất JWT Refresh gọi HTTP `POST /api/refresh` đổi lấy token tươi rồi Re-auth ngay lập tức, tự phục hồi không để User gián đoạn.

### d. Chiến lược Đồng bộ (Pagination Gap Strategy)
- **Chọn:** IndexedDB bằng thư viện **Dexie.js**.
- **Lý do & Cách Setup:** LocalStorage bị giới hạn dung lượng nên không thể ôm dữ liệu Text. `Dexie.js` quản lý cực nhanh bằng DB.
- **Mô hình Đồng Bộ (Gap Strategy):**
  - Mở App: Fetch lẹ 50 tin DB Local, song song Fetch 50 tin API Online.
  - Kiểm tra Index timestamp `server_ts`. Nếu 2 đầu thời gian bị hở, UI tự ném 1 Node `<div id="gap">Có dòng tin chưa tải, Nhấp xem thêm...</div>` vào giữa. Khi User Scroll tới mới xả HTTP Fetch ngược về sau, vá lỗ hổng thay vì dội đệ quy mù quáng.

## 3. Rủi ro Hệ thống Cần Lưu ý (Implementation Risks)
- **Data Loss Phía Client:** Nếu User ấn "Xóa dữ liệu trang web" / "Clear Cache", mất toàn bộ Khóa E2EE & Tin nhắn (do lưu ở IndexedDB). Cần làm cơ chế Backup/Restore Key File thủ công hoặc đồng bộ qua Cloud (Ngoại vi).
- **Index Database Bottleneck:** Việc đánh Index schema của Dexie (`roomId`, `server_ts`) cần làm kỹ lưỡng, nếu lộn Index, UI sẽ giật khi tải hơn 10.000 dòng.
- **Race Condition in Gap Strategy:** Bấm load 2 mép Gap quá sát có thể gây trùng tin nhắn (Duplicate rendering), cần State cản nhiễu (Set đụng độ id).

## 4. Tiêu chí Thành công Kéo thả (Success Metrics)
- Tuyệt đối mã bảo mật Token không xuất hiện ở Header TCP / GET Path.
- Mã hóa, Gửi và giải mã, render chéo phòng, E2E File upload vận hành liền mạch thông suốt không Drop Frame.
- Đồng bộ Gap Marker UX trơn tru.

## 5. Bước Tích hợp Khởi điểm (Next Steps & Dependencies)
1. **Thiết lập Core Project** (React, Vite, Tailwind, Zustand, Dexie).
2. Tách bộ Cấu trúc API Services & Socket Client.
3. Chuẩn bị File Web Worker xử lý tác vụ Security riêng biệt.
4. Triển khai phương án theo tài liệu **Workflow /plan**.
