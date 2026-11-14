import { useState } from 'react';
import { getSavedRecords, saveRecords } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';

export default function HealthForm() {
  const { language } = useLanguage();
  const t = copy[language].form;
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
        if (!data.has(field.name)) nextErrors[field.name] = t.selectError;
        continue;
      }
      if (!field.value.trim()) nextErrors[field.name] = t.requiredError;
      else if (field.validity.rangeUnderflow) nextErrors[field.name] = `${t.minError} ${field.min}.`;
      else if (field.validity.rangeOverflow) nextErrors[field.name] = `${t.maxError} ${field.max}.`;
      else if (field.validity.patternMismatch) nextErrors[field.name] = t.formatError;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError(true);
      setMessage(t.review);
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
      setError(false); setFieldErrors({}); setMessage(`${t.saved} ${record.bmi}.`); form.reset();
    } catch { setError(true); setMessage(t.saveFail); }
  }

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <section className="panel form-panel health-form-panel"><div className="form-heading"><div><span className="section-kicker">{t.new}</span><h2>{t.indicators}</h2><p>{t.requiredNote}</p></div><div className="step-indicator"><span className="step-dot" /> {t.manual}</div></div>
      <form id="healthForm" noValidate onSubmit={submit} onChange={(event) => { const name = event.target.name; if (name && fieldErrors[name]) setFieldErrors((current) => { const next = { ...current }; delete next[name]; return next; }); }}>
        <div className="form-section-title"><span className="form-section-number">01</span><div><strong>{t.physical}</strong><small>{t.current}</small></div></div>
        <div className="form-grid">
          <label className={`field${fieldErrors.heartRate ? ' invalid-field' : ''}`}><span>{t.heart} <em>*</em></span><div className="input-wrap"><input name="heartRate" type="number" min="30" max="250" placeholder="e.g. 72" required aria-invalid={Boolean(fieldErrors.heartRate)} /><span className="input-unit">{t.unitBpm}</span></div><small>{t.measured}</small>{fieldErrors.heartRate && <small className="field-error">{fieldErrors.heartRate}</small>}</label>
          <label className={`field${fieldErrors.bloodPressure ? ' invalid-field' : ''}`}><span>{t.pressure} <em>*</em></span><div className="input-wrap"><input name="bloodPressure" type="text" inputMode="numeric" pattern="\d{2,3}\s*\/\s*\d{2,3}" placeholder="e.g. 120/80" required aria-invalid={Boolean(fieldErrors.bloodPressure)} /><span className="input-unit">{t.unitMmhg}</span></div><small>{t.systolic}</small>{fieldErrors.bloodPressure && <small className="field-error">{fieldErrors.bloodPressure}</small>}</label>
          <label className={`field${fieldErrors.glucose ? ' invalid-field' : ''}`}><span>{t.glucose} <em>*</em></span><div className="input-wrap"><input name="glucose" type="number" min="20" max="700" step="0.1" placeholder="e.g. 95" required aria-invalid={Boolean(fieldErrors.glucose)} /><span className="input-unit">{t.unitGlucose}</span></div>{fieldErrors.glucose && <small className="field-error">{fieldErrors.glucose}</small>}</label>
          <label className={`field${fieldErrors.weight ? ' invalid-field' : ''}`}><span>{t.weight} <em>*</em></span><div className="input-wrap"><input name="weight" type="number" min="20" max="350" step="0.1" placeholder="e.g. 68.5" required aria-invalid={Boolean(fieldErrors.weight)} /><span className="input-unit">{t.unitKg}</span></div><small>{t.calculate}</small>{fieldErrors.weight && <small className="field-error">{fieldErrors.weight}</small>}</label>
          <label className={`field${fieldErrors.height ? ' invalid-field' : ''}`}><span>{t.height} <em>*</em></span><div className="input-wrap"><input name="height" type="number" min="100" max="250" step="0.1" placeholder="e.g. 172" required aria-invalid={Boolean(fieldErrors.height)} /><span className="input-unit">{t.unitCm}</span></div>{fieldErrors.height && <small className="field-error">{fieldErrors.height}</small>}</label>
          <label className={`field${fieldErrors.diabetes ? ' invalid-field' : ''}`}><span>{t.diabetes} <em>*</em></span><div className="select-wrap"><select name="diabetes" required defaultValue="" aria-invalid={Boolean(fieldErrors.diabetes)}><option value="" disabled>{t.choose}</option><option value="tipo1">Type I</option><option value="tipo2">Type II</option><option value="ninguna">{t.none}</option></select><span className="select-arrow">⌄</span></div>{fieldErrors.diabetes && <small className="field-error">{fieldErrors.diabetes}</small>}</label>
        </div>
        <div className="form-section-title mental-title"><span className="form-section-number">02</span><div><strong>{t.wellbeing}</strong><small>{language === 'en' ? 'Tell us how you feel today.' : 'Describe cómo te sientes hoy.'}</small></div></div>
        <fieldset className={`stress-field${fieldErrors.stress ? ' invalid-field' : ''}`}><legend>{t.how} <em>*</em></legend><div className="radio-options"><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Mildly stressed' : 'Levemente estresado'} required /><span className="radio-visual"><i /></span><span><strong>{t.low}</strong><small>{t.lowDetail}</small></span><span className="stress-face">☺</span></label><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Moderately stressed' : 'Regularmente estresado'} /><span className="radio-visual"><i /></span><span><strong>{t.medium}</strong><small>{t.mediumDetail}</small></span><span className="stress-face">◡</span></label><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Highly stressed' : 'Altamente estresado'} /><span className="radio-visual"><i /></span><span><strong>{t.high}</strong><small>{t.highDetail}</small></span><span className="stress-face">☹</span></label></div>{fieldErrors.stress && <small className="field-error">{fieldErrors.stress}</small>}</fieldset>
        <label className="field notes-field"><span>{t.note} <small>{t.optional}</small></span><textarea name="notes" rows="3" placeholder={t.notePlaceholder} /></label>
        <div className="form-footer"><span className="privacy-note">{t.local}</span><button className="submit-button" type="submit">{t.save} <span>→</span></button></div>
        {message && <div className={`form-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </form>
    </section>
  </>;
}
