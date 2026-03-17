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

export default function VoiceOrb({ state, audioLevel, onClick, color }: VoiceOrbProps) {
  const isClickable = state === 'idle' || state === 'listening';

  let scale = 1;
  if (state === 'idle') scale = 1;
  if (state === 'listening') scale = 1 + audioLevel * 0.4;
  if (state === 'processing') scale = 0.95;
  if (state === 'speaking') scale = 1.05;

  return (
    <div className="relative flex items-center justify-center w-72 h-72">
      <AnimatePresence>
        {state === 'speaking' && [0, 1, 2].map((i) => (
          <motion.div
            key={`speak-${i}`}
            className="absolute rounded-full pointer-events-none"
            initial={{ width: 160, height: 160, opacity: 0.5, border: `1px solid ${color}` }}
            animate={{ width: 300 + i * 60, height: 300 + i * 60, opacity: 0 }}
            transition={{
              duration: 2,
              delay: i * 0.4,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}

        {state === 'listening' && [1, 2, 3, 4].map((i) => {
          const baseOpacity = 0.6 - (i * 0.12);
          const ringScale = 1 + (audioLevel * (0.8 + i * 0.3)) + (i * 0.15);
          const isHigh = audioLevel > 0.4;
          
          return (
            <motion.div
              key={`listen-${i}`}
              className="absolute rounded-full pointer-events-none"
              initial={{ width: 160, height: 160, opacity: 0, scale: 1 }}
              animate={{
                scale: ringScale,
                opacity: audioLevel < 0.05 ? baseOpacity * 0.4 : baseOpacity,
                boxShadow: isHigh ? `0 0 ${15 + i * 5}px ${color}` : 'none'
              }}
              transition={{
                type: 'spring',
                stiffness: 300 - (i * 30),
                damping: 20 + i,
                mass: 0.5
              }}
              style={{
                border: `1.5px solid ${color}`,
              }}
            />
          );
        })}
      </AnimatePresence>
      <motion.button
        onClick={isClickable ? onClick : undefined}
        className="relative flex items-center justify-center rounded-full focus:outline-none z-10"
        animate={{
          scale: state === 'idle' ? [0.97, 1.03, 0.97] : scale,
          background: `radial-gradient(circle, ${color}33 0%, transparent 60%)`, // 20% opacity center
          borderColor: color,            // Border uses color prop
          boxShadow: `0 0 60px 10px ${color}4D`, // Box shadow glow at 30% opacity
        }}
        transition={
          state === 'idle'
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : { type: 'spring', stiffness: 300, damping: 20, mass: 0.5 }
        }
        style={{
          width: 160,
          height: 160,
          borderWidth: 1,
          borderStyle: 'solid',
          cursor: isClickable ? 'pointer' : 'default',
        }}
        whileTap={isClickable ? { scale: 0.9 } : undefined}
      >
        <motion.div
          animate={{ color }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center"
        >
          {state === 'idle' && <MicIcon color={color} />}
          {state === 'listening' && <MicIcon color={color} />}
          
          {state === 'processing' && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${color}4D`, borderTopColor: color }}
            />
          )}
          
          {state === 'speaking' && <SpeakerIcon color={color} />}
        </motion.div>
      </motion.button>
    </div>
  );
}