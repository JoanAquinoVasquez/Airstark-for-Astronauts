import { useMemo, useState } from 'react';
import { getSavedRecords, saveRecords } from '../lib/health.js';
import { PageHeading, VoiceButton } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition.js';
import { getAstronautProfile } from '../lib/profile.js';
import Icon from '../components/Icon.jsx';
import { insertCloudRecords, insertCardiovascularEvaluation, saveCardioEvaluation } from '../lib/supabase.js';

// ── Lista de Antecedentes Familiares (F) ──────────────────────────────────────
const FAMILY_HISTORY_ITEMS = [
  { code: 'PREVCHD', status: 'F', es: '¿Tiene familiares con enfermedades coronarias?', en: 'Family history of coronary heart disease?' },
  { code: 'PREVAP', status: 'F', es: '¿Tiene familiares que presenten Angina de Pecho?', en: 'Family history of Angina Pectoris?' },
  { code: 'PREVMI', status: 'F', es: '¿Tiene familiares que hayan sufrido infarto de miocardio?', en: 'Family history of myocardial infarction?' },
  { code: 'PREVSTRK', status: 'F', es: '¿Tiene familiares que hayan sufrido un accidente cerebro vascular (ACV)?', en: 'Family history of stroke / cerebrovascular accident?' },
  { code: 'PREVHYP', status: 'F', es: '¿Tiene familiares con hipertensión?', en: 'Family history of hypertension?' },
];

// ── Lista de Historial y Condiciones Clínicas Personales (D) ─────────────────
const PERSONAL_HISTORY_ITEMS = [
  { code: 'HYPERTEN', status: 'D', es: '¿Ud. es hipertenso?', en: 'Do you have diagnosed hypertension?' },
  { code: 'ANGINA', status: 'D', es: '¿Presenta dolor de pecho (Angina)?', en: 'Do you experience chest pain (angina)?' },
  { code: 'ANYCHD', status: 'D', es: '¿Presenta enfermedades coronarias?', en: 'Do you have coronary heart disease?' },
  { code: 'STROKE', status: 'D', es: '¿Ha sufrido un accidente cerebro vascular (ACV)?', en: 'Have you ever suffered a stroke?' },
  { code: 'CVD', status: 'D', es: '¿Presenta enfermedades cardiovasculares?', en: 'Do you have cardiovascular disease?' },
];

export default function HealthForm() {
  const { language } = useLanguage();
  const t = copy[language].form;
  const isEn = language === 'en';
  const voice = useVoiceRecognition(language);

  // Estados de navegación interna
  const [activeTab, setActiveTab] = useState('all'); // 'all' | '01' | '02' | '03' | '04' | '05' | '06'

  // Estados de valores del formulario
  const [sexo, setSexo] = useState('M');
  const [edad, setEdad] = useState('42');
  const [peso, setPeso] = useState('74');
  const [talla, setTalla] = useState('175');
  const [frecuenciaCardiaca, setFrecuenciaCardiaca] = useState('72');
  const [presionArterial, setPresionArterial] = useState('120/80');
  const [glucosa, setGlucosa] = useState('92');
  const [colesterolTotal, setColesterolTotal] = useState('185');
  const [hdlc, setHdlc] = useState('52');
  const [ldlc, setLdlc] = useState('110');
  const [tabaquismoActual, setTabaquismoActual] = useState(false);
  const [cigarrosPorDia, setCigarrosPorDia] = useState('0');
  const [diabetes, setDiabetes] = useState(false);
  const [bpmeds, setBpmeds] = useState(false);

  // Estados booleanos para antecedentes (mapa de clave-valor)
  const [boolAnswers, setBoolAnswers] = useState({
    PREVCHD: false,
    PREVAP: false,
    PREVMI: false,
    PREVSTRK: false,
    PREVHYP: true,
    HYPERTEN: false,
    ANGINA: false,
    ANYCHD: false,
    STROKE: false,
    CVD: false,
  });

  const [stress, setStress] = useState(isEn ? 'Mildly stressed' : 'Levemente estresado');
  const [notes, setNotes] = useState('');

  // Estados de feedback
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState(null);

  // Cálculo en tiempo real de IMC
  const imcInfo = useMemo(() => {
    const p = parseFloat(peso);
    const h = parseFloat(talla) / 100;
    if (!p || !h || h <= 0) return { val: null, label: '—', color: '#91a4b7' };
    const val = Number((p / (h * h)).toFixed(1));
    if (val < 18.5) return { val, label: isEn ? 'Underweight' : 'Bajo peso', color: '#65a9ff' };
    if (val < 25) return { val, label: isEn ? 'Normal' : 'Normal', color: '#49ddb2' };
    if (val < 30) return { val, label: isEn ? 'Overweight' : 'Sobrepeso', color: '#f5c842' };
    return { val, label: isEn ? 'Obesity' : 'Obesidad', color: '#f07c3e' };
  }, [peso, talla, isEn]);

  // Manejador para preguntas booleanas
  const handleBoolChange = (code, val) => {
    setBoolAnswers((prev) => ({ ...prev, [code]: val }));
  };

  // Autollenado para jurados / demo
  const handleAutofillDemo = () => {
    setSexo('M');
    setEdad('38');
    setPeso('72.5');
    setTalla('176');
    setFrecuenciaCardiaca('68');
    setPresionArterial('118/78');
    setGlucosa('89');
    setColesterolTotal('178');
    setHdlc('55');
    setLdlc('98');
    setTabaquismoActual(false);
    setCigarrosPorDia('0');
    setDiabetes(false);
    setBpmeds(false);
    setBoolAnswers({
      PREVCHD: false,
      PREVAP: false,
      PREVMI: false,
      PREVSTRK: false,
      PREVHYP: false,
      HYPERTEN: false,
      ANGINA: false,
      ANYCHD: false,
      STROKE: false,
      CVD: false,
    });
    setStress(isEn ? 'Mildly stressed' : 'Levemente estresado');
    setNotes(isEn ? 'Pre-mission physical check-in. All telemetry optimal.' : 'Chequeo físico pre-misión. Toda la telemetría en rango óptimo.');
    setMessage(isEn ? 'Sample cardiovascular evaluation loaded.' : 'Valores de muestra de evaluación cardiovascular cargados.');
    setError(false);
  };

  // Dictado por voz
  function dictate(name) {
    setActiveVoiceField(name);
    voice.start((transcript) => {
      let val = transcript.trim().replace(/,/g, '.');
      if (name === 'presionArterial') {
        val = val.replace(/\s*(over|slash|sobre|dividido por)\s*/i, '/').replace(/\s*\/\s*/g, '/');
        setPresionArterial(val);
      } else if (name === 'frecuenciaCardiaca') {
        const num = val.replace(/\D/g, '');
        if (num) setFrecuenciaCardiaca(num);
      } else if (name === 'glucosa') {
        const num = val.replace(/[^\d.]/g, '');
        if (num) setGlucosa(num);
      } else if (name === 'peso') {
        const num = val.replace(/[^\d.]/g, '');
        if (num) setPeso(num);
      } else if (name === 'talla') {
        const num = val.replace(/[^\d.]/g, '');
        if (num) setTalla(num);
      } else if (name === 'colesterolTotal') {
        const num = val.replace(/[^\d.]/g, '');
        if (num) setColesterolTotal(num);
      }
    });
  }

  function toggleDictation(name) {
    if (voice.listening && activeVoiceField === name) {
      voice.stop();
      return;
    }
    dictate(name);
  }

  // Guardado unificado: Nueva tabla Supabase + health_records + LocalStorage
  async function submit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError(false);

    const astronaut = getAstronautProfile();
    const evaluatedAt = new Date().toISOString();
    const parsedBmi = imcInfo.val || 22.4;

    // 1. Objeto completo con las 23 variables del estudio cardiovascular
    const cardioRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : undefined,
      astronautId: astronaut.crewId,
      date: evaluatedAt,
      // 01. Demográficos y Biometría
      sex: sexo,
      age: Number(edad) || null,
      weight: Number(peso) || null,
      heightCm: Number(talla) || null,
      bmi: parsedBmi,
      // 02. Signos y Laboratorio
      heartRate: Number(frecuenciaCardiaca) || null,
      bloodPressure: presionArterial.trim(),
      glucose: Number(glucosa) || null,
      totChol: Number(colesterolTotal) || null,
      hdlc: Number(hdlc) || null,
      ldlc: Number(ldlc) || null,
      // 03. Hábitos y Medicación
      curSmoke: tabaquismoActual,
      cigsPerDay: tabaquismoActual ? Number(cigarrosPorDia) || 0 : 0,
      diabetes,
      bpMeds: bpmeds,
      // 04. Antecedentes Familiares
      prevChd: boolAnswers.PREVCHD,
      prevAp: boolAnswers.PREVAP,
      prevMi: boolAnswers.PREVMI,
      prevStrk: boolAnswers.PREVSTRK,
      prevHyp: boolAnswers.PREVHYP,
      // 05. Historial Clínico Personal
      angina: boolAnswers.ANGINA,
      anyChd: boolAnswers.ANYCHD,
      stroke: boolAnswers.STROKE,
      cvd: boolAnswers.CVD,
      hyperten: boolAnswers.HYPERTEN,
      // 06. Bienestar
      stress,
      notes: notes.trim(),
    };

    // 2. Registro estándar para sincronización con Dashboard y Gemelo 3D
    const standardHealthRecord = {
      date: evaluatedAt,
      astronautId: astronaut.crewId,
      heartRate: Number(frecuenciaCardiaca) || 72,
      pressure: presionArterial.trim() || '120/80',
      glucose: Number(glucosa) || 90,
      weight: Number(peso) || 70,
      heightCm: Number(talla) || 175,
      bmi: parsedBmi,
      stress: stress.includes('Mild') || stress.includes('Leve') ? 'Bajo' : stress.includes('Modera') ? 'Moderado' : 'Alto',
      diabetes: diabetes ? 'tipo2' : 'ninguna',
      notes: notes.trim(),
      source: 'manual',
    };

    try {
      // Guardar localmente
      saveCardioEvaluation(cardioRecord);
      saveRecords([standardHealthRecord, ...getSavedRecords()]);

      // Guardar en Supabase en paralelo
      let newTableSuccess = false;
      try {
        await insertCardiovascularEvaluation(cardioRecord, astronaut.crewId);
        newTableSuccess = true;
      } catch (err) {
        console.info('Aviso: Tabla cardiovascular_evaluations pendiente de migración SQL en Supabase.', err.message);
      }

      await insertCloudRecords([standardHealthRecord], astronaut.crewId);
      window.dispatchEvent(new Event('airstark-cloud-data-loaded'));

      setError(false);
      const successMsg = isEn
        ? `Cardiovascular evaluation saved. BMI: ${parsedBmi} (${imcInfo.label})${newTableSuccess ? ' · Synced to cardiovascular_evaluations' : ''}`
        : `Evaluación cardiovascular guardada exitosamente. IMC: ${parsedBmi} (${imcInfo.label})${newTableSuccess ? '' : ' · Guardado localmente y en health_records'}`;
      setMessage(successMsg);
    } catch (err) {
      setError(true);
      setMessage(isEn ? `Save notice: ${err.message}` : `Aviso de guardado: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={isEn ? 'CARDIOVASCULAR RISK EVALUATION' : 'EVALUACIÓN DE RIESGO CARDIOVASCULAR'}
        title={isEn ? 'Comprehensive Health Check-In' : 'Chequeo Médico Integral'}
        description={
          isEn
            ? 'Structured 23-variable cardiovascular evaluation protocol (Framingham criteria). Syncs to cloud database.'
            : 'Protocolo de evaluación cardiovascular de 23 variables clínicas (criterios Framingham). Sincroniza con base de datos en la nube.'
        }
        action={
          <button
            type="button"
            className="cardio-autofill-btn"
            onClick={handleAutofillDemo}
            style={{
              background: 'linear-gradient(135deg, rgba(84, 215, 238, 0.28), rgba(73, 221, 178, 0.28))',
              border: '1.5px solid #54d7ee',
              color: '#ffffff',
              padding: '9px 18px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              boxShadow: '0 0 18px rgba(84, 215, 238, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <Icon name="sparkles" size={15} />
            <span>{isEn ? 'Autofill Demo Sample' : '⚡ Llenar datos de prueba'}</span>
          </button>
        }
      />

      <section className="panel form-panel health-form-panel">
        {/* Cabecera y botón de llenado rápido para jurados */}
        <div className="cardio-header-stats">
          <div className="cardio-stats-left">
            <span className="cardio-stats-pill">
              <span className="dot" />
              <span>23 {isEn ? 'CLINICAL VARIABLES' : 'VARIABLES CLÍNICAS'}</span>
            </span>
            <span className="cardio-stats-pill" style={{ color: imcInfo.color, borderColor: `${imcInfo.color}55` }}>
              <span>IMC: {imcInfo.val || '—'} · {imcInfo.label}</span>
            </span>
          </div>

          <button
            type="button"
            className="cardio-autofill-btn"
            onClick={handleAutofillDemo}
            title={isEn ? 'Load realistic clinical data for demonstration' : 'Cargar datos clínicos realistas para demostración'}
          >
            <Icon name="sparkles" size={13} />
            <span>{isEn ? 'Autofill Demo Sample' : 'Llenar datos de prueba'}</span>
          </button>
        </div>

        {/* Navegación por pestañas de secciones */}
        <div className="cardio-sections-nav" role="tablist" aria-label="Secciones del formulario">
          {[
            { id: 'all', label: isEn ? 'All Sections' : 'Ver todo' },
            { id: '01', label: isEn ? '01 Biometrics & Sex' : '01 Biometría' },
            { id: '02', label: isEn ? '02 Vitals & Labs' : '02 Signos y Laboratorio' },
            { id: '03', label: isEn ? '03 Habits & Meds' : '03 Hábitos y Fármacos' },
            { id: '04', label: isEn ? '04 Personal History' : '04 Historial Personal' },
            { id: '05', label: isEn ? '05 Family History' : '05 Antecedentes Familiares' },
            { id: '06', label: isEn ? '06 Wellbeing' : '06 Bienestar' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`cardio-nav-pill ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form id="healthForm" onSubmit={submit}>
          {/* ════════════════════════════════════════════════════════════════════════
              01. DATOS DEMOGRÁFICOS Y BIOMETRÍA (F / D)
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '01') && (
            <div style={{ marginBottom: 28 }}>
              <div className="form-section-title">
                <span className="form-section-number">01</span>
                <div>
                  <strong>{isEn ? 'Demographics & Biometrics (F / D)' : 'Datos Demográficos y Biometría (F / D)'}</strong>
                  <small>{isEn ? 'Sex, age, weight, height, and live BMI calculation' : 'Sexo, edad, peso, talla e IMC calculado'}</small>
                </div>
              </div>

              <div className="form-grid">
                {/* Sexo (F) */}
                <label className="field">
                  <span>{isEn ? 'Sex (F)' : 'Sexo (F)'} <em>*</em></span>
                  <div className="select-wrap">
                    <select value={sexo} onChange={(e) => setSexo(e.target.value)} required>
                      <option value="M">{isEn ? 'Male (Masculino)' : 'Masculino'}</option>
                      <option value="F">{isEn ? 'Female (Femenino)' : 'Femenino'}</option>
                    </select>
                    <span className="select-arrow"><Icon name="chevronDown" size={13} /></span>
                  </div>
                  <small>{isEn ? 'Biological sex' : '¿Cuál es su sexo?'}</small>
                </label>

                {/* Edad (F) */}
                <label className="field">
                  <span>{isEn ? 'Age (F)' : 'Edad (F)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      min="18"
                      max="110"
                      value={edad}
                      onChange={(e) => setEdad(e.target.value)}
                      placeholder="Ej. 42"
                      required
                    />
                    <span className="input-unit">{isEn ? 'years' : 'años'}</span>
                  </div>
                  <small>{isEn ? 'Chronological age' : '¿Cuál es su edad?'}</small>
                </label>

                {/* Peso (D) */}
                <label className="field">
                  <span>{isEn ? 'Weight (D)' : 'Peso corporal (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.1"
                      min="30"
                      max="250"
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      placeholder="Ej. 74"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'peso'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('peso')}
                    />
                    <span className="input-unit">kg</span>
                  </div>
                  <small>{isEn ? 'Current weight' : '¿Cuál es su peso?'}</small>
                </label>

                {/* Talla (D) */}
                <label className="field">
                  <span>{isEn ? 'Height (D)' : 'Talla / Estatura (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.5"
                      min="100"
                      max="240"
                      value={talla}
                      onChange={(e) => setTalla(e.target.value)}
                      placeholder="Ej. 175"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'talla'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('talla')}
                    />
                    <span className="input-unit">cm</span>
                  </div>
                  <small>{isEn ? 'Standing height' : '¿Cuál es su talla?'}</small>
                </label>

                {/* IMC Calculado (D) */}
                <div className="field imc-field">
                  <span>{isEn ? 'Body Mass Index (BMI) (D)' : 'Índice de Masa Corporal (IMC) (D)'}</span>
                  <div className="input-wrap">
                    <input
                      type="text"
                      value={imcInfo.val ? `${imcInfo.val} kg/m²` : '—'}
                      readOnly
                      style={{ color: imcInfo.color, fontWeight: 700 }}
                    />
                    <span className="input-unit">IMC</span>
                  </div>
                  <div
                    className="cardio-imc-badge"
                    style={{ background: `${imcInfo.color}18`, color: imcInfo.color, border: `1px solid ${imcInfo.color}44` }}
                  >
                    <span>{imcInfo.label}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              02. SIGNOS VITALES Y LABORATORIO CLÍNICO (D)
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '02') && (
            <div style={{ marginBottom: 28 }}>
              <div className="form-section-title">
                <span className="form-section-number">02</span>
                <div>
                  <strong>{isEn ? 'Vital Signs & Clinical Laboratory (D)' : 'Signos Vitales y Laboratorio Clínico (D)'}</strong>
                  <small>{isEn ? 'Heart rate, blood pressure, glucose, and full lipid panel' : 'Frecuencia cardíaca, presión arterial, glucosa y perfil lipídico'}</small>
                </div>
              </div>

              <div className="form-grid">
                {/* Frecuencia Cardíaca (D) */}
                <label className="field">
                  <span>{isEn ? 'Heart Rate (D)' : 'Frecuencia Cardíaca (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      min="35"
                      max="220"
                      value={frecuenciaCardiaca}
                      onChange={(e) => setFrecuenciaCardiaca(e.target.value)}
                      placeholder="Ej. 72"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'frecuenciaCardiaca'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('frecuenciaCardiaca')}
                    />
                    <span className="input-unit">bpm</span>
                  </div>
                  <small>{isEn ? 'Resting or current pulse' : '¿Cuál es su Frecuencia Cardiaca?'}</small>
                </label>

                {/* Presión Arterial (D) */}
                <label className="field">
                  <span>{isEn ? 'Blood Pressure (D)' : 'Presión Arterial (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="text"
                      pattern="\d{2,3}\s*\/\s*\d{2,3}"
                      value={presionArterial}
                      onChange={(e) => setPresionArterial(e.target.value)}
                      placeholder="120/80"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'presionArterial'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('presionArterial')}
                    />
                    <span className="input-unit">mmHg</span>
                  </div>
                  <small>{isEn ? 'Systolic / Diastolic' : '¿Cuál es su Presión Arterial?'}</small>
                </label>

                {/* Glucosa (D) */}
                <label className="field">
                  <span>{isEn ? 'Blood Glucose (D)' : 'Glucosa en Sangre (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.1"
                      min="30"
                      max="600"
                      value={glucosa}
                      onChange={(e) => setGlucosa(e.target.value)}
                      placeholder="Ej. 92"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'glucosa'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('glucosa')}
                    />
                    <span className="input-unit">mg/dL</span>
                  </div>
                  <small>{isEn ? 'Fasting glucose' : '¿Cuánto mide su glucosa?'}</small>
                </label>

                {/* Colesterol Total (D) */}
                <label className="field">
                  <span>{isEn ? 'Total Cholesterol (D)' : 'Colesterol Total (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.1"
                      min="50"
                      max="800"
                      value={colesterolTotal}
                      onChange={(e) => setColesterolTotal(e.target.value)}
                      placeholder="Ej. 185"
                      required
                    />
                    <VoiceButton
                      listening={voice.listening && activeVoiceField === 'colesterolTotal'}
                      label={copy[language].voice.dictate}
                      onClick={() => toggleDictation('colesterolTotal')}
                    />
                    <span className="input-unit">mg/dL</span>
                  </div>
                  <small>{isEn ? 'Serum cholesterol' : '¿Cuál es su Colesterol Total?'}</small>
                </label>

                {/* HDLC (D) */}
                <label className="field">
                  <span>{isEn ? 'HDL Cholesterol - HDLC (D)' : 'Colesterol HDL - HDLC (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.1"
                      min="10"
                      max="200"
                      value={hdlc}
                      onChange={(e) => setHdlc(e.target.value)}
                      placeholder="Ej. 52"
                      required
                    />
                    <span className="input-unit">mg/dL</span>
                  </div>
                  <small>{isEn ? 'High-density lipoprotein' : '¿Cuánto tiene de colesterol de alta densidad?'}</small>
                </label>

                {/* LDLC (D) */}
                <label className="field">
                  <span>{isEn ? 'LDL Cholesterol - LDLC (D)' : 'Colesterol LDL - LDLC (D)'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      type="number"
                      step="0.1"
                      min="10"
                      max="400"
                      value={ldlc}
                      onChange={(e) => setLdlc(e.target.value)}
                      placeholder="Ej. 110"
                      required
                    />
                    <span className="input-unit">mg/dL</span>
                  </div>
                  <small>{isEn ? 'Low-density lipoprotein' : '¿Cuánto tiene de colesterol de baja densidad?'}</small>
                </label>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              03. HÁBITOS, TABAQUISMO Y MEDICACIÓN (F / D)
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '03') && (
            <div style={{ marginBottom: 28 }}>
              <div className="form-section-title">
                <span className="form-section-number">03</span>
                <div>
                  <strong>{isEn ? 'Habits & Medication (F / D)' : 'Hábitos y Medicación (F / D)'}</strong>
                  <small>{isEn ? 'Smoking habits, diabetes diagnosis, and antihypertensive therapy' : 'Tabaquismo actual, consumo diario, diabetes y medicamentos antihipertensivos'}</small>
                </div>
              </div>

              <div className="cardio-bool-grid">
                {/* Tabaquismo actual (F) */}
                <div className="cardio-bool-field">
                  <div className="cardio-bool-header">
                    <span className="cardio-bool-question">{isEn ? 'Do you currently smoke?' : '¿Ud. Fuma actualmente?'}</span>
                    <span className="cardio-bool-code">
                      <code>SMOKING</code>
                      <small className="badge-f">F</small>
                    </span>
                  </div>
                  <div className="cardio-bool-options">
                    <button
                      type="button"
                      className={`cardio-bool-btn ${tabaquismoActual === true ? 'selected-yes' : ''}`}
                      onClick={() => setTabaquismoActual(true)}
                    >
                      <span className="dot" />
                      {isEn ? 'Yes' : 'Sí'}
                    </button>
                    <button
                      type="button"
                      className={`cardio-bool-btn ${tabaquismoActual === false ? 'selected-no' : ''}`}
                      onClick={() => {
                        setTabaquismoActual(false);
                        setCigarrosPorDia('0');
                      }}
                    >
                      <span className="dot" />
                      No
                    </button>
                  </div>
                </div>

                {/* Cigarros por día (D) - Condicional si fuma */}
                {tabaquismoActual && (
                  <div className="cardio-bool-field" style={{ borderColor: 'rgba(240, 124, 62, 0.4)' }}>
                    <div className="cardio-bool-header">
                      <span className="cardio-bool-question">{isEn ? 'Cigarettes per day (D)' : '¿Cuántos cigarros por día fuma?'}</span>
                      <span className="cardio-bool-code">
                        <code>CIGS/DAY</code>
                        <small className="badge-d">D</small>
                      </span>
                    </div>
                    <div className="input-wrap" style={{ marginTop: 6 }}>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={cigarrosPorDia}
                        onChange={(e) => setCigarrosPorDia(e.target.value)}
                        placeholder="Ej. 10"
                      />
                      <span className="input-unit">{isEn ? 'cigs' : 'cigarros'}</span>
                    </div>
                  </div>
                )}

                {/* Diabetes (F) */}
                <div className="cardio-bool-field">
                  <div className="cardio-bool-header">
                    <span className="cardio-bool-question">{isEn ? 'Are you diabetic?' : '¿Ud. es diabético?'}</span>
                    <span className="cardio-bool-code">
                      <code>DIABETES</code>
                      <small className="badge-f">F</small>
                    </span>
                  </div>
                  <div className="cardio-bool-options">
                    <button
                      type="button"
                      className={`cardio-bool-btn ${diabetes === true ? 'selected-yes' : ''}`}
                      onClick={() => setDiabetes(true)}
                    >
                      <span className="dot" />
                      {isEn ? 'Yes' : 'Sí'}
                    </button>
                    <button
                      type="button"
                      className={`cardio-bool-btn ${diabetes === false ? 'selected-no' : ''}`}
                      onClick={() => setDiabetes(false)}
                    >
                      <span className="dot" />
                      No
                    </button>
                  </div>
                </div>

                {/* BPMEDS (F) */}
                <div className="cardio-bool-field">
                  <div className="cardio-bool-header">
                    <span className="cardio-bool-question">{isEn ? 'Do you use antihypertensive medication?' : '¿Usa medicamentos antihipertensivos?'}</span>
                    <span className="cardio-bool-code">
                      <code>BPMEDS</code>
                      <small className="badge-f">F</small>
                    </span>
                  </div>
                  <div className="cardio-bool-options">
                    <button
                      type="button"
                      className={`cardio-bool-btn ${bpmeds === true ? 'selected-yes' : ''}`}
                      onClick={() => setBpmeds(true)}
                    >
                      <span className="dot" />
                      {isEn ? 'Yes' : 'Sí'}
                    </button>
                    <button
                      type="button"
                      className={`cardio-bool-btn ${bpmeds === false ? 'selected-no' : ''}`}
                      onClick={() => setBpmeds(false)}
                    >
                      <span className="dot" />
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              04. HISTORIAL Y SÍNTOMAS PERSONALES CARDIOVASCULARES (D)
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '04') && (
            <div style={{ marginBottom: 28 }}>
              <div className="form-section-title">
                <span className="form-section-number">04</span>
                <div>
                  <strong>{isEn ? 'Personal Cardiovascular Conditions (D)' : 'Historial y Síntomas Personales Cardiovasculares (D)'}</strong>
                  <small>{isEn ? 'Hypertension, angina, coronary disease, stroke history, and CVD' : 'Hipertensión, dolor de pecho, enfermedades coronarias, ACV y CVD'}</small>
                </div>
              </div>

              <div className="cardio-bool-grid">
                {PERSONAL_HISTORY_ITEMS.map((item) => (
                  <div className="cardio-bool-field" key={item.code}>
                    <div className="cardio-bool-header">
                      <span className="cardio-bool-question">{isEn ? item.en : item.es}</span>
                      <span className="cardio-bool-code">
                        <code>{item.code}</code>
                        <small className="badge-d">D</small>
                      </span>
                    </div>
                    <div className="cardio-bool-options">
                      <button
                        type="button"
                        className={`cardio-bool-btn ${boolAnswers[item.code] === true ? 'selected-yes' : ''}`}
                        onClick={() => handleBoolChange(item.code, true)}
                      >
                        <span className="dot" />
                        {isEn ? 'Yes' : 'Sí'}
                      </button>
                      <button
                        type="button"
                        className={`cardio-bool-btn ${boolAnswers[item.code] === false ? 'selected-no' : ''}`}
                        onClick={() => handleBoolChange(item.code, false)}
                      >
                        <span className="dot" />
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              05. ANTECEDENTES FAMILIARES (PREDISPOSICIÓN GENÉTICA) (F)
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '05') && (
            <div style={{ marginBottom: 28 }}>
              <div className="form-section-title">
                <span className="form-section-number">05</span>
                <div>
                  <strong>{isEn ? 'Family Medical History (F)' : 'Antecedentes Familiares (F)'}</strong>
                  <small>{isEn ? 'Coronary disease, angina, myocardial infarction, stroke, or hypertension in relatives' : 'Familiares con enfermedad coronaria, angina de pecho, infarto, ACV o hipertensión'}</small>
                </div>
              </div>

              <div className="cardio-bool-grid">
                {FAMILY_HISTORY_ITEMS.map((item) => (
                  <div className="cardio-bool-field" key={item.code}>
                    <div className="cardio-bool-header">
                      <span className="cardio-bool-question">{isEn ? item.en : item.es}</span>
                      <span className="cardio-bool-code">
                        <code>{item.code}</code>
                        <small className="badge-f">F</small>
                      </span>
                    </div>
                    <div className="cardio-bool-options">
                      <button
                        type="button"
                        className={`cardio-bool-btn ${boolAnswers[item.code] === true ? 'selected-yes' : ''}`}
                        onClick={() => handleBoolChange(item.code, true)}
                      >
                        <span className="dot" />
                        {isEn ? 'Yes' : 'Sí'}
                      </button>
                      <button
                        type="button"
                        className={`cardio-bool-btn ${boolAnswers[item.code] === false ? 'selected-no' : ''}`}
                        onClick={() => handleBoolChange(item.code, false)}
                      >
                        <span className="dot" />
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              06. BIENESTAR EMOCIONAL Y OBSERVACIONES ADICIONALES
          ════════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === '06') && (
            <div style={{ marginBottom: 20 }}>
              <div className="form-section-title mental-title">
                <span className="form-section-number">06</span>
                <div>
                  <strong>{isEn ? 'Wellbeing & Additional Notes' : 'Bienestar Emocional y Observaciones'}</strong>
                  <small>{isEn ? 'Subjective stress perception and mission physician notes' : 'Percepción de estrés y notas clínicas adicionales para el médico de vuelo'}</small>
                </div>
              </div>

              <fieldset className="stress-field">
                <legend>{isEn ? 'How would you describe your stress level?' : '¿Cómo describirías tu nivel de estrés actual?'}</legend>
                <div className="radio-options">
                  <label className="radio-card">
                    <input
                      type="radio"
                      name="stress"
                      value={isEn ? 'Mildly stressed' : 'Levemente estresado'}
                      checked={stress === (isEn ? 'Mildly stressed' : 'Levemente estresado')}
                      onChange={(e) => setStress(e.target.value)}
                    />
                    <span className="radio-visual"><i /></span>
                    <span>
                      <strong>{t.low}</strong>
                      <small>{t.lowDetail}</small>
                    </span>
                    <span className="stress-face"><Icon name="smile" size={18} /></span>
                  </label>

                  <label className="radio-card">
                    <input
                      type="radio"
                      name="stress"
                      value={isEn ? 'Moderately stressed' : 'Regularmente estresado'}
                      checked={stress === (isEn ? 'Moderately stressed' : 'Regularmente estresado')}
                      onChange={(e) => setStress(e.target.value)}
                    />
                    <span className="radio-visual"><i /></span>
                    <span>
                      <strong>{t.medium}</strong>
                      <small>{t.mediumDetail}</small>
                    </span>
                    <span className="stress-face"><Icon name="neutral" size={18} /></span>
                  </label>

                  <label className="radio-card">
                    <input
                      type="radio"
                      name="stress"
                      value={isEn ? 'Highly stressed' : 'Altamente estresado'}
                      checked={stress === (isEn ? 'Highly stressed' : 'Altamente estresado')}
                      onChange={(e) => setStress(e.target.value)}
                    />
                    <span className="radio-visual"><i /></span>
                    <span>
                      <strong>{t.high}</strong>
                      <small>{t.highDetail}</small>
                    </span>
                    <span className="stress-face"><Icon name="frown" size={18} /></span>
                  </label>
                </div>
              </fieldset>

              <label className="field notes-field" style={{ marginTop: 14 }}>
                <span>{isEn ? 'Clinical observations / Notes' : 'Observaciones clínicas / Notas'} <small>{t.optional}</small></span>
                <textarea
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isEn ? 'Add any relevant telemetry or symptoms...' : 'Añadir notas relevantes o síntomas de misión...'}
                />
              </label>
            </div>
          )}

          {/* Feedback de voz y mensajes de confirmación */}
          {voice.listening && (
            <div className="voice-feedback">
              {copy[language].voice.listening}
            </div>
          )}

          {message && (
            <div className={`form-message${error ? ' error' : ''}`} role="status">
              {message}
            </div>
          )}

          {/* Pie de formulario con botón de acción */}
          <div className="form-footer">
            <span className="privacy-note">
              {isEn
                ? 'Evaluation encrypted in Supabase and local device storage.'
                : 'Evaluación cifrada en Supabase y almacenamiento local del dispositivo.'}
            </span>
            <button className="health-submit-button" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? (isEn ? 'Saving' : 'Guardando') : (isEn ? 'Save Clinical Evaluation' : 'Guardar Evaluación')}</span>
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
