# Phase 1: Core Project Setup

## Context Links
- Blueprint: `brainstormer-260311-1120-web-chat-integration-final.md`

## Overview
**Priority:** High
**Status:** Not Started
**Description:** Thiết lập bộ khung ứng dụng React (Vite) ban đầu, cài đặt các thư viện cần thiết, định nghĩa cấu trúc thư mục (Folder Structure).

## Requirements
- Dùng `vite` tạo ứng dụng React + TypeScript.
- Cài đặt dependency: Zustand, Tailwind CSS, Dexie.js, axios, uuid, thư viện crypto (libsodium.js or similar), React Query (cho Metadata Sidebar).

## Architecture / Folder Structure
```
src/
├── api/             # HTTP REST clients (axios)
├── components/      # UI components (Button, Input, Avatar)
├── features/        # Phân chia luồng logic theo lĩnh vực E2EE, Workspace
│   ├── chat/        # Lãnh địa Message Box E2EE
│   └── rooms/       # Lãnh địa Room List Sidebar (Non E2EE)
├── hooks/           # Custom hooks kết nối vào Zustand, Dexie
├── store/           # Zustand state management (Socket Status, Current Room)
├── types/           # TypeScript Types Definitions
├── utils/           # Helper functions
└── workers/         # Web Worker chứa tác vụ mã hóa/giải mã Crypto
```

## Implementation Steps
1. Chạy CLI khởi tạo dự án React (Vite + TypeScript).
2. Cài các dependency cốt lõi.
3. Thiết lập Tailwind CSS vào Vite config.
4. Cấu hình Alias (`@/`) cho imports để code sạch đẹp.
5. Setup file `store/chatStore.ts` bằng Zustand với các initial state cơ bản.
6. Cấu hình biến môi trường (`.env`) như `VITE_API_URL` và `VITE_WS_URL`.

## Todo List
- [ ] Initialize Vite project
- [ ] Install deps (TanStack Query, Zustand, Dexie, uuid, etc)
- [ ] Configure Tailwind CSS & PostCSS
- [ ] Setup Folder Structure & absolute alias
- [ ] Create base Zustand Store

## Success Criteria
- Lệnh `npm run dev` hoạt động không bị lỗi.
- Cấu trúc thư mục được phân định rõ ràng giữa E2EE data và Metadata view.
