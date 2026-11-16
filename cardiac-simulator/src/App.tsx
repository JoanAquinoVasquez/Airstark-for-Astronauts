import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Activity, AlertCircle, Box, ChevronDown, CircleHelp, Database, Eye, EyeOff,
  Focus, Layers3, LoaderCircle, Pause, Play, RotateCcw, ScanLine, SlidersHorizontal, X,
} from 'lucide-react'
import { CTViewer2D } from './components/CTViewer2D'
import { ECGMonitor } from './components/ECGMonitor'
import { HeartViewer3D } from './components/HeartViewer3D'
import { useCardiacSimulation } from './hooks/useCardiacSimulation'
import { fetchCaseCatalog, fetchCaseManifest } from './services/cases'
import { PhaseFrameProvider } from './services/frames'
import { useSimulationStore } from './stores/simulation'
import type { CaseEntry, LoadedCase } from './types'

type Point = [number, number, number]
const rhythmPresets = [60, 75, 120]
const planes = ['axial', 'coronal', 'sagittal'] as const
const modeNames = { acquired: 'Adquirido', inferred: 'Inferido', demo: 'Demostrativo' }
const view = new URLSearchParams(window.location.search).get('view')
const isHeartOnly = view === 'heart-only'

function useMonitorSync(study: LoadedCase | null) {
  const latest = useRef<{ bpm: number; playing: boolean } | null>(null)

  useLayoutEffect(() => {
    if (!isHeartOnly) return
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const message = event.data
      if (message?.type !== 'AIRSTARK_SET_BPM' || !Number.isFinite(message.bpm)) return
      latest.current = { bpm: message.bpm, playing: message.playing !== false }
      const state = useSimulationStore.getState()
      state.setBpm(latest.current.bpm)
      if (study) state.setPlaying(latest.current.playing)
    }
    window.addEventListener('message', receive)
    if (study) {
      const state = useSimulationStore.getState()
      if (latest.current) state.setBpm(latest.current.bpm)
      state.setPlaying(latest.current?.playing ?? true)
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'AIRSTARK_SIMULATOR_READY' }, window.location.origin)
    }
    return () => window.removeEventListener('message', receive)
  }, [study])
}

function Range({ id, label, value, min, max, onChange }: {
  id?: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void
}) {
  return <input id={id} type="range" aria-label={label} min={min} max={max} value={value}
    style={{ '--range': `${100 * (value - min) / (max - min)}%` } as CSSProperties}
    onChange={(event) => onChange(Number(event.target.value))} />
}

function StudyDialog({ study }: { study: LoadedCase | null }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()

  return <>
    <button className="icon-button help-button" type="button" onClick={() => dialog.current?.showModal()}
      aria-label="Información del estudio" title="Información del estudio"><CircleHelp size={19} /></button>
    <dialog ref={dialog} aria-labelledby={heading} className="study-dialog">
      <header className="panel-heading">
        <h2 id={heading}><Database size={17} /> Información del estudio</h2>
        <form method="dialog"><button className="icon-button" aria-label="Cerrar información"><X size={19} /></button></form>
      </header>
      <div className="dialog-body">
        {study && <>
          <h3>{study.title}</h3>
          <dl className="detail-list">
            <div><dt>Tipo de dataset</dt><dd>{study.datasetType}</dd></div>
            <div><dt>Modalidad de origen</dt><dd>{study.modality}</dd></div>
            <div><dt>Imágenes CT originales</dt><dd>{study.hasOriginalCT ? 'Disponibles' : 'Ausentes'}</dd></div>
            <div><dt>Cobertura</dt><dd>{study.completeHeartVerified ? 'Corazón completo verificado' : study.caseId === 'duke-heart-4d' ? 'Parcial' : 'Completa sin verificar'}</dd></div>
            <div><dt>Espaciado del visor</dt><dd>{study.voxelSpacingMm.map((value) => +value.toFixed(3)).join(' × ')} mm</dd></div>
            <div><dt>Tiempo de fase</dt><dd>{study.phaseTiming === 'acquisition' ? 'Metadatos de adquisición' : study.phaseTiming === 'static' ? 'Estudio estático' : 'Distribución uniforme estimada'}</dd></div>
          </dl>
          {study.notes.map((note) => <p key={note}>{note}</p>)}
          {study.caseId === 'duke-heart-4d' && <p>Datos de W. Paul Segars, Center for Virtual Imaging Trials, Duke University. Malin et al., <a href="https://doi.org/10.1002/mp.17945" target="_blank" rel="noreferrer">Medical Physics (2025)</a>. Distribución CC BY mediante <a href="https://github.com/Project-MONAI/monai-physio/tree/main/data/Duke-Heart-4DLabelmaps" target="_blank" rel="noreferrer">MONAI Physio</a>.</p>}
        </>}
        <p>Simulación para educación e investigación. No destinada a diagnóstico ni a toma de decisiones clínicas.</p>
      </div>
    </dialog>
  </>
}

function RhythmPanel({ hasCase }: { hasCase: boolean }) {
  const bpm = useSimulationStore((state) => state.bpm)
  const phase = useSimulationStore((state) => state.normalizedPhase)
  const playing = useSimulationStore((state) => state.playing)
  const togglePlaying = useSimulationStore((state) => state.togglePlaying)
  const reset = useSimulationStore((state) => state.reset)
  const setBpm = useSimulationStore((state) => state.setBpm)

  return <section className="rhythm-panel panel" aria-label="Monitor y controles cardíacos">
    <div className="rate-readout">
      <div className="field-title"><Activity size={14} /> Frecuencia cardíaca</div>
      <div className="bpm-number"><output aria-label="Frecuencia seleccionada">{bpm}</output><span>BPM</span></div>
    </div>
    <div className="rhythm-signal">
      <div className="signal-title"><span>ECG ilustrativo</span><span className={playing ? 'pulse-status running' : 'pulse-status'}><i />{playing ? 'En reproducción' : 'En pausa'}</span></div>
      <ECGMonitor phase={phase} bpm={bpm} playing={playing} />
    </div>
    <div className="rate-adjust">
      <label className="field-title">Ajustar BPM</label>
      <div className="bpm-range"><span>40</span><Range label="Ajustar BPM" min={40} max={180} value={bpm} onChange={setBpm} /><span>180</span></div>
      <div className="presets">{rhythmPresets.map((preset) => <button className={preset === bpm ? 'active' : ''} type="button"
        key={preset} onClick={() => setBpm(preset)} aria-pressed={preset === bpm}>{preset}</button>)}</div>
    </div>
    <div className="playback-controls">
      <button className="play-button" disabled={!hasCase} type="button" onClick={togglePlaying}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{playing ? 'Pausar' : 'Reproducir'}
      </button>
      <button className="icon-button reset-button" type="button" onClick={reset} aria-label="Reiniciar ciclo" title="Reiniciar ciclo"><RotateCcw size={17} /></button>
    </div>
  </section>
}

function CycleTimeline({ study }: { study: LoadedCase }) {
  const phase = useSimulationStore((state) => state.normalizedPhase)
  const index = useSimulationStore((state) => state.phaseIndex)
  const duration = useSimulationStore((state) => state.cycleDurationSeconds)
  const seek = useSimulationStore((state) => state.seek)
  const percent = Math.floor(phase * 100)

  return <section className="timeline panel" aria-label="Línea temporal cardíaca">
    <div className="timeline-title">
      <h2><Activity size={16} /> Ciclo cardíaco</h2>
      <span><strong data-testid="current-phase">{String(index + 1).padStart(2, '0')}</strong> / {String(study.phaseCount).padStart(2, '0')} fases <i /> {percent}% <i /> {duration.toFixed(2)} s por ciclo</span>
    </div>
    <div className="cycle-range">
      <Range label="Fase cardíaca" min={0} max={999} value={Math.floor(phase * 1000)} onChange={(value) => seek(value / 1000)} />
      <div className="phase-ticks" aria-hidden="true">{study.phaseTimesNormalized.map((mark) => <i key={mark} style={{ left: `${mark * 100}%` }} />)}</div>
    </div>
    <div className="timeline-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
  </section>
}

function HeartOnlyWorkspace({ study }: { study: LoadedCase }) {
  const phaseIndex = useSimulationStore((state) => state.phaseIndex)
  const bpm = useSimulationStore((state) => state.bpm)
  const [crosshair] = useState<Point>(() => study.dimensions.map((size) => Math.floor(size / 2)) as Point)

  return <section className="panel anatomy-view heart-only-view" aria-label="Reconstrucción 3D">
    <header className="panel-heading heart-only-header">
      <h2><Box size={16} /> Reconstrucción 3D del corazón</h2>
      <div className="heart-only-tags">
        <span className="tag">LPS · mm</span>
        <span className="heart-live-bpm-badge"><Activity size={12} /> {bpm} BPM</span>
      </div>
    </header>
    <PhaseFrameProvider manifest={study} phaseIndex={phaseIndex}>
      <HeartViewer3D manifest={study} crosshair={crosshair} opacity={0.65} cameraDistanceMultiplier={2.95} />
    </PhaseFrameProvider>
  </section>
}

function StudyWorkspace({ study }: { study: LoadedCase }) {
  const phaseIndex = useSimulationStore((state) => state.phaseIndex)
  const transparencyId = useId()
  const [modelTransparency, setModelTransparency] = useState(0)
  const [visible, setVisible] = useState<Record<number, boolean>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [opacity, setOpacity] = useState(100)
  const [overlays, setOverlays] = useState(true)
  const [windowWidth, setWindowWidth] = useState(850)
  const [windowLevel, setWindowLevel] = useState(250)
  const [crosshair, setCrosshair] = useState<Point>(() => study.dimensions.map((size) => Math.floor(size / 2)) as Point)
  const showAll = study.structures.every((structure) => visible[structure.label] !== false)
  const labels = { acquired: 'Fases adquiridas', inferred: 'Movimiento inferido', demo: 'Animación demostrativa' }

  return <div className="workbench">
    <div className="viewer-column">
      <PhaseFrameProvider key={study.caseId} manifest={study} phaseIndex={phaseIndex}>
        <div className="viewer-grid">
          <section className="panel anatomy-view" aria-label="Reconstrucción 3D">
            <header className="panel-heading"><h2><Box size={16} /> Reconstrucción 3D</h2><span className="tag">LPS · mm</span></header>
            <HeartViewer3D manifest={study} crosshair={crosshair} opacity={(100 - modelTransparency) / 100} />
            <div className="opacity-control">
              <div><label htmlFor={transparencyId}><SlidersHorizontal size={14} aria-hidden="true" /> Transparencia 3D</label>
                <output htmlFor={transparencyId}>{modelTransparency}%</output></div>
              <Range id={transparencyId} label="Transparencia 3D" min={0} max={100} value={modelTransparency} onChange={setModelTransparency} />
            </div>
            <div className="panel-caption"><Focus size={13} /> Arrastra para rotar · rueda para ampliar</div>
          </section>
          <section className="panel slice-panel" aria-label="Cortes ortogonales">
            <header className="panel-heading"><h2><ScanLine size={16} /> Cortes ortogonales</h2>
              <button type="button" className={`icon-button mask-toggle${overlays ? ' active' : ''}`} onClick={() => setOverlays(!overlays)}
                aria-pressed={overlays} aria-label="Mostrar máscaras en los cortes" title="Mostrar máscaras"><Layers3 size={16} /></button>
            </header>
            <div className="slices-grid">
              {planes.map((plane) => <CTViewer2D key={plane} plane={plane} manifest={study} phaseIndex={phaseIndex} visible={visible}
                opacity={overlays ? opacity / 100 : 0} selected={selected} onSelect={overlays ? setSelected : undefined}
                crosshair={crosshair} onCrosshair={setCrosshair} windowWidth={windowWidth} windowLevel={windowLevel} />)}
            </div>
            {study.hasOriginalCT ? <div className="window-controls">
              <label>Ventana <output>{windowWidth} HU</output><Range label="Ventana HU" min={1} max={2500} value={windowWidth} onChange={setWindowWidth} /></label>
              <label>Nivel <output>{windowLevel} HU</output><Range label="Nivel HU" min={-1000} max={1200} value={windowLevel} onChange={setWindowLevel} /></label>
            </div> : <div className="panel-caption"><Layers3 size={13} /> Segmentaciones 4D <i /> CT original ausente</div>}
          </section>
        </div>
      </PhaseFrameProvider>
      <CycleTimeline study={study} />
    </div>
    <aside className="sidebar">
      <section className="panel structure-panel">
        <header className="panel-heading"><h2><Layers3 size={16} /> Segmentación 2D</h2><span className="count-pill">{study.structures.length}</span></header>
        <div className="anatomy-controls">
          <button className="text-button" type="button" onClick={() => setVisible(Object.fromEntries(study.structures.map((structure) => [structure.label, !showAll])))}>
            {showAll ? <EyeOff size={14} /> : <Eye size={14} />}{showAll ? 'Ocultar todas' : 'Mostrar todas'}
          </button>
          {selected !== null && <button type="button" className="text-button" onClick={() => setSelected(null)}>Quitar selección</button>}
        </div>
        <ul className="structures">
          {study.structures.map((structure) => {
            const shown = visible[structure.label] !== false
            return <li className={`${selected === structure.label ? 'selected' : ''}${shown ? '' : ' hidden-structure'}`} key={structure.id}>
              <button type="button" className="structure-name" aria-pressed={selected === structure.label} onClick={() => setSelected(selected === structure.label ? null : structure.label)}>
                <i className="color-dot" style={{ backgroundColor: structure.color }} />{structure.name}
              </button>
              <button type="button" className="icon-button visibility-button" onClick={() => setVisible({ ...visible, [structure.label]: !shown })}
                aria-label={`${shown ? 'Ocultar' : 'Mostrar'} ${structure.name}`} title={`${shown ? 'Ocultar' : 'Mostrar'} ${structure.name}`}>
                {shown ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </li>
          })}
        </ul>
        <div className="opacity-control"><div><label><SlidersHorizontal size={14} /> Opacidad</label><output>{opacity}%</output></div>
          <Range label="Opacidad de las capas" min={0} max={100} value={opacity} onChange={setOpacity} /></div>
      </section>
      <section className="panel dataset-panel">
        <header className="panel-heading"><h2><Database size={16} /> Datos del estudio</h2></header>
        <dl className="detail-list">
          <div><dt>Modalidad</dt><dd>{study.modality}</dd></div>
          <div><dt>Fases disponibles</dt><dd>{study.phaseCount}</dd></div>
          <div><dt>Movimiento</dt><dd className="accent-text">{labels[study.dataMode]}</dd></div>
          <div><dt>Cobertura</dt><dd>{study.completeHeartVerified ? 'Completa verificada' : study.caseId === 'duke-heart-4d' ? 'Parcial' : 'Completa sin verificar'}</dd></div>
        </dl>
      </section>
    </aside>
  </div>
}

export default function App() {
  const [catalog, setCatalog] = useState<CaseEntry[]>([])
  const [caseId, setCaseId] = useState('')
  const [study, setStudy] = useState<LoadedCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useCardiacSimulation(study)
  useMonitorSync(study)

  useEffect(() => {
    const controller = new AbortController()
    fetchCaseCatalog(controller.signal).then((entries) => {
      if (controller.signal.aborted) return
      if (!entries.length) throw new Error('El catálogo de estudios está vacío.')
      setCatalog(entries)
      setCaseId(entries[0].caseId)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setLoading(false)
      setError(reason instanceof Error ? reason.message : 'Error al cargar el catálogo.')
    })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    const item = catalog.find((entry) => entry.caseId === caseId)
    if (!item) return
    const controller = new AbortController()
    setStudy(null)
    setLoading(true)
    setError('')
    fetchCaseManifest(item, controller.signal).then((manifest) => {
      if (controller.signal.aborted) return
      setStudy(manifest)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : 'Error al cargar los recursos del estudio.')
      setLoading(false)
    })
    return () => controller.abort()
  }, [catalog, caseId])

  function retry() {
    setError('')
    setLoading(true)
    setRevision((value) => value + 1)
  }

  const emptyStudy = <div className="panel empty-study" role={error ? 'alert' : 'status'}>
    {loading ? <><LoaderCircle className="loading-spinner" /><strong>Cargando estudio</strong></> : <>
      <AlertCircle /><strong>Estudio no disponible</strong><p>{error}</p><button type="button" className="text-button" onClick={retry}>Reintentar</button>
    </>}
  </div>

  if (isHeartOnly) return <main className="app-content-heart-only">
    {study ? <HeartOnlyWorkspace key={study.caseId} study={study} /> : emptyStudy}
  </main>

  return <>
    {view !== 'workspace' && <header className="app-nav">
      <div className="app-nav-inner">
        <div className="brand"><div className="brand-icon" /><span>AIRSTARK</span></div>
        <span className="nav-rule" />
        <div className="app-name">Cardiac Simulator</div>
        <div className="nav-right">
          <span className="environment-label"><i /> Laboratorio educativo</span>
          <StudyDialog study={study} />
        </div>
      </div>
    </header>}
    <main className="app-content">
      {view !== 'workspace' && <div className="study-header">
        <div>
          <h1>Simulador cardíaco</h1>
          <p>Exploración anatómica 4D y reproducción del ciclo cardíaco</p>
        </div>
        <div className="study-picker">
          {study && <span className={`study-ready ${study.dataMode}`} title="Origen del movimiento"><i /> {modeNames[study.dataMode]}</span>}
          <label className="study-select"><Database size={15} />
            <select aria-label="Seleccionar estudio" value={caseId} onChange={(event) => setCaseId(event.target.value)} disabled={!catalog.length}>
              {catalog.length ? catalog.map((entry) => <option value={entry.caseId} key={entry.caseId}>{entry.title}</option>) : <option value="">Estudio sin seleccionar</option>}
            </select><ChevronDown size={15} />
          </label>
        </div>
      </div>}
      <RhythmPanel hasCase={Boolean(study)} />
      {study ? <StudyWorkspace key={study.caseId} study={study} /> : emptyStudy}
      {view !== 'workspace' && <footer className="app-footer"><CircleHelp size={15} /> Simulación para educación e investigación. No destinada a diagnóstico ni a toma de decisiones clínicas.</footer>}
    </main>
  </>
}
