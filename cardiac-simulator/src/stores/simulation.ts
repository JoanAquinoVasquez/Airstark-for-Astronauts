import { create } from 'zustand'
import type { DataMode } from '../types'

const DEFAULT_BPM = 72

export interface CardiacSimulationState {
  bpm: number
  playing: boolean
  normalizedPhase: number
  phaseIndex: number
  totalPhases: number
  cycleDurationSeconds: number
  dataMode: DataMode
}

interface SimulationStore extends CardiacSimulationState {
  phaseTimes: number[]
  setBpm: (bpm: number) => void
  setPlaying: (playing: boolean) => void
  togglePlaying: () => void
  reset: () => void
  seek: (phase: number) => void
  advance: (seconds: number) => void
  configure: (phaseTimes: number[], dataMode: DataMode, referenceBpm?: number | null) => void
}

export function normalizePhase(phase: number): number {
  return phase - Math.floor(phase)
}

export function phaseAt(phase: number, times: number[]): number {
  let low = 0
  let high = times.length
  while (low < high) {
    const index = Math.floor((low + high) / 2)
    if (times[index] <= phase) low = index + 1
    else high = index
  }
  return low === 0 ? Math.max(0, times.length - 1) : low - 1
}

export function advancePhase(phase: number, elapsedSeconds: number, bpm: number): number {
  return normalizePhase(phase + elapsedSeconds * bpm / 60)
}

function constrainBpm(value: number): number {
  return Math.min(180, Math.max(40, Math.round(value)))
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  bpm: DEFAULT_BPM,
  playing: false,
  normalizedPhase: 0,
  phaseIndex: 0,
  totalPhases: 1,
  phaseTimes: [0],
  cycleDurationSeconds: 60 / DEFAULT_BPM,
  dataMode: 'demo',
  configure: (phaseTimes, dataMode, referenceBpm) => set(() => {
    const bpm = referenceBpm != null && Number.isFinite(referenceBpm) ? constrainBpm(referenceBpm) : DEFAULT_BPM
    return {
      bpm,
      playing: false,
      normalizedPhase: 0,
      phaseIndex: phaseAt(0, phaseTimes),
      totalPhases: phaseTimes.length,
      phaseTimes,
      cycleDurationSeconds: 60 / bpm,
      dataMode,
    }
  }),
  setBpm: (value) => {
    if (!Number.isFinite(value)) return
    const bpm = constrainBpm(value)
    set({ bpm, cycleDurationSeconds: 60 / bpm })
  },
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set(({ playing }) => ({ playing: !playing })),
  reset: () => set(({ phaseTimes }) => ({ playing: false, normalizedPhase: 0, phaseIndex: phaseAt(0, phaseTimes) })),
  seek: (value) => {
    if (!Number.isFinite(value)) return
    const normalizedPhase = Math.max(0, Math.min(0.999999, value))
    set(({ phaseTimes }) => ({ normalizedPhase, phaseIndex: phaseAt(normalizedPhase, phaseTimes) }))
  },
  advance: (seconds) => set((state) => {
    if (!state.playing) return state
    const normalizedPhase = advancePhase(state.normalizedPhase, seconds, state.bpm)
    return { normalizedPhase, phaseIndex: phaseAt(normalizedPhase, state.phaseTimes) }
  }),
}))
