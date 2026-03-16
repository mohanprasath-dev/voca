import React from 'react';

interface StatusBarProps {
  connected: boolean;
  latencyMs: number;
  personaLabel: string;
}

export function StatusBar({ connected, latencyMs, personaLabel }: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full h-8 bg-[var(--bg-surface)] border-t border-[var(--border)] flex items-center justify-between px-4 font-mono text-[11px] text-[var(--text-secondary)] z-50">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      
      <div className="text-[var(--text-mono)]">
        {personaLabel || 'No Persona'}
      </div>

      <div className="w-20 text-right">
        {connected && latencyMs > 0 ? `${latencyMs}ms` : '--'}
      </div>
    </div>
  );
}