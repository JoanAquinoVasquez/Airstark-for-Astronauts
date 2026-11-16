import { useEffect, useLayoutEffect } from 'react'
import { useSimulationStore } from '../stores/simulation'
import type { CaseManifest } from '../types'

export function useCardiacSimulation(manifest: CaseManifest | null, autoPlay = false) {
  const playing = useSimulationStore((state) => state.playing)

  useLayoutEffect(() => {
    if (!manifest) {
      useSimulationStore.getState().setPlaying(false)
      return
    }
    const simulation = useSimulationStore.getState()
    simulation.configure(manifest.phaseTimesNormalized, manifest.dataMode, manifest.referenceBpm)
    if (autoPlay) simulation.setPlaying(true)
  }, [manifest, autoPlay])

  useEffect(() => {
    if (!playing) return
    let previousTime = performance.now()
    let requestId: number
    const tick = (now: number) => {
      useSimulationStore.getState().advance(Math.max(0, now - previousTime) / 1000)
      previousTime = now
      requestId = requestAnimationFrame(tick)
    }
    requestId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(requestId)
  }, [playing])
}
