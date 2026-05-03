'use client'

interface Props {
  days: number
}

export function StreakBadge({ days }: Props) {
  if (days === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-slate-400">0</span>
        <span className="text-slate-400 text-xs font-medium">días</span>
      </div>
    )
  }

  const hot = days >= 3

  return (
    <div className="flex items-center gap-1.5">
      {hot && (
        <span
          className="text-xl animate-bounce"
          style={{ animationDuration: '1.5s' }}
        >
          🔥
        </span>
      )}
      <span
        className={`text-2xl font-bold tabular-nums ${hot ? 'text-orange-500' : 'text-slate-700'}`}
      >
        {days}
      </span>
      <span className={`text-xs font-medium ${hot ? 'text-orange-400' : 'text-slate-400'}`}>
        {days === 1 ? 'día' : 'días'}
      </span>
    </div>
  )
}
