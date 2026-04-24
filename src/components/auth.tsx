'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthProps {
  onAuth: (user: any) => void;
}

export default function Auth({ onAuth }: AuthProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Restore session
    const stored = localStorage.getItem('relay_user');
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        if (userData?.id) {
          onAuth(userData);
          return;
        }
      } catch {
        localStorage.removeItem('relay_user');
      }
    }
    
    if (!supabase) {
      setError('Supabase connection missing. Check .env.local');
    }

    setTimeout(() => inputRef.current?.focus(), 300);
  }, [onAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        setError('Configuration error: Supabase keys missing.');
        setLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', trimmed)
        .single();

      if (dbError || !data) {
        setError('Phone number not registered. Please add it to the profiles table in Supabase.');
        return;
      }

      localStorage.setItem('relay_user', JSON.stringify(data));
      onAuth(data);
    } catch (err) {
      setError('Connection failed. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050507]">
      {/* Simple Glow Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight gradient-text mb-2">Relay</h1>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/30">Support Command Center</p>
        </div>

        <div className="glass-panel rounded-3xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-sm text-white/40">Enter your registered phone number</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Phone Number</label>
              <input
                ref={inputRef}
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                placeholder="e.g. 8376007876"
                className="auth-input w-full px-4 py-3 rounded-xl text-sm"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all py-3.5 rounded-xl font-bold text-sm text-white shadow-[0_4px_20px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Access Command Center'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
