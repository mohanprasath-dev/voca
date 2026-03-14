import { useState } from 'react'

export function usePersona() {
  // Persona state management hook placeholder
  const [activePersona, setActivePersona] = useState('aura')
  
  return {
    activePersona,
    setActivePersona,
  }
}
