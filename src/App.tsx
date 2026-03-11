import { useChatStore } from '@/store/chatStore'

function App() {
  const connectionStatus = useChatStore((state) => state.connectionStatus)

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Core Chat E2EE</h1>
      <p className="text-lg">
        Connection Status: <span className="font-semibold text-emerald-400">{connectionStatus}</span>
      </p>
    </div>
  )
}

export default App
