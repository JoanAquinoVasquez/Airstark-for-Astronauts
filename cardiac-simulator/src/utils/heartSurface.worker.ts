import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial } from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
import type { HeartSurfaceRequest, HeartSurfaceResult } from './heartSurface'

const MAX_GRID = 100
const MAX_TRIANGLES = 160_000
const PADDING = 3
const material = new MeshBasicMaterial()
let marching: MarchingCubes | undefined

function indexSurface(marching: MarchingCubes) {
  const { count, positionArray, normalArray } = marching
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const indices = new Uint32Array(count)
  const vertexByPosition = new Map<number, number>()
  const quantize = (value: number) => Math.round((value + 1) * 50_000)
  // Each axis packs into 17 bits, so the full key stays within Number's exact range.
  const keyBase = 2 ** 17
  for (let vertex = 0; vertex < count; vertex++) {
    const source = vertex * 3
    const x = positionArray[source]
    const y = positionArray[source + 1]
    const z = positionArray[source + 2]
    const key = quantize(x) + keyBase * (quantize(y) + keyBase * quantize(z))
    let index = vertexByPosition.get(key)
    if (index === undefined) {
      index = vertexByPosition.size
      vertexByPosition.set(key, index)
      const target = index * 3
      positions[target] = x
      positions[target + 1] = y
      positions[target + 2] = z
      normals[target] = normalArray[source]
      normals[target + 1] = normalArray[source + 1]
      normals[target + 2] = normalArray[source + 2]
    }
    indices[vertex] = index
  }
  const length = vertexByPosition.size * 3
  return {
    positions: positions.slice(0, length),
    normals: normals.slice(0, length),
    indices: vertexByPosition.size <= 65_536 ? Uint16Array.from(indices) : indices,
  }
}

function reconstruct({ id, labels, dimensions, voxelToWorld }: HeartSurfaceRequest): HeartSurfaceResult {
  const step = Math.ceil(Math.max(...dimensions) / (MAX_GRID - PADDING * 2))
  const [nx, ny, nz] = dimensions.map((size) => Math.ceil(size / step))
  const resolution = Math.max(nx, ny, nz) + PADDING * 2
  if (marching?.size !== resolution) {
    marching?.geometry.dispose()
    marching = new MarchingCubes(resolution, material, false, false, MAX_TRIANGLES)
  } else {
    marching.reset()
  }

  const { field, size2, size: stride } = marching
  const occupied = new Float32Array(field.length)
  const [width, height, depth] = dimensions
  for (let z = 0; z < nz; z++) {
    const startZ = z * step
    const endZ = Math.min(startZ + step, depth)
    for (let y = 0; y < ny; y++) {
      const startY = y * step
      const endY = Math.min(startY + step, height)
      const target = PADDING + stride * (y + PADDING) + size2 * (z + PADDING)
      for (let x = 0; x < nx; x++) {
        const startX = x * step
        const endX = Math.min(startX + step, width)
        let anatomy = 0
        for (let sourceZ = startZ; sourceZ < endZ; sourceZ++) {
          for (let sourceY = startY; sourceY < endY; sourceY++) {
            const source = width * (sourceY + height * sourceZ)
            for (let sourceX = startX; sourceX < endX; sourceX++) {
              anatomy += Number(labels[source + sourceX] !== 0)
            }
          }
        }
        if (anatomy) {
          const coverage = anatomy / ((endX - startX) * (endY - startY) * (endZ - startZ))
          // Preserve connected vessels that only partially occupy a sampling cell.
          occupied[target + x] = 0.5 + 0.5 * coverage
        }
      }
    }
  }

  // Smooth the union of the labeled anatomy before extracting its outer surface.
  for (let z = PADDING - 1; z <= PADDING + nz; z++) {
    for (let y = PADDING - 1; y <= PADDING + ny; y++) {
      const row = stride * y + size2 * z
      for (let x = PADDING - 1; x <= PADDING + nx; x++) {
        const at = row + x
        field[at] = 0.68 * occupied[at] + (0.32 / 6) * (
          occupied[at - 1] + occupied[at + 1] + occupied[at - stride] + occupied[at + stride]
          + occupied[at - size2] + occupied[at + size2]
        )
      }
    }
  }
  marching.isolation = step === 1 ? 0.5 : 0.44
  marching.update()
  if (!marching.count || marching.count > MAX_TRIANGLES * 3) return { id }

  const { positions, normals, indices } = indexSurface(marching)
  const scale = resolution * step / 2
  const offset = scale - PADDING * step + (step - 1) / 2
  const toVoxels = new Matrix4().makeScale(scale, scale, scale).setPosition(offset, offset, offset)
  const toWorld = new Matrix4().fromArray(voxelToWorld).transpose().multiply(toVoxels)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.applyMatrix4(toWorld)
  geometry.dispose()
  if (toWorld.determinant() < 0) {
    // A reflected acquisition grid reverses the triangle front faces.
    for (let i = 0; i < indices.length; i += 3) {
      const second = indices[i + 1]
      indices[i + 1] = indices[i + 2]
      indices[i + 2] = second
    }
  }
  const packedNormals = Int16Array.from(normals, (value) => Math.round(value * 32_767))
  return { id, positions, normals: packedNormals, indices }
}

self.addEventListener('message', ({ data }: MessageEvent<HeartSurfaceRequest>) => {
  try {
    const result = reconstruct(data)
    const { positions, normals, indices } = result
    const transfer = positions && normals && indices ? [positions.buffer, normals.buffer, indices.buffer] : []
    self.postMessage(result, { transfer })
  } catch {
    self.postMessage({ id: data.id } satisfies HeartSurfaceResult)
  }
})
