import type { Crosshair, Plane, Vec3 } from '../types'

export const slices = {
  axial: { u: 0, v: 1, slice: 2, flipV: false, title: 'Axial', code: 'AX' },
  coronal: { u: 0, v: 2, slice: 1, flipV: true, title: 'Coronal', code: 'CO' },
  sagittal: { u: 1, v: 2, slice: 0, flipV: true, title: 'Sagital', code: 'SA' },
} as const satisfies Record<Plane, unknown>

export function voxelToWorld(matrix: number[], point: Vec3): Vec3 {
  const [x, y, z] = point
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ]
}

export function voxelOffset(point: Vec3, dimensions: Vec3): number {
  return point[0] + dimensions[0] * (point[1] + dimensions[1] * point[2])
}

export function projectVoxel(plane: Plane, point: Crosshair, dimensions: Vec3): [number, number] {
  const { u, v, flipV } = slices[plane]
  return [point[u], flipV ? dimensions[v] - 1 - point[v] : point[v]]
}

export function sliceVoxel(plane: Plane, position: [number, number], index: number, dimensions: Vec3): Vec3 {
  const layout = slices[plane]
  const point: Vec3 = [0, 0, 0]
  point[layout.u] = position[0]
  point[layout.v] = layout.flipV ? dimensions[layout.v] - 1 - position[1] : position[1]
  point[layout.slice] = index
  return point
}

export function anatomicalDirection(matrix: number[], axis: number, sign: number): string {
  const names = [['L', 'R'], ['P', 'A'], ['S', 'I']]
  const direction = [matrix[axis], matrix[axis + 4], matrix[axis + 8]]
  const largestAxis = direction.reduce((best, value, index) => Math.abs(value) > Math.abs(direction[best]) ? index : best, 0)
  return names[largestAxis][direction[largestAxis] * sign < 0 ? 1 : 0]
}
