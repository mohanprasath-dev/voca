import React from 'react';
import { Persona } from '../hooks/usePersona';

interface PersonaSwitcherProps {
  personas: Persona[];
  activePersona: Persona | null;
  onSwitch: (persona: Persona) => void;
  disabled: boolean;
}

export function PersonaSwitcher({ personas, activePersona, onSwitch, disabled }: PersonaSwitcherProps) {
  if (personas.length === 0) return null;

  return (
    <div className={`flex items-center justify-center gap-2 p-1 bg-[var(--bg-surface)] rounded-full border border-[var(--border)] transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      {personas.map((persona) => {
        const isActive = activePersona?.id === persona.id;
        return (
          <button
            key={persona.id}
            onClick={() => !disabled && onSwitch(persona)}
            disabled={disabled}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ease-in-out font-sans`}
            style={{
              backgroundColor: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
              boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none',
            }}
          >
            {persona.ui_config.label || persona.name}
          </button>
        );
      })}
    </div>
  );
}