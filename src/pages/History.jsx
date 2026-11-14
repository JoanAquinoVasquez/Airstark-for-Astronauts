import { exportRecords, formatDate, getCurrentRecords, getSavedRecords, stressLabel } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';

export default function History() {
  const records = getCurrentRecords();
  const saved = getSavedRecords();
  return <>
    <PageHeading eyebrow="ACTIVIDAD DE LA TRIPULACIÓN" title="Historial de mediciones" description="Registros locales y datos de muestra en una sola vista." action={<button className="export-button" type="button" disabled={!saved.length} onClick={() => exportRecords(saved)}>{saved.length ? '↓ Exportar CSV' : 'Sin datos propios'}</button>} />
    <section className="panel history-panel history-page-panel"><div className="table-scroll"><table><thead><tr><th>FECHA / HORA</th><th>RITMO CARDÍACO</th><th>PRESIÓN ARTERIAL</th><th>GLUCOSA</th><th>IMC</th><th>ESTRÉS</th><th>ORIGEN</th></tr></thead><tbody>{records.map((record, index) => <tr key={`${record.date}-${index}`}><td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false })}</td><td>{record.heartRate ? `${record.heartRate} bpm` : '—'}</td><td>{record.pressure || '—'}</td><td>{record.glucose ? `${record.glucose} mg/dL` : '—'}</td><td>{record.bmi ? Number(record.bmi).toFixed(1) : '—'}</td><td><span className={`status-chip ${stressLabel(record.stress) === 'Alto' ? 'high' : stressLabel(record.stress) === 'Moderado' ? 'medium' : ''}`}>{stressLabel(record.stress)}</span></td><td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? 'MOCK' : record.source === 'csv' ? 'CSV' : 'MANUAL'}</span></td></tr>)}</tbody></table></div>{records.length === 0 && <div className="empty-history">Aún no hay mediciones guardadas.</div>}</section>
    <p className="integration-note">Los registros mock se muestran como referencia. El archivo exportado incluye solo los registros guardados por el astronauta.</p>
  </>;
}
