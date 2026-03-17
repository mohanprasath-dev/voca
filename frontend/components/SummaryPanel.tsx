'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface SessionSummaryView {
  personaName: string;
  durationSeconds: number;
  turnCount: number;
  languagesUsed: string[];
  summaryText: string;
}

interface SummaryPanelProps {
  summary: SessionSummaryView;
  onNewConversation: () => void;
  accentColor?: string;
}

import Link from 'next/link';

export default function SummaryPanel({ summary, onNewConversation, accentColor = '#00C2B8' }: SummaryPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-full max-w-3xl mx-auto p-8 rounded-3xl"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: accentColor, boxShadow: `0 0 12px ${accentColor}` }}
          />
          <h3 className="text-white text-2xl font-semibold">{summary.personaName} — Session Complete</h3>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-full font-semibold text-sm transition-transform hover:scale-105 border border-white/20 text-white hover:bg-white/5"
          >
            View Dashboard →
          </Link>
          <button
            onClick={onNewConversation}
            className="px-6 py-2.5 rounded-full font-semibold text-sm transition-transform hover:scale-105"
            style={{ backgroundColor: accentColor, color: '#080A0F' }}
          >
            New Conversation
          </button>
        </div>
      </div>

      <div className="flex items-center gap-8 mb-8 pb-8 border-b border-white/10 font-mono text-sm">
        <div>
          <span className="text-[#8B92A0] block text-xs uppercase tracking-widest mb-1">Duration</span>
          <span className="text-white text-lg">{summary.durationSeconds}s</span>
        </div>
        <div>
          <span className="text-[#8B92A0] block text-xs uppercase tracking-widest mb-1">Turns</span>
          <span className="text-white text-lg">{summary.turnCount}</span>
        </div>
        <div>
          <span className="text-[#8B92A0] block text-xs uppercase tracking-widest mb-1">Languages</span>
          <span className="text-white text-lg">{summary.languagesUsed.join(', ') || '-'}</span>
        </div>
      </div>

      <div>
        <span className="text-[#8B92A0] block font-mono text-xs uppercase tracking-widest mb-3">Session Summary</span>
        <p className="text-base text-[#D5D9E3] leading-relaxed font-sans">{summary.summaryText}</p>
      </div>
    </motion.div>
  );
}
