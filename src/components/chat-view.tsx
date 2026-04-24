'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';

const SUBJECTS = ['Shift Issue', 'RTO Delivered', 'Payment Issue', 'Order Problem', 'App Error', 'Other'];

export default function ChatView({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState(SUBJECTS[0]);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const fetchTickets = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  }, [user.id]);

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

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (!activeTicket || !supabase) return;
    fetchMessages(activeTicket.id);

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`msgs-${activeTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `ticket_id=eq.${activeTicket.id}`
      }, async (payload: any) => {
        const { data } = await supabase

          .from('messages')
          .select('*, profiles(*)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages((prev: any[]) => {
            if (prev.find(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }


      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [activeTicket, fetchMessages]);

  const sendMessage = async (e: React.FormEvent, attachmentUrl?: string) => {
    if (e) e.preventDefault();
    if ((!newMsg.trim() && !attachmentUrl) || !activeTicket || sending || !supabase) return;
    setSending(true);
    const content = newMsg.trim() || (attachmentUrl ? 'Sent an attachment' : '');
    setNewMsg('');
    await supabase.from('messages').insert({ 
      ticket_id: activeTicket.id, 
      sender_id: user.id, 
      content,
      attachment_url: attachmentUrl 
    });

    // Auto-reopen if ticket was resolved
    if (activeTicket.status === 'resolved') {
      const { error: updateError } = await supabase.from('tickets').update({ status: 'open' }).eq('id', activeTicket.id);
      if (updateError) {
        console.error('Reopen failed:', updateError);
      } else {
        setActiveTicket((prev: any) => ({ ...prev, status: 'open' }));
        setTickets((prev: any[]) => prev.map(t => t.id === activeTicket.id ? { ...t, status: 'open' } : t));
      }

    }


    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !activeTicket) return;

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


  const createTicket = async () => {
    if (!supabase) return;
    setCreating(true);
    const { data } = await supabase
      .from('tickets')
      .insert({ user_id: user.id, subject: newSubject, status: 'open' })
      .select()
      .single();
    if (data) {
      await fetchTickets();
      setActiveTicket(data);
      setShowNew(false);
    }
    setCreating(false);
  };

  const filtered = tickets.filter(t => tab === 'open' ? t.status !== 'resolved' : t.status === 'resolved');

  return (
    <div className="flex h-screen overflow-hidden bg-[#050507] text-white">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-white/10 bg-white/[0.02]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">
              {user.full_name?.charAt(0)}
            </div>
            <p className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</p>
          </div>
          <button onClick={onLogout} className="text-white/20 hover:text-red-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className="flex p-2 gap-2 bg-white/[0.02]">
          {(['open', 'resolved'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${tab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-3">
          <button onClick={() => setShowNew(true)} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 rounded-xl text-xs font-bold transition-all">
            + New Support Request
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(ticket => (
            <div key={ticket.id} onClick={() => setActiveTicket(ticket)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-all ${activeTicket?.id === ticket.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/[0.02]'}`}>
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold truncate pr-2">{ticket.subject}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${ticket.status === 'open' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                  {ticket.status}
                </span>
              </div>
              <p className="text-[10px] text-white/30">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col bg-black/20">
        {!activeTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-bold">Select a request to view conversation</p>
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-white/10 bg-white/[0.01] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{activeTicket.subject}</h2>
                <p className="text-[10px] text-white/40">ID: {activeTicket.id.slice(0,8)}</p>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-[11px] font-bold text-white/40">{activeTicket.status}</span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isOwn ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
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
                      <p className="text-[9px] mt-1.5 opacity-50 text-right">{format(new Date(msg.created_at), 'h:mm a')}</p>
                    </div>
                  </div>

                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-white/[0.02]">
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
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
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500/50 transition-all"
                />
                <button type="submit" disabled={(!newMsg.trim()) || sending} className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-all disabled:opacity-30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>

          </>
        )}
      </main>

      {/* New Ticket Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d0d12] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Create Support Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Subject</label>
                <select value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm outline-none text-white appearance-none cursor-pointer focus:border-indigo-500/50"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  {SUBJECTS.map(s => (
                    <option key={s} value={s} className="bg-[#1a1a2e] text-white">
                      {s}
                    </option>
                  ))}
                </select>

              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                <button onClick={createTicket} disabled={creating} className="flex-1 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 transition-colors">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
