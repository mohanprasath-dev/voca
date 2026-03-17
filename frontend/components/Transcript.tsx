'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TranscriptEntry {
  role: 'user' | 'voca';
  text: string;
  language: string;
  timestamp: number;
}

interface TranscriptProps {
  entries: TranscriptEntry[];
  accentColor: string;
}

export function Transcript({ entries, accentColor }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [entries]);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-6 w-full max-w-3xl mx-auto overflow-y-auto px-6 py-6 scroll-smooth rounded-3xl"
      style={{
        maxHeight: '35vh',
        scrollbarWidth: 'none',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <AnimatePresence initial={false}>
        {entries.map((entry, idx) => {
          const isUser = entry.role === 'user';

          return (
            <motion.div
              key={`${entry.timestamp}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] font-mono text-sm leading-relaxed ${
                  isUser 
                    ? 'px-5 py-3 rounded-full bg-[rgba(255,255,255,0.06)] text-[#F0F2F5]' 
                    : 'pl-4 py-1 bg-transparent text-[#F0F2F5]'
                }`}
                style={{
                  borderLeft: isUser ? 'none' : `2px solid ${accentColor}`
                }}
              >
                {entry.text}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {entries.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="m-auto font-mono text-sm tracking-wide text-center"
          style={{ color: 'var(--text-mono)' }}
        >
          Start speaking to begin...
        </motion.div>
      )}
    </div>
  );
}