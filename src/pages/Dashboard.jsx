import { formatDate, getLatestRecord, stressLabel } from '../lib/health.js';
import { MetricCard, PageHeading, QuickLink } from '../components/ui.jsx';

export default function Dashboard() {
  const latest = getLatestRecord();
  const source = latest?.source === 'demo' ? 'Datos de demostración' : 'Última medición guardada';
  return <>
    <PageHeading eyebrow="SISTEMA DE MONITOREO DE TRIPULACIÓN" title={<>Tu salud, <span>en órbita.</span></>} description="Accede a cada herramienta desde su propia ventana de misión." action={<div className="date-card"><span className="date-icon">◷</span><div><small>FECHA LOCAL</small><strong>{formatDate(new Date(), { year: 'numeric' }).toUpperCase()}</strong></div></div>} />
    <div className="status-banner"><div className="status-icon">✦</div><div className="status-copy"><strong>Resumen de salud</strong><span>Las métricas son simuladas hasta cargar datos del reloj o completar un registro.</span></div><span className="demo-tag"><i /> DATOS MOCK</span></div>
    <section className="metrics-section"><div className="section-heading"><div><span className="section-kicker">LECTURA MÁS RECIENTE</span><h2>Indicadores principales</h2></div><span className="updated-label"><span className="live-dot" />{source}</span></div>
      <div className="metrics-grid">
        <MetricCard icon="♡" label="RITMO CARDÍACO" value={latest?.heartRate ?? '—'} unit="bpm" detail="Frecuencia cardíaca" />
        <MetricCard icon="↗" label="ÍNDICE DE MASA CORPORAL" value={latest?.bmi ? Number(latest.bmi).toFixed(1) : '—'} unit="IMC" detail="Calculado desde peso y estatura" tone="blue" />
        <MetricCard icon="⌁" label="NIVEL DE ESTRÉS" value={stressLabel(latest?.stress)} detail="Autorreporte o dato del reloj" tone="green" />
      </div>
    </section>
    <section className="quick-links-section"><div className="section-heading"><div><span className="section-kicker">ACCESO RÁPIDO</span><h2>¿Qué necesitas hacer?</h2></div></div><div className="quick-links-grid">
      <QuickLink to="/monitor" icon="⌁" title="Monitor en vivo" description="Señal cardíaca y telemetría Bluetooth" />
      <QuickLink to="/gemelo-3d" icon="◇" title="Gemelo digital 3D" description="Visor volumétrico de salud" />
      <QuickLink to="/datos" icon="⌚" title="Datos del reloj" description="Importa una exportación CSV" />
      <QuickLink to="/registro" icon="＋" title="Registrar medición" description="Completa tu check-in de salud" />
      <QuickLink to="/asistente" icon="✧" title="Hablar con Copilot" description="Pregunta sobre tus indicadores" />
      <Link className="quick-link-card quick-link-history" to="/historial"><span className="quick-link-icon">◷</span><span className="quick-link-copy"><strong>Ver historial</strong><small>Consulta y exporta registros</small></span><span className="quick-link-arrow">→</span></Link>
    </div></section>
  </>;
}
