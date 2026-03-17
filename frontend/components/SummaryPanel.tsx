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
}

export default function SummaryPanel({ summary, onNewConversation }: SummaryPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="w-full max-w-2xl bg-white/[0.03] border border-white/10 p-6 rounded-2xl backdrop-blur-md"
    >
      <h3 className="text-white text-lg font-semibold mb-4">Session Summary</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
        <div className="text-[#A8B5C8]">Persona: <span className="text-white">{summary.personaName}</span></div>
        <div className="text-[#A8B5C8]">Duration: <span className="text-white">{summary.durationSeconds}s</span></div>
        <div className="text-[#A8B5C8]">Turns: <span className="text-white">{summary.turnCount}</span></div>
        <div className="text-[#A8B5C8]">Languages: <span className="text-white">{summary.languagesUsed.join(', ') || '-'}</span></div>
      </div>

      <p className="text-sm text-[#D5D9E3] leading-relaxed mb-5">{summary.summaryText}</p>

      <button
        onClick={onNewConversation}
        className="px-4 py-2 rounded-lg border border-white/15 text-white text-sm hover:bg-white/5 transition-colors"
      >
        New Conversation
      </button>
    </motion.div>
  );
}
