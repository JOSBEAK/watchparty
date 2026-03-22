import { useState, useRef, useEffect } from 'react';
import { getSocket } from '../lib/socket';

interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  timestamp: number;
}

interface ChatProps {
  displayName: string;
}

export function Chat({ displayName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat-message', handleChat);
    return () => {
      socket.off('chat-message', handleChat);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      displayName,
      text: input.trim(),
      timestamp: Date.now(),
    };
    getSocket().emit('chat-message', msg);
    setInput('');
  };

  return (
    <div className="chat">
      <div className="chat__header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Chat
      </div>
      <div className="chat__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat__empty">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat__msg ${msg.displayName === displayName ? 'chat__msg--mine' : ''}`}
          >
            <span className="chat__msg-name">{msg.displayName}</span>
            <span className="chat__msg-text">{msg.text}</span>
          </div>
        ))}
      </div>
      <div className="chat__input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="chat__input"
        />
        <button onClick={sendMessage} className="chat__send-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
