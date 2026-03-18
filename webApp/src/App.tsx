import { ChatList } from '@components/chat-list/ChatList';

export default function App() {
  return (
    <div className="flex h-full w-full bg-black">
      {/* Sidebar */}
      <div className="w-[320px] flex-shrink-0 h-full">
        <ChatList />
      </div>

      {/* Chat area — placeholder */}
      <main className="flex-1 flex items-center justify-center h-full" style={{ backgroundColor: '#000' }}>
        <p className="text-[15px]" style={{ color: '#8E8E93' }}>
          Выберите чат
        </p>
      </main>
    </div>
  );
}
