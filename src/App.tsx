import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { RoomList } from '@/components/chat/RoomList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { AuthPage } from '@/pages/AuthPage'
import { ToastContainer } from '@/components/ui/Toast'
import { socketService } from '@/services/SocketService'
import { requestNotificationPermission } from '@/utils/notification'
import { useAutoJoinRooms } from '@/hooks/useAutoJoinRooms'
import { MessageSquare } from 'lucide-react'

function App() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated)
  const connectionStatus = useChatStore((state) => state.connectionStatus)
  const currentRoomId = useChatStore((state) => state.currentRoomId)
  const accessToken = useChatStore((state) => state.accessToken)

  // Auto-join all rooms when WS connects (ensures messages arrive from all rooms)
  useAutoJoinRooms()

  // Auto-connect WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken && connectionStatus === 'disconnected') {
      socketService.connect(accessToken)
    }
  }, [isAuthenticated, accessToken, connectionStatus])

  // Request browser notification permission on auth
  useEffect(() => {
    if (isAuthenticated) requestNotificationPermission()
  }, [isAuthenticated])

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <ToastContainer />
      </>
    )
  }

  // Authenticated — main layout
  return (
    <>
      <div className="flex h-screen w-screen bg-zinc-950 text-white overflow-hidden">
        <RoomList />

        {currentRoomId ? (
          <ChatWindow key={currentRoomId} roomId={currentRoomId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
              <MessageSquare size={36} className="text-emerald-600/50" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-300 mb-2">Core Chat</h1>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs text-center">
              Chọn một cuộc trò chuyện từ danh sách để bắt đầu.
            </p>
          </div>
        )}
      </div>
      <ToastContainer />
    </>
  )
}

export default App
