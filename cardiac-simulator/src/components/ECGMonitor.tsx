import { memo, useId } from 'react'
import { normalizePhase } from '../stores/simulation'

const WIDTH = 320
const HEIGHT = 100
const SECONDS_SHOWN = 2.85

function wave(phase: number, center: number, width: number, amplitude: number): number {
  const distance = Math.abs(phase - center)
  return amplitude * Math.exp(-0.5 * (Math.min(distance, 1 - distance) / width) ** 2)
}

export function ecgAmplitude(phase: number): number {
  const sample = normalizePhase(phase)
  // QRS is anchored at phase zero, allowing the trace to follow a simulation reset.
  return wave(sample, 0.82, 0.035, 0.16)
    + wave(sample, 0.965, 0.015, -0.21)
    + wave(sample, 0, 0.013, 1)
    + wave(sample, 0.034, 0.018, -0.33)
    + wave(sample, 0.29, 0.075, 0.31)
}

export const ECGMonitor = memo(function ECGMonitor({ phase, bpm, playing }: { phase: number; bpm: number; playing: boolean }) {
  const fine = useId()
  const grid = useId()
  const fade = useId()
  const beatsVisible = SECONDS_SHOWN * bpm / 60
  const cursorX = WIDTH - 8
  const baseline = 57
  const height = 36
  const points = Array.from({ length: cursorX + 1 }, (_, x) => {
    const sample = phase - beatsVisible * (1 - x / cursorX)
    return `${x},${(baseline - ecgAmplitude(sample) * height).toFixed(2)}`
  }).join(' ')

  return <svg className="ecg-signal" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"
    role="img" aria-label="Señal ECG ilustrativa" data-playing={playing} data-phase={phase.toFixed(4)}>
    <defs>
      <pattern id={fine} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M 8 0 H 0 V 8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      </pattern>
      <pattern id={grid} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill={`url(#${fine})`} />
        <path d="M 40 0 H 0 V 40" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.2" />
      </pattern>
      <linearGradient id={fade}>
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
        <stop offset="30%" stopColor="currentColor" stopOpacity="0.67" />
        <stop offset="100%" stopColor="currentColor" />
      </linearGradient>
    </defs>
    <rect width={WIDTH} height={HEIGHT} fill={`url(#${grid})`} />
    <polyline points={points} fill="none" stroke={`url(#${fade})`} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <circle cx={cursorX} cy={baseline - height * ecgAmplitude(phase)} r="2.65" fill="currentColor" />
  </svg>
})
