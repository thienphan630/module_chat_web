import { useChatStore } from '@/store/chatStore'
import { RoomList } from '@/components/chat/RoomList'
import { ChatWindow } from '@/components/chat/ChatWindow'

function App() {
  const connectionStatus = useChatStore((state) => state.connectionStatus)
  const currentRoomId = useChatStore((state) => state.currentRoomId)

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-white overflow-hidden">
      <RoomList />

      {currentRoomId ? (
        <ChatWindow roomId={currentRoomId} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
          <h1 className="text-4xl font-bold mb-4 text-zinc-800">Core Chat E2EE</h1>
          <p className="text-lg">
            Connection Status: <span className="font-semibold text-emerald-400">{connectionStatus}</span>
          </p>
          <p className="mt-8">Select a conversation from the sidebar to start messaging.</p>
        </div>
      )}
    </div>
  )
}

export default App
