import { BufferAttribute, BufferGeometry } from 'three'
import type { Vec3 } from '../types'

export interface HeartSurfaceRequest {
  id: number
  labels: Uint8Array | Uint16Array
  dimensions: Vec3
  voxelToWorld: number[]
}

export interface HeartSurfaceResult {
  id: number
  positions?: Float32Array
  normals?: Int16Array
  indices?: Uint16Array | Uint32Array
}

export class HeartSurfaceBuilder {
  private worker: Worker | null = null
  private unavailable = false
  private nextId = 0
  private readonly pending = new Map<number, (geometry: BufferGeometry | null) => void>()

  build(labels: HeartSurfaceRequest['labels'], dimensions: Vec3, voxelToWorld: number[]) {
    if (this.unavailable) return Promise.resolve(null)
    return new Promise<BufferGeometry | null>((resolve) => {
      const id = this.nextId++
      this.pending.set(id, resolve)
      try {
        if (!this.worker) {
          this.worker = new Worker(new URL('./heartSurface.worker.ts', import.meta.url), { type: 'module' })
          this.worker.onmessage = ({ data }: MessageEvent<HeartSurfaceResult>) => this.receive(data)
          this.worker.onerror = this.worker.onmessageerror = () => {
            this.unavailable = true
            this.dispose()
          }
        }
        // The slices still use this label array. Keep its buffer in the frame cache.
        this.worker.postMessage({ id, labels, dimensions, voxelToWorld } satisfies HeartSurfaceRequest)
      } catch {
        this.unavailable = true
        this.dispose()
      }
    })
  }

  private receive({ id, positions, normals, indices }: HeartSurfaceResult) {
    const resolve = this.pending.get(id)
    if (!resolve) return
    this.pending.delete(id)
    if (!positions || !normals || !indices) {
      resolve(null)
      return
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(normals, 3, true))
    geometry.setIndex(new BufferAttribute(indices, 1))
    resolve(geometry)
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    for (const resolve of this.pending.values()) resolve(null)
    this.pending.clear()
  }
}
