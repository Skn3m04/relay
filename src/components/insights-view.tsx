'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function InsightsView() {
  const [issueDistribution, setIssueDistribution] = useState<any[]>([]);
  const [repeatUsers, setRepeatUsers] = useState<any[]>([]);
  const [topAreas, setTopAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      
      // 1. Issue Distribution
      const { data: issueData } = await supabase
        .from('tickets')
        .select('issue_type');
      
      if (issueData) {
        const dist = issueData.reduce((acc: any, t: any) => {
          if (t.issue_type) {
            acc[t.issue_type] = (acc[t.issue_type] || 0) + 1;
          }
          return acc;
        }, {});
        setIssueDistribution(Object.entries(dist).map(([name, value]) => ({ name, value: value as number })));
      }

      // 2. Repeat Users
      const { data: userData } = await supabase
        .from('tickets')
        .select('user_id, profiles!tickets_user_id_fkey(full_name, phone)');
      
      if (userData) {
        const counts = userData.reduce((acc: any, t: any) => {
          acc[t.user_id] = { 
            count: (acc[t.user_id]?.count || 0) + 1,
            name: t.profiles?.full_name,
            phone: t.profiles?.phone
          };
          return acc;
        }, {});
        const repeat = Object.values(counts).filter((u: any) => u.count > 3).sort((a: any, b: any) => b.count - a.count);
        setRepeatUsers(repeat);
      }

      // 3. Top Areas
      const { data: locationData } = await supabase
        .from('tickets')
        .select('city');
      
      if (locationData) {
        const locDist = locationData.reduce((acc: any, t: any) => {
          if (t.city) acc[t.city] = (acc[t.city] || 0) + 1;
          return acc;
        }, {});
        setTopAreas(Object.entries(locDist).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-bold text-white/20 uppercase tracking-[0.2em]">Analyzing operational data...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-12 bg-transparent">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold mb-2">Operational Intelligence</h1>
          <p className="text-sm text-purple-300/40">Real-time insights across your support ecosystem</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-1">Status</p>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
            Live Feed Active
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Issue Breakdown */}
        <section className="bg-[#0a0514]/60 border border-purple-500/15 rounded-3xl p-8 backdrop-blur-xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400 mb-8">Issue Distribution</h3>
          <div className="space-y-6">
            {issueDistribution.map((item: any) => {
              const total = issueDistribution.reduce((a, b) => a + b.value, 0);
              const percentage = Math.round((item.value / total) * 100);
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold">{item.name}</span>
                    <span className="text-white/40">{item.value} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-400 rounded-full transition-all duration-1000" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {issueDistribution.length === 0 && (
              <p className="text-center py-12 text-xs text-white/10">No issue data available yet.</p>
            )}
          </div>
        </section>

        {/* Top Problematic Areas */}
        <section className="bg-[#0a0514]/60 border border-purple-500/15 rounded-3xl p-8 backdrop-blur-xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-8">Top Problematic Areas</h3>
          <div className="space-y-4">
            {topAreas.map((item: any) => (
              <div key={item.name} className="group flex items-center justify-between p-4 bg-[#130927]/50 border border-purple-500/10 rounded-2xl hover:bg-purple-500/10 transition-all cursor-default">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{item.value}</p>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest">Tickets</p>
                </div>
              </div>
            ))}
            {topAreas.length === 0 && (
              <p className="text-center py-12 text-xs text-white/10">No location data available yet.</p>
            )}
          </div>
        </section>

        {/* Repeat Users */}
        <section className="lg:col-span-2 bg-[#0a0514]/60 border border-purple-500/15 rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Critical Repeat Users</h3>
            <span className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 rounded-md font-bold uppercase tracking-widest">Action Required</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-white/20 border-b border-purple-500/10">
                  <th className="pb-4 px-4">User Details</th>
                  <th className="pb-4 px-4">Contact</th>
                  <th className="pb-4 px-4 text-right">Volume Intensity</th>
                </tr>
              </thead>
              <tbody>
                {repeatUsers.map((user: any, i: number) => (
                  <tr key={i} className="group border-b border-purple-500/10 hover:bg-purple-500/5 transition-colors">
                    <td className="py-6 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px]">
                          {user.name?.charAt(0)}
                        </div>
                        <span className="text-sm font-bold">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-6 px-4 text-sm text-white/40 font-mono">{user.phone}</td>
                    <td className="py-6 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-sm font-bold text-red-400">{user.count}</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, j) => (
                            <div key={j} className={`w-1 h-3 rounded-full ${j < user.count ? 'bg-red-500' : 'bg-white/10'}`} />
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {repeatUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-xs text-white/10 italic">No critical repeat users detected (threshold: &gt;3 tickets).</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
