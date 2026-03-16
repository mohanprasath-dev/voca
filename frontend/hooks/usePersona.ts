import { useState, useEffect, useCallback } from 'react';

export interface Persona {
  id: string;
  name: string;
  display_name: string;
  ui_config: {
    accent_color: string;
    orb_color: string;
    label: string;
  };
}

export interface UsePersonaReturn {
  personas: Persona[];
  activePersona: Persona | null;
  setActivePersona: (persona: Persona) => void;
  isLoading: boolean;
}

// Helper to convert hex to rgb for the glow
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 194, 184';
}

export function usePersona(): UsePersonaReturn {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersonaState] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateCssVars = (persona: Persona) => {
    const root = document.documentElement;
    root.style.setProperty('--accent', persona.ui_config.accent_color);
    root.style.setProperty('--orb-color', persona.ui_config.orb_color);
    
    // Set accent-glow to 15% opacity
    const rgb = hexToRgb(persona.ui_config.accent_color);
    root.style.setProperty('--accent-glow', `rgba(${rgb}, 0.15)`);
  };

  const setActivePersona = useCallback((persona: Persona) => {
    setActivePersonaState(persona);
    updateCssVars(persona);
  }, []);

  useEffect(() => {
    async function fetchPersonas() {
      try {
        const response = await fetch('http://localhost:8000/personas');
        const data = await response.json();
        
        // Ensure it's an array
        const personaList: Persona[] = Array.isArray(data) ? data : (data.personas || []);
        setPersonas(personaList);
        
        if (personaList.length > 0) {
          // Default to apex
          const defaultPersona = personaList.find(p => p.id === 'apex') || personaList[0];
          setActivePersona(defaultPersona);
        }
      } catch (err) {
        console.error("Failed to fetch personas", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchPersonas();
  }, [setActivePersona]);

  return {
    personas,
    activePersona,
    setActivePersona,
    isLoading
  };
}