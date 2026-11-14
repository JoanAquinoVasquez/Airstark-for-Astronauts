import { ModuleState, PageHeading } from '../components/ui.jsx';

export default function LiveMonitor() {
  return <>
    <PageHeading eyebrow="TELEMETRÍA BLUETOOTH" title="Monitor en vivo" description="Vista dedicada para las lecturas instantáneas del smartwatch." action={<ModuleState />} />
    <section className="mission-module panel" id="monitor-en-vivo">
      <div className="module-heading"><div><span className="section-kicker">MÓDULO DEL EQUIPO</span><h2>Monitor de frecuencia cardíaca</h2><p>Señal, intervalos RR y estadísticas de sesión aparecerán cuando se conecte el módulo Bluetooth.</p></div><ModuleState /></div>
      <div className="module-mount live-module-mount" id="airstark-live-monitor-root" data-airstark-module="live-monitor" aria-label="Espacio de integración para el módulo de datos en vivo del reloj">
        <div className="live-module-sidebar">
          <div className="live-module-card live-heart-card"><span className="live-placeholder-status"><i /> SIN SEÑAL EN VIVO</span><div className="live-placeholder-value">— <small>BPM</small></div><p>El ritmo cardíaco aparecerá aquí cuando el módulo Bluetooth se conecte al reloj.</p><div className="live-divider" /><span className="live-module-label">FUENTE DE TELEMETRÍA</span><div className="live-module-row"><span>Dispositivo</span><strong>Pendiente</strong></div><div className="live-module-row"><span>Sensor</span><strong>Muñeca</strong></div></div>
          <div className="live-module-card live-stats-card"><span className="live-module-label">ESTADÍSTICAS DE SESIÓN</span><div className="live-stat-grid"><div><small>Muestras</small><strong>—</strong></div><div><small>Promedio</small><strong>— <small>bpm</small></strong></div><div><small>HRV · RMSSD</small><strong>— <small>ms</small></strong></div><div><small>Intervalo RR</small><strong>— <small>ms</small></strong></div></div></div>
        </div>
        <div className="live-module-charts"><article className="live-module-card live-chart-card"><div className="live-chart-title"><div><strong>Osciloscopio de pulso cardíaco</strong><small>La señal del sensor aparecerá en este panel.</small></div><span>ESPERANDO DATOS</span></div><div className="live-chart-canvas"><div className="live-chart-placeholder"><span className="pulse-mark">⌁</span><span>Sin lecturas recibidas</span></div></div></article><article className="live-module-card live-chart-card"><div className="live-chart-title"><div><strong>Frecuencia cardíaca · últimas muestras</strong><small>Serie temporal recibida del reloj.</small></div><span>— BPM</span></div><div className="live-chart-canvas trend-placeholder"><div className="chart-gridlines"><i /><i /><i /><i /></div><div className="live-chart-placeholder"><span>Gráfica pendiente de telemetría</span></div></div></article></div>
      </div>
    </section>
    <p className="integration-note">Este módulo todavía no está conectado al reloj; esta pantalla queda como punto de montaje para el componente Bluetooth del equipo.</p>
  </>;
}
