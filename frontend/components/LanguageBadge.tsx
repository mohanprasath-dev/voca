'use client';

import React from 'react';
import { motion } from 'framer-motion';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
};

export interface LanguageBadgeProps {
  language: string;
  changed: boolean;
  accentColor: string;
}

export default function LanguageBadge({ language, changed, accentColor }: LanguageBadgeProps) {
  const code = language.split('-')[0].toLowerCase();
  const displayName = LANGUAGE_MAP[code] || 'English';

  return (
    <motion.div
      initial={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
      animate={{
        backgroundColor: changed ? `${accentColor}33` : 'rgba(255, 255, 255, 0.03)',
        borderColor: changed ? accentColor : 'rgba(255, 255, 255, 0.08)',
        color: changed ? accentColor : '#A8B5C8',
        scale: changed ? [1, 1.05, 1] : 1
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="px-3 py-1.5 text-xs font-medium tracking-wide rounded-full border backdrop-blur-md"
    >
      {displayName}
    </motion.div>
  );
}