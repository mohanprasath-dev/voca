'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const PERSONAS = [
  { name: 'Aura', color: '#00C2B8' },
  { name: 'Nova', color: '#F59E0B' },
  { name: 'Apex', color: '#6366F1' },
];

const STATS = [
  { metric: '130ms', label: 'Murf Falcon Latency' },
  { metric: '35+', label: 'Languages Supported' },
  { metric: '3', label: 'AI Personas' },
  { metric: 'Real-time', label: 'Voice Pipeline' },
];

const HOW_IT_WORKS = [
  'Choose persona',
  'Speak naturally',
  'Instant response'
];

const POWERED_BY = ['Murf Falcon', 'Deepgram', 'Gemini', 'LiveKit', 'Next.js 14'];

export default function LandingScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080A0F] text-white selection:bg-cyan-500/30">
      {/* Background Animated Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: ['-10%', '10%', '-10%'],
            y: ['-10%', '10%', '-10%'],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[#00C2B8]/15 blur-[120px]"
        />
        <motion.div
          animate={{
            x: ['10%', '-10%', '10%'],
            y: ['10%', '-10%', '10%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-[#6366F1]/15 blur-[120px]"
        />
        <motion.div
          animate={{
            x: ['-5%', '5%', '-5%'],
            y: ['5%', '-5%', '5%'],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-[-20%] left-[20%] w-[35vw] h-[35vw] rounded-full bg-[#F59E0B]/10 blur-[120px]"
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-12 pt-10 md:px-10">
        
        {/* Navigation */}
        <header className="mb-20 flex items-center justify-between">
          <div className="font-display text-2xl font-bold tracking-tight">VOCA</div>
          <nav className="flex gap-6 text-sm font-medium text-[#8B92A0]">
            <Link href="/about" className="transition-colors hover:text-white cursor-pointer">About</Link>
            <Link href="/dashboard" className="transition-colors hover:text-white cursor-pointer">Dashboard</Link>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="mb-24 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-6xl font-bold tracking-tight md:text-8xl"
          >
            VOCA
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-xl text-[#A8B5C8] font-light"
          >
            The Voice Layer for Every Conversation on Earth
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/app"
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-105"
            >
              Launch App →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              View Dashboard →
            </Link>
          </motion.div>
        </section>

        {/* One-liner */}
        <section className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-lg md:text-2xl font-medium leading-relaxed text-[#A8B5C8]"
          >
            <span className="opacity-70">Twilio gave every app a phone number.</span>
            <br />
            <span className="text-white">Voca gives every phone number a brain.</span>
          </motion.div>
        </section>

        {/* Stats Bar */}
        <section className="mb-24 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <div className="text-3xl lg:text-4xl font-bold text-white mb-2">{stat.metric}</div>
              <div className="text-xs font-mono uppercase tracking-widest text-[#8B92A0] text-center">{stat.label}</div>
            </motion.div>
          ))}
        </section>

        {/* How It Works & Persona Cards */}
        <div className="mb-24 grid gap-8 md:grid-cols-2">
          {/* How It Works */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm flex flex-col justify-center">
            <h2 className="mb-8 font-display text-3xl font-semibold">How It Works</h2>
            <ul className="space-y-6">
              {HOW_IT_WORKS.map((step, i) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex items-center gap-4 text-lg text-[#A8B5C8]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-mono text-white">
                    {i + 1}
                  </span>
                  {step}
                </motion.li>
              ))}
            </ul>
          </section>

          {/* Persona Cards */}
          <section className="grid gap-4">
            {PERSONAS.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div
                  className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center font-display text-xl font-bold shadow-lg"
                  style={{ backgroundColor: `${p.color}20`, color: p.color, boxShadow: `0 0 20px ${p.color}40`, border: `1px solid ${p.color}50` }}
                >
                  {p.name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-semibold" style={{ color: p.color }}>{p.name}</h3>
                  <p className="text-sm text-[#8B92A0]">AI Persona</p>
                </div>
              </motion.div>
            ))}
          </section>
        </div>

        {/* Powered By */}
        <section className="mb-24 text-center">
          <p className="mb-6 text-sm font-mono uppercase tracking-widest text-[#8B92A0]">Powered By</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {POWERED_BY.map((tech, i) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-full bg-white/5 px-5 py-2 text-sm font-medium text-[#A8B5C8] border border-white/10 transition-colors hover:bg-white/10"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8B92A0]">
          <div>Built by Mohan Prasath</div>
          <div className="flex gap-6">
            <Link href="https://github.com/mohanprasath-dev" target="_blank" className="hover:text-white transition-colors">GitHub</Link>
            <Link href="https://linkedin.com/in/mohanprasath21" target="_blank" className="hover:text-white transition-colors">LinkedIn</Link>
            <Link href="https://mohanprasath.dev" target="_blank" className="hover:text-white transition-colors">Website</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
