import { Component, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry, type Group, type Object3D } from 'three'
import type { OrbitControls as OrbitController } from 'three-stdlib'
import { Box, LoaderCircle, Maximize, Minus, Plus, RotateCcw } from 'lucide-react'
import { usePhaseFrame } from '../services/frames'
import { useSimulationStore } from '../stores/simulation'
import type { Crosshair, LoadedCase } from '../types'
import { voxelToWorld } from '../utils/spatial'
import {
  findSurfaceAnchor, HeartHotspots, HeartHotspotPositions, meshStructureId,
  readInterpretedStructures, simulatedInfarct, type HotspotAnchor,
} from './HeartHotspots'
import { createHeartTissueMaterial } from './heartTissue'

export interface HeartViewerProps {
  manifest: LoadedCase
  crosshair: Crosshair
  opacity: number
  cameraDistanceMultiplier?: number
}

type CameraCommand = 'reset' | 'in' | 'out'
type ViewMode = 'segments' | 'tissue'
const infarctStructureId = simulatedInfarct.hotspots[0].structureId
const infarctScenario = 'simulated-infarct'
const surroundingOpacity = 0.18
const shellOpacity = new Map([['heart-wall', 0.36], ['myocardium', 0.78]])
const frontView = new Vector3(-0.31, -1, 0.19).normalize()

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <div className="viewer-overlay viewer-overlay-empty" role="status">
      <Box aria-hidden="true" size={24} /> WebGL no está disponible en este navegador.
    </div> : this.props.children
  }
}

function AnatomyScene({ surface, mesh, manifest, crosshair, opacity, cameraDistanceMultiplier = 2.45,
  segmented, focusId, anatomy, commandRef }: HeartViewerProps & {
  surface: BufferGeometry | null
  mesh: Object3D | null
  segmented: boolean
  focusId: string | null
  anatomy: RefObject<Group | null>
  commandRef: { current: ((command: CameraCommand) => void) | null }
}) {
  const controls = useRef<OrbitController>(null)
  const measured = useRef(false)
  const { camera, invalidate } = useThree()
  const bounds = useMemo(() => new Box3(...manifest.worldBoundsMm.map((point) => new Vector3(...point)) as [Vector3, Vector3]), [manifest])
  const framing = useRef(bounds)
  const tissue = useMemo(createHeartTissueMaterial, [])
  const segmentMaterials = useMemo(() => new Map(manifest.structures.map(({ id, color }) => [
    id, new MeshStandardMaterial({ color, roughness: 0.58 }),
  ])), [manifest.structures])
  const model = useMemo(() => mesh?.clone() ?? null, [mesh])
  const showModel = segmented || !surface

  useEffect(() => () => tissue.dispose(), [tissue])
  useEffect(() => () => {
    for (const material of segmentMaterials.values()) material.dispose()
  }, [segmentMaterials])

  useLayoutEffect(() => {
    model?.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const id = meshStructureId(object)
      object.material = (segmented ? segmentMaterials.get(id) : undefined) ?? tissue
    })
    invalidate()
  }, [invalidate, model, segmentMaterials, segmented, tissue])

  useLayoutEffect(() => {
    const updateOpacity = (material: MeshStandardMaterial, alpha: number) => {
      const transparent = alpha < 1
      material.opacity = alpha
      if (material.transparent !== transparent) {
        material.transparent = transparent
        material.depthWrite = !transparent
        material.needsUpdate = true
      }
    }
    updateOpacity(tissue, focusId ? opacity * surroundingOpacity : opacity)
    for (const [id, material] of segmentMaterials) {
      const baseOpacity = focusId ? (id === focusId ? 1 : surroundingOpacity) : (shellOpacity.get(id) ?? 1)
      updateOpacity(material, opacity * baseOpacity)
    }
    invalidate()
  }, [focusId, invalidate, opacity, segmentMaterials, tissue])

  useLayoutEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const command = (action: CameraCommand) => {
      if (action === 'reset') {
        const center = framing.current.getCenter(new Vector3())
        const size = framing.current.getSize(new Vector3())
        const radius = Math.max(size.length() / 2, 1)
        const distance = Math.max(size.x, size.z, size.y * 0.75) * cameraDistanceMultiplier || radius * 4
        camera.up.set(0, 0, 1)
        camera.position.copy(center).addScaledVector(frontView, distance)
        orbit.target.copy(center)
        orbit.minDistance = radius * 0.22
        orbit.maxDistance = radius * 12
      } else {
        const delta = camera.position.clone().sub(orbit.target)
        const distance = delta.length() * (action === 'in' ? 0.8 : 1.25)
        delta.setLength(Math.max(orbit.minDistance, Math.min(orbit.maxDistance, distance)))
        camera.position.copy(orbit.target).add(delta)
      }
      orbit.update()
      invalidate()
    }
    commandRef.current = command
    command('reset')
    return () => { commandRef.current = null }
  }, [camera, cameraDistanceMultiplier, commandRef, invalidate])

  useLayoutEffect(() => {
    if (measured.current) return
    if (surface && !surface.boundingBox) surface.computeBoundingBox()
    const measuredBounds = surface?.boundingBox ?? (model && new Box3().setFromObject(model))
    if (!measuredBounds || measuredBounds.isEmpty()) return
    measured.current = true
    framing.current = measuredBounds
    commandRef.current?.('reset')
  }, [commandRef, model, surface])

  const worldPoint = voxelToWorld(manifest.voxelToWorld, crosshair)
  return <>
    <hemisphereLight args={segmented ? ['#edf3ff', '#39374a', 0.95] : ['#f1d8cb', '#6d3637', 0.83]} position={[0, 0, 300]} />
    <directionalLight position={[-170, -310, 290]} intensity={segmented ? 1.85 : 2.65} color="#fff7ef" />
    <directionalLight position={[195, -95, 25]} intensity={0.72} color="#d5d8e3" />
    <directionalLight position={[70, 160, 110]} intensity={segmented ? 1 : 1.55} color={segmented ? '#e0e9ff' : '#f1b5a3'} />
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.13} />
    <group ref={anatomy} visible={opacity > 0}>
      {showModel && model && <primitive object={model} dispose={null} />}
      {!showModel && surface && <mesh geometry={surface} material={tissue} dispose={null} />}
    </group>
    {!focusId && (surface || model) && <mesh position={worldPoint} renderOrder={100} raycast={() => undefined}>
      <sphereGeometry args={[0.65, 12, 8]} />
      <meshBasicMaterial color="#6bc5c3" depthTest={false} opacity={0.72} transparent />
    </mesh>}
  </>
}

export const HeartViewer3D = memo(function HeartViewer3D(props: HeartViewerProps) {
  const { frame, pending, error, retry } = usePhaseFrame()
  const playing = useSimulationStore((state) => state.playing)
  const { assets, structures, caseId } = props.manifest
  const canSegment = structures.length > 0 && assets.meshes.some(Boolean)
  const canSimulate = canSegment && caseId === 'duke-heart-4d' && structures.some(({ id }) => id === infarctStructureId)
  const startsWithScenario = canSimulate && new URLSearchParams(window.location.search).get('scenario') === infarctScenario
  const [mode, setMode] = useState<ViewMode>('segments')
  const [simulated, setSimulated] = useState(startsWithScenario)
  const lastScenarioId = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!canSimulate || window.parent === window) return
    function showScenario(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const command = event.data
      if (command?.type !== 'AIRSTARK_SHOW_SCENARIO' || command.visualScenario !== infarctScenario
        || typeof command.id !== 'string' || command.id === lastScenarioId.current) return
      lastScenarioId.current = command.id
      setSimulated(true)
    }
    window.addEventListener('message', showScenario)
    return () => window.removeEventListener('message', showScenario)
  }, [canSimulate])
  const mesh = frame?.mesh ?? null
  const focusId = simulated ? infarctStructureId : null
  const interpreted = useMemo(() => simulated ? readInterpretedStructures(props.manifest, true) : [], [props.manifest, simulated])
  const anchors = useMemo(() => {
    const points = new Map<string, HotspotAnchor>()
    if (!mesh || !focusId) return points
    const meshes: Mesh[] = []
    mesh.updateWorldMatrix(true, true)
    mesh.traverse((object) => {
      if (object instanceof Mesh && meshStructureId(object) === focusId) meshes.push(object)
    })
    const anchor = findSurfaceAnchor(meshes, frontView)
    if (anchor) points.set(focusId, anchor)
    return points
  }, [mesh, focusId])
  const segmented = canSegment && Boolean(mesh) && (simulated || mode === 'segments')
  const anatomy = useRef<Group>(null)
  const hotspotLayer = useRef<HTMLDivElement>(null)
  const commandRef = useRef<((command: CameraCommand) => void) | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const hasAnatomy = assets.segmentations.some(Boolean) || assets.meshes.some(Boolean)
  const fullscreen = async () => {
    if (document.fullscreenElement === container.current) await document.exitFullscreen()
    else await container.current?.requestFullscreen?.()
  }
  function selectMode(next: ViewMode) {
    setMode(next)
    setSimulated(false)
  }

  return <>
    {canSegment && <div className="heart-mode" role="group" aria-label="Vista del corazón 3D">
      <button type="button" aria-pressed={segmented || (!frame && mode === 'segments')}
        disabled={Boolean(frame) && !mesh} onClick={() => selectMode('segments')}>Segmentación</button>
      <button type="button" aria-pressed={frame ? !segmented : mode === 'tissue'} onClick={() => selectMode('tissue')}>Tejido</button>
    </div>}
    <div className="heart-stage">
      <div className="heart-viewer" ref={container} tabIndex={-1} data-phase-index={frame?.index} aria-label="Visualizador cardíaco 3D">
        {hasAnatomy && <ViewerBoundary>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.75]}
            camera={{ fov: 35, near: 0.1, far: 10000, position: [0, -250, 30], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            fallback={<div className="viewer-overlay viewer-overlay-empty">El navegador no ofrece WebGL.</div>}
            aria-label="Superficie cardíaca interactiva"
          >
            <AnatomyScene {...props} surface={frame?.surface ?? null} mesh={mesh} segmented={segmented}
              focusId={focusId} anatomy={anatomy} commandRef={commandRef} />
            {simulated && <HeartHotspotPositions anchors={anchors} anatomy={anatomy} layer={hotspotLayer} />}
          </Canvas>
        </ViewerBoundary>}
        {simulated && <HeartHotspots structures={interpreted} layer={hotspotLayer}
          showMarker={props.opacity > 0} onDismiss={() => {
            setSimulated(false)
            container.current?.focus()
          }} />}
        {hasAnatomy && <div className="heart-viewer-tools" aria-label="Controles de cámara">
          <button type="button" title="Acercar cámara 3D" aria-label="Acercar cámara 3D" onClick={() => commandRef.current?.('in')}><Plus size={16} /></button>
          <button type="button" title="Alejar cámara 3D" aria-label="Alejar cámara 3D" onClick={() => commandRef.current?.('out')}><Minus size={16} /></button>
          <button type="button" title="Restablecer cámara 3D" aria-label="Restablecer cámara 3D" onClick={() => commandRef.current?.('reset')}><RotateCcw size={15} /></button>
          {document.fullscreenEnabled && <button type="button" title="Pantalla completa 3D" aria-label="Pantalla completa 3D" onClick={() => void fullscreen().catch(() => undefined)}><Maximize size={15} /></button>}
        </div>}
        {pending && !frame && <div className="viewer-overlay" role="status"><LoaderCircle size={18} aria-hidden="true" /> Cargando geometría</div>}
        {pending && frame && <span className="viewer-progress" role="status">Cargando fase</span>}
        {error && <div className="viewer-overlay" role="status">{error}<button type="button" onClick={retry}>Reintentar</button></div>}
        {!pending && !error && !frame?.surface && !mesh && <div className="viewer-overlay viewer-overlay-empty" role="status"><Box size={23} aria-hidden="true" /> Esta fase carece de superficie anatómica.</div>}
      </div>
      {(frame?.surface || mesh) && <div className="heart-stage-label">
        <i className={playing ? '' : 'paused'} /> {playing ? 'Sincronizado en tiempo real' : 'En pausa'} · {segmented ? 'Segmentación anatómica 4D' : 'Tejido cardíaco 4D'}
      </div>}
    </div>
  </>
})
