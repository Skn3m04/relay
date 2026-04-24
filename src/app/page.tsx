'use client';

import { useState, useEffect } from 'react';
import Auth from '@/components/auth';
import ChatView from '@/components/chat-view';
import InboxView from '@/components/inbox-view';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Restore session from localStorage on first load
    try {
      const stored = localStorage.getItem('relay_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setUser(parsed);
      }
    } catch {
      localStorage.removeItem('relay_user');
    }
    setHydrated(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('relay_user');
    setUser(null);
  };

  // Avoid hydration flash
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050507]">
        <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#050507]">
      {!user ? (
        <Auth onAuth={setUser} />
      ) : user.team_type === 'CT Team' || user.team_type === 'Admin' ? (
        <InboxView user={user} onLogout={handleLogout} />
      ) : (
        <ChatView user={user} onLogout={handleLogout} />
      )}
    </main>
  );
}
