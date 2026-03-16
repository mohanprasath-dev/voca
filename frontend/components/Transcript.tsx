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
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto overflow-y-auto px-4 pb-4 scroll-smooth"
      style={{ maxHeight: '35vh', scrollbarWidth: 'none' }}
    >
      <AnimatePresence initial={false}>
        {entries.map((entry, idx) => {
          const isUser = entry.role === 'user';

          return (
            <motion.div
              key={`${entry.timestamp}-${idx}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <motion.div
                className="max-w-[85%] px-5 py-4 rounded-3xl font-mono text-sm leading-relaxed"
                animate={{
                  backgroundColor: isUser ? 'rgba(255,255,255,0.05)' : `${accentColor}1A`,
                  color: isUser ? '#E2E8F0' : '#F8FAFC',
                  borderBottomRightRadius: isUser ? '4px' : '24px',
                  borderBottomLeftRadius: isUser ? '24px' : '4px',
                  border: `1px solid ${isUser ? 'rgba(255,255,255,0.05)' : `${accentColor}33`}`,
                }}
                transition={{ duration: 0.4 }}
              >
                {entry.text}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {entries.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="m-auto font-mono text-xs tracking-widest text-center uppercase"
          style={{ color: '#8B92A0' }}
        >
          Awaiting input
        </motion.div>
      )}
    </div>
  );
}