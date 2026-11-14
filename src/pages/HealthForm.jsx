import { useState } from 'react';
import { getSavedRecords, saveRecords } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';

export default function HealthForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors = {};
    for (const field of form.querySelectorAll('[required]')) {
      if (field.type === 'radio') {
        if (!data.has(field.name)) nextErrors[field.name] = 'Selecciona una opción para continuar.';
        continue;
      }
      if (!field.value.trim()) nextErrors[field.name] = 'Este campo es obligatorio.';
      else if (field.validity.rangeUnderflow) nextErrors[field.name] = `El valor mínimo es ${field.min}.`;
      else if (field.validity.rangeOverflow) nextErrors[field.name] = `El valor máximo es ${field.max}.`;
      else if (field.validity.patternMismatch) nextErrors[field.name] = 'Usa el formato indicado, por ejemplo 120/80.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError(true);
      setMessage('Revisa los campos marcados para guardar tu registro.');
      form.querySelector(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
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
      setError(false); setFieldErrors({}); setMessage(`Registro guardado. IMC calculado: ${record.bmi}.`); form.reset();
    } catch { setError(true); setMessage('No se pudo guardar el registro en este dispositivo.'); }
  }

  return <>
    <PageHeading eyebrow="CHECK-IN DE TRIPULACIÓN" title="Registro de salud" description="Completa la evaluación para añadir una lectura a tu historial." />
    <section className="panel form-panel health-form-panel"><div className="form-heading"><div><span className="section-kicker">NUEVA MEDICIÓN</span><h2>Indicadores y bienestar</h2><p>Los campos con asterisco son obligatorios.</p></div><div className="step-indicator"><span className="step-dot" /> REGISTRO MANUAL</div></div>
      <form id="healthForm" noValidate onSubmit={submit} onChange={(event) => { const name = event.target.name; if (name && fieldErrors[name]) setFieldErrors((current) => { const next = { ...current }; delete next[name]; return next; }); }}>
        <div className="form-section-title"><span className="form-section-number">01</span><div><strong>Indicadores físicos</strong><small>Ingresa los datos de tus mediciones actuales.</small></div></div>
        <div className="form-grid">
          <label className={`field${fieldErrors.heartRate ? ' invalid-field' : ''}`}><span>Frecuencia cardíaca <em>*</em></span><div className="input-wrap"><input name="heartRate" type="number" min="30" max="250" placeholder="Ej. 72" required aria-invalid={Boolean(fieldErrors.heartRate)} /><span className="input-unit">bpm</span></div><small>Medida por el smartwatch o manualmente.</small>{fieldErrors.heartRate && <small className="field-error">{fieldErrors.heartRate}</small>}</label>
          <label className={`field${fieldErrors.bloodPressure ? ' invalid-field' : ''}`}><span>Presión arterial <em>*</em></span><div className="input-wrap"><input name="bloodPressure" type="text" inputMode="numeric" pattern="\d{2,3}\s*\/\s*\d{2,3}" placeholder="Ej. 120/80" required aria-invalid={Boolean(fieldErrors.bloodPressure)} /><span className="input-unit">mmHg</span></div><small>Sistólica / diastólica.</small>{fieldErrors.bloodPressure && <small className="field-error">{fieldErrors.bloodPressure}</small>}</label>
          <label className={`field${fieldErrors.glucose ? ' invalid-field' : ''}`}><span>Glucosa en sangre <em>*</em></span><div className="input-wrap"><input name="glucose" type="number" min="20" max="700" step="0.1" placeholder="Ej. 95" required aria-invalid={Boolean(fieldErrors.glucose)} /><span className="input-unit">mg/dL</span></div>{fieldErrors.glucose && <small className="field-error">{fieldErrors.glucose}</small>}</label>
          <label className={`field${fieldErrors.weight ? ' invalid-field' : ''}`}><span>Peso <em>*</em></span><div className="input-wrap"><input name="weight" type="number" min="20" max="350" step="0.1" placeholder="Ej. 68.5" required aria-invalid={Boolean(fieldErrors.weight)} /><span className="input-unit">kg</span></div><small>Se usará para calcular el IMC.</small>{fieldErrors.weight && <small className="field-error">{fieldErrors.weight}</small>}</label>
          <label className={`field${fieldErrors.height ? ' invalid-field' : ''}`}><span>Estatura <em>*</em></span><div className="input-wrap"><input name="height" type="number" min="100" max="250" step="0.1" placeholder="Ej. 172" required aria-invalid={Boolean(fieldErrors.height)} /><span className="input-unit">cm</span></div>{fieldErrors.height && <small className="field-error">{fieldErrors.height}</small>}</label>
          <label className={`field${fieldErrors.diabetes ? ' invalid-field' : ''}`}><span>Tipo de diabetes <em>*</em></span><div className="select-wrap"><select name="diabetes" required defaultValue="" aria-invalid={Boolean(fieldErrors.diabetes)}><option value="" disabled>Selecciona una opción</option><option value="tipo1">Tipo I</option><option value="tipo2">Tipo II</option><option value="ninguna">No presenta</option></select><span className="select-arrow">⌄</span></div>{fieldErrors.diabetes && <small className="field-error">{fieldErrors.diabetes}</small>}</label>
        </div>
        <div className="form-section-title mental-title"><span className="form-section-number">02</span><div><strong>Bienestar y estrés</strong><small>Describe cómo te sientes hoy.</small></div></div>
        <fieldset className={`stress-field${fieldErrors.stress ? ' invalid-field' : ''}`}><legend>¿Cómo describirías tu nivel de estrés? <em>*</em></legend><div className="radio-options"><label className="radio-card"><input type="radio" name="stress" value="Levemente estresado" required /><span className="radio-visual"><i /></span><span><strong>Levemente estresado</strong><small>Me siento en calma la mayor parte del tiempo.</small></span><span className="stress-face">☺</span></label><label className="radio-card"><input type="radio" name="stress" value="Regularmente estresado" /><span className="radio-visual"><i /></span><span><strong>Regularmente estresado</strong><small>He notado algo de tensión o preocupación.</small></span><span className="stress-face">◡</span></label><label className="radio-card"><input type="radio" name="stress" value="Altamente estresado" /><span className="radio-visual"><i /></span><span><strong>Altamente estresado</strong><small>El estrés está afectando cómo me siento.</small></span><span className="stress-face">☹</span></label></div>{fieldErrors.stress && <small className="field-error">{fieldErrors.stress}</small>}</fieldset>
        <label className="field notes-field"><span>Nota para tu registro <small>(opcional)</small></span><textarea name="notes" rows="3" placeholder="¿Hay algo más que quieras dejar anotado?" /></label>
        <div className="form-footer"><span className="privacy-note">Los datos se guardan en este dispositivo.</span><button className="submit-button" type="submit">Guardar registro <span>→</span></button></div>
        {message && <div className={`form-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </form>
    </section>
  </>;
}
