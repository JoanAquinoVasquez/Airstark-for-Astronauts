import { useMemo } from 'react';
import { formatDate, getCurrentRecords, getLatestRecord, stressLabel } from '../lib/health.js';
import { MetricCard, PageHeading } from '../components/ui.jsx';

function HeartRateTrend({ records }) {
  const samples = useMemo(() => records.filter((record) => Number.isFinite(Number(record.heartRate)) && Number(record.heartRate) > 0).slice(0, 7).reverse(), [records]);
  if (!samples.length) return <div className="dashboard-chart-empty">Aún no hay mediciones de frecuencia cardíaca.</div>;
  const values = samples.map((record) => Number(record.heartRate));
  const points = values.map((value, index) => `${samples.length === 1 ? 460 : 24 + (index / (samples.length - 1)) * 912},${135 - ((value - 40) / 100) * 106}`).join(' ');
  const area = `24,135 ${points} 936,135`;
  return <div className="dashboard-trend-graph">
    <div className="trend-axis-labels"><span>140</span><span>110</span><span>80</span><span>50</span></div>
    <svg viewBox="0 0 960 160" preserveAspectRatio="none" role="img" aria-label="Gráfico de frecuencia cardíaca de los últimos siete registros">
      <defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#47c9dc" stopOpacity=".27"/><stop offset="100%" stopColor="#47c9dc" stopOpacity="0"/></linearGradient></defs>
      {[28, 64, 99, 135].map((y) => <line key={y} x1="24" x2="936" y1={y} y2={y} className="trend-grid-line" />)}
      <polygon points={area} fill="url(#trendFill)" />
      <polyline points={points} className="trend-chart-line" />
      {samples.map((record, index) => <circle key={`${record.date}-${index}`} cx={samples.length === 1 ? 460 : 24 + (index / (samples.length - 1)) * 912} cy={135 - ((Number(record.heartRate) - 40) / 100) * 106} r={index === samples.length - 1 ? 4 : 2} className={index === samples.length - 1 ? 'trend-chart-point latest' : 'trend-chart-point'} />)}
    </svg>
    <div className="trend-date-labels">{samples.map((record, index) => <span key={`${record.date}-label-${index}`}>{formatDate(record.date, { day: '2-digit', month: 'short' })}</span>)}</div>
  </div>;
}

export default function Dashboard() {
  const records = useMemo(() => getCurrentRecords(), []);
  const latest = records[0] || getLatestRecord();
  const hasRealRecords = records.some((record) => record.source !== 'demo');
  const heartRate = latest?.heartRate ?? '—';
  const bmi = latest?.bmi ? Number(latest.bmi).toFixed(1) : '—';
  const stress = stressLabel(latest?.stress);
  const stressLevel = stress === 'Alto' ? 3 : stress === 'Moderado' ? 2 : 1;

  return <>
    <PageHeading eyebrow="SISTEMA DE MONITOREO DE TRIPULACIÓN" title={<>Tu salud, <span>en órbita.</span></>} description="Una lectura clara de tus indicadores para acompañarte durante la misión." action={<div className="date-card"><span className="date-icon">◷</span><div><small>REGISTRO LOCAL</small><strong>{formatDate(new Date(), { year: 'numeric' }).toUpperCase()}</strong></div></div>} />
    <div className="status-banner"><div className="status-icon">✦</div><div className="status-copy"><strong>{hasRealRecords ? 'Panel de salud' : 'Panel de demostración'}</strong><span>{hasRealRecords ? 'Aquí tienes un resumen de tus registros recientes de salud.' : 'Los valores visibles son simulados. Completa un registro de salud para ver tus indicadores.'}</span></div>{!hasRealRecords && <span className="demo-tag"><i /> DATOS MOCK</span>}</div>
    <section className="metrics-section"><div className="section-heading"><div><span className="section-kicker">LECTURA RÁPIDA</span><h2>Indicadores principales</h2></div><span className="updated-label"><span className="live-dot" />{hasRealRecords ? 'Último registro' : 'Muestra de demostración'}</span></div>
      <div className="metrics-grid">
        <MetricCard icon="♡" label="RITMO CARDÍACO" value={heartRate} unit="bpm" detail="Lectura más reciente" status={hasRealRecords ? 'Registrado' : 'Dato de muestra'} />
        <MetricCard icon="↗" label="ÍNDICE DE MASA CORPORAL" value={bmi} unit="IMC" detail="Calculado de peso y talla" tone="blue" visual="bmi" status={hasRealRecords ? 'Registrado' : 'Dato de muestra'} />
        <MetricCard icon="⌁" label="NIVEL DE ESTRÉS" value={stress} detail="Autorreporte de bienestar" tone="green" visual="stress" level={stressLevel} status={hasRealRecords ? 'Registrado' : 'Dato de muestra'} />
      </div>
    </section>
    <section className="dashboard-trend-panel panel"><div className="dashboard-trend-heading"><div><span className="section-kicker">TENDENCIA</span><h2>Frecuencia cardíaca</h2><div className="trend-current-value"><strong>{heartRate}</strong><span>bpm</span><small>{hasRealRecords ? 'ÚLTIMO REGISTRO' : 'LECTURA DE MUESTRA'}</small></div></div><span className="trend-unit">bpm · últimos registros</span></div><HeartRateTrend records={records} /></section>
  </>;
}
