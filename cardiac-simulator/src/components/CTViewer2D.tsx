import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Layers, LoaderCircle, Minus, Plus, RotateCcw } from 'lucide-react'
import { usePhaseFrame } from '../services/frames'
import type { Crosshair, LoadedCase, Plane, Visibility } from '../types'
import { anatomicalDirection, projectVoxel, slices, sliceVoxel, voxelOffset } from '../utils/spatial'

export interface CTViewerProps {
  plane: Plane
  manifest: LoadedCase
  phaseIndex?: number
  visible: Visibility
  opacity: number
  selected?: number | null
  crosshair: Crosshair
  onCrosshair: (point: Crosshair) => void
  onSelect?: (label: number | null) => void
  windowWidth: number
  windowLevel: number
}

type RGB = readonly [number, number, number]
type Pixel = [number, number]

const ctMaskAlpha = 0.58

function parseColor(color: string): RGB {
  const packed = Number.parseInt(color.slice(1), 16)
  return [packed >> 16 & 255, packed >> 8 & 255, packed & 255]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export const CTViewer2D = memo(function CTViewer2D(props: CTViewerProps) {
  const { plane, manifest, visible, opacity, selected, crosshair, onCrosshair, onSelect, windowWidth, windowLevel } = props
  const { frame, pending, error } = usePhaseFrame()
  const layout = slices[plane]
  const { dimensions, voxelSpacingMm } = manifest
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: number; start: Pixel; pan: Pixel; moved: boolean; panOnly: boolean } | null>(null)
  const [size, setSize] = useState<Pixel>([0, 0])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pixel>([0, 0])
  const width = dimensions[layout.u]
  const height = dimensions[layout.v]
  const slice = crosshair[layout.slice]
  const sliceCount = dimensions[layout.slice]
  const [crossX, crossY] = projectVoxel(plane, crosshair, dimensions)
  const physicalWidth = width * voxelSpacingMm[layout.u]
  const physicalHeight = height * voxelSpacingMm[layout.v]
  const fit = Math.min(size[0] / physicalWidth, size[1] / physicalHeight)
  const imageWidth = fit * physicalWidth * zoom
  const imageHeight = fit * physicalHeight * zoom
  const left = (size[0] - imageWidth) / 2 + pan[0]
  const top = (size[1] - imageHeight) / 2 + pan[1]
  const hasPixels = Boolean(frame?.volume || frame?.segmentation)
  const topSign = layout.flipV ? 1 : -1
  const orientations = [
    ['top', anatomicalDirection(manifest.voxelToWorld, layout.v, topSign)],
    ['bottom', anatomicalDirection(manifest.voxelToWorld, layout.v, -topSign)],
    ['left', anatomicalDirection(manifest.voxelToWorld, layout.u, -1)],
    ['right', anatomicalDirection(manifest.voxelToWorld, layout.u, 1)],
  ]
  const palettes = useMemo(() => new Map(manifest.structures.map((structure) => [structure.label, parseColor(structure.color)])), [manifest])

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const sync = () => setSize([element.clientWidth, element.clientHeight])
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const image = context.createImageData(width, height)
    const { data } = image
    const channelStep = [1, dimensions[0], dimensions[0] * dimensions[1]]
    const horizontalStride = channelStep[layout.u]
    const verticalStride = channelStep[layout.v] * (layout.flipV ? -1 : 1)
    const start = voxelOffset(sliceVoxel(plane, [0, 0], slice, dimensions), dimensions)
    const volume = frame?.volume
    const mask = frame?.segmentation
    const windowRange = Math.max(1, windowWidth) - 1
    const windowMin = windowLevel - 0.5 - windowRange / 2
    let pixel = 0
    for (let y = 0; y < height; y++) {
      let offset = start + y * verticalStride
      for (let x = 0; x < width; x++, offset += horizontalStride, pixel += 4) {
        const hu = volume?.[offset]
        const base = hu == null ? 0 : windowRange > 0
          ? clamp((hu - windowMin) / windowRange * 255, 0, 255)
          : hu > windowMin ? 255 : 0
        const label = mask?.[offset] ?? 0
        const color = visible[label] !== false ? palettes.get(label) : undefined
        if (color) {
          const weight = opacity * (selected == null || selected === label ? 1 : 0.42)
          const alpha = volume ? weight * ctMaskAlpha : weight
          data[pixel] = base * (1 - alpha) + color[0] * alpha
          data[pixel + 1] = base * (1 - alpha) + color[1] * alpha
          data[pixel + 2] = base * (1 - alpha) + color[2] * alpha
        } else {
          data[pixel] = base
          data[pixel + 1] = base
          data[pixel + 2] = base
        }
        data[pixel + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
  }, [dimensions, frame, height, layout, opacity, palettes, plane, selected, slice, visible, width, windowLevel, windowWidth])

  const setSlice = (value: number) => {
    const updated: Crosshair = [...crosshair]
    updated[layout.slice] = clamp(value, 0, sliceCount - 1)
    if (updated[layout.slice] !== slice) onCrosshair(updated)
  }

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || !hasPixels) return
      event.preventDefault()
      const direction = Math.sign(event.deltaY)
      if (event.ctrlKey || event.metaKey) setZoom((value) => clamp(value * (direction > 0 ? 0.85 : 1.18), 1, 8))
      else {
        const updated: Crosshair = [...crosshair]
        updated[layout.slice] = clamp(slice + direction, 0, sliceCount - 1)
        if (updated[layout.slice] !== slice) onCrosshair(updated)
      }
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [crosshair, hasPixels, layout, onCrosshair, slice, sliceCount])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasPixels || (event.target as HTMLElement).closest('button')) return
    gesture.current = { id: event.pointerId, start: [event.clientX, event.clientY], pan, moved: false, panOnly: event.button !== 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || active.id !== event.pointerId) return
    const dx = event.clientX - active.start[0]
    const dy = event.clientY - active.start[1]
    if (!active.moved && Math.hypot(dx, dy) < 4) return
    active.moved = true
    setPan([clamp(active.pan[0] + dx, -imageWidth * 0.8, imageWidth * 0.8), clamp(active.pan[1] + dy, -imageHeight * 0.8, imageHeight * 0.8)])
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    gesture.current = null
    if (!active || active.id !== event.pointerId || active.moved || active.panOnly || !imageWidth || !imageHeight) return
    const rect = event.currentTarget.getBoundingClientRect()
    const u = (event.clientX - rect.left - left) / imageWidth
    const v = (event.clientY - rect.top - top) / imageHeight
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return
    const point = sliceVoxel(plane, [Math.floor(u * width), Math.floor(v * height)], slice, dimensions)
    onCrosshair(point)
    const label = frame?.segmentation?.[voxelOffset(point, dimensions)]
    if (label && opacity > 0 && visible[label] !== false) onSelect?.(label)
  }

  return <section className="ct-viewer" aria-label={`Vista ${layout.title}`} data-plane={plane} data-phase-index={frame?.index}>
    <div className="ct-heading"><h3>{layout.title}</h3><span>{layout.code}</span></div>
    <div className="ct-viewport" ref={viewport}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { gesture.current = null }} onContextMenu={(event) => event.preventDefault()}>
      <div className="ct-image" style={{ left, top, width: imageWidth, height: imageHeight, visibility: hasPixels ? 'visible' : 'hidden' }}>
        <canvas ref={canvas} width={width} height={height} aria-label={`Corte ${layout.title.toLowerCase()} ${slice + 1}`} />
        <span className="ct-crosshair ct-crosshair-x" style={{ left: `${(crossX + 0.5) / width * 100}%` }} aria-hidden="true" />
        <span className="ct-crosshair ct-crosshair-y" style={{ top: `${(crossY + 0.5) / height * 100}%` }} aria-hidden="true" />
      </div>
      {hasPixels && orientations.map(([edge, direction]) => (
        <span key={edge} className={`ct-orientation ct-orientation-${edge}`} aria-hidden="true">{direction}</span>
      ))}
      <div className="ct-viewport-tools" aria-label={`Ampliación ${layout.title.toLowerCase()}`}>
        <button type="button" aria-label={`Acercar ${layout.title.toLowerCase()}`} title="Acercar" disabled={!hasPixels} onClick={() => setZoom((value) => clamp(value * 1.25, 1, 8))}><Plus size={13} /></button>
        <button type="button" aria-label={`Alejar ${layout.title.toLowerCase()}`} title="Alejar" disabled={!hasPixels || zoom === 1} onClick={() => { setZoom((value) => Math.max(1, value / 1.25)); setPan([0, 0]) }}><Minus size={13} /></button>
        <button type="button" aria-label={`Restablecer vista ${layout.title.toLowerCase()}`} title="Restablecer vista" disabled={!hasPixels} onClick={() => { setZoom(1); setPan([0, 0]) }}><RotateCcw size={12} /></button>
      </div>
      {pending && !frame && <div className="viewer-overlay" role="status"><LoaderCircle size={16} aria-hidden="true" /> Cargando corte</div>}
      {!hasPixels && !pending && <div className="viewer-overlay viewer-overlay-empty" role="status"><Layers size={19} aria-hidden="true" /> {error ? 'Corte no disponible' : 'Fase sin datos 2D'}</div>}
    </div>
    <div className="ct-slice-controls">
      <button type="button" onClick={() => setSlice(slice - 1)} aria-label={`Corte anterior ${layout.title.toLowerCase()}`} disabled={!hasPixels || slice === 0}><ChevronLeft size={14} /></button>
      <input type="range" min={0} max={sliceCount - 1} step={1} value={slice} disabled={!hasPixels || sliceCount < 2}
        onChange={(event) => setSlice(event.currentTarget.valueAsNumber)} aria-label={`Corte ${layout.title.toLowerCase()}`} />
      <span className="ct-slice-counter">{slice + 1} / {sliceCount}</span>
      <button type="button" onClick={() => setSlice(slice + 1)} aria-label={`Corte siguiente ${layout.title.toLowerCase()}`} disabled={!hasPixels || slice === sliceCount - 1}><ChevronRight size={14} /></button>
    </div>
  </section>
})
