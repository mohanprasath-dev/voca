import { useState, useRef, useCallback, useEffect } from 'react';
import { vocaWS } from '../lib/websocket';

const MIC_ACCESS_REQUIRED_MESSAGE = 'Microphone access required';
const MIC_DISCONNECTED_MESSAGE = 'Microphone disconnected';

export interface UseVoiceReturn {
  isListening: boolean;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  audioLevel: number;
  error: string | null;
}

export function useVoice(onAudioChunk: (chunk: ArrayBuffer) => void): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const setIsListeningWithRef = useCallback((val: boolean) => {
    isListeningRef.current = val;
    setIsListening(val);
  }, []);

  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startListening = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          setIsListeningWithRef(false);
          setError(MIC_DISCONNECTED_MESSAGE);
          cleanup();
        };
      });

      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 16000,
      });

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      if (audioContext.state !== 'running') {
        throw new Error('Audio context could not start');
      }

      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 4096 buffer size
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return; // Prevent sending if just stopping
        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate audio level (RMS)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        // Scale RMS to 0-1 for visualization
        const level = Math.min(Math.max(rms * 10, 0), 1);
        setAudioLevel(level);

        // Convert Float32Array to Int16Array for WebSocket transmission
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        onAudioChunk(pcmData.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListeningWithRef(true);
      return true;
    } catch (err) {
      console.error('Failed to start listening', err);
      setError(MIC_ACCESS_REQUIRED_MESSAGE);
      setIsListeningWithRef(false);
      cleanup();
      return false;
    }
  };

  const stopListening = useCallback(() => {
    if (!isListening) return;
    setIsListeningWithRef(false);
    cleanup();
    vocaWS.sendEndOfSpeech();
  }, [isListening, cleanup]);

  return {
    isListening,
    startListening,
    stopListening,
    audioLevel,
    error,
  };
}