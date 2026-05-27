'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, X, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { AppNotification } from '@/types'
import { useNotificationStore } from '@/store/notificationStore'

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)  return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`
  return `${Math.floor(diff / 86400000)} d`
}

const TYPE_ICON: Record<string, string> = {
  task_assigned:       '📋',
  task_status_changed: '🔄',
  brief_assigned:      '📝',
  brief_status_changed:'📢',
  brief_comment:       '💬',
  brief_mention:       '🔖',
  shoot_assigned:      '🎬',
  doc_mention:         '📄',
}

export function NotificationBell() {
  const router = useRouter()
  const store = useNotificationStore()
  const {
    notifications, unreadCount, open,
    setNotifications, setUnreadCount,
    addNotification, removeNotification, clearAll,
    markAllRead, markOneRead, toggleOpen, close,
  } = store
  const dropdownRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  const esRef = useRef<EventSource | null>(null)

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/notifications/stream', { withCredentials: true })
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'init') {
            // Initial unread count from server — sync badge immediately
            setUnreadCount(data.unreadCount)
          } else {
            // Real-time notification pushed from server
            addNotification(data as AppNotification)
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        // Browser will auto-reconnect; close cleanly so it can
        es.close()
        esRef.current = null
        // Retry manually after 5s in case browser doesn't auto-reconnect
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Initial list load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    api.get<AppNotification[]>('/api/notifications')
      .then(setNotifications)
      .catch(() => {})
  }, [setNotifications])

  // ── Polling fallback (30s) — keeps badge in sync if SSE drops ──────────────
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { count } = await api.get<{ count: number }>('/api/notifications/unread-count')
        if (count !== unreadCount) {
          // Sync in any direction (increase OR decrease)
          const data = await api.get<AppNotification[]>('/api/notifications')
          setNotifications(data)
        }
      } catch { /* network hiccup — ignore */ }
    }, 30_000)
    return () => clearInterval(id)
  }, [unreadCount, setNotifications])

  // ── Refresh list on open ────────────────────────────────────────────────────
  async function handleOpen() {
    toggleOpen()
    // If going from closed → open, refresh the list
    if (!open) {
      api.get<AppNotification[]>('/api/notifications')
        .then(setNotifications)
        .catch(() => {})
    }
  }

  // ── Outside click ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) close()
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, close])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleMarkAllRead() {
    markAllRead()
    await api.post('/api/notifications/read-all', {}).catch(() => {})
  }

  async function handleClickNotif(notif: AppNotification) {
    if (!notif.readAt) {
      markOneRead(notif.id)
      await api.patch(`/api/notifications/${notif.id}/read`, {}).catch(() => {})
    }
    close()
    if (notif.link) router.push(notif.link)
  }

  async function handleDismiss(e: React.MouseEvent, notif: AppNotification) {
    e.stopPropagation()
    removeNotification(notif.id) // optimistic
    await api.delete(`/api/notifications/${notif.id}`).catch(() => {})
  }

  async function handleClearAll() {
    clearAll() // optimistic
    await api.delete('/api/notifications').catch(() => {})
  }

  const displayCount = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        title="Notificaciones"
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${open ? 'bg-slate-100 text-[#17394f]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
      >
        <Bell className="w-4 h-4" />
        {displayCount && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#17394f] transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar leído
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  title="Vaciar todo"
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2 text-lg">🔔</div>
                <p className="text-sm text-slate-500 font-medium">Sin notificaciones</p>
                <p className="text-xs text-slate-400 mt-0.5">Aquí aparecerán tus alertas</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`group relative flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors ${!notif.readAt ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50'}`}
                >
                  {/* Main clickable area */}
                  <button
                    onClick={() => handleClickNotif(notif)}
                    className="flex items-start gap-3 flex-1 text-left min-w-0"
                  >
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[notif.type] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${!notif.readAt ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400">{relTime(notif.createdAt)}</span>
                      {!notif.readAt && (
                        <span className="w-2 h-2 rounded-full bg-[#17394f]" />
                      )}
                    </div>
                  </button>

                  {/* Dismiss button — visible on group hover */}
                  <button
                    onClick={(e) => handleDismiss(e, notif)}
                    title="Descartar"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
