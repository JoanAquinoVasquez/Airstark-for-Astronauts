import { useMemo, useState } from 'react';
import { formatDate, getCurrentRecords, getSavedRecords, localizeStress, readSmartwatchCsv, saveRecords } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';

export default function HealthData() {
  const { language } = useLanguage();
  const t = copy[language].data;
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const records = useMemo(() => getCurrentRecords(), [version]);

  async function importFile(file) {
    setMessage(''); setError(false);
    try {
      const result = await readSmartwatchCsv(file);
      const otherRecords = getSavedRecords().filter((record) => record.sourceFile !== file.name);
      saveRecords([...otherRecords, ...result.records]);
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

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <section className="data-import-layout">
      <article className="panel data-import-panel"><div className="panel-heading"><div><span className="section-kicker">{t.import}</span><h2>{t.add}</h2></div><span className="watch-icon">⌚</span></div><p className="panel-description">{t.compatible}</p>
        <div className={`upload-box${dragging ? ' dragover' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); importFile(event.dataTransfer.files[0]); }}><div className="upload-icon">↑</div><strong>{t.drop}</strong><span>{t.or}</span><label className="file-button" htmlFor="csvInput">{t.select}</label><input type="file" id="csvInput" accept=".csv,text/csv" onChange={(event) => { importFile(event.target.files[0]); event.target.value = ''; }} /><small>{t.max}</small></div>
        <div className="csv-info"><span className="info-icon">i</span><span>{t.columns} <code>bpm</code>, <code>timestamp_iso</code>, {language === 'en' ? 'BMI and stress level' : 'IMC y nivel de estrés'}. {t.zero}</span></div>
        {message && <div className={`csv-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </article>
      <article className="panel data-summary-panel"><span className="section-kicker">{t.summary}</span><h2>{t.available}</h2><div className="data-summary-number">{getSavedRecords().length}<small>{t.own}</small></div><p>{t.saved}</p><div className="data-source-list"><span><i className="source-dot mock" /> {t.mockSource}</span><span><i className="source-dot csv" /> {t.csvSource}</span><span><i className="source-dot manual" /> {t.manualSource}</span></div></article>
    </section>
    <section className="panel recent-readings-panel"><div className="panel-heading"><div><span className="section-kicker">{t.recent}</span><h2>{t.last}</h2></div></div><div className="table-scroll"><table><thead><tr><th>{t.datetime}</th><th>{t.heart}</th><th>{t.bmi}</th><th>{t.stress}</th><th>{t.source}</th></tr></thead><tbody>{records.slice(0, 8).map((record, index) => <tr key={`${record.date}-${index}`}><td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</td><td>{record.heartRate ? `${record.heartRate} bpm` : '—'}</td><td>{record.bmi ?? '—'}</td><td>{localizeStress(record.stress, language)}</td><td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? t.mock : record.source === 'csv' ? 'CSV' : t.manual}</span></td></tr>)}</tbody></table></div></section>
  </>;
}
