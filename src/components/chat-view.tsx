'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';

const getSLAColor = (deadline: string, status: string) => {
  if (status === 'resolved' || !deadline) return 'bg-transparent';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return 'bg-red-500';
  if (diff < 5 * 60000) return 'bg-yellow-500';
  return 'bg-transparent';
};

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
    // Operational Intelligence: Map subject to issue_type and add mock location
    const city = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune'][Math.floor(Math.random() * 5)];
    const lat = 12.9716 + (Math.random() - 0.5) * 2;
    const lon = 77.5946 + (Math.random() - 0.5) * 2;

    // Workflow Automation: Priority Mapping & SLA Assignment
    let priority = 'low';
    if (newSubject === 'Payment Issue') priority = 'high';
    else if (newSubject === 'App Error' || newSubject === 'Delay') priority = 'medium';

    const slaMinutes = 15; // As per final instruction "SLA is 15 mins for all actions"
    const slaDeadline = new Date(Date.now() + slaMinutes * 60000).toISOString();

    const { data } = await supabase
      .from('tickets')
      .insert({ 
        user_id: user.id, 
        subject: newSubject, 
        status: 'open', 
        priority,
        issue_type: newSubject,
        city,
        lat,
        lon,
        sla_deadline: slaDeadline
      })
      .select()
      .single();
    if (data) {
      // Log created event
      await supabase.from('ticket_events').insert({
        ticket_id: data.id,
        event_type: 'created',
        actor_id: user.id
      });
      await fetchTickets();
      setActiveTicket(data);
      setShowNew(false);
    }
    setCreating(false);
  };

  const filtered = tickets.filter(t => tab === 'open' ? t.status !== 'resolved' : t.status === 'resolved');

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#030108] text-white">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(168,85,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0" />

      {/* Sidebar - Hidden on mobile if a ticket is selected */}
      <aside className={`${activeTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col border-r border-purple-500/10 bg-[#06030f]/80 backdrop-blur-xl relative z-10 h-screen md:h-auto overflow-y-auto`}>
        <div className="p-4 border-b border-purple-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center font-bold text-fuchsia-400">
              {user.full_name?.charAt(0)}
            </div>
            <p className="text-sm font-bold truncate max-w-[120px]">{user.full_name}</p>
          </div>
          <button onClick={onLogout} className="text-white/20 hover:text-red-400 transition-colors p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>


        <div className="flex p-2 gap-2 bg-black/40 border-b border-purple-500/10">
          {(['open', 'resolved'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${tab === t ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-white/30 hover:bg-purple-500/10'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-3">
          <button onClick={() => setShowNew(true)} className="w-full bg-[#130927]/50 hover:bg-purple-500/10 border border-purple-500/20 py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            + New Support Request
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.map(ticket => {
            const slaColor = getSLAColor(ticket.sla_deadline, ticket.status);
            return (
              <div key={ticket.id} onClick={() => setActiveTicket(ticket)}
                className={`p-4 border-b border-purple-500/10 cursor-pointer transition-all relative overflow-hidden flex flex-col gap-1 ${activeTicket?.id === ticket.id ? 'bg-purple-600/10 border-l-2 border-l-fuchsia-500' : 'hover:bg-purple-500/5'}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${slaColor}`} />
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold truncate pr-2">{ticket.subject}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${ticket.status === 'open' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-white/5 text-purple-300/40'}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-white/30">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</p>
                  <p className={`text-[9px] font-bold uppercase ${ticket.priority === 'high' ? 'text-red-400' : ticket.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {ticket.priority}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`${!activeTicket ? 'hidden md:flex' : 'flex'} flex-1 flex flex-col relative z-10`}>
        {!activeTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/10 p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] mb-2 opacity-50">Pulse Hub</p>
            <p className="text-[10px]">Select a ticket or create a new one to begin</p>
          </div>
        ) : (
          <>
            <header className="p-3 md:p-4 border-b border-purple-500/10 bg-[#06030f]/60 backdrop-blur-xl flex items-center justify-between sticky top-0 z-10 gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button onClick={() => setActiveTicket(null)} className="md:hidden w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="min-w-0">
                  <h2 className="text-xs md:text-sm font-bold truncate">{activeTicket.subject}</h2>
                  <p className="text-[9px] md:text-[10px] text-purple-300/40 uppercase tracking-widest flex items-center gap-2 truncate">
                    ID: {activeTicket.id.split('-')[0]}
                    <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${activeTicket.status === 'open' ? 'bg-fuchsia-400 animate-pulse' : 'bg-green-400'}`} />
                    {activeTicket.status}
                  </p>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isOwn ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-tr-none shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-[#130927]/80 border border-purple-500/10 rounded-tl-none'}`}>
                      {msg.attachment_url && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                          {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img src={msg.attachment_url} alt="Attachment" className="max-w-full h-auto" />
                          ) : (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-xs font-bold text-fuchsia-300 hover:text-fuchsia-200">
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

            <form onSubmit={sendMessage} className="p-3 md:p-4 border-t border-purple-500/10 bg-[#06030f]/40 backdrop-blur-md">
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
                    className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-[#130927]/50 border border-purple-500/20 cursor-pointer hover:bg-purple-500/10 transition-all ${uploading ? 'animate-pulse opacity-50' : ''}`}
                  >
                    <svg className="w-5 h-5 text-purple-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </label>
                </div>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#130927]/50 border border-purple-500/20 px-4 py-3 rounded-xl text-sm outline-none focus:border-fuchsia-500/50 focus:bg-[#1a0c33]/80 transition-all font-mono"
                />
                <button type="submit" disabled={(!newMsg.trim()) || sending} className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex-shrink-0">
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
          <div className="bg-[#0a0514] border border-purple-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-fuchsia-600" />
            <h3 className="text-lg font-bold mb-4">Create Support Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-fuchsia-400/60 uppercase tracking-widest mb-2">Subject</label>
                <select value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  className="w-full bg-[#130927]/50 border border-purple-500/20 px-4 py-3 rounded-xl text-sm outline-none text-white appearance-none cursor-pointer focus:border-fuchsia-500/50"
                >
                  {SUBJECTS.map(s => (
                    <option key={s} value={s} className="bg-[#1a1a2e] text-white">
                      {s}
                    </option>
                  ))}
                </select>

              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#130927]/50 border border-purple-500/20 hover:bg-purple-500/10 transition-colors">Cancel</button>
                <button onClick={createTicket} disabled={creating} className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.3)]">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
