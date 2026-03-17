'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Persona } from '../hooks/usePersona';

interface PersonaSwitcherProps {
  personas: Persona[];
  activePersona: Persona | null;
  onSwitch: (persona: Persona) => void;
  disabled: boolean;
  pendingPersonaId: string | null;
}

export function PersonaSwitcher({ personas, activePersona, onSwitch, disabled, pendingPersonaId }: PersonaSwitcherProps) {
  if (personas.length === 0) return null;

  return (
    <motion.div 
      className="flex items-center gap-1 p-1 rounded-full border backdrop-blur-md z-10"
      animate={{
        backgroundColor: 'rgba(15, 17, 23, 0.6)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        opacity: disabled ? 0.5 : 1
      }}
      transition={{ duration: 0.4 }}
      style={{ pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {personas.map((persona) => {
        const isActive = activePersona?.id === persona.id;
        const isPending = pendingPersonaId === persona.id;
        const color = persona.ui_config.accent_color;

        return (
          <motion.button
            key={persona.id}
            onClick={() => onSwitch(persona)}
            className="relative px-5 py-2 text-xs font-medium rounded-full outline-none"
            animate={{
              color: isActive ? '#FFFFFF' : '#8B92A0'
            }}
            transition={{ duration: 0.4 }}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            {isActive && (
              <motion.div
                layoutId="activePersonaPill"
                className="absolute inset-0 rounded-full"
                initial={false}
                animate={{
                  backgroundColor: color,
                  boxShadow: `0 0 20px 2px ${color}40`
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <span className="relative z-10">{persona.ui_config.label || persona.name}</span>
            {isPending && (
              <motion.span
                className="absolute -right-1 -top-1 w-2 h-2 rounded-full"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                style={{ backgroundColor: color }}
              />
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}