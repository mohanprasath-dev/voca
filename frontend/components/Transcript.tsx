import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export interface TranscriptEntry {
  role: 'user' | 'voca';
  text: string;
  language: string;
  timestamp: number;
}

interface TranscriptProps {
  entries: TranscriptEntry[];
}

export function Transcript({ entries }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full opacity-50 text-[var(--text-mono)] font-mono text-sm">
        Start speaking to begin
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-4 w-full max-w-2xl mx-auto overflow-y-auto pr-2 scroll-smooth"
      style={{ maxHeight: '40vh' }}
    >
      {entries.map((entry, idx) => {
        const isUser = entry.role === 'user';
        const words = entry.text.split(' ');

        return (
          <motion.div
            key={`${entry.timestamp}-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl font-mono text-sm leading-relaxed
                ${isUser 
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-mono)] rounded-br-sm' 
                  : 'bg-transparent text-[var(--text-secondary)] rounded-bl-sm'
                }
              `}
            >
              <motion.div
                variants={{
                  hidden: { opacity: 1 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.02,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
                className="flex flex-wrap gap-x-1"
              >
                {words.map((word, wIdx) => (
                  <motion.span
                    key={`${wIdx}`}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1 },
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}