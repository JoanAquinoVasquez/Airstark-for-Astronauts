import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { LoadedCase } from '../types'
import { HeartSurfaceBuilder } from '../utils/heartSurface'
import { resolveAsset } from './cases'

export interface PhaseFrame {
  index: number
  volume: Int16Array | null
  segmentation: Uint8Array | Uint16Array | null
  surface: BufferGeometry | null
  mesh: Object3D | null
}

interface FrameState {
  frame: PhaseFrame | null
  pending: boolean
  error: string | null
  retry: () => void
}

interface CachedFrame {
  frame: PhaseFrame
  size: number
}

const FrameContext = createContext<FrameState | null>(null)
const MAX_ACTIVE_PHASES = 2

function frameCacheLimit() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return (memory != null && memory <= 4 ? 128 : 256) * 1024 * 1024
}

async function fetchBinary(assetRoot: string, path: string, signal: AbortSignal) {
  const url = resolveAsset(assetRoot, path)
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Error ${response.status} al cargar ${path}.`)
  return response.arrayBuffer()
}

async function readVoxels(assetRoot: string, path: string, voxelCount: number, signal: AbortSignal) {
  let buffer = await fetchBinary(assetRoot, path, signal)
  const header = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  if (header[0] === 0x1f && header[1] === 0x8b) {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
    buffer = await new Response(stream).arrayBuffer()
  }
  if (buffer.byteLength !== voxelCount * 2) throw new Error(`El tamaño de ${path} difiere del volumen declarado.`)
  return buffer
}

function releaseMesh(mesh: Object3D | null) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  mesh?.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    for (const material of [object.material].flat()) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}

function releaseFrame(frame: PhaseFrame) {
  frame.surface?.dispose()
  releaseMesh(frame.mesh)
}

function packSegmentation(buffer: ArrayBuffer | null) {
  if (!buffer) return null
  const labels = new Uint16Array(buffer)
  if (labels.some((value) => value > 255)) return labels
  return Uint8Array.from(labels)
}

class PhaseCache {
  private controller = new AbortController()
  private readonly ready = new Map<number, CachedFrame>()
  private readonly requests = new Map<number, Promise<PhaseFrame>>()
  private readonly loader = new GLTFLoader()
  private readonly surfaceBuilder = new HeartSurfaceBuilder()
  private readonly byteLimit = frameCacheLimit()
  private current: number | undefined
  private bytes = 0

  constructor(private readonly manifest: LoadedCase) {}

  get(index: number) {
    return this.ready.get(index)?.frame
  }

  touch(index: number) {
    this.current = index
    const cached = this.ready.get(index)
    if (cached) {
      this.ready.delete(index)
      this.ready.set(index, cached)
    }
  }

  activate() {
    if (this.controller.signal.aborted) this.controller = new AbortController()
  }

  async load(index: number, isRelevant: () => boolean): Promise<PhaseFrame | null> {
    while (isRelevant()) {
      const cached = this.get(index)
      if (cached) return cached
      const request = this.requests.get(index)
      if (request) return request
      if (this.requests.size < MAX_ACTIVE_PHASES) return this.fetchFrame(index)
      // Recheck the requested phase when a slot becomes free. Playback can move on
      // several times while the network is still fetching an older phase.
      await Promise.race([...this.requests.values()].map((active) => active.catch(() => null)))
    }
    return null
  }

  private fetchFrame(index: number): Promise<PhaseFrame> {
    const { assets, assetRoot, dimensions, voxelToWorld } = this.manifest
    const volumePath = assets.volumes[index]
    const maskPath = assets.segmentations[index]
    const meshPath = assets.meshes[index]
    const voxelCount = dimensions[0] * dimensions[1] * dimensions[2]
    const { signal } = this.controller
    const promise = Promise.all([
      volumePath ? readVoxels(assetRoot, volumePath, voxelCount, signal) : null,
      maskPath ? readVoxels(assetRoot, maskPath, voxelCount, signal) : null,
    ]).then(async ([volume, labelBuffer]) => {
      signal.throwIfAborted()
      const segmentation = packSegmentation(labelBuffer)
      const surface = segmentation ? await this.surfaceBuilder.build(segmentation, dimensions, voxelToWorld) : null
      if (signal.aborted) {
        surface?.dispose()
        signal.throwIfAborted()
      }
      let mesh: Object3D | null = null
      let meshBytes = 0
      if (meshPath) {
        try {
          const bytes = await fetchBinary(assetRoot, meshPath, signal)
          mesh = (await this.loader.parseAsync(bytes, assetRoot)).scene
          meshBytes = bytes.byteLength
        } catch (error) {
          if (!surface) throw error
        }
      }
      if (signal.aborted) {
        surface?.dispose()
        releaseMesh(mesh)
        signal.throwIfAborted()
      }
      const frame: PhaseFrame = {
        index,
        volume: volume ? new Int16Array(volume) : null,
        segmentation,
        surface,
        mesh,
      }
      // Mesh CPU/GPU attributes can coexist. Budget both copies conservatively.
      const surfaceBytes = surface
        ? Object.values(surface.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, surface.index?.array.byteLength ?? 0)
        : 0
      const size = (volume?.byteLength ?? 0) + (segmentation?.byteLength ?? 0) + 2 * (surfaceBytes + meshBytes)
      this.ready.set(index, { frame, size })
      this.bytes += size
      while (this.bytes > this.byteLimit && this.ready.size > 2) {
        const oldest = [...this.ready.keys()].find((key) => key !== index && key !== this.current)
        if (oldest === undefined) break
        const item = this.ready.get(oldest)!
        this.ready.delete(oldest)
        this.bytes -= item.size
        releaseFrame(item.frame)
      }
      return frame
    }).finally(() => {
      if (this.requests.get(index) === promise) this.requests.delete(index)
    })
    this.requests.set(index, promise)
    return promise
  }

  canPrefetch(index: number) {
    return this.ready.has(index) || this.bytes < this.byteLimit * 0.9
  }

  dispose() {
    this.controller.abort()
    this.surfaceBuilder.dispose()
    for (const { frame } of this.ready.values()) releaseFrame(frame)
    this.ready.clear()
    this.requests.clear()
    this.bytes = 0
    this.current = undefined
  }
}

export function PhaseFrameProvider({ manifest, phaseIndex, children }: {
  manifest: LoadedCase
  phaseIndex: number
  children: ReactNode
}) {
  const cache = useMemo(() => new PhaseCache(manifest), [manifest])
  const [last, setLast] = useState<PhaseFrame | null>(null)
  const [problem, setProblem] = useState<{ index: number; message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const cached = cache.get(phaseIndex)
  const frame = cached ?? last

  useEffect(() => {
    cache.activate()
    return () => cache.dispose()
  }, [cache])

  useEffect(() => {
    if (frame) cache.touch(frame.index)
  }, [cache, frame])

  useEffect(() => {
    let active = true
    const prepare = async () => {
      try {
        const next = await cache.load(phaseIndex, () => active)
        if (!active || !next) return
        setLast(next)
        setProblem(null)
      } catch (error) {
        if (!active) return
        setProblem({ index: phaseIndex, message: error instanceof Error ? error.message : 'No se pudo cargar la fase.' })
        return
      }
      // Start from the displayed phase, then read the following phases in sequence.
      for (let offset = 1; offset < manifest.phaseCount && active; offset++) {
        const upcoming = (phaseIndex + offset) % manifest.phaseCount
        if (!cache.canPrefetch(upcoming)) break
        try {
          await cache.load(upcoming, () => active)
        } catch {
          break
        }
      }
    }
    void prepare()
    return () => { active = false }
  }, [cache, phaseIndex, manifest.phaseCount, attempt])

  const error = !cached && problem?.index === phaseIndex ? problem.message : null
  return <FrameContext.Provider value={{
    frame,
    pending: !cached && frame?.index !== phaseIndex && !error,
    error,
    retry: () => { setProblem(null); setAttempt((value) => value + 1) },
  }}>{children}</FrameContext.Provider>
}

export function usePhaseFrame() {
  const state = useContext(FrameContext)
  if (!state) throw new Error('Los visores deben estar dentro de PhaseFrameProvider.')
  return state
}
