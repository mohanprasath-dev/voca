'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_REFRESH_MS = 30000;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_BASE = `${API_URL}/api/dashboard`;

const PERSONA_COLORS: Record<string, string> = {
  aura: '#00C2B8',
  nova: '#F59E0B',
  apex: '#6366F1',
};

const PERSONA_NAMES: Record<string, string> = {
  aura: 'Aura — Hospital',
  nova: 'Nova — University',
  apex: 'Apex — Startup',
};

interface SessionMessage {
  role: string;
  content: string;
  language_detected: string | null;
  timestamp: string;
}

interface SessionRecord {
  session_id: string;
  persona_id: string;
  started_at: string;
  duration_seconds: number;
  turn_count: number;
  languages_used: string[];
  resolution_status: string;
  escalation_needed: boolean;
  summary_text: string;
  messages: SessionMessage[];
}

interface SessionStats {
  total_sessions: number;
  resolved: number;
  escalated: number;
  avg_duration_seconds: number;
  languages_used: string[];
}

function getRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    resolved: { bg: 'rgba(16,185,129,0.1)', text: '#10B981', border: 'rgba(16,185,129,0.2)' },
    escalated: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444', border: 'rgba(239,68,68,0.2)' },
    ended: { bg: 'rgba(139,146,160,0.1)', text: '#9CA3AF', border: 'rgba(156,163,175,0.25)' },
  };
  const normalized = status.toLowerCase();
  const uiStatus = normalized === 'completed' ? 'ended' : normalized;
  const c = colors[uiStatus] || colors.ended;
  const label = uiStatus === 'resolved' ? 'Resolved' : uiStatus === 'escalated' ? 'Escalated' : 'Ended';
  return (
    <span
      className="px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {label}
    </span>
  );
}

function LanguagePills({ languages }: { languages: string[] }) {
  if (!languages.length) {
    return <span className="text-[#8B92A0]">-</span>;
  }

  return (
    <span className="flex items-center gap-1">
      {languages.map((language) => (
        <span
          key={language}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#C8D0DD]"
        >
          {language.slice(0, 2).toUpperCase()}
        </span>
      ))}
    </span>
  );
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/sessions`),
        fetch(`${API_BASE}/sessions/stats`),
      ]);

      if (!sessRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const sessData: SessionRecord[] = await sessRes.json();
      const statsData: SessionStats = await statsRes.json();

      setSessions(sessData);
      setStats(statsData);
      setFetchError(null);
    } catch {
      setFetchError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-[#080A0F] text-white"
    >
      {/* Nav Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080A0F]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="text-lg font-display font-bold tracking-tight text-white/80 hover:text-white transition-colors">
            Voca
          </Link>
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-[#8B92A0]">Dashboard</span>
          <Link
            href="/app"
            className="px-4 py-2 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            Launch App →
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Error Banner */}
        <AnimatePresence>
          {fetchError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-3 rounded-xl text-sm text-center"
            >
              {fetchError}
              <button
                onClick={() => void fetchData()}
                className="ml-3 text-white/80 underline hover:text-white text-xs"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10"
          >
            {[
              { label: 'Total Sessions', value: stats.total_sessions },
              { label: 'Resolved', value: stats.resolved },
              { label: 'Escalated', value: stats.escalated },
              { label: 'Avg Duration', value: formatDuration(stats.avg_duration_seconds) },
              { label: 'Languages', value: stats.languages_used.length || '—' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-center"
              >
                <div className="text-2xl font-display font-bold text-white mb-1">{stat.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B92A0]">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Session History */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-[#8B92A0] mb-5">Session History</h2>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/50"
              />
            </div>
          )}

          {!loading && sessions.length === 0 && !fetchError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <div className="text-5xl opacity-20">🎙️</div>
              <p className="text-[#8B92A0] text-sm">No conversations yet. Launch the app to start your first session.</p>
              <Link
                href="/app"
                className="px-5 py-2 rounded-xl border border-white/10 text-white text-sm hover:bg-white/5 transition-colors"
              >
                Launch App →
              </Link>
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {sessions.map((sess) => {
                const color = PERSONA_COLORS[sess.persona_id] || '#8B92A0';
                const personaName = PERSONA_NAMES[sess.persona_id] || sess.persona_id;
                const isExpanded = expandedSession === sess.session_id;

                return (
                  <motion.div
                    key={sess.session_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    layout
                    className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                    onClick={() => setExpandedSession(isExpanded ? null : sess.session_id)}
                  >
                    <div className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2.5 h-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                        />
                        <span className="text-sm font-medium text-white">{personaName}</span>
                        <span className="text-xs text-[#8B92A0]">· {getRelativeTime(sess.started_at)}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#8B92A0] font-mono">
                        <span>{formatDuration(sess.duration_seconds)}</span>
                        <span>{sess.turn_count} turns</span>
                        <LanguagePills languages={sess.languages_used} />
                        <StatusBadge status={sess.resolution_status} />
                      </div>
                    </div>

                    {/* Summary line */}
                    {sess.summary_text && (
                      <div className={`px-5 pb-4 text-sm text-[#A8B5C8] leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {sess.summary_text}
                      </div>
                    )}

                    {/* Expanded Transcript */}
                    <AnimatePresence>
                      {isExpanded && sess.messages.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-white/5 px-5 py-4 overflow-hidden"
                        >
                          <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B92A0] mb-3">
                            Transcript
                          </div>
                          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                            {sess.messages.map((msg, idx) => (
                              <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className="max-w-[80%] px-4 py-2 rounded-2xl text-xs"
                                  style={{
                                    backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.05)' : `${color}1A`,
                                    color: msg.role === 'user' ? '#E2E8F0' : '#F8FAFC',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.05)' : `${color}33`}`,
                                  }}
                                >
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.main>
  );
}
