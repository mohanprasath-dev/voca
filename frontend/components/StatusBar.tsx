'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface StatusBarProps {
  connectionState: 'ready' | 'connected' | 'disconnected';
  latencyMs: number;
  personaLabel: string;
  accentColor: string;
}

export function StatusBar({ connectionState, latencyMs, personaLabel, accentColor }: StatusBarProps) {
  return (
    <motion.div 
      className="fixed bottom-0 left-0 w-full h-10 flex items-center justify-between px-6 font-mono text-[10px] uppercase tracking-widest z-50 backdrop-blur-md"
      animate={{
        backgroundColor: 'rgba(8, 10, 15, 0.9)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#8B92A0'
      }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 w-1/4">
        <motion.div 
          animate={{
            backgroundColor: connectionState === 'connected' ? '#10B981' : connectionState === 'disconnected' ? '#EF4444' : '#8B92A0',
            boxShadow: connectionState === 'connected' ? '0 0 10px #10B981' : connectionState === 'disconnected' ? '0 0 10px #EF4444' : '0 0 10px transparent'
          }}
          className="w-1.5 h-1.5 rounded-full"
        />
        <span>{connectionState === 'connected' ? 'Connected' : connectionState === 'disconnected' ? 'Disconnected' : 'Ready'}</span>
      </div>
      
      <div className="flex justify-center w-1/4">
        <motion.span 
          animate={{ color: accentColor }}
          transition={{ duration: 0.4 }}
        >
          {personaLabel || 'No Persona'}
        </motion.span>
      </div>

      <div className="flex items-center justify-end w-2/4 gap-6">
        {connectionState === 'connected' && latencyMs > 0 ? (
          <span>Ping {latencyMs}ms</span>
        ) : (
          <span>Ping --ms</span>
        )}
        <Link
          href="/dashboard"
          className="text-[#8B92A0] hover:text-white transition-colors no-underline"
        >
          Dashboard →
        </Link>
        <Link
          href="/about"
          className="text-[#8B92A0] hover:text-white transition-colors no-underline"
        >
          About →
        </Link>
      </div>
    </motion.div>
  );
}