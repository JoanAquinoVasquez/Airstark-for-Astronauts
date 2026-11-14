import { useState } from 'react';
import { getSavedRecords, saveRecords } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';

export default function HealthForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const height = Number(data.get('height')) / 100;
    const record = {
      date: new Date().toISOString(), heartRate: Number(data.get('heartRate')),
      pressure: String(data.get('bloodPressure')).replace(/\s/g, ''), glucose: Number(data.get('glucose')),
      weight: Number(data.get('weight')), heightCm: Number(data.get('height')),
      bmi: Number((Number(data.get('weight')) / (height * height)).toFixed(1)),
      stress: data.get('stress'), diabetes: data.get('diabetes'), notes: String(data.get('notes') || '').trim(), source: 'manual',
    };
    try {
      saveRecords([record, ...getSavedRecords()]);
      setError(false); setMessage(`Registro guardado. IMC calculado: ${record.bmi}.`); form.reset();
    } catch { setError(true); setMessage('No se pudo guardar el registro en este dispositivo.'); }
  }

  return <>
    <PageHeading eyebrow="CHECK-IN DE TRIPULACIÓN" title="Registro de salud" description="Completa la evaluación para añadir una lectura a tu historial." />
    <section className="panel form-panel health-form-panel"><div className="form-heading"><div><span className="section-kicker">NUEVA MEDICIÓN</span><h2>Indicadores y bienestar</h2><p>Los campos con asterisco son obligatorios.</p></div><div className="step-indicator"><span className="step-dot" /> REGISTRO MANUAL</div></div>
      <form id="healthForm" onSubmit={submit}>
        <div className="form-section-title"><span className="form-section-number">01</span><div><strong>Indicadores físicos</strong><small>Ingresa los datos de tus mediciones actuales.</small></div></div>
        <div className="form-grid">
          <label className="field"><span>Frecuencia cardíaca <em>*</em></span><div className="input-wrap"><input name="heartRate" type="number" min="30" max="250" placeholder="Ej. 72" required /><span className="input-unit">bpm</span></div><small>Medida por el smartwatch o manualmente.</small></label>
          <label className="field"><span>Presión arterial <em>*</em></span><div className="input-wrap"><input name="bloodPressure" type="text" inputMode="numeric" pattern="\d{2,3}\s*\/\s*\d{2,3}" placeholder="Ej. 120/80" required /><span className="input-unit">mmHg</span></div><small>Sistólica / diastólica.</small></label>
          <label className="field"><span>Glucosa en sangre <em>*</em></span><div className="input-wrap"><input name="glucose" type="number" min="20" max="700" step="0.1" placeholder="Ej. 95" required /><span className="input-unit">mg/dL</span></div></label>
          <label className="field"><span>Peso <em>*</em></span><div className="input-wrap"><input name="weight" type="number" min="20" max="350" step="0.1" placeholder="Ej. 68.5" required /><span className="input-unit">kg</span></div><small>Se usará para calcular el IMC.</small></label>
          <label className="field"><span>Estatura <em>*</em></span><div className="input-wrap"><input name="height" type="number" min="100" max="250" step="0.1" placeholder="Ej. 172" required /><span className="input-unit">cm</span></div></label>
          <label className="field"><span>Tipo de diabetes <em>*</em></span><div className="select-wrap"><select name="diabetes" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option value="tipo1">Tipo I</option><option value="tipo2">Tipo II</option><option value="ninguna">No presenta</option></select><span className="select-arrow">⌄</span></div></label>
        </div>
        <div className="form-section-title mental-title"><span className="form-section-number">02</span><div><strong>Bienestar y estrés</strong><small>Describe cómo te sientes hoy.</small></div></div>
        <fieldset className="stress-field"><legend>¿Cómo describirías tu nivel de estrés? <em>*</em></legend><div className="radio-options"><label className="radio-card"><input type="radio" name="stress" value="Levemente estresado" required /><span className="radio-visual"><i /></span><span><strong>Levemente estresado</strong><small>Me siento en calma la mayor parte del tiempo.</small></span><span className="stress-face">☺</span></label><label className="radio-card"><input type="radio" name="stress" value="Regularmente estresado" /><span className="radio-visual"><i /></span><span><strong>Regularmente estresado</strong><small>He notado algo de tensión o preocupación.</small></span><span className="stress-face">◡</span></label><label className="radio-card"><input type="radio" name="stress" value="Altamente estresado" /><span className="radio-visual"><i /></span><span><strong>Altamente estresado</strong><small>El estrés está afectando cómo me siento.</small></span><span className="stress-face">☹</span></label></div></fieldset>
        <label className="field notes-field"><span>Nota para tu registro <small>(opcional)</small></span><textarea name="notes" rows="3" placeholder="¿Hay algo más que quieras dejar anotado?" /></label>
        <div className="form-footer"><span className="privacy-note">Los datos se guardan en este dispositivo.</span><button className="submit-button" type="submit">Guardar registro <span>→</span></button></div>
        {message && <div className={`form-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </form>
    </section>
  </>;
}
