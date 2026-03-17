'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[#080A0F] text-white selection:bg-cyan-500/30">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-10">
        
        <header className="mb-16 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight hover:text-cyan-400 transition-colors">VOCA</Link>
          <nav className="flex gap-6 text-sm font-medium text-[#8B92A0]">
            <Link href="/app" className="transition-colors hover:text-white">App</Link>
            <Link href="/dashboard" className="transition-colors hover:text-white">Dashboard</Link>
          </nav>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-16"
        >
          {/* Hero */}
          <section>
            <h1 className="font-display text-4xl font-bold md:text-5xl mb-4">About Voca</h1>
            <p className="text-xl text-[#A8B5C8] leading-relaxed">
              We&apos;re giving every application a voice. Real-time, browser-first voice agents.
            </p>
          </section>

          {/* Problem */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-semibold mb-3 text-red-400">The Problem</h2>
            <p className="text-[#A8B5C8] leading-relaxed">
              Before now, adding interactive voice required complex integrations with telephony providers, fragmented speech models, and slow latencies that ruined the conversational feel.
            </p>
          </section>

          {/* Solution */}
          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-8 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-semibold mb-3 text-cyan-400">Our Solution</h2>
            <p className="text-[#A8B5C8] leading-relaxed">
              Voca unifies STT, LLM, and TTS directly over WebRTC. By leveraging LiveKit and Murf Falcon, we enable sub-second audio responses straight from the browser—no phone dialing required.
            </p>
          </section>

          {/* Tech Stack */}
          <section>
            <h2 className="font-display text-2xl font-semibold mb-6">Tech Stack</h2>
            <div className="flex flex-wrap gap-3">
              {['LiveKit', 'Murf Falcon TTS', 'Deepgram STT', 'Gemini AI', 'Next.js', 'Framer Motion', 'FastAPI'].map((tech) => (
                <span key={tech} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#A8B5C8]">
                  {tech}
                </span>
              ))}
            </div>
          </section>

          {/* Builder */}
          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">The Builder</h2>
            <p className="text-[#A8B5C8] leading-relaxed">
              Built by <strong className="text-white font-medium">Mohan Prasath</strong>. Passionate about web communication and real-time AI capabilities.
            </p>
          </section>

          {/* Hackathon */}
          <section className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-8 backdrop-blur-sm text-center">
            <h2 className="font-display text-xl font-bold text-[#F59E0B] tracking-widest uppercase mb-2">Hackathon Project</h2>
            <p className="text-[#A8B5C8] leading-relaxed flex flex-col items-center justify-center">
              <span>Built for Murf AI Voice Hackathon — March 18, 2026</span>
              <span className="text-white font-medium mt-1 inline-block">Voice-First AI Applications</span>
            </p>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
