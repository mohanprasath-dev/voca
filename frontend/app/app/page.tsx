'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePersona } from '../../hooks/usePersona';
import { useVoice } from '../../hooks/useVoice';
import { vocaWS, VocaMessage } from '../../lib/websocket';
import VoiceOrb, { OrbState } from '../../components/VoiceOrb';
import { PersonaSwitcher } from '../../components/PersonaSwitcher';
import { Transcript, TranscriptEntry } from '../../components/Transcript';
import LanguageBadge from '../../components/LanguageBadge';
import { StatusBar } from '../../components/StatusBar';
import SummaryPanel, { SessionSummaryView } from '../../components/SummaryPanel';
import { motion, AnimatePresence } from 'framer-motion';

const NOTICE_AUTO_HIDE_MS = 2500;
const AUDIO_WAIT_NOTICE_MS = 20000;
const AUDIO_WAIT_TIMEOUT_MS = 30000;
const PLAYBACK_END_FALLBACK_PADDING_MS = 500;

export default function VocaPage() {
  const { personas, activePersona, setActivePersona, isLoading, loadError, retryLoad } = usePersona();
  const activePersonaId = activePersona?.id;
  
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [languageChanged, setLanguageChanged] = useState<boolean>(false);
  const [hasLanguageDetection, setHasLanguageDetection] = useState<boolean>(false);
  const [escalation, setEscalation] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryView | null>(null);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWaitTimeoutRef = useRef<number | null>(null);
  const audioWaitNoticeTimeoutRef = useRef<number | null>(null);
  const playbackFallbackTimeoutRef = useRef<number | null>(null);
  const activePersonaRef = useRef(activePersona);
  const transcriptEntriesRef = useRef<TranscriptEntry[]>([]);
  const sessionStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    activePersonaRef.current = activePersona;
  }, [activePersona]);

  useEffect(() => {
    transcriptEntriesRef.current = transcriptEntries;
  }, [transcriptEntries]);

  useEffect(() => {
    sessionStartMsRef.current = sessionStartMs;
  }, [sessionStartMs]);

  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    vocaWS.sendAudio(chunk);
  }, []);

  const clearAudioWaitTimeout = useCallback(() => {
    if (audioWaitTimeoutRef.current !== null) {
      window.clearTimeout(audioWaitTimeoutRef.current);
      audioWaitTimeoutRef.current = null;
    }

    if (audioWaitNoticeTimeoutRef.current !== null) {
      window.clearTimeout(audioWaitNoticeTimeoutRef.current);
      audioWaitNoticeTimeoutRef.current = null;
    }
  }, []);

  const clearPlaybackFallbackTimeout = useCallback(() => {
    if (playbackFallbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackFallbackTimeoutRef.current);
      playbackFallbackTimeoutRef.current = null;
    }
  }, []);

  const startAudioWaitTimeout = useCallback(() => {
    clearAudioWaitTimeout();

    audioWaitNoticeTimeoutRef.current = window.setTimeout(() => {
      setNotice('Taking longer than expected...');
    }, AUDIO_WAIT_NOTICE_MS);

    audioWaitTimeoutRef.current = window.setTimeout(() => {
      setOrbState('idle');
      setNotice('Taking longer than expected...');
    }, AUDIO_WAIT_TIMEOUT_MS);
  }, [clearAudioWaitTimeout]);

  const handleSpeechEnd = useCallback(() => {
    setOrbState('processing');
    startAudioWaitTimeout();
  }, [startAudioWaitTimeout]);

  const { startListening, audioLevel, error } = useVoice(handleAudioChunk, {
    onSpeechEnd: handleSpeechEnd,
  });

  const markSessionStarted = useCallback(() => {
    if (sessionStartMsRef.current) return;
    const now = Date.now();
    sessionStartMsRef.current = now;
    setSessionStartMs(now);
  }, []);

  const buildFallbackSummary = useCallback((summaryText?: string): SessionSummaryView => {
    const entries = transcriptEntriesRef.current;
    const userTurns = entries.filter(entry => entry.role === 'user').length;
    const vocaTurns = entries.filter(entry => entry.role === 'voca').length;
    const turnCount = Math.min(userTurns, vocaTurns);
    const languages = Array.from(new Set(entries.map(entry => entry.language)));
    const durationSeconds = sessionStartMsRef.current
      ? Math.max(1, Math.round((Date.now() - sessionStartMsRef.current) / 1000))
      : 0;
    const persona = activePersonaRef.current;

    return {
      personaName: persona?.display_name || persona?.name || 'Unknown',
      durationSeconds,
      turnCount,
      languagesUsed: languages,
      summaryText: summaryText || 'Session completed.',
    };
  }, []);

  const resetConversation = useCallback(() => {
    setTranscriptEntries([]);
    setEscalation(null);
    setNotice(null);
    setCurrentLanguage('en');
    setHasLanguageDetection(false);
    setLanguageChanged(false);
    setLatencyMs(0);
    setSessionSummary(null);
    setSessionStartMs(null);
    sessionStartMsRef.current = null;
    transcriptEntriesRef.current = [];
    setOrbState('idle');
  }, []);

  useEffect(() => {
    if (!error) return;

    setOrbState('idle');
    setNotice(error);

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [error]);

  const playAudioSequence = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    clearAudioWaitTimeout();
    clearPlaybackFallbackTimeout();

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
        clearPlaybackFallbackTimeout();
        setOrbState('idle');
      };

      setOrbState('speaking');
      source.start();

      const fallbackDurationMs = Math.ceil(audioBuffer.duration * 1000) + PLAYBACK_END_FALLBACK_PADDING_MS;
      playbackFallbackTimeoutRef.current = window.setTimeout(() => {
        setOrbState('idle');
      }, fallbackDurationMs);
    } catch (e) {
      console.error("Failed to decode audio", e);
      setOrbState('idle');
    }
  }, [clearAudioWaitTimeout, clearPlaybackFallbackTimeout]);

  useEffect(() => {
    if (!activePersonaId) return;

    let stillMounted = true;
    setIsConnected(vocaWS.isConnected);

    vocaWS.connect(
      activePersonaId,
      (message: VocaMessage) => {
        if (message.type === 'persona_loaded') {
          if (stillMounted) {
            setIsConnected(true);
            setPendingPersonaId(null);
          }
        } else if (message.type === 'transcript') {
          const text = message.text as string;
          const lang = message.language as string;
          markSessionStarted();
          setTranscriptEntries(prev => {
            const next: TranscriptEntry[] = [...prev, { role: 'user', text, language: lang, timestamp: Date.now() }];
            transcriptEntriesRef.current = next;
            return next;
          });
          setHasLanguageDetection(true);
          setCurrentLanguage(lang);
        } else if (message.type === 'language_changed') {
          const to = message.to as string;
          setHasLanguageDetection(true);
          setCurrentLanguage(to);
          setLanguageChanged(true);
          setTimeout(() => setLanguageChanged(false), 2000);
        } else if (message.type === 'response') {
          const text = message.text as string;
          const lang = message.language as string;
          markSessionStarted();
          setTranscriptEntries(prev => {
            const next: TranscriptEntry[] = [...prev, { role: 'voca', text, language: lang, timestamp: Date.now() }];
            transcriptEntriesRef.current = next;
            return next;
          });
          setHasLanguageDetection(true);
          setLatencyMs(vocaWS.latencyMs);

          void playAudioSequence();
        } else if (message.type === 'escalation') {
           setEscalation(message.message as string);
        } else if (message.type === 'session_summary') {
          const summaryText = (message.summary as string) || '';
          const fallback = buildFallbackSummary(summaryText);
          const durationSeconds = typeof message.duration_seconds === 'number'
            ? message.duration_seconds
            : fallback.durationSeconds;
          const turnCount = typeof message.turn_count === 'number'
            ? message.turn_count
            : fallback.turnCount;
          const languagesUsed = Array.isArray(message.languages_used)
            ? (message.languages_used as string[])
            : fallback.languagesUsed;
          const persona = activePersonaRef.current;

          setSessionSummary({
            personaName: persona?.display_name || persona?.name || 'Unknown',
            durationSeconds,
            turnCount,
            languagesUsed,
            summaryText: summaryText || fallback.summaryText,
          });
        } else if (message.type === 'error') {
          const messageText = (message.message as string) || 'Something went wrong, please try again.';
          setNotice(messageText);
          setOrbState('idle');
        }
      },
      (chunk: ArrayBuffer) => {
        clearAudioWaitTimeout();
        audioChunksRef.current.push(chunk);
        setOrbState(prev => prev !== 'speaking' ? 'processing' : prev);
      },
      (connected: boolean) => {
        if (stillMounted) {
          setIsConnected(connected);
        }
      },
    );

    return () => {
      stillMounted = false;
      clearAudioWaitTimeout();
      clearPlaybackFallbackTimeout();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersonaId]);

  const handleOrbClick = async () => {
    if (orbState === 'idle') {
      const started = await startListening();
      setOrbState(started ? 'listening' : 'idle');
    }
  };

  const handlePersonaSwitch = (persona: import('../../hooks/usePersona').Persona) => {
    if (orbState !== 'idle') return;
    if (activePersona?.id === persona.id) return;

    setPendingPersonaId(persona.id);
    resetConversation();

    setActivePersona(persona);
  };

  if (isLoading || loadError) {
    return (
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-[#080A0F] flex flex-col items-center justify-center gap-4"
          >
            <motion.h1
              animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.01, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="text-4xl md:text-5xl text-white font-semibold tracking-tight"
            >
              Voca
            </motion.h1>
            <div className="font-mono text-[11px] tracking-[0.32em] text-[#8B92A0] uppercase">
              Initializing
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-[#080A0F] flex flex-col items-center justify-center gap-5 px-6 text-center"
          >
            <p className="text-[#D5D9E3] text-sm md:text-base">{loadError}</p>
            <button
              onClick={() => void retryLoad()}
              className="px-5 py-2 rounded-xl border border-white/15 text-white text-sm hover:bg-white/5 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const currentAccent = activePersona?.ui_config.accent_color || '#00C2B8';
  const hasCompletedExchange = transcriptEntries.some(entry => entry.role === 'user')
    && transcriptEntries.some(entry => entry.role === 'voca');

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col font-sans overflow-hidden"
      style={{ backgroundColor: '#080A0F' }}
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
            pendingPersonaId={pendingPersonaId}
          />
        </div>
        <div className="flex-1 flex justify-end">
          {hasLanguageDetection && (
            <LanguageBadge 
              language={currentLanguage} 
              changed={languageChanged} 
              accentColor={currentAccent}
            />
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="px-6 z-10">
          <div className="mx-auto max-w-2xl rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-center text-xs font-mono text-red-300">
            Server disconnected.
            <button
              onClick={() => window.location.reload()}
              className="ml-2 underline underline-offset-2 hover:text-white"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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

          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/25 text-red-300 px-5 py-2 rounded-xl text-xs font-mono text-center backdrop-blur-md"
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
        
        <VoiceOrb 
          state={orbState} 
          audioLevel={audioLevel} 
          onClick={handleOrbClick} 
          color={activePersona?.ui_config.orb_color || '#00C2B8'} 
        />

        {orbState === 'idle' && hasCompletedExchange && !sessionSummary && (
          <button
            onClick={() => vocaWS.sendEndSession()}
            className="px-4 py-2 rounded-lg border border-white/15 text-white/90 text-xs font-mono uppercase tracking-wider hover:bg-white/5 transition-colors"
          >
            End Session
          </button>
        )}

        <div className="w-full max-w-3xl flex-1 flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {sessionSummary ? (
              <SummaryPanel summary={sessionSummary} onNewConversation={resetConversation} />
            ) : (
              <Transcript entries={transcriptEntries} accentColor={currentAccent} />
            )}
          </AnimatePresence>
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

