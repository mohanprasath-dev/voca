'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StatusBarProps {
  connected: boolean;
  latencyMs: number;
  personaLabel: string;
  accentColor: string;
}

export function StatusBar({ connected, latencyMs, personaLabel, accentColor }: StatusBarProps) {
  return (
    <motion.div 
      className="fixed bottom-0 left-0 w-full h-10 flex items-center justify-between px-6 font-mono text-[10px] uppercase tracking-widest z-50 backdrop-blur-md"
      animate={{
        backgroundColor: 'rgba(8, 10, 15, 0.8)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        color: '#8B92A0'
      }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 w-1/3">
        <motion.div 
          animate={{
            backgroundColor: connected ? '#10B981' : '#EF4444',
            boxShadow: connected ? '0 0 10px #10B981' : '0 0 10px #EF4444'
          }}
          className="w-1.5 h-1.5 rounded-full"
        />
        <span>{connected ? 'Sys.Online' : 'Sys.Offline'}</span>
      </div>
      
      <div className="flex justify-center w-1/3">
        <motion.span 
          animate={{ color: accentColor }}
          transition={{ duration: 0.4 }}
        >
          {personaLabel || 'No Persona'}
        </motion.span>
      </div>

      <div className="flex justify-end w-1/3">
        {connected && latencyMs > 0 ? (
          <span>Ping {latencyMs}ms</span>
        ) : (
          <span>Ping --</span>
        )}
      </div>
    </motion.div>
  );
}