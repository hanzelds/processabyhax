import { create } from 'zustand'
import { ActiveTimer } from '@/types'

interface TimerState {
  active: ActiveTimer | null
  setActive: (t: ActiveTimer | null) => void
  clearActive: () => void
}

export const useTimerStore = create<TimerState>((set) => ({
  active:      null,
  setActive:   (active) => set({ active }),
  clearActive: () => set({ active: null }),
}))
