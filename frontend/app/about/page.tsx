'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const TECH_STACK = [
  { name: 'Murf Falcon', desc: 'Ultra-low latency Text-to-Speech' },
  { name: 'Deepgram', desc: 'Real-time speech recognition & language detection' },
  { name: 'Gemini', desc: 'Gemini 3.1 Pro & Flash for conversational reasoning' },
  { name: 'LiveKit', desc: 'WebRTC infrastructure for voice streaming' },
  { name: 'FastAPI', desc: 'High-performance Python backend' },
  { name: 'Next.js', desc: 'React framework for the frontend interface' }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080A0F] text-white font-sans selection:bg-cyan-500/30 p-6 md:p-12 lg:p-24">
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 flex items-center justify-between">
          <Link href="/" className="font-syne text-xl font-bold tracking-widest hover:opacity-80 transition-opacity">
            VOCA
          </Link>
          <Link href="/app" className="text-sm font-medium text-[#8B92A0] hover:text-white transition-colors">
            Launch App →
          </Link>
        </header>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">About Voca</h1>
          
          <div className="space-y-12 text-[#D5D9E3] text-lg leading-relaxed font-light">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">The Problem</h2>
              <p>
                Current AI voice agents sound robotic, interrupt users, and fail to handle natural conversational flow. 
                They struggle with multilingual speakers and often have high latency, making conversations feel unnatural and frustrating.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">The Solution</h2>
              <p>
                Voca is a real-time, multilingual AI voice layer designed to sound and feel entirely human. 
                Powered by Murf Falcon and Deepgram, Voca detects languages on the fly, switches seamlessly, 
                and uses Gemini&apos;s advanced reasoning to hold natural, context-aware conversations. 
                Whether you&apos;re calling a hospital front desk or a startup support line, Voca adapts its tone and personality perfectly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-6">Tech Stack</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TECH_STACK.map((tech, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <h3 className="text-white font-semibold mb-2">{tech.name}</h3>
                    <p className="text-sm text-[#8B92A0]">{tech.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 mt-16 backdrop-blur-sm">
              <h2 className="text-sm font-mono uppercase tracking-widest text-[#8B92A0] mb-8">The Builder</h2>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white shadow-xl shrink-0">
                  MP
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2">Mohan Prasath</h3>
                  <p className="text-[#8B92A0] mb-6">Full-stack Developer & Voice AI Enthusiast</p>
                  <div className="flex gap-4">
                    <Link href="https://github.com/mohanprasath-dev" target="_blank" className="px-5 py-2 rounded-full border border-white/20 text-sm hover:bg-white/10 transition-colors">GitHub</Link>
                    <Link href="https://linkedin.com/in/mohanprasath21" target="_blank" className="px-5 py-2 rounded-full border border-white/20 text-sm hover:bg-white/10 transition-colors">LinkedIn</Link>
                    <Link href="https://mohanprasath.dev" target="_blank" className="px-5 py-2 rounded-full border border-white/20 text-sm hover:bg-white/10 transition-colors">Website</Link>
                  </div>
                </div>
              </div>
            </section>

            <section className="text-center pt-12 border-t border-white/10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#6366F1]/20 text-[#6366F1] text-xs font-mono uppercase tracking-widest border border-[#6366F1]/30 mb-4">
                Hackathon Submission
              </span>
              <p className="text-[#8B92A0]">
                Built for the Murf AI Voice Hackathon — March 18, 2025<br />
                <span className="text-sm">Category: Real-time Voice AI · Multilingual · Voice Infrastructure</span>
              </p>
              <div className="mt-4">
                <Link href="https://github.com/mohanprasath-dev/voca" target="_blank" className="text-sm text-teal-400 hover:underline">
                  View GitHub Repository →
                </Link>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}