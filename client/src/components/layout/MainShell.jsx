import ChatSidebar from '../chat/ChatSidebar';

export default function MainShell({ children }) {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-surface overflow-hidden">
      <ChatSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
