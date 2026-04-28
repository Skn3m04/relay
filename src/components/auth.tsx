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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('relay_user');
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        if (userData?.id) { onAuth(userData); return; }
      } catch { localStorage.removeItem('relay_user'); }
    }
    if (!supabase) setError('Supabase connection missing. Check .env.local');
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [onAuth]);

  // Particle canvas effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: Math.random() * 200,
        maxLife: 150 + Math.random() * 100,
        size: 0.5 + Math.random() * 1.5,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife) {
          p.life = 0;
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
        }
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.12 * (1 - dist / 80)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      if (!supabase) { setError('Configuration error: Supabase keys missing.'); setLoading(false); return; }
      const { data, error: dbError } = await supabase.from('profiles').select('*').eq('phone', trimmed).single();
      if (dbError || !data) { setError('Phone number not registered. Please Contact Support Center.'); return; }
      localStorage.setItem('relay_user', JSON.stringify(data));
      onAuth(data);
    } catch {
      setError('Connection failed. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#030108] overflow-hidden relative font-sans">

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-slow    { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes spin-reverse { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes radar-sweep  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; box-shadow: 0 0 20px rgba(168,85,247,0.3), 0 0 60px rgba(168,85,247,0.1); }
          50%       { opacity: 1;   box-shadow: 0 0 40px rgba(217,70,239,0.6), 0 0 100px rgba(217,70,239,0.2); }
        }
        @keyframes float-node {
          0%, 100% { transform: translateY(0px)   scale(1); opacity: 0.6; }
          50%       { transform: translateY(-12px) scale(1.1); opacity: 1; }
        }
        @keyframes scan-hologram {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(600%); opacity: 0; }
        }
        @keyframes error-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(110px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(110px) rotate(-360deg); }
        }
        @keyframes orbit-mobile {
          from { transform: rotate(0deg) translateX(65px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(65px) rotate(-360deg); }
        }
        @keyframes orbit-reverse {
          from { transform: rotate(360deg) translateX(75px) rotate(-360deg); }
          to   { transform: rotate(0deg) translateX(75px) rotate(0deg); }
        }
        @keyframes orbit-reverse-mobile {
          from { transform: rotate(360deg) translateX(45px) rotate(-360deg); }
          to   { transform: rotate(0deg) translateX(45px) rotate(0deg); }
        }
        @keyframes data-stream {
          0%   { transform: translateY(-100%); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes flicker {
          0%, 95%, 100% { opacity: 1; }
          96%, 98%      { opacity: 0.3; }
          97%, 99%      { opacity: 0.8; }
        }

        .ring-spin-cw  { animation: spin-slow    20s linear infinite; }
        .ring-spin-ccw { animation: spin-reverse  14s linear infinite; }
        .ring-spin-cw2 { animation: spin-slow     32s linear infinite; }
        .neon-glow-pulse { animation: glow-pulse   4s ease-in-out infinite; }
        .float-node-1  { animation: float-node  4s ease-in-out infinite; }
        .float-node-2  { animation: float-node  5.5s ease-in-out infinite 1s; }
        .float-node-3  { animation: float-node  3.8s ease-in-out infinite 0.5s; }
        .float-node-4  { animation: float-node  6s ease-in-out infinite 2s; }
        .hologram-scanner { animation: scan-hologram 5s linear infinite; }
        .animate-error    { animation: error-fade-in 0.3s ease forwards; }
        .flicker-text  { animation: flicker 8s ease-in-out infinite; }
        .btn-shimmer {
          background: linear-gradient(90deg, #7c3aed, #d946ef, #a855f7, #7c3aed);
          background-size: 200% auto;
          animation: shimmer 1.5s linear infinite;
        }
        .data-stream-1 { animation: data-stream 6s linear infinite; }
        .data-stream-2 { animation: data-stream 8s linear infinite 2s; }
        .data-stream-3 { animation: data-stream 7s linear infinite 4s; }
        .radar-sweep {
          background: conic-gradient(from 0deg, transparent 300deg, rgba(168,85,247,0.15) 340deg, rgba(217,70,239,0.4) 360deg);
          animation: radar-sweep 4s linear infinite;
        }

        /* Desktop orbits */
        .orbit-dot-1   { animation: orbit         8s linear infinite; }
        .orbit-dot-2   { animation: orbit        12s linear infinite 1s; }
        .orbit-dot-rev { animation: orbit-reverse 6s linear infinite; }

        /* Mobile orbits — smaller radius */
        @media (max-width: 1023px) {
          .orbit-dot-1   { animation: orbit-mobile         8s linear infinite; }
          .orbit-dot-2   { animation: orbit-mobile        12s linear infinite 1s; }
          .orbit-dot-rev { animation: orbit-reverse-mobile 6s linear infinite; }
        }
      `}} />

      {/* ============================================================ */}
      {/* LEFT / BACKGROUND PANEL — Cybernetic Void                    */}
      {/* On mobile: positioned behind login as full-screen background */}
      {/* On desktop: side-by-side split layout                        */}
      {/* ============================================================ */}
      <div className="absolute inset-0 lg:relative lg:flex-1 flex items-center justify-center overflow-hidden">

        {/* Particle Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Deep radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(107,33,168,0.25)_0%,transparent_70%)]" />

        {/* Cyberpunk grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.04)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Vertical data stream columns */}
        <div className="absolute top-0 left-[15%] w-px h-full overflow-hidden opacity-40">
          <div className="data-stream-1 w-full h-32 bg-gradient-to-b from-transparent via-fuchsia-400 to-transparent" />
        </div>
        <div className="absolute top-0 left-[42%] w-px h-full overflow-hidden opacity-30">
          <div className="data-stream-2 w-full h-48 bg-gradient-to-b from-transparent via-purple-400 to-transparent" />
        </div>
        <div className="absolute top-0 left-[70%] w-px h-full overflow-hidden opacity-35">
          <div className="data-stream-3 w-full h-24 bg-gradient-to-b from-transparent via-fuchsia-300 to-transparent" />
        </div>

        {/* ---- Central Core HUD ---- */}
        {/* Scales down on mobile */}
        <div className="relative flex items-center justify-center w-[280px] h-[280px] lg:w-[500px] lg:h-[500px]">

          {/* Outermost static ring */}
          <div className="absolute w-[260px] h-[260px] lg:w-[480px] lg:h-[480px] rounded-full border border-purple-500/10 ring-spin-cw2" />

          {/* Radar sweep disc */}
          <div className="absolute w-[220px] h-[220px] lg:w-[420px] lg:h-[420px] rounded-full radar-sweep opacity-60" />

          {/* Dashed ring 1 */}
          <svg className="absolute w-[220px] h-[220px] lg:w-[420px] lg:h-[420px] ring-spin-cw" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#d946ef" strokeWidth="0.4" strokeDasharray="3 5" />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const x1 = 50 + 44 * Math.cos(angle);
              const y1 = 50 + 44 * Math.sin(angle);
              const x2 = 50 + 48 * Math.cos(angle);
              const y2 = 50 + 48 * Math.sin(angle);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d946ef" strokeWidth="0.8" opacity="0.6" />;
            })}
          </svg>

          {/* Inner ring CCW */}
          <svg className="absolute w-[160px] h-[160px] lg:w-[310px] lg:h-[310px] ring-spin-ccw" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#a855f7" strokeWidth="0.6" strokeDasharray="1 3" />
          </svg>

          {/* Cross-hair lines */}
          <div className="absolute w-[200px] h-[200px] lg:w-[360px] lg:h-[360px] flex items-center justify-center pointer-events-none opacity-10">
            <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent" />
            <div className="absolute h-full w-px bg-gradient-to-b from-transparent via-fuchsia-400 to-transparent" />
          </div>

          {/* Orbiting dots */}
          <div className="absolute w-0 h-0" style={{ top: '50%', left: '50%' }}>
            <div className="orbit-dot-1 w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.9)] -ml-1 -mt-1 lg:-ml-1.5 lg:-mt-1.5" />
          </div>
          <div className="absolute w-0 h-0" style={{ top: '50%', left: '50%' }}>
            <div className="orbit-dot-2 w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.8)] -ml-0.5 -mt-0.5 lg:-ml-1 lg:-mt-1" />
          </div>
          <div className="absolute w-0 h-0" style={{ top: '50%', left: '50%' }}>
            <div className="orbit-dot-rev w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)] -ml-0.5 -mt-0.5 lg:-ml-1 lg:-mt-1" />
          </div>

          {/* Logo Core — smaller on mobile */}
          <div className="relative w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-black/60 border-2 border-purple-500/40 neon-glow-pulse flex items-center justify-center overflow-hidden backdrop-blur-md z-10">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-700/30 to-fuchsia-600/20" />
            <img src="/icon-192x192.png" alt="Relay" className="w-[82%] h-[82%] object-cover rounded-full z-10 relative" />
          </div>

          {/* Corner HUD brackets — hidden on mobile for cleaner look */}
          {[
            'top-4 left-4 border-t-2 border-l-2',
            'top-4 right-4 border-t-2 border-r-2',
            'bottom-4 left-4 border-b-2 border-l-2',
            'bottom-4 right-4 border-b-2 border-r-2',
          ].map((cls, i) => (
            <div key={i} className={`absolute w-6 h-6 lg:w-8 lg:h-8 border-fuchsia-400/40 ${cls} hidden sm:block`} />
          ))}
        </div>

        {/* Floating data nodes — hidden on mobile to avoid clutter */}
        <div className="float-node-1 absolute top-[15%] left-[10%] bg-[#0a0514]/80 border border-purple-500/30 rounded-xl px-3 py-2 backdrop-blur-md text-[10px] font-mono text-purple-300/60 hidden md:block">
          <span className="text-fuchsia-400/80">SYS</span> · ONLINE
        </div>
        <div className="float-node-2 absolute top-[20%] right-[12%] bg-[#0a0514]/80 border border-fuchsia-500/30 rounded-xl px-3 py-2 backdrop-blur-md text-[10px] font-mono text-purple-300/60 hidden md:block">
          <span className="text-green-400/80">●</span> RELAY ACTIVE
        </div>
        <div className="float-node-3 absolute bottom-[22%] left-[8%] bg-[#0a0514]/80 border border-purple-500/20 rounded-xl px-3 py-2 backdrop-blur-md text-[10px] font-mono text-purple-300/60 hidden lg:block">
          NODE · <span className="text-fuchsia-400/80">∞</span>
        </div>
        <div className="float-node-4 absolute bottom-[18%] right-[10%] bg-[#0a0514]/80 border border-purple-500/20 rounded-xl px-3 py-2 backdrop-blur-md text-[10px] font-mono text-purple-300/60 hidden lg:block">
          <span className="text-yellow-400/70">⚡</span> SIGNAL LOCK
        </div>

        {/* Brand text — hidden on mobile (shown in login panel instead) */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center hidden lg:block">
          <h1 className="text-5xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-500 flicker-text uppercase">
            Relay Support
          </h1>
          <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-fuchsia-400/40 mt-1 flex items-center justify-center gap-2">
            <span className="w-10 h-px bg-gradient-to-r from-transparent to-fuchsia-500/40" />
            Command Center
            <span className="w-10 h-px bg-gradient-to-l from-transparent to-fuchsia-500/40" />
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT / OVERLAY PANEL — Login                                */}
      {/* On mobile: full-screen overlay with glass background         */}
      {/* On desktop: fixed-width sidebar                              */}
      {/* ============================================================ */}
      <div className="relative z-20 min-h-screen flex items-center justify-center p-6 sm:p-8 lg:w-[400px] lg:border-l border-purple-500/10 bg-[#06030f]/90 lg:bg-[#06030f]/80 backdrop-blur-xl">

        {/* Scan line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent hologram-scanner shadow-[0_0_10px_rgba(217,70,239,0.8)] z-0" />

        <div className="w-full max-w-sm relative z-10 space-y-8">

          {/* Mobile brand text — visible only on mobile */}
          <div className="text-center lg:hidden mb-4">
            <h1 className="text-3xl sm:text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-500 flicker-text uppercase">
              Relay Support
            </h1>
            <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-fuchsia-400/40 mt-1 flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-gradient-to-r from-transparent to-fuchsia-500/40" />
              Command Center
              <span className="w-6 h-px bg-gradient-to-l from-transparent to-fuchsia-500/40" />
            </p>
          </div>

          {/* Panel header */}
          <div className="text-center space-y-1">
            <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-fuchsia-500/50">Secure Gateway</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white/90">Establish Link</h2>
            <p className="text-xs text-purple-300/30 font-mono">Awaiting valid credentials...</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <label className="block text-[10px] font-bold text-fuchsia-400/60 uppercase tracking-[0.15em] mb-2 transition-colors group-focus-within:text-fuchsia-400">
                Target Identification (Phone)
              </label>
              <div className="relative">
                <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-fuchsia-500/40 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-fuchsia-500/40 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <input
                  ref={inputRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(''); }}
                  placeholder="e.g. 8376007876"
                  className="w-full bg-[#130927]/50 border border-purple-500/20 px-5 py-4 rounded-xl text-sm text-purple-100 placeholder:text-purple-300/20 focus:outline-none focus:border-fuchsia-500/60 focus:ring-1 focus:ring-fuchsia-500/30 focus:bg-[#1a0c33]/80 transition-all font-mono tracking-wider"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="animate-error bg-red-900/20 border-l-2 border-red-500 p-3 text-xs text-red-300 font-mono tracking-wide flex items-start gap-2">
                <span className="mt-0.5 animate-pulse">⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="relative w-full group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`absolute inset-0 transition-all duration-300 ${
                loading
                  ? 'btn-shimmer'
                  : 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-600 opacity-70 group-hover:opacity-100'
              }`} />
              <div className="relative bg-[#0c051a] group-hover:bg-transparent transition-colors duration-300 px-4 py-4 rounded-xl flex items-center justify-center gap-3">
                <span className="font-bold text-sm text-fuchsia-100 tracking-widest uppercase">
                  {loading ? 'Authenticating...' : 'Initialize Relay'}
                </span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  loading
                    ? 'bg-fuchsia-500 animate-ping'
                    : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]'
                }`} />
              </div>
            </button>
          </form>

          {/* Bottom system status */}
          <div className="pt-4 border-t border-purple-500/10 flex items-center justify-between text-[9px] font-mono text-purple-400/30 uppercase tracking-widest">
            <span>v1.0.0</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] animate-pulse" />
              All Systems Nominal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
