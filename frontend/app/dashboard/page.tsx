import SummaryPanel from '@/components/SummaryPanel';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-8">Voca Dashboard</h1>
      <SummaryPanel />
    </div>
  )
}
