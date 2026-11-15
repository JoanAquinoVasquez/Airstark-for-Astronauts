import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, getCurrentRecords, getSavedRecords, localizeStress, readSmartwatchCsv, saveRecords, stressLabel } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { getAstronautProfile } from '../lib/profile.js';
import Icon from '../components/Icon.jsx';
import { insertCloudRecords } from '../lib/supabase.js';

// ── Rangos de referencia ────────────────────────────────────────────────────
const BPM_ZONES = [
  { label: 'Reposo óptimo', min: 50, max: 70, color: '#49ddb2', level: 'ok' },
  { label: 'Normal', min: 70, max: 100, color: '#65a9ff', level: 'ok' },
  { label: 'Elevado', min: 100, max: 120, color: '#f5c842', level: 'warn' },
  { label: 'Alto', min: 120, max: 180, color: '#f07c3e', level: 'danger' },
];
const STRESS_ZONES = [
  { label: 'Bajo', max: 33, color: '#49ddb2', level: 'ok' },
  { label: 'Moderado', max: 66, color: '#f5c842', level: 'warn' },
  { label: 'Alto', max: 100, color: '#f07c3e', level: 'danger' },
];
function bpmZone(bpm) {
  return BPM_ZONES.find((z) => bpm >= z.min && bpm < z.max) || BPM_ZONES.at(-1);
}
function stressZone(score) {
  return STRESS_ZONES.find((z) => score <= z.max) || STRESS_ZONES.at(-1);
}

// ── Mini sparkline SVG ──────────────────────────────────────────────────────
function Sparkline({ values, color = '#54d7ee', height = 44, width = 160 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const area = `M${pts.join('L')}V${height}H0Z`;
  const line = `M${pts.join('L')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* último punto */}
      <circle cx={pts.at(-1).split(',')[0]} cy={pts.at(-1).split(',')[1]} r="3" fill={color} />
    </svg>
  );
}

// ── Barra de zona BPM ────────────────────────────────────────────────────────
function BpmZoneBar({ bpm }) {
  const absMin = 40, absMax = 180;
  const pct = Math.max(0, Math.min(100, ((bpm - absMin) / (absMax - absMin)) * 100));
  const zone = bpmZone(bpm);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {BPM_ZONES.map((z) => {
          const left = ((z.min - absMin) / (absMax - absMin)) * 100;
          const width = ((z.max - z.min) / (absMax - absMin)) * 100;
          return <div key={z.label} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: z.color, opacity: 0.35 }} />;
        })}
        <div style={{ position: 'absolute', left: `${pct}%`, top: -3, transform: 'translateX(-50%)', width: 13, height: 13, borderRadius: '50%', background: zone.color, border: '2px solid #0a1929', boxShadow: `0 0 8px ${zone.color}88` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 8, color: '#7794ab' }}>
        {BPM_ZONES.map((z) => <span key={z.label} style={{ color: z.level === 'ok' ? '#7794ab' : z.color }}>{z.label}</span>)}
      </div>
    </div>
  );
}

// ── Card de métrica ──────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, sub, color, children, trend }) {
  const trendIcon = trend > 0 ? '▲' : trend < 0 ? '▼' : '—';
  const trendColor = trend > 0 ? '#f07c3e' : trend < 0 ? '#49ddb2' : '#7794ab';
  return (
    <div className="hd-metric-card">
      <div className="hd-metric-header">
        <span className="hd-metric-icon" style={{ color }}><Icon name={icon} size={15} /></span>
        <span className="hd-metric-label">{label}</span>
        {trend !== undefined && <span style={{ marginLeft: 'auto', fontSize: 8, color: trendColor, fontFamily: 'var(--mono)' }}>{trendIcon} {Math.abs(trend)}</span>}
      </div>
      <div className="hd-metric-value" style={{ color }}>
        {value}<span className="hd-metric-unit">{unit}</span>
      </div>
      {sub && <div className="hd-metric-sub">{sub}</div>}
      {children}
    </div>
  );
}

// ── Notificaciones simuladas del agente ──────────────────────────────────────
const AGENT_NOTIFICATIONS = [
  { id: 1, type: 'info', icon: 'heart', msg: 'Tu frecuencia cardíaca en reposo ha disminuido 3 bpm esta semana. Excelente progreso.', delay: 4000 },
  { id: 2, type: 'warn', icon: 'brain', msg: 'Nivel de estrés moderado detectado en las últimas 48 h. Considera una sesión de respiración guiada.', delay: 9000 },
  { id: 3, type: 'ok', icon: 'activity', msg: 'Telemetría BLE estable. Todos los sensores en línea.', delay: 15000 },
  { id: 4, type: 'info', icon: 'chart', msg: 'Tendencia de BPM: ligeramente elevado en horario de ejercicio ARED (142 bpm promedio).', delay: 22000 },
];
function AgentNotifications() {
  const [visible, setVisible] = useState([]);
  useEffect(() => {
    const timers = AGENT_NOTIFICATIONS.map((n) =>
      setTimeout(() => setVisible((prev) => [...prev.filter((x) => x.id !== n.id), n]), n.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  if (!visible.length) return null;
  const colorMap = { info: '#54d7ee', warn: '#f5c842', ok: '#49ddb2', danger: '#f07c3e' };
  return (
    <div className="hd-notifications">
      <div className="hd-notif-header"><Icon name="bell" size={12} /> <span>Agente IA · Alertas recientes</span></div>
      {visible.map((n) => (
        <div key={n.id} className="hd-notif-item" style={{ borderLeftColor: colorMap[n.type] }}>
          <span style={{ color: colorMap[n.type], fontSize: 13 }}><Icon name={n.icon} size={12} /></span>
          <span>{n.msg}</span>
          <button className="hd-notif-close" onClick={() => setVisible((prev) => prev.filter((x) => x.id !== n.id))}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Historial mini-tabla ─────────────────────────────────────────────────────
function HistoryMini({ records, language }) {
  const t = copy[language]?.data || copy.es.data;
  return (
    <div className="table-scroll" style={{ maxHeight: 320 }}>
      <table>
        <thead>
          <tr>
            <th>{t.datetime}</th>
            <th>{t.heart}</th>
            <th>{t.stress}</th>
            <th>IMC</th>
            <th>{t.source}</th>
          </tr>
        </thead>
        <tbody>
          {records.slice(0, 15).map((record, index) => {
            const ns = stressLabel(record.stress);
            const chipClass = ns === 'Alto' ? 'high' : ns === 'Moderado' ? 'medium' : '';
            const zone = record.heartRate ? bpmZone(record.heartRate) : null;
            return (
              <tr key={`${record.date}-${index}`}>
                <td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</td>
                <td>
                  {record.heartRate
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <strong>{record.heartRate}</strong><span style={{ color: '#7794ab', fontSize: 8 }}>bpm</span>
                        {zone && <span style={{ width: 6, height: 6, borderRadius: '50%', background: zone.color, display: 'inline-block', flexShrink: 0 }} title={zone.label} />}
                      </span>
                    : '—'}
                </td>
                <td><span className={`status-chip ${chipClass}`}>{localizeStress(record.stress, language, record.stressScore)}</span></td>
                <td style={{ color: '#a0b8cc' }}>{record.bmi ? Number(record.bmi).toFixed(1) : '—'}</td>
                <td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? t.mock : record.source === 'csv' ? 'CSV' : t.manual}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function HealthData() {
  const { language } = useLanguage();
  const t = copy[language].data;
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const records = useMemo(() => getCurrentRecords(), [version]);

  // Métricas derivadas
  const bpmValues = records.filter((r) => r.heartRate).map((r) => r.heartRate);
  const latestBpm = bpmValues[0] ?? null;
  const avgBpm = bpmValues.length ? Math.round(bpmValues.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(bpmValues.length, 10)) : null;
  const bpmTrend = bpmValues.length >= 2 ? bpmValues[0] - bpmValues[1] : undefined;

  const stressValues = records.filter((r) => r.stressScore != null).map((r) => r.stressScore);
  const latestStress = stressValues[0] ?? null;
  const avgStress = stressValues.length ? Math.round(stressValues.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(stressValues.length, 10)) : null;
  const stressTrend = stressValues.length >= 2 ? Math.round(stressValues[0] - stressValues[1]) : undefined;

  const latestRecord = records[0];
  const latestBmi = records.find((r) => r.bmi)?.bmi;

  const bpmZoneCurrent = latestBpm ? bpmZone(latestBpm) : null;
  const stressZoneCurrent = latestStress != null ? stressZone(latestStress) : null;

  // Sparkline últimos 20 bpm
  const sparkBpm = bpmValues.slice(0, 20).reverse();
  const sparkStress = stressValues.slice(0, 20).reverse();

  async function importFile(file) {
    setMessage(''); setError(false);
    try {
      const result = await readSmartwatchCsv(file);
      const astronautId = getAstronautProfile().crewId;
      result.records = result.records.map((record) => ({ ...record, astronautId }));
      const otherRecords = getSavedRecords().filter((record) => record.sourceFile !== file.name);
      saveRecords([...otherRecords, ...result.records]);
      await insertCloudRecords(result.records, astronautId);
      setVersion((value) => value + 1);
      const skipped = result.ignoredZeroReadings ? ` ${result.ignoredZeroReadings} ${t.skipped}` : '';
      setMessage(`${result.records.length} ${t.imported} ${file.name}.${skipped}`);
    } catch (reason) {
      const errorText = reason.message || '';
      const translatedError = language === 'en'
        ? (errorText.includes('10 MB') ? t.tooLarge : errorText.includes('extensión') ? t.extension : errorText.includes('encabezados') ? t.headers : errorText.includes('columnas') ? t.columnsError : errorText.includes('filas') ? t.rowsError : t.noCsv)
        : (errorText || t.noCsv);
      setError(true); setMessage(translatedError);
    }
  }

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      {/* Notificaciones del agente */}
      <AgentNotifications />

      {/* ── Cards de métricas dinámicas ── */}
      <div className="hd-metrics-grid">
        {/* BPM */}
        <MetricCard
          icon="heart"
          label="Frecuencia cardíaca"
          value={latestBpm ?? '—'}
          unit=" bpm"
          sub={bpmZoneCurrent ? bpmZoneCurrent.label : 'Sin datos'}
          color={bpmZoneCurrent?.color ?? '#7794ab'}
          trend={bpmTrend}
        >
          <Sparkline values={sparkBpm} color={bpmZoneCurrent?.color ?? '#54d7ee'} />
          {latestBpm && <BpmZoneBar bpm={latestBpm} />}
          {avgBpm && <div style={{ marginTop: 7, fontSize: 9, color: '#7794ab' }}>Promedio (últ. 10): <strong style={{ color: '#c8dded' }}>{avgBpm} bpm</strong></div>}
        </MetricCard>

        {/* Estrés */}
        <MetricCard
          icon="brain"
          label="Nivel de estrés"
          value={latestStress != null ? `${latestStress}%` : '—'}
          unit=""
          sub={stressZoneCurrent ? stressZoneCurrent.label : 'Sin datos'}
          color={stressZoneCurrent?.color ?? '#7794ab'}
          trend={stressTrend}
        >
          <Sparkline values={sparkStress} color={stressZoneCurrent?.color ?? '#f5c842'} />
          {latestStress != null && (
            <div style={{ marginTop: 10 }}>
              <div style={{ position: 'relative', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {STRESS_ZONES.map((z, i) => {
                  const prev = i === 0 ? 0 : STRESS_ZONES[i - 1].max;
                  const left = (prev / 100) * 100;
                  const width = ((z.max - prev) / 100) * 100;
                  return <div key={z.label} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: z.color, opacity: 0.35 }} />;
                })}
                <div style={{ position: 'absolute', left: `${latestStress}%`, top: -3, transform: 'translateX(-50%)', width: 13, height: 13, borderRadius: '50%', background: stressZoneCurrent.color, border: '2px solid #0a1929', boxShadow: `0 0 8px ${stressZoneCurrent.color}88` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 8, color: '#7794ab' }}>
                {STRESS_ZONES.map((z) => <span key={z.label} style={{ color: z.color }}>{z.label}</span>)}
              </div>
            </div>
          )}
          {avgStress != null && <div style={{ marginTop: 7, fontSize: 9, color: '#7794ab' }}>Promedio (últ. 10): <strong style={{ color: '#c8dded' }}>{avgStress}%</strong></div>}
        </MetricCard>

        {/* IMC */}
        <MetricCard
          icon="activity"
          label="IMC"
          value={latestBmi ? Number(latestBmi).toFixed(1) : '—'}
          unit=" kg/m²"
          sub={latestBmi ? (latestBmi < 18.5 ? 'Bajo peso' : latestBmi < 25 ? 'Normal' : latestBmi < 30 ? 'Sobrepeso' : 'Obesidad') : 'Sin datos'}
          color={latestBmi ? (latestBmi >= 18.5 && latestBmi < 25 ? '#49ddb2' : latestBmi < 30 ? '#f5c842' : '#f07c3e') : '#7794ab'}
        >
          {latestRecord?.weight && <div style={{ marginTop: 10, fontSize: 9, color: '#7794ab', display: 'flex', gap: 14 }}>
            <span>Peso: <strong style={{ color: '#c8dded' }}>{latestRecord.weight} kg</strong></span>
            {latestRecord.heightCm && <span>Talla: <strong style={{ color: '#c8dded' }}>{latestRecord.heightCm} cm</strong></span>}
          </div>}
        </MetricCard>

        {/* Resumen de registros */}
        <div className="hd-metric-card">
          <div className="hd-metric-header">
            <span className="hd-metric-icon" style={{ color: '#65a9ff' }}><Icon name="database" size={15} /></span>
            <span className="hd-metric-label">Registros totales</span>
          </div>
          <div className="hd-metric-value" style={{ color: '#65a9ff' }}>{getSavedRecords().length}<span className="hd-metric-unit"> propios</span></div>
          <div className="hd-metric-sub">+ {records.length - getSavedRecords().length} demo</div>
          <div className="data-source-list" style={{ marginTop: 10 }}>
            <span><i className="source-dot mock" /> {t.mockSource}</span>
            <span><i className="source-dot csv" /> {t.csvSource}</span>
            <span><i className="source-dot manual" /> {t.manualSource}</span>
          </div>
        </div>
      </div>

      {/* ── Importar CSV ── */}
      <section className="data-import-layout" style={{ marginTop: 14 }}>
        <article className="panel data-import-panel">
          <div className="panel-heading"><div><span className="section-kicker">{t.import}</span><h2>{t.add}</h2></div><span className="watch-icon"><Icon name="watch" size={17} /></span></div>
          <p className="panel-description">{t.compatible}</p>
          <div className={`upload-box${dragging ? ' dragover' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); importFile(event.dataTransfer.files[0]); }}>
            <div className="upload-icon"><Icon name="upload" size={17} /></div>
            <strong>{t.drop}</strong><span>{t.or}</span>
            <label className="file-button" htmlFor="csvInput">{t.select}</label>
            <input type="file" id="csvInput" accept=".csv,text/csv" onChange={(event) => { importFile(event.target.files[0]); event.target.value = ''; }} />
            <small>{t.max}</small>
          </div>
          <div className="csv-info"><span className="info-icon"><Icon name="info" size={13} /></span><span>{t.columns} <code>bpm</code>, <code>timestamp_iso</code>, {language === 'en' ? 'BMI and stress level' : 'IMC y nivel de estrés'}. {t.zero}</span></div>
          {message && <div className={`csv-message${error ? ' error' : ''}`} role="status">{message}</div>}
        </article>

        {/* Leyenda de zonas BPM */}
        <article className="panel data-summary-panel" style={{ padding: '16px 18px' }}>
          <span className="section-kicker">Referencia</span>
          <h2 style={{ marginBottom: 14 }}>Zonas de frecuencia cardíaca</h2>
          <div style={{ display: 'grid', gap: 9 }}>
            {BPM_ZONES.map((z) => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#c0d2e0', flex: 1 }}>{z.label}</span>
                <span style={{ fontSize: 9, color: '#7794ab', fontFamily: 'var(--mono)' }}>{z.min}–{z.max} bpm</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <span className="section-kicker">Estrés</span>
            <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
              {STRESS_ZONES.map((z, i) => {
                const prevMax = i === 0 ? 0 : STRESS_ZONES[i - 1].max;
                return (
                  <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#c0d2e0', flex: 1 }}>{z.label}</span>
                    <span style={{ fontSize: 9, color: '#7794ab', fontFamily: 'var(--mono)' }}>{prevMax}–{z.max}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      {/* ── Historial reciente ── */}
      <section className="panel recent-readings-panel" style={{ marginTop: 14 }}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">{t.recent}</span>
            <h2>{t.last}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {bpmZoneCurrent && <span style={{ fontSize: 9, color: bpmZoneCurrent.color, border: `1px solid ${bpmZoneCurrent.color}55`, borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--mono)' }}>⬤ {bpmZoneCurrent.label}</span>}
          </div>
        </div>
        <HistoryMini records={records} language={language} />
      </section>
    </>
  );
}
