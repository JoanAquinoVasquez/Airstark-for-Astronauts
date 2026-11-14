import { exportRecords, formatDate, getCurrentRecords, getSavedRecords, stressLabel } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';

export default function History() {
  const { language } = useLanguage();
  const t = copy[language].history;
  const records = getCurrentRecords();
  const saved = getSavedRecords();
  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} action={<button className="export-button" type="button" disabled={!saved.length} onClick={() => exportRecords(saved)}>{saved.length ? t.export : t.noData}</button>} />
    <section className="panel history-panel history-page-panel"><div className="table-scroll"><table><thead><tr><th>{t.datetime}</th><th>{t.heart}</th><th>{t.pressure}</th><th>{t.glucose}</th><th>{t.bmi}</th><th>{t.stress}</th><th>{t.source}</th></tr></thead><tbody>{records.map((record, index) => { const normalizedStress = stressLabel(record.stress); const localizedStress = language === 'en' ? ({ Bajo: 'Low', Moderado: 'Moderate', Alto: 'High' }[normalizedStress] || record.stress || '—') : normalizedStress; return <tr key={`${record.date}-${index}`}><td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</td><td>{record.heartRate ? `${record.heartRate} bpm` : '—'}</td><td>{record.pressure || '—'}</td><td>{record.glucose ? `${record.glucose} mg/dL` : '—'}</td><td>{record.bmi ? Number(record.bmi).toFixed(1) : '—'}</td><td><span className={`status-chip ${normalizedStress === 'Alto' ? 'high' : normalizedStress === 'Moderado' ? 'medium' : ''}`}>{localizedStress}</span></td><td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? t.mock : record.source === 'csv' ? t.csv : t.manual}</span></td></tr>; })}</tbody></table></div>{records.length === 0 && <div className="empty-history">{t.empty}</div>}</section>
    <p className="integration-note">{t.note}</p>
  </>;
}
