import { useRef, type CSSProperties, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Plus, X } from 'lucide-react'
import { Box3, Matrix3, Mesh, Raycaster, Vector3, type Group } from 'three'
import type { AnatomyStructure } from '../types'

export interface InterpretedStructure extends AnatomyStructure {
  cause: string
  explanation: string
}

export const simulatedInfarct = {
  hotspots: [{
    structureId: 'left-coronary-artery',
    cause: 'Un depósito de grasa en la pared de la arteria se rompe. Se forma un coágulo que tapa el paso de la sangre.',
    explanation: 'Esta arteria lleva sangre con oxígeno al músculo del corazón. Si el bloqueo dura demasiado, esa parte del músculo puede morir. Eso es un infarto.',
  }],
}

export function readInterpretedStructures(structures: AnatomyStructure[], result: unknown): InterpretedStructure[] {
  if (!result || typeof result !== 'object' || !('hotspots' in result) || !Array.isArray(result.hotspots)) return []
  const byId = new Map(structures.map((structure) => [structure.id, structure]))
  const interpreted = new Map<string, InterpretedStructure>()
  for (const entry of result.hotspots as unknown[]) {
    if (interpreted.size >= 3) break
    if (!entry || typeof entry !== 'object' || !('structureId' in entry) || !('explanation' in entry)
      || typeof entry.structureId !== 'string' || typeof entry.explanation !== 'string') continue
    const structure = byId.get(entry.structureId)
    const explanation = entry.explanation.trim()
    const cause = 'cause' in entry && typeof entry.cause === 'string' ? entry.cause.trim() : ''
    if (structure && cause && explanation && cause.length <= 500 && explanation.length <= 750 && !interpreted.has(structure.id)) {
      interpreted.set(structure.id, { ...structure, cause, explanation })
    }
  }
  return [...interpreted.values()]
}

export function meshStructureId(object: Mesh): string {
  return typeof object.userData.name === 'string' ? object.userData.name : object.name
}

export interface HotspotAnchor {
  point: Vector3
  normal: Vector3
}

export function findSurfaceAnchor(meshes: Mesh[], front: Vector3): HotspotAnchor | null {
  const bounds = new Box3()
  for (const mesh of meshes) bounds.expandByObject(mesh)
  if (bounds.isEmpty()) return null
  const center = bounds.getCenter(new Vector3())
  const distance = bounds.getSize(new Vector3()).length() + 1
  const ray = new Raycaster(center.clone().addScaledVector(front, distance), front.clone().negate())
  const hit = ray.intersectObjects(meshes, false)[0]
  if (hit?.face) {
    const normal = hit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(hit.object.matrixWorld))
    return { point: hit.point, normal }
  }

  // A ray through the center can miss a narrow or curved structure.
  let nearest = Infinity
  let anchor: HotspotAnchor | null = null
  const vertex = new Vector3()
  for (const mesh of meshes) {
    const { position, normal } = mesh.geometry.attributes
    if (!position) continue
    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld)
    for (let i = 0; i < position.count; i++) {
      vertex.set(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(mesh.matrixWorld)
      const distanceSq = vertex.distanceToSquared(center)
      if (distanceSq >= nearest) continue
      nearest = distanceSq
      anchor = {
        point: vertex.clone(),
        normal: normal
          ? new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)).applyNormalMatrix(normalMatrix)
          : new Vector3(),
      }
    }
  }
  return anchor
}

export function HeartHotspotPositions({ anchors, anatomy, layer }: {
  anchors: ReadonlyMap<string, HotspotAnchor>
  anatomy: RefObject<Group | null>
  layer: RefObject<HTMLDivElement | null>
}) {
  const projected = useRef(new Vector3())
  const towardCamera = useRef(new Vector3())
  const ray = useRef(new Raycaster())
  useFrame(({ camera, size: { width, height } }) => {
    const markers = layer.current?.querySelectorAll<HTMLElement>('[data-heart-hotspot]')
    if (!markers?.length) return
    camera.updateMatrixWorld()
    anatomy.current?.updateWorldMatrix(true, true)
    const meshes: Mesh[] = []
    anatomy.current?.traverseVisible((node) => { if (node instanceof Mesh) meshes.push(node) })
    for (const marker of markers) {
      marker.removeAttribute('data-in-view')
      const id = marker.dataset.heartHotspot ?? ''
      const anchor = anchors.get(id)
      if (!anchor) continue
      const point = projected.current.copy(anchor.point).project(camera)
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) continue
      const view = towardCamera.current.subVectors(camera.position, anchor.point)
      if (anchor.normal.lengthSq() && anchor.normal.dot(view) <= 0) continue

      ray.current.set(camera.position, view.normalize().negate())
      ray.current.far = camera.position.distanceTo(anchor.point) - 0.3
      // A farther surface of the same segment stays hidden even in transparency mode.
      const blockers = meshes.filter((mesh) => meshStructureId(mesh) === id || [mesh.material].flat().some((material) => !material.transparent))
      if (ray.current.intersectObjects(blockers, false).length) continue
      marker.style.left = `${(point.x + 1) * width / 2}px`
      marker.style.top = `${(1 - point.y) * height / 2}px`
      marker.setAttribute('data-in-view', '')
    }
  })
  return null
}

export function HeartHotspots({ structures, activeId, simulated, layer, showMarker, onSelect, onDismiss }: {
  structures: InterpretedStructure[]
  activeId: string
  simulated: boolean
  layer: RefObject<HTMLDivElement | null>
  showMarker: boolean
  onSelect: (id: string) => void
  onDismiss: () => void
}) {
  const active = structures.find(({ id }) => id === activeId)
  if (!active) return null

  return <div className="heart-hotspots" ref={layer} onKeyDown={(event) => {
    if (event.key === 'Escape') onDismiss()
  }}>
    {showMarker && structures.map(({ id, name, color }) => (
      <button key={id} type="button" className="heart-hotspot" data-heart-hotspot={id}
        style={{ '--hotspot-color': color } as CSSProperties}
        aria-label={`Ver explicación de ${name}`} aria-pressed={id === active.id} onClick={() => onSelect(id)}>
        <Plus size={12} aria-hidden="true" />
      </button>
    ))}
    <div className="heart-hotspot-card" role="region" aria-label={`Interpretación de ${active.name}`}>
      <button type="button" className="heart-hotspot-close" aria-label="Cerrar interpretación" onClick={onDismiss}><X size={15} /></button>
      <span>{simulated ? 'Ejemplo educativo · Infarto simulado' : 'Según el informe de IA'}</span>
      {structures.length > 1 && <div className="heart-hotspot-choices" role="group" aria-label="Zonas del informe">
        {structures.map(({ id, name }) => (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-pressed={id === active.id}>{name}</button>
        ))}
      </div>}
      <h3>{active.name}</h3>
      <p><strong>{simulated ? 'Causa simulada' : 'Por qué se señala'}</strong> {active.cause}</p>
      <p>{active.explanation}</p>
    </div>
  </div>
}
