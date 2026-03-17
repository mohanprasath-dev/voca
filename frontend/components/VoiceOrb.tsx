'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceOrbProps {
  state: OrbState;
  audioLevel: number;
  onClick: () => void;
  color: string;
}

const MicIcon = ({ color }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const SpeakerIcon = ({ color }: { color?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const SpinnerIcon = ({ color }: { color?: string }) => (
  <motion.svg 
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </motion.svg>
);

export default function VoiceOrb({ state, audioLevel, onClick, color }: VoiceOrbProps) {
  const isClickable = state === 'idle' || state === 'listening';
  const ORB_SIZE = 240;

  return (
    <div className="relative flex items-center justify-center w-[450px] h-[450px]">
      <AnimatePresence>
        {state === 'idle' && (
          <motion.div
            key="idle-ring"
            className="absolute rounded-full pointer-events-none"
            initial={{ width: 280, height: 280, opacity: 0.05 }}
            animate={{ width: 280, height: 280, opacity: 0.1 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
            style={{ border: `1px solid ${color}` }}
          />
        )}

        {state === 'speaking' && [0, 1, 2, 3].map((i) => (
          <motion.div
            key={`speak-${i}`}
            className="absolute rounded-full pointer-events-none"
            initial={{ width: ORB_SIZE, height: ORB_SIZE, opacity: 0.3, border: `1px solid ${color}` }}
            animate={{ width: ORB_SIZE + 100 + i * 80, height: ORB_SIZE + 100 + i * 80, opacity: 0 }}
            transition={{ duration: 3, delay: i * 0.75, repeat: Infinity, ease: 'linear' }}
          />
        ))}

        {state === 'listening' && [0, 1, 2, 3].map((i) => {
          const ringRadii = [280, 320, 360, 400];
          const radius = ringRadii[i];
          const opacityVal = Math.max(0.05, audioLevel * (0.6 - i * 0.15));
          
          return (
            <motion.div
              key={`listen-${i}`}
              className="absolute rounded-full pointer-events-none"
              animate={{
                width: radius + (audioLevel * 20),
                height: radius + (audioLevel * 20),
                opacity: opacityVal,
              }}
              transition={{ type: 'spring', stiffness: 400 - (i * 50), damping: 25, mass: 0.5 }}
              style={{ border: `1px solid ${color}` }}
            />
          );
        })}
      </AnimatePresence>

      <motion.button
        onClick={isClickable ? onClick : undefined}
        className="relative flex items-center justify-center rounded-full focus:outline-none z-10"
        animate={{
          background: `radial-gradient(circle, ${color}20 0%, ${color}08 50%, transparent 100%)`,
          boxShadow: `0 0 60px ${color}20, 0 0 120px ${color}10`,
          borderColor: `${color}40`,
        }}
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderWidth: 1,
          borderStyle: 'solid',
          cursor: isClickable ? 'pointer' : 'default',
        }}
        whileTap={isClickable ? { scale: 0.95 } : undefined}
      >
        <motion.div animate={{ color }} transition={{ duration: 0.4 }} className="flex items-center justify-center">
          {(state === 'idle' || state === 'listening') && <MicIcon color={color} />}
          {state === 'speaking' && <SpeakerIcon color={color} />}
          {state === 'processing' && <SpinnerIcon color={color} />}
        </motion.div>
      </motion.button>
    </div>
  );
}