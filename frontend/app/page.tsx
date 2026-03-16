'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePersona } from '../hooks/usePersona';
import { useVoice } from '../hooks/useVoice';
import { vocaWS, VocaMessage } from '../lib/websocket';
import { VoiceOrb, OrbState } from '../components/VoiceOrb';
import { PersonaSwitcher } from '../components/PersonaSwitcher';
import { Transcript, TranscriptEntry } from '../components/Transcript';
import { LanguageBadge } from '../components/LanguageBadge';
import { StatusBar } from '../components/StatusBar';

export default function VocaPage() {
  const { personas, activePersona, setActivePersona, isLoading } = usePersona();
  
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [languageChanged, setLanguageChanged] = useState<boolean>(false);
  const [escalation, setEscalation] = useState<string | null>(null);
  
  // Connection and latency state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    vocaWS.sendAudio(chunk);
  }, []);

  const { isListening, startListening, stopListening, audioLevel } = useVoice(handleAudioChunk);

  const playAudioSequence = async () => {
    if (audioChunksRef.current.length === 0) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    audioChunksRef.current = [];

    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(combined.buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setOrbState('idle');
      };
      
      setOrbState('speaking');
      source.start();
    } catch (e) {
      console.error("Failed to decode audio", e);
      setOrbState('idle');
    }
  };

  useEffect(() => {
    if (!activePersona) return;

    vocaWS.connect(
      activePersona.id,
      (message: VocaMessage) => {
        if (message.type === 'persona_loaded') {
          // Persona ready
          setIsConnected(true);
        } else if (message.type === 'transcript') {
          const text = message.text as string;
          const lang = message.language as string;
          setTranscriptEntries(prev => [...prev, { role: 'user', text, language: lang, timestamp: Date.now() }]);
          setCurrentLanguage(lang);
        } else if (message.type === 'language_changed') {
          const to = message.to as string;
          setCurrentLanguage(to);
          setLanguageChanged(true);
          setTimeout(() => setLanguageChanged(false), 2000);
        } else if (message.type === 'response') {
          const text = message.text as string;
          const lang = message.language as string;
          setTranscriptEntries(prev => [...prev, { role: 'voca', text, language: lang, timestamp: Date.now() }]);
          setLatencyMs(vocaWS.latencyMs);
          
          // Once response arrives, play whatever chunks we have
          playAudioSequence();
          
          // Fallback if no chunks received
          if (audioChunksRef.current.length === 0 && orbState === 'processing') {
             setOrbState('idle');
          }
        } else if (message.type === 'escalation') {
           setEscalation(message.message as string);
        }
      },
      (chunk: ArrayBuffer) => {
        audioChunksRef.current.push(chunk);
        if (orbState !== 'speaking' && orbState !== 'processing') {
          setOrbState('processing'); // Transition to processing when first chunk arrives if not already
        }
      }
    );

    return () => {
      vocaWS.disconnect();
    };
  }, [activePersona]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(vocaWS.isConnected);
      if (vocaWS.isConnected) {
        setLatencyMs(vocaWS.latencyMs);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOrbClick = async () => {
    if (orbState === 'idle') {
      await startListening();
      setOrbState('listening');
    } else if (orbState === 'listening') {
      stopListening();
      setOrbState('processing');
    }
  };

  const handlePersonaSwitch = (persona: any) => {
    if (orbState !== 'idle') return;
    setActivePersona(persona);
    vocaWS.switchPersona(persona.id);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-secondary)]">Loading Voca...</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex flex-col font-sans">
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between p-6">
        <div className="flex-1" />
        <div className="flex-1 flex justify-center">
          <PersonaSwitcher 
            personas={personas} 
            activePersona={activePersona} 
            onSwitch={handlePersonaSwitch} 
            disabled={orbState !== 'idle'} 
          />
        </div>
        <div className="flex-1 flex justify-end">
          <LanguageBadge language={currentLanguage} changed={languageChanged} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-12 pb-24 px-4">
        {escalation && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm max-w-xl text-center">
            {escalation}
          </div>
        )}
        
        <VoiceOrb 
          state={orbState} 
          audioLevel={audioLevel} 
          onClick={handleOrbClick} 
          color={activePersona?.ui_config.orb_color || '#00C2B8'} 
        />

        <div className="w-full max-w-3xl flex-1 flex flex-col justify-end">
          <Transcript entries={transcriptEntries} />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar 
        connected={isConnected} 
        latencyMs={latencyMs} 
        personaLabel={activePersona?.ui_config.label || ''} 
      />
    </main>
  );
}