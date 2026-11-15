import { useState, useEffect } from 'react';
import { exportRecords, formatDate, getCurrentRecords, getSavedRecords, localizeStress, stressLabel } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';

export default function History() {
  const { language } = useLanguage();
  const t = copy[language].history;
  const [records, setRecords] = useState(getCurrentRecords);
  const [saved, setSaved] = useState(getSavedRecords);

  useEffect(() => {
    const refresh = () => {
      setRecords(getCurrentRecords());
      setSaved(getSavedRecords());
    };
    window.addEventListener('airstark-cloud-data-loaded', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('airstark-cardio-updated', refresh);
    return () => {
      window.removeEventListener('airstark-cloud-data-loaded', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('airstark-cardio-updated', refresh);
    };
  }, []);

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} action={<button className="export-button" type="button" disabled={!saved.length} onClick={() => exportRecords(saved)}>{saved.length ? t.export : t.noData}</button>} />
    <section className="panel history-panel history-page-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.datetime}</th>
              <th>{t.heart}</th>
              <th>{t.pressure}</th>
              <th>{t.glucose}</th>
              <th>{language === 'en' ? 'WEIGHT / HEIGHT' : 'PESO / TALLA'}</th>
              <th>{t.bmi}</th>
              {/* <th>{language === 'en' ? 'BODY FAT' : 'GRASA'}</th> */}
              <th>{t.stress}</th>
              <th>{t.source}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => {
              const ns = stressLabel(record.stress);
              const chipClass = ns === 'Alto' ? 'high' : ns === 'Moderado' ? 'medium' : '';
              const weightStr = record.weight ? `${record.weight} kg` : '';
              const heightStr = record.heightCm ? `${record.heightCm} cm` : '';
              const physical = [weightStr, heightStr].filter(Boolean).join(' · ') || '—';
              return (
                <tr key={`${record.date}-${index}`}>
                  <td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</td>
                  <td>{record.heartRate ? <strong>{record.heartRate} bpm</strong> : '—'}</td>
                  <td>{record.pressure || '—'}</td>
                  <td>{record.glucose ? `${record.glucose} mg/dL` : '—'}</td>
                  <td>{physical}</td>
                  <td>{record.bmi ? Number(record.bmi).toFixed(1) : '—'}</td>
                  {/* <td>{record.bodyFat ? `${record.bodyFat}%` : '—'}</td> */}
                  <td><span className={`status-chip ${chipClass}`}>{localizeStress(record.stress, language, record.stressScore)}</span></td>
                  <td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? t.mock : record.source === 'csv' ? t.csv : t.manual}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {records.length === 0 && <div className="empty-history">{t.empty}</div>}
    </section>
    <p className="integration-note">{t.note}</p>
  </>;
}
