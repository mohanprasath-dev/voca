import React from 'react';
import { motion } from 'framer-motion';

interface LanguageBadgeProps {
  language: string;
  changed: boolean;
}

const langMap: Record<string, string> = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
};

export function LanguageBadge({ language, changed }: LanguageBadgeProps) {
  const displayLang = langMap[language] || language.toUpperCase();

  return (
    <motion.div
      className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide font-sans shadow-sm`}
      initial={false}
      animate={{
        backgroundColor: changed ? 'var(--accent)' : 'var(--bg-elevated)',
        color: changed ? '#FFFFFF' : 'var(--text-secondary)',
        opacity: changed ? [1, 0.8, 1] : 1,
      }}
      transition={{ 
        backgroundColor: { duration: 0.3 },
        color: { duration: 0.3 },
        opacity: { duration: 0.5, repeat: changed ? 3 : 0 }
      }}
      style={{
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-secondary)'
      }}
    >
      {displayLang}
    </motion.div>
  );
}