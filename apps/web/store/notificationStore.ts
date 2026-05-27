import { create } from 'zustand'
import { AppNotification } from '@/types'

interface NotifState {
  notifications: AppNotification[]
  unreadCount: number
  open: boolean
  setNotifications: (n: AppNotification[]) => void
  addNotification: (n: AppNotification) => void
  removeNotification: (id: string) => void
  clearAll: () => void
  markAllRead: () => void
  markOneRead: (id: string) => void
  setUnreadCount: (count: number) => void
  toggleOpen: () => void
  close: () => void
}

export const useNotificationStore = create<NotifState>((set) => ({
  notifications: [],
  unreadCount:   0,
  open:          false,

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.readAt).length,
  }),

  // Push a new notification to the top (from SSE real-time push)
  addNotification: (n) => set(s => ({
    notifications: [n, ...s.notifications].slice(0, 100),
    unreadCount: n.readAt ? s.unreadCount : s.unreadCount + 1,
  })),

  // Remove a single notification (dismiss)
  removeNotification: (id) => set(s => {
    const n = s.notifications.find(x => x.id === id)
    return {
      notifications: s.notifications.filter(x => x.id !== id),
      unreadCount: n && !n.readAt ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }
  }),

  // Clear all notifications
  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  markAllRead: () => set(s => ({
    notifications: s.notifications.map(n => n.readAt ? n : { ...n, readAt: new Date().toISOString() }),
    unreadCount: 0,
  })),

  markOneRead: (id) => set(s => {
    const notifications = s.notifications.map(n =>
      n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n
    )
    return { notifications, unreadCount: notifications.filter(n => !n.readAt).length }
  }),

  setUnreadCount: (count) => set({ unreadCount: count }),
  toggleOpen: () => set(s => ({ open: !s.open })),
  close: () => set({ open: false }),
}))
