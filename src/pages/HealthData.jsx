import { useMemo, useState } from 'react';
import { formatDate, getCurrentRecords, getSavedRecords, readSmartwatchCsv, saveRecords } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';

export default function HealthData() {
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
      const skipped = result.ignoredZeroReadings ? ` Se omitieron ${result.ignoredZeroReadings} lecturas de 0 bpm.` : '';
      setMessage(`${result.records.length} lecturas importadas desde ${file.name}.${skipped}`);
    } catch (reason) { setError(true); setMessage(reason.message || 'No se pudo leer el CSV.'); }
  }

  return <>
    <PageHeading eyebrow="SINCRONIZACIÓN DEL RELOJ" title="Datos del smartwatch" description="Carga una exportación CSV para añadir lecturas al historial local." />
    <section className="data-import-layout">
      <article className="panel data-import-panel"><div className="panel-heading"><div><span className="section-kicker">IMPORTACIÓN CSV</span><h2>Agregar lecturas</h2></div><span className="watch-icon">⌚</span></div><p className="panel-description">Compatible con la exportación del Samsung Galaxy Watch: marcas de tiempo y ritmo cardíaco en BPM.</p>
        <div className={`upload-box${dragging ? ' dragover' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); importFile(event.dataTransfer.files[0]); }}><div className="upload-icon">↑</div><strong>Arrastra tu archivo aquí</strong><span>o selecciónalo desde tu dispositivo</span><label className="file-button" htmlFor="csvInput">Seleccionar archivo CSV</label><input type="file" id="csvInput" accept=".csv,text/csv" onChange={(event) => { importFile(event.target.files[0]); event.target.value = ''; }} /><small>CSV · máx. 10 MB</small></div>
        <div className="csv-info"><span className="info-icon">i</span><span>Columnas reconocidas: <code>bpm</code>, <code>timestamp_iso</code>, IMC y nivel de estrés. Las lecturas de 0 bpm se omiten.</span></div>
        {message && <div className={`csv-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </article>
      <article className="panel data-summary-panel"><span className="section-kicker">RESUMEN LOCAL</span><h2>Lecturas disponibles</h2><div className="data-summary-number">{getSavedRecords().length}<small>registros propios</small></div><p>Los registros se guardan en este navegador. Al usar Copilot, las últimas siete lecturas se incluyen en el contexto enviado al agente.</p><div className="data-source-list"><span><i className="source-dot mock" /> Datos mock: se distinguen de lecturas reales</span><span><i className="source-dot csv" /> CSV: importación local del archivo</span><span><i className="source-dot manual" /> Manual: formulario de salud</span></div></article>
    </section>
    <section className="panel recent-readings-panel"><div className="panel-heading"><div><span className="section-kicker">LECTURAS RECIENTES</span><h2>Últimas mediciones</h2></div></div><div className="table-scroll"><table><thead><tr><th>FECHA / HORA</th><th>RITMO CARDÍACO</th><th>IMC</th><th>ESTRÉS</th><th>ORIGEN</th></tr></thead><tbody>{records.slice(0, 8).map((record, index) => <tr key={`${record.date}-${index}`}><td>{formatDate(record.date, { hour: '2-digit', minute: '2-digit', hour12: false })}</td><td>{record.heartRate ? `${record.heartRate} bpm` : '—'}</td><td>{record.bmi ?? '—'}</td><td>{record.stress ?? '—'}</td><td><span className={`source-pill ${record.source}`}>{record.source === 'demo' ? 'MOCK' : record.source === 'csv' ? 'CSV' : 'MANUAL'}</span></td></tr>)}</tbody></table></div></section>
  </>;
}
