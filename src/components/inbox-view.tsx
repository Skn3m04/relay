'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
  open: 'text-blue-400 bg-blue-500/10',
  active: 'text-green-400 bg-green-500/10',
  resolved: 'text-gray-400 bg-white/5',
};

export default function InboxView({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingT, setLoadingT] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'resolved'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const fetchTickets = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('tickets')
      .select('*, profiles!tickets_user_id_fkey(*)')
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoadingT(false);
  }, []);

  const fetchMessages = useCallback(async (ticketId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    fetchTickets();
    if (!supabase) return;
    const sub = supabase.channel('tickets-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchTickets).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchTickets]);

  useEffect(() => {
    if (!selected || !supabase) return;
    fetchMessages(selected.id);

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`inbox-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${selected.id}` }, async (payload) => {
        const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', payload.new.id).single();
        if (data) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })

      .subscribe();

    if (selected.status === 'open') {
      supabase.from('tickets').update({ status: 'active', assigned_to: user.id }).eq('id', selected.id);
    }

    return () => { channelRef.current?.unsubscribe(); };
  }, [selected?.id, fetchMessages, user.id]);

  const sendMessage = async (e: React.FormEvent, attachmentUrl?: string) => {
    if (e) e.preventDefault();
    if ((!newMsg.trim() && !attachmentUrl) || !selected || sending || !supabase) return;
    setSending(true);
    const content = newMsg.trim() || (attachmentUrl ? 'Sent an attachment' : '');
    setNewMsg('');
    await supabase.from('messages').insert({ 
      ticket_id: selected.id, 
      sender_id: user.id, 
      content,
      attachment_url: attachmentUrl 
    });
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !selected) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      await sendMessage(null as any, publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Ensure you have an "attachments" bucket in Supabase storage.');
    } finally {
      setUploading(false);
    }
  };


  const resolveTicket = async () => {
    if (!selected || !supabase) return;
    const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', selected.id);
    
    if (error) {
      console.error('Resolve failed:', error);
      alert('Failed to resolve ticket: ' + error.message);
    } else {
      // Update local state immediately
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'resolved' } : t));
      setSelected(null);
    }
  };


  const displayTickets = tickets.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507] text-white">
      {/* Sidebar */}
      <aside className="w-80 border-r border-white/10 flex flex-col bg-white/[0.01]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{user.full_name}</p>
            <p className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">{user.team_type}</p>
          </div>
          <button onClick={onLogout} className="text-white/20 hover:text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className="flex p-2 gap-1 overflow-x-auto bg-black/20">
          {(['all', 'open', 'active', 'resolved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded-md transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'text-white/30 hover:bg-white/5'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayTickets.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all ${selected?.id === t.id ? 'bg-indigo-600/10' : 'hover:bg-white/[0.02]'}`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold truncate max-w-[140px]">{t.profiles?.full_name}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${STATUS_STYLES[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-[11px] text-white/50 truncate mb-1">{t.subject}</p>
              <p className="text-[9px] text-white/20">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Inbox */}
      <main className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/10">
            <p className="text-sm font-bold">Select a ticket to respond</p>
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-white/10 bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">
                  {selected.profiles?.full_name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-sm font-bold">{selected.profiles?.full_name}</h2>
                  <p className="text-[10px] text-white/40">{selected.subject}</p>
                </div>
              </div>
              {selected.status !== 'resolved' && (
                <button onClick={resolveTicket} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Resolve</button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isOwn ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                      {!isOwn && <p className="text-[9px] font-bold text-indigo-400 mb-1">{msg.profiles?.full_name}</p>}
                      {msg.attachment_url && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                          {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img src={msg.attachment_url} alt="Attachment" className="max-w-full h-auto" />
                          ) : (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-xs font-bold text-indigo-300 hover:text-indigo-200">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View Attachment
                            </a>
                          )}
                        </div>
                      )}
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className="text-[9px] mt-1.5 opacity-30 text-right">{format(new Date(msg.created_at), 'h:mm a')}</p>
                    </div>
                  </div>

                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    id="admin-file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="admin-file-upload"
                    className={`w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all ${uploading ? 'animate-pulse opacity-50' : ''}`}
                  >
                    <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </label>
                </div>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder={`Reply to ${selected.profiles?.full_name}...`}
                  className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500/50 transition-all"
                />
                <button type="submit" disabled={(!newMsg.trim()) || sending} className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>

          </>
        )}
      </main>
    </div>
  );
}
