'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePersona } from '../hooks/usePersona';
import { useVoice } from '../hooks/useVoice';
import { vocaWS, VocaMessage } from '../lib/websocket';
import VoiceOrb, { OrbState } from '../components/VoiceOrb';
import { PersonaSwitcher } from '../components/PersonaSwitcher';
import { Transcript, TranscriptEntry } from '../components/Transcript';
import LanguageBadge from '../components/LanguageBadge';
import { StatusBar } from '../components/StatusBar';
import SummaryPanel, { SessionSummaryData } from '../components/SummaryPanel';
import { motion, AnimatePresence } from 'framer-motion';

export default function VocaPage() {
  const { personas, activePersona, setActivePersona, isLoading } = usePersona();
  
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [languageChanged, setLanguageChanged] = useState<boolean>(false);
  const [escalation, setEscalation] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null);
  
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousOrbStateRef = useRef<OrbState>('idle');
  const endSessionRequestedRef = useRef<boolean>(false);

  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    vocaWS.sendAudio(chunk);
  }, []);

  const { startListening, stopListening, audioLevel } = useVoice(handleAudioChunk);

  const playAudioSequence = async () => {
    if (audioChunksRef.current.length === 0) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
          
          playAudioSequence();
          
          if (audioChunksRef.current.length === 0 && orbState === 'processing') {
             setOrbState('idle');
          }
        } else if (message.type === 'escalation') {
           setEscalation(message.message as string);
        } else if (message.type === 'session_summary') {
          setSessionSummary({
            session_id: String(message.session_id || ''),
            persona_name: String(message.persona_name || activePersona?.display_name || 'Voca'),
            duration_seconds: Number(message.duration_seconds || 0),
            turn_count: Number(message.turn_count || 0),
            detected_languages: Array.isArray(message.detected_languages)
              ? message.detected_languages.map((lang) => String(lang))
              : [],
            escalated: Boolean(message.escalated),
            resolution_status: String(message.resolution_status || 'ended'),
            summary: String(message.summary || 'No conversation recorded.'),
          });
        }
      },
      (chunk: ArrayBuffer) => {
        audioChunksRef.current.push(chunk);
        setOrbState(prev => prev !== 'speaking' ? 'processing' : prev);
      }
    );

    return () => {
      vocaWS.disconnect();
    };
  }, [activePersona, orbState]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(vocaWS.isConnected);
      if (vocaWS.isConnected) {
        setLatencyMs(vocaWS.latencyMs);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const previous = previousOrbStateRef.current;
    if (
      previous === 'speaking' &&
      orbState === 'idle' &&
      transcriptEntries.length > 0 &&
      !endSessionRequestedRef.current
    ) {
      vocaWS.sendEndSession();
      endSessionRequestedRef.current = true;
    }
    previousOrbStateRef.current = orbState;
  }, [orbState, transcriptEntries.length]);

  const handleOrbClick = async () => {
    if (orbState === 'idle') {
      await startListening();
      setOrbState('listening');
    } else if (orbState === 'listening') {
      stopListening();
      setOrbState('processing');
    }
  };

  const handlePersonaSwitch = (persona: import('../hooks/usePersona').Persona) => {
    if (orbState !== 'idle') return;
    setActivePersona(persona);
    setSessionSummary(null);
    setTranscriptEntries([]);
    endSessionRequestedRef.current = false;
    vocaWS.switchPersona(persona.id);
  };

  const handleSummaryDismiss = () => {
    setSessionSummary(null);
    setTranscriptEntries([]);
    setEscalation(null);
    endSessionRequestedRef.current = false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080A0F] flex items-center justify-center font-mono text-xs tracking-widest text-[#8B92A0] uppercase">
        Initializing Core...
      </div>
    );
  }

  const currentAccent = activePersona?.ui_config.accent_color || '#00C2B8';

  return (
    <motion.main 
      className="min-h-screen flex flex-col font-sans overflow-hidden"
      style={{ ['--accent' as string]: currentAccent }}
      animate={{ backgroundColor: '#080A0F' }}
      transition={{ duration: 0.4 }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(circle at 50% 50%, ${currentAccent}08 0%, transparent 60%)`,
        transition: 'background 0.4s ease-in-out'
      }} />

      <div className="w-full flex items-center justify-between p-6 z-10">
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
          <LanguageBadge 
            language={currentLanguage} 
            changed={languageChanged} 
            accentColor={currentAccent}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-16 pb-24 px-4 z-10">
        <AnimatePresence>
          {escalation && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-3 rounded-2xl text-xs font-mono max-w-xl text-center backdrop-blur-md"
            >
              {escalation}
            </motion.div>
          )}
        </AnimatePresence>
        
        <VoiceOrb 
          state={orbState} 
          audioLevel={audioLevel} 
          onClick={handleOrbClick} 
          color={activePersona?.ui_config.orb_color || '#00C2B8'} 
        />

        <div className="w-full max-w-3xl flex-1 flex flex-col justify-end">
          <Transcript entries={transcriptEntries} accentColor={currentAccent} />
          <div className="mt-4">
            <SummaryPanel data={sessionSummary} onDismiss={handleSummaryDismiss} />
          </div>
        </div>
      </div>

      <StatusBar 
        connected={isConnected} 
        latencyMs={latencyMs} 
        personaLabel={activePersona?.ui_config.label || ''} 
        accentColor={currentAccent}
      />
    </motion.main>
  );
}