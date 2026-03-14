import VoiceOrb from '@/components/VoiceOrb'
import PersonaSwitcher from '@/components/PersonaSwitcher'
import Transcript from '@/components/Transcript'
import LanguageBadge from '@/components/LanguageBadge'
import StatusBar from '@/components/StatusBar'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-[#080A0F]">
      <div className="w-full flex justify-between items-center bg-transparent">
        <PersonaSwitcher />
        <LanguageBadge />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-12">
        <VoiceOrb />
        <Transcript />
      </div>

      <div className="w-full flex justify-end">
        <StatusBar />
      </div>
    </main>
  )
}
