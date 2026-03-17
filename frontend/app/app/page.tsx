'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ParticipantKind,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import VoiceOrb, { OrbState } from '../../components/VoiceOrb';
import { PersonaSwitcher } from '../../components/PersonaSwitcher';
import { Transcript, TranscriptEntry } from '../../components/Transcript';
import LanguageBadge from '../../components/LanguageBadge';
import { StatusBar } from '../../components/StatusBar';
import SummaryPanel, { SessionSummaryView } from '../../components/SummaryPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { usePersona, Persona } from '../../hooks/usePersona';

const NOTICE_AUTO_HIDE_MS = 2500;
const PROCESSING_TIMEOUT_MS = 10000;
const SPEAKING_SILENCE_TIMEOUT_MS = 4000;
const API_BASE = 'http://localhost:8000';

interface LiveKitTokenResponse {
  token: string;
  url: string;
  persona_id: string;
  session_id: string;
  room_name: string;
  participant_name: string;
}

interface LiveKitSummaryResponse {
  session_id: string;
  summary: string;
  duration_seconds: number;
  turn_count: number;
  languages_used: string[];
  persona_id: string;
}

export default function VocaPage() {
  const { personas, activePersona, setActivePersona, isLoading, loadError, retryLoad } = usePersona();

  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [languageChanged, setLanguageChanged] = useState<boolean>(false);
  const [hasLanguageDetection, setHasLanguageDetection] = useState<boolean>(false);
  const [escalation] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryView | null>(null);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isEndingSession, setIsEndingSession] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs] = useState<number>(0);
  const [hasAttemptedSession, setHasAttemptedSession] = useState<boolean>(false);

  const activePersonaRef = useRef(activePersona);
  const transcriptEntriesRef = useRef<TranscriptEntry[]>([]);
  const sessionStartMsRef = useRef<number | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activePersonaRef.current = activePersona;
  }, [activePersona]);

  useEffect(() => {
    transcriptEntriesRef.current = transcriptEntries;
  }, [transcriptEntries]);

  useEffect(() => {
    sessionStartMsRef.current = sessionStartMs;
  }, [sessionStartMs]);

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current !== null) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  const clearSpeakingSilenceTimeout = useCallback(() => {
    if (speakingSilenceTimeoutRef.current !== null) {
      clearTimeout(speakingSilenceTimeoutRef.current);
      speakingSilenceTimeoutRef.current = null;
    }
  }, []);

  const resetConversation = useCallback(() => {
    setTranscriptEntries([]);
    setNotice(null);
    setCurrentLanguage('en');
    setHasLanguageDetection(false);
    setLanguageChanged(false);
    setSessionSummary(null);
    setIsEndingSession(false);
    setSessionStartMs(null);
    setCurrentSessionId(null);
    transcriptEntriesRef.current = [];
    sessionStartMsRef.current = null;
    setOrbState('idle');
  }, []);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        void room.disconnect();
      }
      for (const element of audioElementsRef.current) {
        element.remove();
      }
      audioElementsRef.current = [];
      clearProcessingTimeout();
      clearSpeakingSilenceTimeout();
    };
  }, [clearProcessingTimeout, clearSpeakingSilenceTimeout]);

  const markSessionStarted = useCallback(() => {
    if (sessionStartMsRef.current) {
      return;
    }

    const now = Date.now();
    sessionStartMsRef.current = now;
    setSessionStartMs(now);
  }, []);

  const updateLanguageState = useCallback((language: string) => {
    const normalized = language || 'en';
    setHasLanguageDetection(true);
    setCurrentLanguage((previousLanguage) => {
      if (previousLanguage !== normalized) {
        setLanguageChanged(true);
        window.setTimeout(() => setLanguageChanged(false), 2000);
      }
      return normalized;
    });
  }, []);

  const appendTranscriptEntry = useCallback((entry: TranscriptEntry) => {
    markSessionStarted();
    setTranscriptEntries((previousEntries) => {
      const nextEntries = [...previousEntries, entry];
      transcriptEntriesRef.current = nextEntries;
      return nextEntries;
    });
    updateLanguageState(entry.language);
  }, [markSessionStarted, updateLanguageState]);

  const buildFallbackSummary = useCallback((summaryText?: string): SessionSummaryView => {
    const entries = transcriptEntriesRef.current;
    const userTurns = entries.filter((entry) => entry.role === 'user').length;
    const vocaTurns = entries.filter((entry) => entry.role === 'voca').length;
    const turnCount = Math.min(userTurns, vocaTurns);
    const languages = Array.from(new Set(entries.map((entry) => entry.language)));
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

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const disconnectRoom = useCallback(async () => {
    clearProcessingTimeout();
    clearSpeakingSilenceTimeout();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }
    for (const element of audioElementsRef.current) {
      element.remove();
    }
    audioElementsRef.current = [];
    setIsConnected(false);
  }, [clearProcessingTimeout, clearSpeakingSilenceTimeout]);

  const appendAgentAudio = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    if (track.kind !== Track.Kind.Audio || participant.kind !== ParticipantKind.AGENT) {
      return;
    }

    const audioElement = track.attach();
    audioElement.autoplay = true;
    document.body.appendChild(audioElement);
    audioElementsRef.current.push(audioElement);
    clearSpeakingSilenceTimeout();
    setOrbState('speaking');
    void audioElement.play().catch(() => {
      setNotice('Audio playback is blocked. Click the orb again.');
    });
  }, [clearSpeakingSilenceTimeout]);

  const connectSession = useCallback(async () => {
    if (!activePersona?.id) {
      return null;
    }

    await disconnectRoom();
    setHasAttemptedSession(true);
    setNotice(null);
    setSessionSummary(null);
    setOrbState('processing');

    const response = await fetch(`${API_BASE}/livekit/token?persona_id=${activePersona.id}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as LiveKitTokenResponse;
    setCurrentSessionId(data.session_id);

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => {
      setIsConnected(true);
      setPendingPersonaId(null);
    });

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
      setOrbState('idle');
      clearProcessingTimeout();
      clearSpeakingSilenceTimeout();
    });

    room.on(RoomEvent.DataReceived, (payload) => {
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string;
          text?: string;
          language?: string;
          to?: string;
        };

        if (event.type === 'transcript' && event.text) {
          appendTranscriptEntry({
            role: 'user',
            text: event.text,
            language: event.language || 'en',
            timestamp: Date.now(),
          });
          clearProcessingTimeout();
          setOrbState('processing');
          // 10s timeout: if no response arrives, reset orb
          processingTimeoutRef.current = setTimeout(() => {
            processingTimeoutRef.current = null;
            setOrbState('idle');
            setNotice('Taking longer than expected...');
          }, PROCESSING_TIMEOUT_MS);
          return;
        }

        if (event.type === 'response' && event.text) {
          clearProcessingTimeout();
          appendTranscriptEntry({
            role: 'voca',
            text: event.text,
            language: event.language || currentLanguage,
            timestamp: Date.now(),
          });
          setOrbState('speaking');
          return;
        }

        if (event.type === 'language_changed' && event.to) {
          updateLanguageState(event.to);
        }
      } catch {
        // Ignore malformed data packets.
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      appendAgentAudio(track, participant);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const agentSpeaking = speakers.some((speaker) => speaker.kind === ParticipantKind.AGENT);
      if (agentSpeaking) {
        clearSpeakingSilenceTimeout();
        setOrbState('speaking');
        return;
      }

      // Agent stopped speaking — set a brief silence window then go idle
      clearSpeakingSilenceTimeout();
      speakingSilenceTimeoutRef.current = setTimeout(() => {
        speakingSilenceTimeoutRef.current = null;
        if (room.localParticipant.isMicrophoneEnabled) {
          setOrbState('listening');
          return;
        }
        if (room.state === 'connected') {
          setOrbState('idle');
        }
      }, SPEAKING_SILENCE_TIMEOUT_MS);
    });

    await room.connect(data.url, data.token);
    await room.startAudio();
    return room;
  }, [activePersona?.id, appendAgentAudio, appendTranscriptEntry, clearProcessingTimeout, clearSpeakingSilenceTimeout, currentLanguage, disconnectRoom, updateLanguageState]);

  const handleOrbClick = useCallback(() => {
    if (!activePersona) {
      return;
    }

    if (orbState === 'processing' || orbState === 'speaking') {
      return;
    }

    if (orbState === 'idle') {
      void connectSession()
        .then(async (room) => {
          if (!room) {
            return;
          }
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            setOrbState('listening');
          } catch (micErr) {
            const isDenied = micErr instanceof Error && (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError');
            setNotice(isDenied ? 'Microphone access required' : 'Microphone could not start');
            setOrbState('idle');
          }
        })
        .catch(() => {
          setNotice('Microphone access required');
          setOrbState('idle');
          setPendingPersonaId(null);
        });
      return;
    }

    if (orbState === 'listening' && roomRef.current?.state === 'connected') {
      void roomRef.current.localParticipant.setMicrophoneEnabled(false);
      setOrbState('processing');
    }
  }, [activePersona, connectSession, orbState]);

  const handleEndSession = useCallback(async () => {
    if (isEndingSession) {
      return;
    }

    clearProcessingTimeout();
    clearSpeakingSilenceTimeout();
    setIsEndingSession(true);

    try {
      if (!currentSessionId) {
        const fallback = buildFallbackSummary();
        setSessionSummary(fallback);
        await disconnectRoom();
        setOrbState('idle');
        return;
      }

      const response = await fetch(`${API_BASE}/livekit/session/end?session_id=${currentSessionId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      const data = (await response.json()) as LiveKitSummaryResponse;
      const fallback = buildFallbackSummary(data.summary);
      setSessionSummary({
        personaName: activePersona?.display_name || activePersona?.name || fallback.personaName,
        durationSeconds: data.duration_seconds || fallback.durationSeconds,
        turnCount: data.turn_count || fallback.turnCount,
        languagesUsed: data.languages_used.length > 0 ? data.languages_used : fallback.languagesUsed,
        summaryText: data.summary || fallback.summaryText,
      });
      await roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      await disconnectRoom();
      setCurrentSessionId(null);
      setOrbState('idle');
    } catch {
      setNotice('Unable to end session.');
    } finally {
      setIsEndingSession(false);
    }
  }, [activePersona, buildFallbackSummary, clearProcessingTimeout, clearSpeakingSilenceTimeout, currentSessionId, disconnectRoom, isEndingSession]);

  const handleNewConversation = useCallback(async () => {
    clearProcessingTimeout();
    clearSpeakingSilenceTimeout();
    await disconnectRoom();
    setHasAttemptedSession(false);
    resetConversation();
  }, [clearProcessingTimeout, clearSpeakingSilenceTimeout, disconnectRoom, resetConversation]);

  const handlePersonaSwitch = useCallback(async (persona: Persona) => {
    if (orbState !== 'idle') {
      return;
    }
    if (activePersona?.id === persona.id) {
      return;
    }

    const shouldReconnect = roomRef.current?.state === 'connected';
    setPendingPersonaId(shouldReconnect ? persona.id : null);

    if (shouldReconnect) {
      await disconnectRoom();
    }

    resetConversation();
    setActivePersona(persona);
    setPendingPersonaId(null);
  }, [activePersona?.id, disconnectRoom, orbState, resetConversation, setActivePersona]);

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
  const hasCompletedExchange = transcriptEntries.some((entry) => entry.role === 'user')
    && transcriptEntries.some((entry) => entry.role === 'voca');
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col font-sans overflow-hidden"
      style={{ backgroundColor: '#080A0F' }}
      transition={{ duration: 0.4 }}
    >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${currentAccent}08 0%, transparent 60%)`,
            transition: 'background 0.4s ease-in-out',
          }}
        />

        <div className="w-full flex items-center justify-between p-6 z-10">
          <div className="flex-1" />
          <div className="flex-1 flex justify-center">
            <PersonaSwitcher
              personas={personas}
              activePersona={activePersona}
              onSwitch={(persona) => {
                void handlePersonaSwitch(persona);
              }}
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

        {hasAttemptedSession && !isConnected && (
          <div className="px-6 z-10">
            <div className="mx-auto max-w-2xl rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-center text-xs font-mono text-red-300">
              Server disconnected.
              <button
                onClick={() => {
                  void handleOrbClick();
                }}
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
            audioLevel={0}
            onClick={handleOrbClick}
            color={activePersona?.ui_config.orb_color || '#00C2B8'}
          />

          <div className="-mt-8 flex flex-col items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={orbState}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-mono uppercase tracking-[0.2em] text-[#8B92A0]"
              >
                {orbState === 'idle' && 'Click to speak'}
                {orbState === 'listening' && 'Listening...'}
                {orbState === 'processing' && 'Thinking...'}
                {orbState === 'speaking' && 'Speaking...'}
              </motion.p>
            </AnimatePresence>

            {activePersona?.ui_config?.label && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-[#8B92A0]/80 font-light max-w-md text-center"
              >
                {activePersona.ui_config.label}
              </motion.p>
            )}
          </div>

          {orbState === 'idle' && hasCompletedExchange && !sessionSummary && (
            <button
              onClick={() => {
                void handleEndSession();
              }}
              disabled={isEndingSession}
              className="px-4 py-2 rounded-lg border border-white/15 text-white/90 text-xs font-mono uppercase tracking-wider hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEndingSession ? 'Ending...' : 'End Session'}
            </button>
          )}

          <div className="w-full max-w-3xl flex-1 flex flex-col justify-end">
            <AnimatePresence mode="wait">
              {sessionSummary ? (
                <SummaryPanel summary={sessionSummary} onNewConversation={() => {
                  void handleNewConversation();
                }} />
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