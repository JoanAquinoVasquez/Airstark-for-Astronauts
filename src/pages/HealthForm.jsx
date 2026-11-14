import { useState } from 'react';
import { getSavedRecords, saveRecords } from '../lib/health.js';
import { PageHeading, VoiceButton } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition.js';
import { getAstronautProfile } from '../lib/profile.js';
import Icon from '../components/Icon.jsx';

export default function HealthForm() {
  const { language } = useLanguage();
  const t = copy[language].form;
  const voice = useVoiceRecognition(language);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeVoiceField, setActiveVoiceField] = useState(null);
  function dictate(name) {
    setActiveVoiceField(name);
    voice.start((transcript) => {
      const form = document.getElementById('healthForm');
      if (name === 'stress') {
        const spoken = transcript.toLowerCase();
        const value = /high|highly|alto|altamente/.test(spoken) ? (language === 'en' ? 'Highly stressed' : 'Altamente estresado')
          : /moderate|regular|medio/.test(spoken) ? (language === 'en' ? 'Moderately stressed' : 'Regularmente estresado')
            : (language === 'en' ? 'Mildly stressed' : 'Levemente estresado');
        const option = [...form.querySelectorAll('[name="stress"]')].find((item) => item.value === value);
        if (option) { option.checked = true; option.dispatchEvent(new Event('change', { bubbles: true })); }
        return;
      }
      if (name === 'diabetes') {
        const spoken = transcript.toLowerCase();
        const value = /none|no diabetes|ninguna|no present|no tengo/.test(spoken) ? 'ninguna'
          : /type\s*(ii|2|two)|tipo\s*(ii|2|dos)/.test(spoken) ? 'tipo2'
            : /type\s*(i|1|one)|tipo\s*(i|1|uno)/.test(spoken) ? 'tipo1' : '';
        const field = form.elements.namedItem(name);
        if (value) { field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); }
        else setMessage(language === 'en' ? 'Say Type I, Type II, or no diabetes.' : 'Di tipo I, tipo II o no presenta.');
        return;
      }
      let value = transcript.trim().replace(/,/g, '.');
      if (name === 'bloodPressure') value = value.replace(/\s*(over|slash|sobre|dividido por)\s*/i, '/').replace(/\s*\/\s*/g, '/');
      const field = form.elements.namedItem(name);
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function toggleDictation(name) {
    if (voice.listening && activeVoiceField === name) { voice.stop(); return; }
    dictate(name);
  }
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
      date: new Date().toISOString(), astronautId: getAstronautProfile().crewId, heartRate: Number(data.get('heartRate')),
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
          <label className={`field${fieldErrors.heartRate ? ' invalid-field' : ''}`}><span>{t.heart} <em>*</em></span><div className="input-wrap"><input name="heartRate" type="number" min="30" max="250" placeholder="e.g. 72" required aria-invalid={Boolean(fieldErrors.heartRate)} /><VoiceButton listening={voice.listening && activeVoiceField === 'heartRate'} label={copy[language].voice.dictate} onClick={() => toggleDictation('heartRate')} /><span className="input-unit">{t.unitBpm}</span></div><small>{t.measured}</small>{fieldErrors.heartRate && <small className="field-error">{fieldErrors.heartRate}</small>}</label>
          <label className={`field${fieldErrors.bloodPressure ? ' invalid-field' : ''}`}><span>{t.pressure} <em>*</em></span><div className="input-wrap"><input name="bloodPressure" type="text" inputMode="numeric" pattern="\d{2,3}\s*\/\s*\d{2,3}" placeholder="e.g. 120/80" required aria-invalid={Boolean(fieldErrors.bloodPressure)} /><VoiceButton listening={voice.listening && activeVoiceField === 'bloodPressure'} label={copy[language].voice.dictate} onClick={() => toggleDictation('bloodPressure')} /><span className="input-unit">{t.unitMmhg}</span></div><small>{t.systolic}</small>{fieldErrors.bloodPressure && <small className="field-error">{fieldErrors.bloodPressure}</small>}</label>
          <label className={`field${fieldErrors.glucose ? ' invalid-field' : ''}`}><span>{t.glucose} <em>*</em></span><div className="input-wrap"><input name="glucose" type="number" min="20" max="700" step="0.1" placeholder="e.g. 95" required aria-invalid={Boolean(fieldErrors.glucose)} /><VoiceButton listening={voice.listening && activeVoiceField === 'glucose'} label={copy[language].voice.dictate} onClick={() => toggleDictation('glucose')} /><span className="input-unit">{t.unitGlucose}</span></div>{fieldErrors.glucose && <small className="field-error">{fieldErrors.glucose}</small>}</label>
          <label className={`field${fieldErrors.weight ? ' invalid-field' : ''}`}><span>{t.weight} <em>*</em></span><div className="input-wrap"><input name="weight" type="number" min="20" max="350" step="0.1" placeholder="e.g. 68.5" required aria-invalid={Boolean(fieldErrors.weight)} /><VoiceButton listening={voice.listening && activeVoiceField === 'weight'} label={copy[language].voice.dictate} onClick={() => toggleDictation('weight')} /><span className="input-unit">{t.unitKg}</span></div><small>{t.calculate}</small>{fieldErrors.weight && <small className="field-error">{fieldErrors.weight}</small>}</label>
          <label className={`field${fieldErrors.height ? ' invalid-field' : ''}`}><span>{t.height} <em>*</em></span><div className="input-wrap"><input name="height" type="number" min="100" max="250" step="0.1" placeholder="e.g. 172" required aria-invalid={Boolean(fieldErrors.height)} /><VoiceButton listening={voice.listening && activeVoiceField === 'height'} label={copy[language].voice.dictate} onClick={() => toggleDictation('height')} /><span className="input-unit">{t.unitCm}</span></div>{fieldErrors.height && <small className="field-error">{fieldErrors.height}</small>}</label>
          <label className={`field${fieldErrors.diabetes ? ' invalid-field' : ''}`}><span>{t.diabetes} <em>*</em></span><div className="select-wrap"><select name="diabetes" required defaultValue="" aria-invalid={Boolean(fieldErrors.diabetes)}><option value="" disabled>{t.choose}</option><option value="tipo1">{language === 'en' ? 'Type I' : 'Tipo I'}</option><option value="tipo2">{language === 'en' ? 'Type II' : 'Tipo II'}</option><option value="ninguna">{t.none}</option></select><VoiceButton listening={voice.listening && activeVoiceField === 'diabetes'} label={copy[language].voice.dictate} onClick={() => toggleDictation('diabetes')} /><span className="select-arrow"><Icon name="chevronDown" size={13} /></span></div>{fieldErrors.diabetes && <small className="field-error">{fieldErrors.diabetes}</small>}</label>
        </div>
        <p className="voice-hint"><Icon name="microphone" size={13} /> {copy[language].voice.formHint}</p>
        <div className="form-section-title mental-title"><span className="form-section-number">02</span><div><strong>{t.wellbeing}</strong><small>{language === 'en' ? 'Tell us how you feel today.' : 'Describe cómo te sientes hoy.'}</small></div></div>
        <fieldset className={`stress-field${fieldErrors.stress ? ' invalid-field' : ''}`}><legend>{t.how} <em>*</em> <VoiceButton listening={voice.listening && activeVoiceField === 'stress'} label={copy[language].voice.dictate} onClick={() => toggleDictation('stress')} /></legend><div className="radio-options"><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Mildly stressed' : 'Levemente estresado'} required /><span className="radio-visual"><i /></span><span><strong>{t.low}</strong><small>{t.lowDetail}</small></span><span className="stress-face"><Icon name="smile" size={18} /></span></label><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Moderately stressed' : 'Regularmente estresado'} /><span className="radio-visual"><i /></span><span><strong>{t.medium}</strong><small>{t.mediumDetail}</small></span><span className="stress-face"><Icon name="neutral" size={18} /></span></label><label className="radio-card"><input type="radio" name="stress" value={language === 'en' ? 'Highly stressed' : 'Altamente estresado'} /><span className="radio-visual"><i /></span><span><strong>{t.high}</strong><small>{t.highDetail}</small></span><span className="stress-face"><Icon name="frown" size={18} /></span></label></div>{fieldErrors.stress && <small className="field-error">{fieldErrors.stress}</small>}</fieldset>
        <label className="field notes-field"><span>{t.note} <small>{t.optional}</small></span><textarea name="notes" rows="3" placeholder={t.notePlaceholder} /></label>
        <div className="form-footer"><span className="privacy-note">{t.local}</span><button className="submit-button" type="submit">{t.save} <Icon name="arrowRight" size={14} /></button></div>
        {voice.listening && <div className="voice-feedback">{copy[language].voice.listening}</div>}{voice.error && <div className="voice-feedback error">{voice.error}</div>}{message && <div className={`form-message${error ? ' error' : ''}`} role="status">{message}</div>}
      </form>
    </section>
  </>;
}
