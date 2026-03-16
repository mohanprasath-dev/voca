import { AnimatePresence, motion } from 'framer-motion'

export interface SessionSummaryData {
  session_id: string
  persona_name: string
  duration_seconds: number
  turn_count: number
  detected_languages: string[]
  escalated: boolean
  resolution_status: string
  summary: string
}

interface SummaryPanelProps {
  data: SessionSummaryData | null
  onDismiss: () => void
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.round(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getStatusMeta(status: string, escalated: boolean): { label: string; classes: string } {
  if (escalated || status === 'escalated') {
    return { label: 'Escalated', classes: 'bg-red-500/20 text-red-300 border-red-400/40' }
  }
  if (status === 'resolved') {
    return { label: 'Resolved', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' }
  }
  return { label: 'Ended', classes: 'bg-slate-500/20 text-slate-300 border-slate-400/40' }
}

export default function SummaryPanel({ data, onDismiss }: SummaryPanelProps) {
  const status = data ? getStatusMeta(data.resolution_status, data.escalated) : null
  const languageLabel = data?.detected_languages.length
    ? data.detected_languages.map((lang) => lang.toUpperCase()).join(' · ')
    : 'N/A'

  return (
    <AnimatePresence>
      {data && (
        <motion.section
          key={data.session_id}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full rounded-2xl border border-[color:var(--accent)]/50 bg-slate-950/70 p-5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
          <button
            type="button"
            onClick={onDismiss}
            className="float-right text-slate-400 transition hover:text-slate-200"
            aria-label="Dismiss summary"
          >
            ×
          </button>

          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-100">{data.persona_name}</h3>
            {status && (
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.classes}`}>
                {status.label}
              </span>
            )}
          </div>

          <p className="mb-4 text-sm leading-6 text-slate-200">{data.summary}</p>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-900/70 p-2">Duration: {formatDuration(data.duration_seconds)}</div>
            <div className="rounded-lg bg-slate-900/70 p-2">Turns: {data.turn_count} turns</div>
            <div className="rounded-lg bg-slate-900/70 p-2">Languages: {languageLabel}</div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
