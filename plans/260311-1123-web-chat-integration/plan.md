---
title: Kế hoạch tích hợp Web Chat E2EE
description: Triển khai Module Frontend Chat E2EE (React Vite, Zustand, Dexie.js, Web Worker)
status: In Progress
priority: High
effort: 3 weeks
branch: feature/web-chat-e2ee
tags: frontend, realtime, E2EE, websocket
created: 2026-03-11
---

# Kế hoạch tích hợp Web Chat E2EE (Frontend)

Bản kế hoạch triển khai dựa trên Blueprint `brainstormer-260311-1120-web-chat-integration-final.md`. Dự án này tập trung vào tính năng bảo mật E2EE tuyệt đối và quản lý lượng tin nhắn lớn bằng bộ nhớ Local Storage IndexedDB.

## Các giai đoạn thực hiện (Phases)

- ✅ **Lên giải pháp (Completed)**
  - Đã chốt kiến trúc Technical Stack và Gap Pagination Strategy.

- 📝 **Phase 01: Thiết lập Core Project (Project Setup)**
  - Khởi tạo React (Vite), Zustand, TailwindCSS, cấu trúc thư mục.

- 📝 **Phase 02: Thiết lập Local Database & Schema (Dexie.js)**
  - Cấu trúc các bảng dữ liệu cho IndexedDB lưu lại Message, Khóa mã hóa.

- 📝 **Phase 03: Xây dựng Crypto Engine (Web Worker)**
  - Tách luồng mã hóa E2EE và UUIDv7 sang Web Worker để bảo vệ Main Thread.

- 📝 **Phase 04: Hạ tầng WebSocket & Xác thực (Networking)**
  - Lifecycle Connection, JWT Auth Payload, bắt mã lỗi và tự động Reconnect.

- 📝 **Phase 05: Giao diện chính (UI Components & Logic)**
  - Layout chia 2 trục: Chat Window (E2EE) và Sidebar Room List.
  - Xử lý Scroll Lazy-load với thuật toán "Gap Marker".

## Các Yêu Cầu Tuân thủ
- **Hiệu năng:** Không gây rớt khung hình (drop frames) với lượng tin nhắn lớn.
- **Bảo mật:** Web Worker đóng gói cẩn thận, Token WS không lọt vào URI.
- Đo ni đóng giày cho Data Flow E2EE Client-side.
