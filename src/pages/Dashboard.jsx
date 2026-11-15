import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_RECORDS, formatDate, getCurrentRecords, getSavedRecords, stressLabel } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import Icon from '../components/Icon.jsx';
import { NOTIFICATIONS_STORAGE_KEY } from '../lib/supabase.js';

// ── Zonas de referencia ──────────────────────────────────────────────────────
const BPM_ZONES = [
  { id: 'optimal', labelEs: 'Reposo óptimo', labelEn: 'Optimal rest', min: 50, max: 70, color: '#49ddb2' },
  { id: 'normal', labelEs: 'Normal', labelEn: 'Normal', min: 70, max: 100, color: '#65a9ff' },
  { id: 'elevated', labelEs: 'Elevado', labelEn: 'Elevated', min: 100, max: 120, color: '#f5c842' },
  { id: 'high', labelEs: 'Alto', labelEn: 'High', min: 120, max: 180, color: '#f07c3e' },
];

function bpmZone(bpm) {
  return BPM_ZONES.find((z) => bpm >= z.min && bpm < z.max) || BPM_ZONES.at(-1);
}

function bpmColor(bpm) {
  return bpmZone(bpm).color;
}

function bpmZoneLabel(bpm, language = 'es') {
  const z = bpmZone(bpm);
  return language === 'en' ? z.labelEn : z.labelEs;
}

function stressColor(score) {
  if (score <= 33) return '#49ddb2';
  if (score <= 66) return '#f5c842';
  return '#f07c3e';
}

function bmiColor(bmi) {
  if (bmi < 18.5) return '#65a9ff';
  if (bmi < 25) return '#49ddb2';
  if (bmi < 30) return '#f5c842';
  return '#f07c3e';
}

function bmiLabel(bmi, language = 'es') {
  if (language === 'en') {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obesity';
  }
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

// ── Barra y leyenda interactiva de zonas BPM ─────────────────────────────────
function BpmZoneBar({ bpm, language = 'es' }) {
  const absMin = 40, absMax = 180;
  const val = Number(bpm) || 72;
  const clampedBpm = Math.max(absMin, Math.min(absMax, val));
  const pct = Math.max(0, Math.min(100, ((clampedBpm - absMin) / (absMax - absMin)) * 100));
  const currentZone = bpmZone(clampedBpm);

  return (
    <div style={{ marginTop: 8, marginBottom: 6 }}>
      {/* Barra de progreso multicolor */}
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {BPM_ZONES.map((z) => {
          const left = ((z.min - absMin) / (absMax - absMin)) * 100;
          const width = ((z.max - z.min) / (absMax - absMin)) * 100;
          return (
            <div
              key={z.id}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
                height: '100%',
                background: z.color,
                opacity: 0.38
              }}
            />
          );
        })}
        {/* Marcador deslizante interactivo */}
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: -3,
            transform: 'translateX(-50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: currentZone.color,
            border: '2px solid #081726',
            boxShadow: `0 0 10px ${currentZone.color}`,
            transition: 'left 0.08s ease, background 0.15s ease'
          }}
        />
      </div>

      {/* Leyenda con rangos de referencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginTop: 7, fontSize: 8.5, flexWrap: 'wrap' }}>
        {BPM_ZONES.map((z) => {
          const isActive = currentZone.id === z.id;
          const label = language === 'en' ? z.labelEn : z.labelEs;
          return (
            <span
              key={z.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: isActive ? z.color : '#6f869a',
                fontWeight: isActive ? 700 : 400,
                transition: 'color 0.15s ease'
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: z.color, display: 'inline-block' }} />
              {label} <span style={{ color: isActive ? z.color : '#475d71', fontFamily: 'var(--mono)', fontSize: 7.5 }}>({z.min}–{z.max})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Card interactiva de Ritmo Cardíaco (Scrubbing con el mouse) ───────────────
function InteractiveHeartCard({ records, hasRealRecords, text, language }) {
  const samples = useMemo(() => {
    const filtered = records.filter((r) => Number.isFinite(Number(r.heartRate)) && Number(r.heartRate) > 0);
    // Orden cronológico estricto: índice 0 = más antiguo (izquierda), último = más reciente (derecha)
    return [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [records]);

  const [hoveredIdx, setHoveredIdx] = useState(null);

  const latest = samples.at(-1);
  const active = hoveredIdx !== null && samples[hoveredIdx] ? samples[hoveredIdx] : latest;

  const activeBpm = active ? Number(active.heartRate) : null;
  const activeColor = activeBpm ? bpmColor(activeBpm) : '#54d7ee';
  const activeZone = activeBpm ? bpmZoneLabel(activeBpm, language) : null;

  // Tendencia vs punto anterior
  const activePrev = hoveredIdx !== null && hoveredIdx > 0
    ? samples[hoveredIdx - 1]
    : samples.length >= 2 ? samples.at(-2) : null;
  const trend = active && activePrev ? Number(active.heartRate) - Number(activePrev.heartRate) : undefined;
  const trendIcon = trend > 0 ? '▲' : trend < 0 ? '▼' : null;
  const trendColor = trend > 0 ? '#f07c3e' : '#49ddb2';

  // Coordenadas SVG
  const W = 320;
  const H = 46;
  const values = samples.map((s) => Number(s.heartRate));
  const minVal = values.length ? Math.min(...values) : 40;
  const maxVal = values.length ? Math.max(...values) : 120;
  const range = maxVal - minVal || 1;

  const points = samples.map((s, i) => {
    const x = samples.length === 1 ? W / 2 : (i / (samples.length - 1)) * (W - 8) + 4;
    const y = H - ((Number(s.heartRate) - minVal) / range) * (H - 14) - 7;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const areaPath = points.length ? `${linePath} L${W} ${H} L0 ${H}Z` : '';

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : points.at(-1);

  const handleMouseMove = (e) => {
    if (!samples.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const closestIdx = Math.round(xRel * (samples.length - 1));
    setHoveredIdx(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  return (
    <article
      className="metric-card heart-card"
      style={{
        '--metric-accent': activeColor,
        cursor: 'default',
        position: 'relative',
        userSelect: 'none',
        minHeight: 205,
        paddingBottom: 48,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="metric-top">
        <span className="metric-icon" style={{ color: activeColor }}><Icon name="heart" size={16} /></span>
        <span className="metric-label">{text.heart}</span>
        {hoveredIdx !== null ? (
          <span style={{
            marginLeft: 'auto',
            fontSize: 8.5,
            color: '#c5f7ff',
            fontFamily: 'var(--mono)',
            background: 'rgba(84,215,238,0.2)',
            border: '1px solid rgba(84,215,238,0.4)',
            padding: '2px 7px',
            borderRadius: 4,
            fontWeight: 600
          }}>
            {formatDate(active?.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}
          </span>
        ) : trendIcon ? (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: trendColor, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {trendIcon} {Math.abs(trend)} bpm
          </span>
        ) : null}
      </div>

      <div className="metric-value">
        <strong style={{ color: activeColor }}>{activeBpm ?? '—'}</strong>
        <span>bpm</span>
        {hoveredIdx !== null && (
          <span style={{ fontSize: 8.5, color: '#7e9db3', fontFamily: 'var(--mono)', marginLeft: 6 }}>
            ({hoveredIdx + 1}/{samples.length})
          </span>
        )}
      </div>

      {/* Barra multicolor y leyenda de zonas de frecuencia cardíaca */}
      <BpmZoneBar bpm={activeBpm} language={language} />

      <div className="metric-bottom">
        <span className="metric-status good" style={{ '--dot': activeColor }}>
          <i style={{ background: activeColor }} />
          {activeZone || (hasRealRecords ? text.registered : text.sampleData)}
        </span>
        <span className="metric-context" style={{ color: hoveredIdx !== null ? '#54d7ee' : '#70879b' }}>
          {hoveredIdx !== null
            ? (language === 'en' ? '◀ Scrubbing history ▶' : '◀ Explorando historial ▶')
            : (language === 'en' ? 'Move mouse to explore' : 'Mueve el mouse para explorar')}
        </span>
      </div>

      {/* Sparkline interactivo */}
      <div className="sparkline" style={{ height: H, opacity: 0.95, pointerEvents: 'none' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="interactiveHeartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill="url(#interactiveHeartGrad)" />}
          {linePath && <path d={linePath} fill="none" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Guía vertical y punto activo */}
          {activePoint && (
            <>
              <line
                x1={activePoint[0]}
                x2={activePoint[0]}
                y1={0}
                y2={H}
                stroke={hoveredIdx !== null ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'}
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <circle
                cx={activePoint[0]}
                cy={activePoint[1]}
                r={hoveredIdx !== null ? 5 : 3.5}
                fill={activeColor}
                stroke="#081726"
                strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 7px ${activeColor})` }}
              />
            </>
          )}
        </svg>
      </div>
    </article>
  );
}

function getRecordStressScore(record) {
  if (!record) return 20;
  if (record.stressScore != null && Number.isFinite(Number(record.stressScore))) {
    return Number(record.stressScore);
  }
  const rawNum = Number(String(record.stress ?? '').replace(',', '.').replace('%', '').trim());
  if (Number.isFinite(rawNum) && String(record.stress ?? '').trim() !== '') {
    return rawNum;
  }
  const label = stressLabel(record.stress);
  if (label === 'Alto') return 82;
  if (label === 'Moderado') return 52;
  if (label === 'Bajo') return 22;
  return 20;
}

// ── Card interactiva de Estrés (Scrubbing con el mouse) ──────────────────────
function InteractiveStressCard({ records, hasRealRecords, text, language }) {
  const samples = useMemo(() => {
    const filtered = records.filter((r) => r.stressScore != null || r.stress);
    // Orden cronológico estricto: índice 0 = más antiguo (izquierda), último = más reciente (derecha)
    return [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [records]);

  const [hoveredIdx, setHoveredIdx] = useState(null);

  const latest = samples.at(-1);
  const active = hoveredIdx !== null && samples[hoveredIdx] ? samples[hoveredIdx] : latest;

  const rawScore = getRecordStressScore(active);
  const activeColor = stressColor(rawScore);
  const normalized = stressLabel(active?.stress);
  const stressDisplay = language === 'en'
    ? ({ Bajo: 'Low', Moderado: 'Moderate', Alto: 'High' }[normalized] || normalized)
    : (normalized !== '—' ? normalized : (rawScore > 66 ? 'Alto' : rawScore > 33 ? 'Moderado' : 'Bajo'));
  const stressLevel = rawScore > 66 ? 3 : rawScore > 33 ? 2 : 1;

  // Coordenadas SVG en escala real 0 - 100%
  const W = 320;
  const H = 46;

  const points = samples.map((s, i) => {
    const sc = getRecordStressScore(s);
    const x = samples.length === 1 ? W / 2 : (i / (samples.length - 1)) * (W - 8) + 4;
    // Escala de altura proporcional al 0 - 100%
    const y = H - (sc / 100) * (H - 14) - 7;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const areaPath = points.length ? `${linePath} L${W} ${H} L0 ${H}Z` : '';
  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : points.at(-1);

  const handleMouseMove = (e) => {
    if (!samples.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const closestIdx = Math.round(xRel * (samples.length - 1));
    setHoveredIdx(closestIdx);
  };

  return (
    <article
      className="metric-card stress-card"
      style={{
        '--metric-accent': activeColor,
        cursor: 'default',
        position: 'relative',
        userSelect: 'none',
        minHeight: 205,
        paddingBottom: 48,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <div className="metric-top">
        <span className="metric-icon stress-icon" style={{ color: activeColor }}><Icon name="stress" size={16} /></span>
        <span className="metric-label">{text.stress}</span>
        {hoveredIdx !== null ? (
          <span style={{
            marginLeft: 'auto',
            fontSize: 8.5,
            color: '#ffe5a3',
            fontFamily: 'var(--mono)',
            background: 'rgba(245,200,66,0.2)',
            border: '1px solid rgba(245,200,66,0.4)',
            padding: '2px 7px',
            borderRadius: 4,
            fontWeight: 600
          }}>
            {formatDate(active?.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}
          </span>
        ) : null}
      </div>

      <div className="metric-value">
        <strong style={{ color: activeColor }}>{stressDisplay !== '—' ? stressDisplay : '—'}</strong>
        <span style={{ color: activeColor }}> ({rawScore}%)</span>
        {hoveredIdx !== null && (
          <span style={{ fontSize: 8.5, color: '#7e9db3', fontFamily: 'var(--mono)', marginLeft: 6 }}>
            ({hoveredIdx + 1}/{samples.length})
          </span>
        )}
      </div>

      <div className="metric-bottom">
        <span className="metric-status good" style={{ '--dot': activeColor }}>
          <i style={{ background: activeColor }} />
          {hasRealRecords ? text.registered : text.sampleData}
        </span>
        <span className="metric-context" style={{ color: hoveredIdx !== null ? '#f5c842' : '#70879b' }}>
          {hoveredIdx !== null ? '◀ Explorando estrés ▶' : text.stressDetail}
        </span>
      </div>

      <div className="stress-bars" role="img" aria-label={`Nivel: ${stressDisplay} (${rawScore}%)`}>
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} className={i < stressLevel * 4 ? 'filled' : ''} style={i < stressLevel * 4 ? { background: activeColor } : {}} />
        ))}
      </div>

      {/* Sparkline de estrés interactivo */}
      <div className="sparkline" style={{ height: H, opacity: 0.95, pointerEvents: 'none' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="interactiveStressGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill="url(#interactiveStressGrad)" />}
          {linePath && <path d={linePath} fill="none" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
          {activePoint && (
            <>
              <line
                x1={activePoint[0]}
                x2={activePoint[0]}
                y1={0}
                y2={H}
                stroke={hoveredIdx !== null ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'}
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <circle
                cx={activePoint[0]}
                cy={activePoint[1]}
                r={hoveredIdx !== null ? 5 : 3.5}
                fill={activeColor}
                stroke="#081726"
                strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 7px ${activeColor})` }}
              />
            </>
          )}
        </svg>
      </div>
    </article>
  );
}

// ── Tarjeta Interactiva de IMC ───────────────────────────────────────────────
function InteractiveBmiCard({ records, hasRealRecords, text, language }) {
  const realBmiRecord = useMemo(
    () => records.find((r) => r.bmi != null && !isNaN(Number(r.bmi)) && r.source !== 'demo'),
    [records]
  );
  const fallbackRecord = useMemo(
    () => records.find((r) => r.bmi != null && !isNaN(Number(r.bmi))) || DEMO_RECORDS.find((r) => r.bmi != null),
    [records]
  );
  const activeRecord = realBmiRecord || fallbackRecord;
  const bmiVal = activeRecord?.bmi ? Number(activeRecord.bmi) : 22.4;
  const bmiFormatted = bmiVal.toFixed(1);
  const color = bmiColor(bmiVal);
  const label = bmiLabel(bmiVal);
  const hasReal = Boolean(realBmiRecord);

  // Posición del puntero en la escala (15 a 40)
  const pct = Math.min(96, Math.max(4, ((bmiVal - 15) / 25) * 100));

  return (
    <article
      className="metric-card bmi-card"
      style={{
        '--metric-accent': color,
        minHeight: 205,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="metric-top">
        <span className="metric-icon bmi-icon" style={{ color }}><Icon name="bmi" size={16} /></span>
        <span className="metric-label">{text.bmi}</span>
        <Link
          to="/registro"
          style={{
            marginLeft: 'auto',
            fontSize: '8.5px',
            color: '#54d7ee',
            textDecoration: 'none',
            border: '1px solid rgba(84,215,238,0.3)',
            borderRadius: 4,
            padding: '2px 8px',
            fontFamily: 'var(--mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(84,215,238,0.06)',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          title={language === 'en' ? 'Register or update weight and height' : 'Registrar o actualizar peso y talla'}
        >
          <span>{hasReal ? (language === 'en' ? 'Update' : 'Actualizar') : (language === 'en' ? '+ Register' : '+ Registrar')}</span>
        </Link>
      </div>

      <div className="metric-value">
        <strong style={{ color }}>{bmiFormatted}</strong>
        <span>{language === 'en' ? ' BMI' : ' IMC'}</span>
        {activeRecord?.weight && activeRecord?.heightCm ? (
          <span style={{ fontSize: '9px', color: '#88a6bd', fontFamily: 'var(--mono)', marginLeft: 8 }}>
            ({activeRecord.weight} kg · {activeRecord.heightCm} cm)
          </span>
        ) : null}
      </div>

      <div className="metric-bottom">
        <span className="metric-status good" style={{ '--dot': color }}>
          <i style={{ background: color }} />
          {label} {!hasReal ? (language === 'en' ? '· Reference' : '· Referencia') : ''}
        </span>
        <span className="metric-context">
          {hasReal
            ? (language === 'en'
                ? `Physical check-in · ${formatDate(activeRecord.date, { day: '2-digit', month: 'short' })}`
                : `Chequeo físico · ${formatDate(activeRecord.date, { day: '2-digit', month: 'short' })}`)
            : (language === 'en' ? 'Calculated from weight and height' : 'Calculado de peso y talla')}
        </span>
      </div>

      <div className="bmi-scale" aria-label={language === 'en' ? 'BMI scale' : 'Escala de IMC'} style={{ marginTop: 'auto' }}>
        <div className="scale-bar" style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, height: 6, background: 'rgba(255,255,255,0.08)' }}>
          {/* Tramos de colores sutiles de la escala OMS */}
          <div style={{ position: 'absolute', left: 0, width: '14%', height: '100%', background: '#65a9ff', opacity: 0.55 }} title="Bajo (<18.5)" />
          <div style={{ position: 'absolute', left: '14%', width: '26%', height: '100%', background: '#49ddb2', opacity: 0.55 }} title="Normal (18.5 - 24.9)" />
          <div style={{ position: 'absolute', left: '40%', width: '20%', height: '100%', background: '#f5c842', opacity: 0.55 }} title="Sobrepeso (25 - 29.9)" />
          <div style={{ position: 'absolute', left: '60%', width: '40%', height: '100%', background: '#f07c3e', opacity: 0.55 }} title="Obesidad (≥30)" />
          {/* Indicador con brillo */}
          <span
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 10px ${color}, 0 0 3px #fff`,
              border: '2px solid #06111f',
              zIndex: 3,
              transition: 'left 0.3s ease',
            }}
          />
        </div>
        <div className="scale-labels">
          <span style={{ color: '#65a9ff' }}>{text.low} &lt;18.5</span>
          <span style={{ color: '#49ddb2' }}>{text.reference} 18.5–24.9</span>
          <span style={{ color: '#f5c842' }}>{text.high} &ge;25</span>
        </div>
      </div>
    </article>
  );
}

// ── Notificaciones del agente simuladas ──────────────────────────────────────
const SIMULATED_ALERTS = [
  { id: 'a1', severity: 'info', title: 'Tendencia estable', message: 'Tu frecuencia cardíaca en reposo ha disminuido 3 bpm esta semana. Excelente progreso.', delay: 3500 },
  { id: 'a2', severity: 'warn', title: 'Estrés moderado', message: 'Nivel de estrés moderado detectado en las últimas 48 h. Considera una sesión de respiración guiada.', delay: 8000 },
  { id: 'a3', severity: 'ok', title: 'Telemetría BLE estable', message: 'Todos los sensores en línea. Frecuencia cardíaca sincronizada en tiempo real.', delay: 14000 },
  { id: 'a4', severity: 'info', title: 'Pico ARED detectado', message: 'BPM elevado (142 bpm) durante ejercicio ARED. Dentro del rango esperado para actividad física.', delay: 20000 },
];

export default function Dashboard() {
  const { language } = useLanguage();
  const text = copy[language].dashboard;
  const [records, setRecords] = useState(() => getCurrentRecords());
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [simAlerts, setSimAlerts] = useState([]);

  // Refrescar registros y notificaciones cuando se cargue la nube o cambie el almacenamiento
  useEffect(() => {
    const refresh = () => {
      setRecords(getCurrentRecords());
      try { setNotifications(JSON.parse(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]')); } catch { setNotifications([]); }
    };
    window.addEventListener('airstark-cloud-data-loaded', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('airstark-cloud-data-loaded', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Notificaciones simuladas del agente (progresivas)
  useEffect(() => {
    const timers = SIMULATED_ALERTS.map((alert) =>
      setTimeout(() => setSimAlerts((prev) => [...prev.filter((x) => x.id !== alert.id), alert]), alert.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const activity = useMemo(() => getSavedRecords().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), []);
  const latest = records[0] || null;
  const hasRealRecords = records.some((r) => r.source !== 'demo');

  // Combinar notificaciones reales + simuladas
  const allNotifications = [...notifications, ...simAlerts];

  return (
    <>
      <PageHeading
        eyebrow={text.eyebrow}
        title={<>{text.title} <span>{text.accent}</span></>}
        description={text.description}
        action={<div className="date-card"><span className="date-icon"><Icon name="clock" size={17} /></span><div><small>{text.date}</small><strong>{formatDate(new Date(), { year: 'numeric' }, language === 'en' ? 'en-US' : 'es-PE').toUpperCase()}</strong></div></div>}
      />

      <div className="status-banner">
        <div className="status-icon"><Icon name="sparkles" size={17} /></div>
        <div className="status-copy">
          <strong>{hasRealRecords ? text.realTitle : text.demoTitle}</strong>
          <span>{hasRealRecords ? text.realText : text.demoText}</span>
        </div>
        {!hasRealRecords && <span className="demo-tag"><i /> {text.mock}</span>}
      </div>

      {/* ── 3 Métricas principales (con exploración interactiva en Ritmo Cardíaco) ── */}
      <section className="metrics-section">
        <div className="section-heading">
          <div><span className="section-kicker">{text.quick}</span><h2>{text.metrics}</h2></div>
          <span className="updated-label"><span className="live-dot" />{hasRealRecords ? text.latest : text.sample}</span>
        </div>
        <div className="metrics-grid">

          {/* 1. Ritmo Cardíaco Interactivo (Desplazamiento horizontal por historial) */}
          <InteractiveHeartCard
            records={records}
            hasRealRecords={hasRealRecords}
            text={text}
            language={language}
          />

          {/* 2. IMC Interactivo (Muestra registro más reciente con peso y talla) */}
          <InteractiveBmiCard
            records={records}
            hasRealRecords={hasRealRecords}
            text={text}
            language={language}
          />

          {/* 3. Nivel de Estrés Interactivo */}
          <InteractiveStressCard
            records={records}
            hasRealRecords={hasRealRecords}
            text={text}
            language={language}
          />

        </div>
      </section>

      {/* ── Actividad de Misión + Notificaciones del Agente IA ── */}
      <section className="dashboard-bottom-grid" style={{ marginTop: 18 }}>

        {/* Actividad reciente */}
        <article className="panel dashboard-activity-panel">
          <span className="section-kicker">{text.activityEyebrow}</span>
          <h2>{text.activityTitle}</h2>
          {activity.length
            ? <div className="mission-activity-list">
                {activity.map((r, i) => (
                  <div className="mission-activity-item" key={`${r.date}-${i}`}>
                    <span className={`activity-marker ${r.source === 'csv' ? 'csv' : 'manual'}`}><Icon name={r.source === 'csv' ? 'watch' : 'plus'} size={13} /></span>
                    <span className="activity-copy">
                      <strong>{r.source === 'csv' ? text.csvEvent : text.manualEvent}</strong>
                      <small>{formatDate(r.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</small>
                    </span>
                    <span className="activity-reading" style={{ color: r.heartRate ? bpmColor(r.heartRate) : '#7794ab' }}>
                      {r.heartRate ? `${r.heartRate} bpm` : r.bmi ? `IMC ${Number(r.bmi).toFixed(1)}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            : <p className="dashboard-empty-copy">{text.activityEmpty}</p>}
        </article>

        {/* Notificaciones (reales + agente simuladas) */}
        <article className="panel dashboard-notifications-panel" id="notifications-panel">
          <div className="dashboard-notifications-head">
            <div>
              <span className="section-kicker">{text.notificationsEyebrow}</span>
              <h2>{text.notificationsTitle}</h2>
            </div>
            <span className="notification-bell" aria-hidden="true" style={{ position: 'relative' }}>
              <Icon name="bell" size={16} />
              {simAlerts.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#f5c842',
                  border: '1.5px solid #0a1929'
                }} />
              )}
            </span>
          </div>

          {allNotifications.length
            ? <div className="cloud-notification-list">
                {allNotifications.slice(0, 6).map((item) => {
                  const dotColor = item.severity === 'ok' ? '#49ddb2' : item.severity === 'warn' ? '#f5c842' : item.severity === 'danger' ? '#f07c3e' : '#54d7ee';
                  return (
                    <div className={`cloud-notification ${item.severity}`} key={item.id} style={{ borderLeftColor: dotColor }}>
                      <span className="notification-status-dot" style={{ background: dotColor }} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                        {item.created_at && <small>{formatDate(item.created_at, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</small>}
                      </div>
                    </div>
                  );
                })}
              </div>
            : <div className="notifications-empty">
                <span className="notification-status-dot" />
                <strong>{text.noAlerts}</strong>
                <p>{text.noAlertsHint}</p>
                <Link to="/asistente" className="notification-action">{text.copilot} <Icon name="arrowRight" size={13} /></Link>
              </div>}

          <small className="notification-disclaimer">{text.panelNotice}</small>
        </article>
      </section>
    </>
  );
}
