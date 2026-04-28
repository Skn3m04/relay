'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import InsightsView from './insights-view';

const STATUS_STYLES: Record<string, string> = {
  open: 'text-fuchsia-400 bg-fuchsia-500/10',
  active: 'text-green-400 bg-green-500/10',
  resolved: 'text-purple-300/40 bg-white/5',
};

const getSLAColor = (deadline: string, status: string) => {
  if (status === 'resolved' || !deadline) return 'bg-transparent';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return 'bg-red-500';
  if (diff < 5 * 60000) return 'bg-yellow-500';
  return 'bg-transparent';
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
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'near' | 'safe'>('all');
  const [showPriorityDrop, setShowPriorityDrop] = useState(false);
  const [showSlaDrop, setShowSlaDrop] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'inbox' | 'insights'>('inbox');
  const [metrics, setMetrics] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const fetchMetrics = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('ticket_metrics').select('*');
    if (error) {
      console.error('Error fetching metrics:', error);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTickets = data.filter((t: any) => new Date(t.created_at) >= today);
    const resolved = data.filter((t: any) => t.status === 'resolved');
    const open = data.filter((t: any) => t.status !== 'resolved');
    const avgTat = resolved.length > 0 
      ? resolved.reduce((acc: number, t: any) => acc + (t.tat_minutes || 0), 0) / resolved.length 
      : 0;
    const slaBreachedCount = data.filter((t: any) => t.sla_breached).length;

    setMetrics({
      totalToday: todayTickets.length,
      avgTat: Math.round(avgTat),
      open: open.length,
      resolved: resolved.length,
      slaBreached: slaBreachedCount
    });
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!supabase) return;
    // Smart Sorting: priority DESC, sla_deadline ASC, created_at ASC
    const { data } = await supabase
      .from('tickets')
      .select('*, profiles!tickets_user_id_fkey(*)')
      .order('priority', { ascending: false, nullsFirst: false })
      .order('sla_deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
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
    fetchMetrics();
    
    // Live Pulse: Refresh every 60 seconds to catch SLA breaches
    const timer = setInterval(() => {
      fetchTickets();
      fetchMetrics();
    }, 60000);

    const sub = supabase.channel('tickets_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
        fetchMetrics();
      })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(sub);
      clearInterval(timer);
    };
  }, [fetchTickets, fetchMetrics]);

  useEffect(() => {
    if (!selected || !supabase) return;
    fetchMessages(selected.id);

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`inbox-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${selected.id}` }, async (payload: any) => {
        const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', payload.new.id).single();

        if (data) {
          setMessages((prev: any[]) => {
            if (prev.find(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }

        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })

      .subscribe();

    if (selected.status === 'open') {
      supabase.from('tickets').update({ 
        status: 'active', 
        assigned_to: user.id 
      }).eq('id', selected.id).then(() => {
        // Log assigned event
        supabase.from('ticket_events').insert({
          ticket_id: selected.id,
          event_type: 'assigned',
          actor_id: user.id
        });
      });
    }

    return () => { channelRef.current?.unsubscribe(); };
  }, [selected?.id, fetchMessages, user.id]);

  // Keyboard shortcut: Escape to close chat
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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

    // Analytics: Update first_response_at if this is the first agent response
    if (!selected.first_response_at) {
      const now = new Date().toISOString();
      await supabase.from('tickets').update({ first_response_at: now }).eq('id', selected.id);
      await supabase.from('ticket_events').insert({
        ticket_id: selected.id,
        event_type: 'responded',
        actor_id: user.id
      });
      setSelected((prev: any) => ({ ...prev, first_response_at: now }));
    }

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
    const now = new Date().toISOString();
    const { error } = await supabase.from('tickets').update({ 
      status: 'resolved',
      resolved_at: now 
    }).eq('id', selected.id);
    
    if (error) {
      console.error('Resolve failed:', error);
      alert('Failed to resolve ticket: ' + error.message);
    } else {
      // Log resolved event
      await supabase.from('ticket_events').insert({
        ticket_id: selected.id,
        event_type: 'resolved',
        actor_id: user.id
      });
      // Update local state immediately
      setTickets((prev: any[]) => prev.map(t => t.id === selected.id ? { ...t, status: 'resolved', resolved_at: now } : t));
      setSelected(null);
    }

  };


  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === displayTickets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayTickets.map(t => t.id)));
  };

  const bulkResolve = async () => {
    if (!supabase || selectedIds.size === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('tickets').update({ 
      status: 'resolved',
      resolved_at: now 
    }).in('id', Array.from(selectedIds));

    if (!error) {
      setTickets(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status: 'resolved', resolved_at: now } : t));
      setSelectedIds(new Set());
    }
  };

  const bulkAssign = async () => {
    if (!supabase || selectedIds.size === 0) return;
    const { error } = await supabase.from('tickets').update({ 
      assigned_to: user.id,
      status: 'active' 
    }).in('id', Array.from(selectedIds));

    if (!error) {
      setTickets(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, assigned_to: user.id, status: 'active' } : t));
      setSelectedIds(new Set());
    }
  };

  const exportReport = async (days: number) => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 86400000).toISOString();
    const res = await fetch(`/api/reports?from=${from}&to=${to}`);
    const data = await res.json();
    
    // Simple CSV export
    const csv = "Date,Total,Resolved\n" + data.map((r: any) => `${r.date},${r.total},${r.resolved}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${days}days.csv`;
    a.click();
  };

  const displayTickets = tickets.filter(t => {
    const matchesStatus = filter === 'all' || t.status === filter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesIssueType = issueTypeFilter === 'all' || t.issue_type === issueTypeFilter;
    
    let matchesSLA = true;
    if (slaFilter !== 'all') {
      const color = getSLAColor(t.sla_deadline, t.status);
      if (slaFilter === 'breached') matchesSLA = color === 'bg-red-500';
      else if (slaFilter === 'near') matchesSLA = color === 'bg-yellow-500';
      else if (slaFilter === 'safe') matchesSLA = color === 'bg-transparent';
    }

    const matchesSearch = !search || 
      t.subject?.toLowerCase().includes(search.toLowerCase()) || 
      t.user_id?.toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesPriority && matchesIssueType && matchesSLA && matchesSearch;
  });

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#030108] text-white">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(168,85,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0" />
      {/* Sidebar — full width on mobile, hidden when chat is open on mobile */}
      <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-purple-500/10 flex-col bg-[#06030f]/80 backdrop-blur-xl relative z-10`}>
        <div className="p-4 border-b border-purple-500/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{user.full_name}</p>
            <p className="text-[9px] uppercase tracking-widest text-fuchsia-400 font-bold">{user.team_type}</p>
          </div>
          <button onClick={onLogout} className="text-white/20 hover:text-red-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className="p-3 bg-black/40 flex gap-2 border-b border-purple-500/10">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all ${activeTab === 'inbox' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
          >
            Inbox
          </button>
          <button 
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all ${activeTab === 'insights' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
          >
            Insights
          </button>
        </div>

        <div className="p-4 bg-black/20 space-y-3 border-b border-purple-500/10">
          <div className="relative group">
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subject or user ID..."
              className="w-full bg-[#130927]/50 border border-purple-500/20 px-4 py-2.5 rounded-xl text-[10px] outline-none focus:border-fuchsia-500/50 focus:bg-[#1a0c33]/80 transition-all font-mono"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-fuchsia-500/50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Custom Priority Dropdown */}
            <div className="relative">
              <button 
                onClick={() => { setShowPriorityDrop(!showPriorityDrop); setShowSlaDrop(false); }}
                className="w-full bg-[#130927]/50 border border-purple-500/20 px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-purple-500/10 transition-all"
              >
                <span>{priorityFilter === 'all' ? 'Priority: All' : priorityFilter}</span>
                <svg className={`w-3 h-3 text-white/20 transition-transform ${showPriorityDrop ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPriorityDrop && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0514] border border-purple-500/20 rounded-xl overflow-hidden z-50 shadow-2xl">
                  {['all', 'high', 'medium', 'low'].map(p => (
                    <button 
                      key={p}
                      onClick={() => { setPriorityFilter(p); setShowPriorityDrop(false); }}
                      className={`w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-purple-600 transition-colors ${priorityFilter === p ? 'text-fuchsia-400' : 'text-white/60'}`}
                    >
                      {p === 'all' ? 'All' : p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom SLA Dropdown */}
            <div className="relative">
              <button 
                onClick={() => { setShowSlaDrop(!showSlaDrop); setShowPriorityDrop(false); }}
                className="w-full bg-[#130927]/50 border border-purple-500/20 px-3 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-purple-500/10 transition-all"
              >
                <span>{slaFilter === 'all' ? 'SLA: All' : slaFilter}</span>
                <svg className={`w-3 h-3 text-white/20 transition-transform ${showSlaDrop ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSlaDrop && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0514] border border-purple-500/20 rounded-xl overflow-hidden z-50 shadow-2xl">
                  {['all', 'breached', 'near', 'safe'].map(s => (
                    <button 
                      key={s}
                      onClick={() => { setSlaFilter(s as any); setShowSlaDrop(false); }}
                      className={`w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-purple-600 transition-colors ${slaFilter === s ? 'text-fuchsia-400' : 'text-white/60'}`}
                    >
                      {s === 'all' ? 'All' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex p-2 gap-1 overflow-x-auto bg-black/20 border-b border-purple-500/10">
          {(['all', 'open', 'active', 'resolved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded-md transition-all ${filter === f ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-white/30 hover:bg-purple-500/10'}`}>
              {f}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="p-3 bg-purple-600/20 border-b border-purple-500/30 flex items-center justify-between">
            <p className="text-[10px] font-bold text-fuchsia-300">{selectedIds.size} Selected</p>
            <div className="flex gap-2">
              <button onClick={bulkAssign} className="text-[9px] font-bold uppercase px-2 py-1 bg-purple-600 rounded">Assign</button>
              <button onClick={bulkResolve} className="text-[9px] font-bold uppercase px-2 py-1 bg-green-600 rounded">Resolve</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/10 bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={selectedIds.size === displayTickets.length && displayTickets.length > 0}
              onChange={selectAll}
              className="w-3 h-3 accent-purple-500"
            />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Select All</span>
          </div>
          <span className="text-[9px] text-white/20 font-bold">{displayTickets.length} Tickets</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayTickets.map(t => {
            const slaColor = getSLAColor(t.sla_deadline, t.status);
            const isBreached = slaColor === 'bg-red-500';

            return (
              <div key={t.id}
                className={`p-4 border-b border-purple-500/10 cursor-pointer transition-all relative overflow-hidden flex gap-3 ${selected?.id === t.id ? 'bg-purple-600/10' : 'hover:bg-purple-500/5'}`}>
                
                <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelection(t.id)}
                    className="w-4 h-4 accent-purple-500 rounded border-white/10"
                  />
                </div>

                <div className="flex-1 min-w-0" onClick={() => setSelected(t)}>
                  {/* SLA Strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${slaColor}`} />
                  
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <p className="text-xs font-bold truncate">{t.profiles?.full_name}</p>
                      {isBreached && <span className="text-[7px] bg-red-500 text-white px-1 rounded-sm font-bold uppercase">Escalated</span>}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  </div>
                  <p className="text-[11px] text-white/50 truncate mb-1">{t.subject}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] text-white/20">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                    <p className={`text-[9px] font-bold uppercase ${t.priority === 'high' ? 'text-red-400' : t.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {t.priority}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Inbox — full screen on mobile when a ticket is selected */}
      <main className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden relative z-10`}>
        {/* Dashboard Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 items-center bg-[#06030f]/60 border-b border-purple-500/10 backdrop-blur-xl">
          <div className="py-3 md:py-4 border-r border-b md:border-b-0 border-purple-500/10 flex flex-col items-center group hover:bg-purple-500/5 transition-colors cursor-default">
            <p className="text-[8px] md:text-[9px] font-bold text-white/30 uppercase tracking-[0.15em] md:tracking-[0.2em] mb-1 md:mb-1.5 group-hover:text-fuchsia-400/60 transition-colors">Today's Volume</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl md:text-2xl font-bold text-white tabular-nums">{metrics?.totalToday || 0}</span>
              <span className="text-[9px] md:text-[10px] font-bold text-white/20 uppercase tracking-tighter">Tickets</span>
            </div>
          </div>
          
          <div className="py-3 md:py-4 border-b md:border-b-0 border-r border-purple-500/10 flex flex-col items-center group hover:bg-purple-500/5 transition-colors cursor-default">
            <p className="text-[8px] md:text-[9px] font-bold text-white/30 uppercase tracking-[0.15em] md:tracking-[0.2em] mb-1 md:mb-1.5 group-hover:text-emerald-400/60 transition-colors">Avg TAT</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl md:text-2xl font-bold text-white tabular-nums">{metrics?.avgTat || 0}</span>
              <span className="text-[9px] md:text-[10px] font-bold text-white/20 uppercase tracking-tighter">Mins</span>
            </div>
          </div>

          <div className="py-3 md:py-4 border-r border-purple-500/10 flex flex-col items-center group hover:bg-purple-500/5 transition-colors cursor-default">
            <p className="text-[8px] md:text-[9px] font-bold text-white/30 uppercase tracking-[0.15em] md:tracking-[0.2em] mb-1 md:mb-1.5 group-hover:text-purple-400/60 transition-colors">Open / Resolved</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl md:text-2xl font-bold text-fuchsia-400 tabular-nums">{metrics?.open || 0}</span>
              <span className="text-xs font-bold text-white/10">/</span>
              <span className="text-xl md:text-2xl font-bold text-white/40 tabular-nums">{metrics?.resolved || 0}</span>
            </div>
          </div>

          <div className="py-4 flex flex-col items-center group hover:bg-purple-500/5 transition-colors cursor-default relative">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1.5 group-hover:text-red-400/60 transition-colors">SLA Breaches</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tabular-nums ${metrics?.slaBreached > 0 ? 'text-red-500 animate-pulse' : 'text-white/20'}`}>
                {metrics?.slaBreached || 0}
              </span>
            </div>
            {/* Export Dropdown */}
            <div className="absolute top-2 right-2 flex gap-1">
              <button onClick={() => exportReport(7)} className="p-1 hover:bg-purple-500/10 rounded group/btn" title="Export 7D">
                <svg className="w-3 h-3 text-white/20 group-hover/btn:text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'insights' ? (
          <InsightsView />
        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/10">
            <p className="text-sm font-bold hidden md:block">Select a ticket to respond</p>
          </div>
        ) : (
          <>
            <header className="p-3 md:p-4 border-b border-purple-500/10 bg-[#06030f]/60 backdrop-blur-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                {/* Mobile back button */}
                <button onClick={() => setSelected(null)} className="md:hidden w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-purple-500/20 flex-shrink-0 flex items-center justify-center font-bold text-fuchsia-400 text-sm md:text-base">
                  {selected.profiles?.full_name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs md:text-sm font-bold truncate">{selected.profiles?.full_name}</h2>
                  <p className="text-[9px] md:text-[10px] text-purple-300/40 truncate">{selected.subject}</p>
                </div>
              </div>
              {selected.status !== 'resolved' && (
                <button onClick={resolveTicket} className="px-3 md:px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] flex-shrink-0">Resolve</button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isOwn ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-tr-none shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-[#130927]/80 border border-purple-500/10 rounded-tl-none'}`}>
                      {!isOwn && <p className="text-[9px] font-bold text-fuchsia-400 mb-1">{msg.profiles?.full_name}</p>}
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
                      <p className="text-[9px] mt-1.5 opacity-30 text-right">{format(new Date(msg.created_at), 'h:mm a')}</p>
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
                    id="admin-file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="admin-file-upload"
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
                  placeholder={`Reply to ${selected.profiles?.full_name}...`}
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
    </div>
  );
}
