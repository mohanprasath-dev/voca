'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const PERSONAS = [
  {
    name: 'Aura',
    context: 'Hospital concierge with calm multilingual support.',
    accent: '#00C2B8',
  },
  {
    name: 'Nova',
    context: 'University front desk for admissions and student ops.',
    accent: '#F59E0B',
  },
  {
    name: 'Apex',
    context: 'Startup operations voice for fast customer help.',
    accent: '#6366F1',
  },
] as const;

const STATS = ['35+ Languages', '130ms Latency', '3 Personas', 'Real-time AI'] as const;

export default function LandingScreen() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 0%, rgba(0,194,184,0.10), transparent 35%), radial-gradient(circle at 80% 100%, rgba(99,102,241,0.14), transparent 40%), #080A0F',
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-12 pt-10 md:px-10">
        <header className="mb-20 flex items-center justify-between">
          <div className="font-display text-2xl font-semibold tracking-tight text-white">Voca</div>
          <nav className="flex items-center gap-4 text-xs font-mono uppercase tracking-[0.2em] text-[#8B92A0]">
            <Link href="/dashboard" className="transition-colors hover:text-white">
              Dashboard
            </Link>
          </nav>
        </header>

        <section className="mb-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="font-display text-5xl font-semibold tracking-tight text-white md:text-7xl"
          >
            Voca
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[#A8B5C8] md:text-base"
          >
            Real-time conversational voice agents for every phone number and browser session.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-9"
          >
            <Link
              href="/app"
              className="inline-flex items-center rounded-full border border-white/20 px-7 py-3 text-xs font-mono uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/10"
            >
              Launch Voice Demo
            </Link>
          </motion.div>
        </section>

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          {PERSONAS.map((persona, index) => (
            <motion.article
              key={persona.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: persona.accent, boxShadow: `0 0 10px ${persona.accent}` }}
                />
                <h2 className="font-display text-lg text-white">{persona.name}</h2>
              </div>
              <p className="text-sm leading-relaxed text-[#8B92A0]">{persona.context}</p>
            </motion.article>
          ))}
        </section>

        <section className="mb-14 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs font-mono uppercase tracking-[0.14em] text-[#A8B5C8]"
            >
              {item}
            </motion.div>
          ))}
        </section>

        <footer className="mt-auto pt-8 text-center text-xs font-mono uppercase tracking-[0.2em] text-[#6E7687]">
          Twilio gave every app a phone number. Voca gives every phone number a brain.
        </footer>
      </div>
    </motion.main>
  );
}
