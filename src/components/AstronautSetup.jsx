import { useState, useContext, useEffect } from 'react';
import { saveAstronautProfile } from '../lib/profile.js';
import { saveCloudProfile } from '../lib/supabase.js';
import { LanguageContext } from '../i18n.jsx';
import Icon from './Icon.jsx';
import brandLogo from '../../assets/airstark-logo.jpg';

const SPACE_APPS_LOGO = 'https://assets.spaceappschallenge.org/media/images/Space_Apps_Logo_Color_and_White.width-440.jpegquality-60.png';
const ASTRONAUT_IMG = 'https://assets.spaceappschallenge.org/media/images/Astronaut_exercise_2.2e16d0ba.fill-785x660.jpg';

function generateRandomCrewId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `A-${code}`;
}

const PRESETS = [
  {
    id: 'commander',
    name: 'Cmdr. Marcus Vega',
    crewId: 'A-9K21-YCXQ',
    missionEn: 'ISS Expedition 71',
    missionEs: 'ISS Expedición 71',
    roleEn: 'Expedition Commander',
    roleEs: 'Comandante de Expedición',
    avatar: 'MV',
    tag: 'NASA ISS',
    statusEn: 'Command Ready',
    statusEs: 'Listo para Mando',
  },
];

const TELEMETRY_MODES = [
  {
    id: 'ared',
    labelEn: 'ARED Microgravity Exercise',
    labelEs: 'Ejercicio Microgravedad (ARED)',
    hr: 142,
    spo2: '99%',
    vo2: '46 mL/kg',
    statusEn: 'Cardiovascular resistance protocol active',
    statusEs: 'Protocolo de resistencia cardiovascular activo',
    gravity: '0.00 G',
    load: '145 kg equiv.',
    ecgSpeed: '1.1s',
  },
  {
    id: 'sleep',
    labelEn: 'Circadian Rest & Sleep',
    labelEs: 'Reposo Circadiano y Sueño',
    hr: 58,
    spo2: '99%',
    vo2: '18 mL/kg',
    statusEn: 'Deep restorative sleep cycle in progress',
    statusEs: 'Ciclo de sueño profundo reparador en curso',
    gravity: '0.00 G',
    load: 'Rest cycle',
    ecgSpeed: '2.4s',
  },
  {
    id: 'eva',
    labelEn: 'EVA Spacewalk Telemetry',
    labelEs: 'Telemetría de Caminata EVA',
    hr: 118,
    spo2: '98%',
    vo2: '38 mL/kg',
    statusEn: 'EMU spacesuit biometric sync nominal',
    statusEs: 'Sincronización biométrica en traje EMU nominal',
    gravity: '0.00 G · Vacuum',
    load: 'Suit delta 4.3 psi',
    ecgSpeed: '1.4s',
  },
];

export default function AstronautSetup({ language: propLang, onDone, cloudError }) {
  const context = useContext(LanguageContext);
  const language = context?.language || propLang || 'en';
  const setLanguage = context?.setLanguage || (() => {});
  const en = language === 'en';

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('commander');
  const [activeTelemetry, setActiveTelemetry] = useState('ared');
  const [livePulse, setLivePulse] = useState(142);

  // Form states so presets and random generation reflect instantly in inputs
  const [name, setName] = useState('Cmdr. Marcus Vega');
  const [crewId, setCrewId] = useState('A-9K21-YCXQ');
  const [mission, setMission] = useState(en ? 'ISS Expedition 71' : 'ISS Expedición 71');
  const [role, setRole] = useState(en ? 'Expedition Commander' : 'Comandante de Expedición');

  const missionSuggestions = en
    ? ['Artemis III · Lunar Base', 'ISS Expedition 71', 'Lunar Gateway Orbit', 'Mars Transit 2026']
    : ['Artemis III · Base Lunar', 'ISS Expedición 71', 'Órbita Lunar Gateway', 'Tránsito a Marte 2026'];

  const roleSuggestions = en
    ? ['Medical Officer', 'Mission Commander', 'Flight Engineer', 'Payload Specialist']
    : ['Oficial Médico', 'Comandante de Misión', 'Ingeniero de Vuelo', 'Especialista de Carga'];

  // Keep live pulse varying subtly for realism
  useEffect(() => {
    const mode = TELEMETRY_MODES.find((m) => m.id === activeTelemetry) || TELEMETRY_MODES[0];
    const baseHr = mode.hr;
    setLivePulse(baseHr);

    const interval = setInterval(() => {
      const jitter = Math.floor(Math.random() * 5) - 2;
      setLivePulse(baseHr + jitter);
    }, 2400);

    return () => clearInterval(interval);
  }, [activeTelemetry]);

  const currentMode = TELEMETRY_MODES.find((m) => m.id === activeTelemetry) || TELEMETRY_MODES[0];

  function applyPreset(preset) {
    setSelectedPreset(preset.id);
    setName(preset.name);
    setCrewId(preset.crewId);
    setMission(en ? preset.missionEn : preset.missionEs);
    setRole(en ? preset.roleEn : preset.roleEs);
  }

  function handleRandomizeCrewId(e) {
    e.preventDefault();
    setCrewId(generateRandomCrewId());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try { localStorage.removeItem('airstark.signedOut'); } catch {}

    const trimmedName = name.trim() || (en ? 'Cmdr. Marcus Vega' : 'Cmdr. Marcus Vega');
    const trimmedCrewId = (crewId.trim() || 'A-9K21-YCXQ').toUpperCase();
    const trimmedMission = mission.trim() || (en ? 'ISS Expedition 71' : 'ISS Expedición 71');
    const trimmedRole = role.trim() || (en ? 'Expedition Commander' : 'Comandante de Expedición');

    const profile = saveAstronautProfile({
      name: trimmedName,
      crewId: trimmedCrewId,
      mission: trimmedMission,
      role: trimmedRole,
    });

    try {
      const saved = await saveCloudProfile(profile);
      onDone(saved || profile);
    } catch (error) {
      setMessage(
        en
          ? `Saved locally. Cloud sync warning: ${error.message || 'offline mode'}`
          : `Guardado localmente. Aviso de sincronización en la nube: ${error.message || 'modo sin conexión'}`
      );
      onDone(profile);
    } finally {
      setSaving(false);
    }
  }

  // Get display initials for live preview badge
  const displayInitials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('')
    : 'AC';

  return (
    <main className="auth-screen space-apps-portal">
      {/* Background Starfield and Orbital Grid */}
      <div className="portal-space-bg" aria-hidden="true">
        <div className="portal-nebula" />
        <div className="portal-grid" />
        <div className="portal-particles" />
      </div>

      {/* Top Banner Navigation Bar */}
      <header className="portal-topbar">
        <div className="portal-brand">
          <img src={brandLogo} alt="Airstark Logo" className="portal-brand-logo" />
          <div className="portal-brand-text">
            <span className="portal-brand-name">AIRSTARK</span>
            <span className="portal-brand-sub">FOR ASTRONAUTS</span>
          </div>
        </div>

        <div className="portal-event-badge">
          <span className="portal-live-indicator" />
          <span className="portal-event-title">
            {en ? 'NASA SPACE APPS CHALLENGE 2026' : 'DESAFÍO NASA SPACE APPS 2026'}
          </span>
          <span className="portal-event-sep">/</span>
          <span className="portal-challenge-pill">
            {en ? 'HEALTH MONITORING FOR ASTRONAUTS' : 'MONITOREO DE SALUD PARA ASTRONAUTAS'}
          </span>
        </div>

        <div className="portal-top-actions">
          <div className="language-switch" role="group" aria-label="Language selector">
            <button
              type="button"
              className={language === 'en' ? 'active' : ''}
              onClick={() => {
                setLanguage('en');
                if (!name) {
                  setMission('Artemis III · Lunar Base');
                  setRole('Flight crew member');
                }
              }}
              aria-pressed={language === 'en'}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'es' ? 'active' : ''}
              onClick={() => {
                setLanguage('es');
                if (!name) {
                  setMission('Artemis III · Base Lunar');
                  setRole('Tripulante de vuelo');
                }
              }}
              aria-pressed={language === 'es'}
            >
              ES
            </button>
          </div>

          <a
            className="space-apps-mark portal-space-apps-link"
            href="https://www.spaceappschallenge.org/"
            target="_blank"
            rel="noreferrer"
            aria-label="NASA Space Apps Challenge"
            title="NASA Space Apps Challenge"
          >
            <img src={SPACE_APPS_LOGO} alt="NASA Space Apps Challenge" />
          </a>
        </div>
      </header>

      {/* Main Two-Column Showcase & Check-in Layout */}
      <div className="portal-content-grid">
        {/* LEFT COLUMN: Challenge Showcase & Interactive Astronaut Bio-HUD */}
        <section className="portal-hero-showcase">
          <div className="challenge-spotlight-card">
            <div className="challenge-tag-row">
              <span className="challenge-badge">
                <Icon name="sparkles" size={13} />
                {en ? 'GLOBAL HACKATHON CHALLENGE' : 'DESAFÍO GLOBAL DE HACKATÓN'}
              </span>
              <span className="challenge-orbit-tag">
                <Icon name="satellite" size={13} />
                LEO · ISS 408 KM
              </span>
            </div>

            {/* BILINGUAL CHALLENGE HEADLINE */}
            <h2 className="challenge-headline">
              {en
                ? 'Create Health Monitoring Software for Astronauts on Space Missions'
                : 'Crear Software de Monitoreo de Salud para Astronautas en Misiones Espaciales'}
            </h2>

            <p className="challenge-summary">
              {en
                ? 'Long-duration spaceflight exposes astronauts to microgravity bone and muscle loss, intense cosmic radiation, and psychological confinement. AIRSTARK provides an autonomous clinical command center combining real-time smartwatch telemetry, 3D digital twin body mapping, and an AI health copilot.'
                : 'Los vuelos espaciales de larga duración exponen a los astronautas a pérdida muscular y ósea por microgravedad, radiación cósmica y confinamiento. AIRSTARK proporciona un centro clínico autónomo con telemetría de reloj inteligente en tiempo real, gemelo digital 3D y un copiloto médico con IA.'}
            </p>
          </div>

          {/* Interactive Astronaut Photo Card with Live HUD Telemetry */}
          <div className="astronaut-hud-card">
            <div className="hud-card-header">
              <div className="hud-title-wrap">
                <span className="hud-kicker">{en ? 'OFFICIAL CHALLENGE VISUAL' : 'IMAGEN OFICIAL DEL RETO'}</span>
                <strong className="hud-title">
                  {en ? 'Astronaut Exercise in Microgravity' : 'Ejercicio de Astronauta en Microgravedad'}
                </strong>
              </div>
              <div className="hud-status-badge">
                <span className="live-dot" />
                <span>{en ? 'BIO-FEED NOMINAL' : 'TELEMETRÍA NOMINAL'}</span>
              </div>
            </div>

            <div className="astronaut-image-container">
              <img
                src={ASTRONAUT_IMG}
                alt="Astronaut exercising on space mission"
                className="astronaut-hero-photo"
              />
              <div className="hud-scanline-overlay" aria-hidden="true" />
              <div className="hud-corner-tl" aria-hidden="true" />
              <div className="hud-corner-tr" aria-hidden="true" />
              <div className="hud-corner-bl" aria-hidden="true" />
              <div className="hud-corner-br" aria-hidden="true" />

              {/* Floating Live Telemetry Badges over the photo */}
              <div className="hud-overlay-metrics">
                <div className="hud-pill hud-pill-heart">
                  <Icon name="heart" size={14} className="hud-heart-pulse" />
                  <div>
                    <span className="hud-pill-label">{en ? 'HEART RATE' : 'RITMO CARDÍACO'}</span>
                    <strong className="hud-pill-val">{livePulse} <small>BPM</small></strong>
                  </div>
                </div>

                <div className="hud-pill hud-pill-spo2">
                  <Icon name="pulse" size={14} />
                  <div>
                    <span className="hud-pill-label">SpO₂</span>
                    <strong className="hud-pill-val">{currentMode.spo2}</strong>
                  </div>
                </div>

                <div className="hud-pill hud-pill-env">
                  <Icon name="shield" size={14} />
                  <div>
                    <span className="hud-pill-label">{en ? 'GRAVITY / LOAD' : 'GRAVEDAD / CARGA'}</span>
                    <strong className="hud-pill-val">{currentMode.gravity}</strong>
                  </div>
                </div>
              </div>

              {/* Live Animated ECG Line overlay */}
              <div className="hud-ecg-strip">
                <div className="ecg-status-text">
                  <span>ECG V5 TELEMETRY</span>
                  <span>{en ? currentMode.statusEn : currentMode.statusEs}</span>
                </div>
                <svg className="ecg-svg" viewBox="0 0 500 40" preserveAspectRatio="none">
                  <path
                    d="M 0 20 L 70 20 L 85 20 L 95 6 L 105 34 L 115 10 L 125 24 L 135 20 L 220 20 L 235 20 L 245 4 L 255 36 L 265 8 L 275 25 L 285 20 L 370 20 L 385 20 L 395 5 L 405 35 L 415 9 L 425 25 L 435 20 L 500 20"
                    fill="none"
                    stroke="#54d7ee"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Interactive Telemetry Mode Selector for Judges */}
            <div className="telemetry-interactive-bar">
              <span className="telemetry-switch-label">
                <Icon name="sparkles" size={13} />
                {en ? 'Interactive Simulation Mode:' : 'Modo de Simulación Interactiva:'}
              </span>
              <div className="telemetry-buttons" role="tablist">
                {TELEMETRY_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTelemetry === mode.id}
                    className={`telemetry-mode-btn ${activeTelemetry === mode.id ? 'active' : ''}`}
                    onClick={() => setActiveTelemetry(mode.id)}
                  >
                    <span>{en ? mode.labelEn : mode.labelEs}</span>
                    <span className="mode-btn-rate">{mode.hr} bpm</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Feature Innovation Highlights */}
            <div className="solution-pillars-grid">
              <div className="pillar-item">
                <span className="pillar-icon"><Icon name="watch" size={16} /></span>
                <div>
                  <strong>{en ? 'Smartwatch Telemetry' : 'Telemetría de Reloj'}</strong>
                  <p>{en ? 'Live Bluetooth & Galaxy Watch CSV' : 'Bluetooth y CSV de Galaxy Watch'}</p>
                </div>
              </div>

              <div className="pillar-item">
                <span className="pillar-icon"><Icon name="cube" size={16} /></span>
                <div>
                  <strong>{en ? '3D Digital Twin' : 'Gemelo Digital 3D'}</strong>
                  <p>{en ? 'Volumetric body-health mapping' : 'Mapeo anatómico volumétrico'}</p>
                </div>
              </div>

              <div className="pillar-item">
                <span className="pillar-icon"><Icon name="assistant" size={16} /></span>
                <div>
                  <strong>{en ? 'Voice AI Copilot' : 'Copiloto IA por Voz'}</strong>
                  <p>{en ? 'Hands-free crew triage & advice' : 'Triaje médico manos libres'}</p>
                </div>
              </div>

              <div className="pillar-item">
                <span className="pillar-icon"><Icon name="shield" size={16} /></span>
                <div>
                  <strong>{en ? 'Cloud Sync & Vault' : 'Sincronización en la Nube'}</strong>
                  <p>{en ? 'Supabase cloud resilience' : 'Base de datos Supabase cifrada'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Full-Height Check-In Form & Live Crew Credential */}
        <section className="portal-auth-panel panel">
          <div className="auth-panel-inner">
            {/* Header */}
            <div className="auth-panel-heading">
              <div className="kicker-row">
                <span className="section-kicker">AIRSTARK · CREW CHECK-IN</span>
                <span className="auth-version-pill">v2.4 ORBIT</span>
              </div>
              <h1 className="auth-title">
                {en ? 'Enter Mission Center' : 'Acceso al Centro de Misión'}
              </h1>
              <p className="auth-subtitle">
                {en
                  ? 'Sign in or select a demo profile to initialize your space health telemetry feed. Sample datasets are loaded automatically.'
                  : 'Identifícate o elige un perfil demo para inicializar tu telemetría médica espacial. Se cargan datos de muestra automáticamente.'}
              </p>
            </div>

            {/* JUROR FAST-TRACK / DEMO PRESETS */}
            <div className="presets-box">
              <div className="presets-box-header">
                <span className="presets-title">
                  <Icon name="rocket" size={13} />
                  {en ? 'FAST-TRACK PROFILES FOR JUDGES' : 'PERFILES RÁPIDOS PARA JURADOS'}
                </span>
                <small className="presets-note">
                  {en ? '1-click quick evaluation' : '1 clic para evaluación rápida'}
                </small>
              </div>

              <div className="presets-grid" role="group" aria-label="Demo Presets">
                {PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id || name === preset.name;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => applyPreset(preset)}
                    >
                      <div className="preset-avatar">{preset.avatar}</div>
                      <div className="preset-info">
                        <div className="preset-top-line">
                          <strong>{preset.name}</strong>
                          <span className="preset-tag">{preset.tag}</span>
                        </div>
                        <small className="preset-role">
                          {en ? preset.roleEn : preset.roleEs} · {preset.crewId}
                        </small>
                      </div>
                      {isSelected && <span className="preset-check"><Icon name="check" size={14} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VERIFIED DEMO PROFILE FORM */}
            <form className="profile-form portal-form" onSubmit={handleSubmit}>
              <div style={{
                background: 'rgba(84, 215, 238, 0.06)',
                border: '1px solid rgba(84, 215, 238, 0.22)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: '#8ee6f3',
                fontFamily: 'var(--mono)',
                marginBottom: '12px'
              }}>
                <span className="live-dot" />
                <span>{en ? 'CREDENTIALS LOCKED FOR DEMO · SUPABASE LINKED (845cc4fa)' : 'CREDENCIALES OFICIALES PARA DEMO · SUPABASE ENLAZADO (845cc4fa)'}</span>
              </div>

              <div className="form-fields-grid">
                {/* Full Name Field */}
                <label className="field">
                  <span>
                    {en ? 'Astronaut Name' : 'Nombre del Astronauta'} <em>*</em>
                  </span>
                  <div className="input-wrap">
                    <input
                      className="profile-text-input"
                      name="name"
                      value={name}
                      readOnly
                      style={{ cursor: 'default', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(84,215,238,0.2)' }}
                      required
                    />
                    <span className="input-icon-decor"><Icon name="user" size={15} /></span>
                  </div>
                </label>

                {/* Crew ID Field */}
                <label className="field">
                  <span>
                    {en ? 'Crew ID (Locked)' : 'ID de Tripulación (Fijo)'} <em>*</em>
                  </span>
                  <div className="input-wrap">
                    <input
                      className="profile-text-input mono-font"
                      name="crewId"
                      value={crewId}
                      readOnly
                      style={{ cursor: 'default', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(84,215,238,0.2)' }}
                      required
                    />
                    <span className="input-icon-decor"><Icon name="shield" size={15} /></span>
                  </div>
                </label>
              </div>

              <div className="form-fields-grid">
                {/* Mission Field */}
                <label className="field">
                  <span>{en ? 'Assigned Mission' : 'Misión Asignada'} <em>*</em></span>
                  <div className="input-wrap">
                    <input
                      className="profile-text-input"
                      name="mission"
                      value={mission}
                      readOnly
                      style={{ cursor: 'default', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(84,215,238,0.2)' }}
                      required
                    />
                    <span className="input-icon-decor"><Icon name="satellite" size={15} /></span>
                  </div>
                </label>

                {/* Crew Role Field */}
                <label className="field">
                  <span>{en ? 'Crew Role' : 'Rol en la Tripulación'}</span>
                  <div className="input-wrap">
                    <input
                      className="profile-text-input"
                      name="role"
                      value={role}
                      readOnly
                      style={{ cursor: 'default', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(84,215,238,0.2)' }}
                    />
                    <span className="input-icon-decor"><Icon name="sparkles" size={15} /></span>
                  </div>
                </label>
              </div>

              {/* Holographic Crew Boarding Pass / Biometric Live Preview */}
              <div className="crew-badge-preview">
                <div className="badge-preview-header">
                  <div className="badge-preview-avatar">{displayInitials}</div>
                  <div className="badge-preview-copy">
                    <div className="badge-preview-name-row">
                      <strong className="badge-preview-name">
                        {name.trim() || (en ? 'Alex Crew (Sample Pilot)' : 'Alex Tripulante (Piloto Demo)')}
                      </strong>
                      <span className="badge-preview-status">
                        <span className="live-dot" />
                        {en ? 'READY FOR FLIGHT' : 'LISTO PARA VUELO'}
                      </span>
                    </div>
                    <small className="badge-preview-sub">
                      {role || (en ? 'Flight crew member' : 'Tripulante de vuelo')} · {mission}
                    </small>
                  </div>
                </div>

                <div className="badge-telemetry-strip">
                  <div className="badge-stat">
                    <span>{en ? 'CREW ID' : 'ID TRIPULACIÓN'}</span>
                    <strong>{crewId}</strong>
                  </div>
                  <div className="badge-stat">
                    <span>{en ? 'BIO-FEED' : 'BIO-SEÑAL'}</span>
                    <strong>{en ? 'SYNC OK' : 'SINC OK'}</strong>
                  </div>
                  <div className="badge-stat">
                    <span>{en ? 'SECURITY' : 'SEGURIDAD'}</span>
                    <strong>HIPAA/SPACE</strong>
                  </div>
                  <div className="badge-stat">
                    <span>{en ? 'CLOUD VAULT' : 'BÓVEDA NUBE'}</span>
                    <strong>SUPABASE</strong>
                  </div>
                </div>
              </div>

              {/* Big Action Button */}
              <button className="submit-button portal-submit-button" type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <span className="button-spinner" />
                    <span>{en ? 'Initializing Telemetry Link…' : 'Inicializando Enlace de Telemetría…'}</span>
                  </>
                ) : (
                  <>
                    <Icon name="rocket" size={16} />
                    <span>{en ? 'Enter Mission Center' : 'Entrar al Centro de Misión'}</span>
                    <Icon name="arrowRight" size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Feedback messages */}
            {cloudError && <div className="form-message error" role="status">{cloudError}</div>}
            {message && <div className="form-message error" role="status">{message}</div>}

            {/* Bottom Security / Prototype Footer */}
            <div className="auth-footer-notes">
              <div className="auth-note-item">
                <Icon name="shield" size={12} />
                <span>{en ? 'HIPAA / Space Medical Sandbox Mode' : 'Modo Seguro para Datos Médicos Espaciales'}</span>
              </div>
              <div className="auth-note-item">
                <span className="live-dot" />
                <span>{en ? 'Supabase Cloud Vault Ready' : 'Almacén Seguro Supabase Listo'}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
