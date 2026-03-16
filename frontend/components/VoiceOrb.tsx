import { motion } from 'framer-motion';
import React from 'react';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceOrbProps {
  state: OrbState;
  audioLevel: number; // 0–1, drives size pulse when listening
  onClick: () => void;
  color: string; // matches --orb-color CSS var
}

export function VoiceOrb({ state, audioLevel, onClick, color }: VoiceOrbProps) {
  // Base scale calculations
  const listeningScale = 1 + (audioLevel * 0.3);
  
  // Icon rendering based on state
  const renderIcon = () => {
    switch (state) {
      case 'idle':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        );
      case 'listening':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--orb-color)" stroke="var(--orb-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        );
      case 'processing':
        return (
          <motion.div 
            className="flex gap-1"
            initial="initial"
            animate="animate"
            variants={{
              animate: { transition: { staggerChildren: 0.2 } }
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-[var(--orb-color)]"
                variants={{
                  initial: { y: 0 },
                  animate: { y: [0, -6, 0], transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" } }
                }}
              />
            ))}
          </motion.div>
        );
      case 'speaking':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--orb-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        );
    }
  };

  const interactive = state === 'idle' || state === 'listening';

  return (
    <div className="relative flex items-center justify-center w-[300px] h-[300px]">
      {/* Speaking ripples */}
      {state === 'speaking' && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-[var(--orb-color)]"
              initial={{ width: 200, height: 200, opacity: 0.8 }}
              animate={{ width: 400, height: 400, opacity: 0 }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "linear",
              }}
            />
          ))}
        </>
      )}

      {/* Processing Spinner */}
      {state === 'processing' && (
        <motion.div
          className="absolute w-[220px] h-[220px] rounded-full border-t-2 border-r-2 border-[var(--orb-color)] opacity-50"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Main Orb */}
      <motion.button
        type="button"
        onClick={interactive ? onClick : undefined}
        className={`relative flex items-center justify-center rounded-full z-10 transition-colors ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
        style={{
          width: 200,
          height: 200,
          background: `radial-gradient(circle, rgba(var(--accent-rgb, 0, 194, 184), 0.3) 0%, transparent 70%)`,
          border: '1px solid color-mix(in srgb, var(--orb-color) 40%, transparent)',
          boxShadow: '0 0 40px var(--accent-glow)',
        }}
        animate={
          state === 'idle' 
            ? { scale: [0.97, 1.03, 0.97] } 
            : state === 'listening' 
              ? { scale: listeningScale }
              : { scale: 1 }
        }
        transition={
          state === 'idle' 
            ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 300, damping: 20 }
        }
      >
        {renderIcon()}
      </motion.button>
    </div>
  );
}