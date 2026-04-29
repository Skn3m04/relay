'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#030108] text-white p-6 text-center">
          <div className="fixed inset-0 bg-[linear-gradient(rgba(168,85,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0" />
          
          <div className="relative z-10 space-y-6 max-w-md">
            <div className="w-20 h-20 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase tracking-[0.2em]">System Fault Detected</h1>
            <p className="text-white/40 text-sm font-mono leading-relaxed">
              An unexpected glitch occurred in the cybernetic core. The interface has been isolated to prevent further data corruption.
            </p>
            
            <div className="p-4 bg-black/40 border border-purple-500/10 rounded-xl text-left overflow-auto max-h-32">
              <p className="text-[10px] text-red-400 font-mono break-all">{this.state.error?.message}</p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-sm font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_30px_rgba(168,85,247,0.3)]"
            >
              Reboot System Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
