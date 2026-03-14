export default function StatusBar() {
  return (
    <div className="flex items-center gap-2 text-xs text-green-500">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
      Connected (45ms)
    </div>
  )
}
