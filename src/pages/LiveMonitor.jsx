import { useEffect, useId, useRef, useState, useCallback, memo } from 'react';
import { copy, useLanguage } from '../i18n.jsx';
import Icon from '../components/Icon.jsx';
import { askAgent } from '../lib/health.js';
import { speakText, useVoiceRecognition } from '../hooks/useVoiceRecognition.js';
import { exportRecords, formatDate, getCurrentRecords, getSavedRecords, localizeStress, readSmartwatchCsv, saveRecords, stressLabel } from '../lib/health.js';
import { computeCardiacZone, computeHrvMetrics } from '../lib/bleHeartRate.js';
import {
  connectBleGlobal,
  disconnectBleGlobal,
  getBleState,
  subscribeBleStatus,
  subscribeBlePacket,
} from '../lib/bleManager.js';

// ─── Mathematical ECG Wave identical to cardiac simulator ─────────────────────
function normalizePhase(phase) {
  return phase - Math.floor(phase);
}

function wave(phase, center, width, amplitude) {
  const distance = Math.abs(phase - center);
  return amplitude * Math.exp(-0.5 * (Math.min(distance, 1 - distance) / width) ** 2);
}

function ecgAmplitude(phase) {
  const sample = normalizePhase(phase);
  // P-Q-R-S-T waves identical to clinical ECG
  return wave(sample, 0.82, 0.035, 0.16)
    + wave(sample, 0.965, 0.015, -0.21)
    + wave(sample, 0, 0.013, 1)
    + wave(sample, 0.034, 0.018, -0.33)
    + wave(sample, 0.29, 0.075, 0.31);
}

const ECG_WIDTH = 280;
const ECG_HEIGHT = 80;
const SECONDS_SHOWN = 2.85;

const LiveECGTrace = memo(function LiveECGTrace({ phase, bpm, playing }) {
  const fine = useId();
  const grid = useId();
  const fade = useId();
  const beatsVisible = (SECONDS_SHOWN * bpm) / 60;
  const cursorX = ECG_WIDTH - 8;
  const baseline = 46;
  const height = 28;
  const points = Array.from({ length: cursorX + 1 }, (_, x) => {
    const sample = phase - beatsVisible * (1 - x / cursorX);
    return `${x},${(baseline - ecgAmplitude(sample) * height).toFixed(2)}`;
  }).join(' ');

  return (
    <svg
      className="monitor-ecg-svg"
      viewBox={`0 0 ${ECG_WIDTH} ${ECG_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Electrocardiograma en tiempo real"
    >
      <defs>
        <pattern id={fine} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 H 0 V 8" fill="none" stroke="#2feaa8" strokeWidth="0.5" opacity="0.12" />
        </pattern>
        <pattern id={grid} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={`url(#${fine})`} />
          <path d="M 40 0 H 0 V 40" fill="none" stroke="#2feaa8" strokeWidth="0.7" opacity="0.22" />
        </pattern>
        <linearGradient id={fade}>
          <stop offset="0%" stopColor="#2feaa8" stopOpacity="0.15" />
          <stop offset="35%" stopColor="#2feaa8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#2feaa8" />
        </linearGradient>
      </defs>
      <rect width={ECG_WIDTH} height={ECG_HEIGHT} fill="#07151a" />
      <rect width={ECG_WIDTH} height={ECG_HEIGHT} fill={`url(#${grid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${fade})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={cursorX}
        cy={baseline - height * ecgAmplitude(phase)}
        r="2.8"
        fill="#2feaa8"
        className={playing ? 'pulse-cursor' : ''}
      />
    </svg>
  );
});

// ─── Inline Compact AI Assistant ──────────────────────────────────────────────
function renderMessage(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function CompactAssistant({ language }) {
  const t = copy[language].assistant;
  const voice = useVoiceRecognition(language);
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: t.welcome }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const bottom = useRef(null);
  const callRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => () => { callRef.current = false; window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, pending]);

  function beginListening() {
    if (!callRef.current || pendingRef.current) return;
    voice.start((transcript) => send(transcript, true), { continuous: true });
  }

  async function send(text = question, fromCall = false) {
    const clean = text.trim();
    if (!clean || pendingRef.current) return;
    if (fromCall) voice.stop();
    setQuestion(''); setPending(true); pendingRef.current = true;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: clean }]);
    try {
      const answer = await askAgent(clean, language);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: answer }]);
      if (fromCall && callRef.current) speakText(answer, language, beginListening);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', error: true, text: t.failed }]);
      if (fromCall && callRef.current) speakText(t.failed, language, beginListening);
    } finally { setPending(false); pendingRef.current = false; }
  }

  function toggleCall() {
    if (callRef.current) {
      callRef.current = false; setCallActive(false); voice.stop(); window.speechSynthesis?.cancel();
      return;
    }
    callRef.current = true; setCallActive(true); beginListening();
  }

  function toggleDictation() {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start((transcript) => {
        setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  }

  return (
    <div className={`monitor-assistant-card ${callActive ? 'call-active' : ''}`}>
      <div className="monitor-card-header">
        <div className="monitor-card-title">
          <Icon name="assistant" size={13} />
          <span>{language === 'es' ? 'Asistente IA · Copilot' : 'AI Copilot Assistant'}</span>
        </div>
        <div className="monitor-call-actions">
          <button
            type="button"
            className={`monitor-call-toggle ${callActive ? 'end' : ''}`}
            onClick={toggleCall}
            disabled={!voice.supported}
            title={callActive ? t.endCall : t.startCall}
          >
            <Icon name={callActive ? 'close' : 'microphone'} size={12} />
            <span>{callActive ? t.endCall : t.startCall}</span>
          </button>
        </div>
      </div>

      {callActive && (
        <div className="monitor-call-banner">
          <span className="call-status-dot active" />
          <span>{voice.listening ? t.listeningCall : t.callLive}</span>
        </div>
      )}

      <div className="monitor-chat-window" role="log" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`monitor-chat-msg ${msg.role}${msg.error ? ' error' : ''}`}>
            {msg.role === 'assistant' && <span className="monitor-chat-avatar"><Icon name="assistant" size={12} /></span>}
            <div className={`monitor-chat-bubble ${msg.role}`}>
              {msg.role === 'assistant' ? renderMessage(msg.text) : msg.text}
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  className="monitor-speak-btn"
                  onClick={() => speakText(msg.text, language)}
                  title={language === 'es' ? 'Escuchar respuesta' : 'Read aloud'}
                  aria-label={language === 'es' ? 'Escuchar' : 'Read aloud'}
                >
                  <Icon name="volume" size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="monitor-chat-msg assistant">
            <span className="monitor-chat-avatar"><Icon name="assistant" size={12} /></span>
            <div className="monitor-chat-bubble assistant">{t.pending} <span className="typing-dots"><i /><i /><i /></span></div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {voice.listening && !callActive && (
        <div className="monitor-voice-feedback">
          <Icon name="microphone" size={11} /> {copy[language].voice.listening}
        </div>
      )}

      <form className="monitor-chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={callActive ? (language === 'es' ? 'Habla por el micrófono…' : 'Speak into microphone…') : t.placeholder}
          disabled={pending || callActive}
          maxLength={500}
        />
        <button
          type="button"
          className={`monitor-dictate-btn ${voice.listening && !callActive ? 'active' : ''}`}
          onClick={toggleDictation}
          disabled={!voice.supported || pending || callActive}
          title={copy[language].voice.dictate}
          aria-label={copy[language].voice.dictate}
        >
          <Icon name="microphone" size={13} />
        </button>
        <button type="submit" disabled={pending || !question.trim() || callActive} aria-label={t.send}>
          <Icon name="arrowUp" size={13} />
        </button>
      </form>
    </div>
  );
}

// ─── Compact History Table ────────────────────────────────────────────────────
function CompactHistory({ language }) {
  const t = copy[language].history;
  const records = getCurrentRecords();
  const saved = getSavedRecords();
  const recent = records.slice(0, 10);

  return (
    <div className="monitor-history-card">
      <div className="monitor-card-header">
        <div className="monitor-card-title">
          <Icon name="pulse" size={13} />
          <span>{language === 'es' ? 'Historial de mediciones' : 'Measurement history'}</span>
        </div>
        {saved.length > 0 && (
          <button type="button" className="monitor-export-pill" onClick={() => exportRecords(saved)}>
            ↓ CSV
          </button>
        )}
      </div>
      <div className="monitor-history-scroll">
        {recent.length === 0 ? (
          <p className="monitor-history-empty">{t.empty}</p>
        ) : (
          <table className="monitor-history-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'HORA' : 'TIME'}</th>
                <th>BPM</th>
                {/* <th>{language === 'es' ? 'PRESIÓN' : 'BP'}</th> */}
                <th>{language === 'es' ? 'ESTRÉS' : 'STRESS'}</th>
                <th>{language === 'es' ? 'ORIGEN' : 'SRC'}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => {
                const ns = stressLabel(r.stress);
                return (
                  <tr key={`${r.date}-${i}`}>
                    <td>{formatDate(r.date, { hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</td>
                    <td className="history-bpm-cell">{r.heartRate ? <strong>{r.heartRate}</strong> : '—'}</td>
                    {/* <td>{r.pressure || '—'}</td> */}
                    <td><span className={`status-chip ${ns === 'Alto' ? 'high' : ns === 'Moderado' ? 'medium' : ''}`}>{localizeStress(r.stress, language, r.stressScore)}</span></td>
                    <td><span className={`source-pill ${r.source}`}>{r.source === 'demo' ? 'mock' : r.source}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main LiveMonitor Component ───────────────────────────────────────────────
export default function LiveMonitor() {
  const { language } = useLanguage();
  const [bpm, setBpm] = useState(72);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  // ─── Estados de Web Bluetooth BLE (Sincronizados con el Singleton Global) ──
  const [bleState, setBleState] = useState(() => getBleState());
  const bleStatus = bleState.status;
  const bleDeviceName = bleState.deviceName;
  const bleBattery = bleState.batteryLevel;
  const lastSavedTimeStr = bleState.lastSavedTimeStr;
  const bleError = bleState.error;
  const [rawHex, setRawHex] = useState(() => bleState.latestPacket?.rawHex || '00 48');
  const [sensorContact, setSensorContact] = useState(() => bleState.latestPacket?.sensorContact || 'contact');
  const [rrIntervals, setRrIntervals] = useState(() => bleState.latestPacket?.rrIntervalsMs || [833]);

  // ─── Estados de Reproducción de CSV (BPM-por-minuto) ───────────────────
  const [csvReplayMode, setCsvReplayMode] = useState(false);
  const [csvSamples, setCsvSamples] = useState([]);
  const [csvIndex, setCsvIndex] = useState(0);
  const [csvFileName, setCsvFileName] = useState('');
  const fileInputRef = useRef(null);

  // Sync BPM and Playing state to cardiac simulator iframe
  const postToSimulator = useCallback((newBpm) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage({ type: 'AIRSTARK_SET_BPM', bpm: newBpm }, '*');
    } catch {
      // Cross-origin fallback
    }
  }, []);

  const changeBpm = useCallback((val) => {
    const num = Math.min(180, Math.max(40, Math.round(val)));
    setBpm(num);
    postToSimulator(num);
  }, [postToSimulator]);

  // Suscribirse a la conexión BLE global persistente
  useEffect(() => {
    const unsubStatus = subscribeBleStatus(() => {
      setBleState(getBleState());
    });
    const unsubPacket = subscribeBlePacket((packet) => {
      if (packet) {
        changeBpm(packet.bpm);
        if (packet.rawHex) setRawHex(packet.rawHex);
        if (packet.sensorContact) setSensorContact(packet.sensorContact);
        if (packet.rrIntervalsMs?.length) {
          setRrIntervals((prev) => [...prev.slice(-25), ...packet.rrIntervalsMs]);
        }
        setBleState(getBleState());
      }
    });

    return () => {
      unsubStatus();
      unsubPacket();
    };
  }, [changeBpm]);

  // Manejo de conexión Bluetooth Web BLE
  const handleToggleBle = async () => {
    if (bleStatus === 'connected') {
      await disconnectBleGlobal();
      return;
    }

    try {
      setCsvReplayMode(false);
      await connectBleGlobal();
    } catch (err) {
      console.warn('Bluetooth connection error:', err);
    }
  };

  // Carga de archivo CSV para reproducción en tiempo real
  const handleLoadCsvFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readSmartwatchCsv(file);
      if (parsed.records?.length) {
        setCsvSamples(parsed.records);
        setCsvFileName(file.name);
        setCsvIndex(0);
        setCsvReplayMode(true);
        if (bleStatus === 'connected') {
          await disconnectBleGlobal();
        }
        const first = parsed.records[0];
        if (first.heartRate) changeBpm(first.heartRate);
        if (first.rawHex) setRawHex(first.rawHex);
      }
    } catch (err) {
      alert(err.message || 'No se pudo cargar el archivo CSV');
    }
    e.target.value = '';
  };

  // Temporizador de avance para reproducción CSV
  useEffect(() => {
    if (!csvReplayMode || !playing || !csvSamples.length) return;
    const interval = setInterval(() => {
      setCsvIndex((prev) => {
        const next = (prev + 1) % csvSamples.length;
        const currentSample = csvSamples[next];
        if (currentSample.heartRate) {
          changeBpm(currentSample.heartRate);
        }
        if (currentSample.rawHex) {
          setRawHex(currentSample.rawHex);
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [csvReplayMode, playing, csvSamples, changeBpm]);

  // Animated phase loop for continuous ECG trace
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf;
    function loop(now) {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((prev) => normalizePhase(prev + (dt * bpm) / 60));
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, bpm]);

  useEffect(() => {
    if (iframeReady) {
      postToSimulator(bpm);
    }
  }, [iframeReady, bpm, postToSimulator]);

  // Métricas calculadas con los algoritmos de BPM-por-minuto
  const cardiacZone = computeCardiacZone(bpm);
  const hrvMetrics = computeHrvMetrics(rrIntervals);
  const currentRr = bpm > 0 ? Math.round(60000 / bpm) : 833;

  return (
    <div className="live-monitor-container">
      <div className="live-monitor-grid">
        {/* ══════════════════════════════════════════════════════════════
            COLUMNA IZQUIERDA:
            Electrocardiograma y Monitoreo en tiempo real del BPM
            ══════════════════════════════════════════════════════════════ */}
        <section className="monitor-col-panel monitor-ecg-col" aria-label="Electrocardiograma y Ritmo cardíaco">
          <div className="monitor-panel-header">
            <span className={`live-status-pill ${bleStatus === 'connected' ? 'running' : csvReplayMode ? 'running' : 'running'}`}>
              <i /> {bleStatus === 'connected' ? `${language === 'es' ? 'BLE EN VIVO' : 'LIVE BLE'}: ${bleDeviceName}` : csvReplayMode ? `CSV REPLAY: ${csvFileName}` : (language === 'es' ? 'MONITOREO EN TIEMPO REAL' : 'REAL-TIME MONITOR')}
            </span>
          </div>

          {/* Tarjeta de Frecuencia cardíaca y ECG (diseño del simulador) */}
          <div className="ecg-rhythm-box">
            <div className="ecg-rhythm-top">
              <div className="ecg-field-title">
                <Icon name="pulse" size={14} />
                <span>{language === 'es' ? 'Frecuencia cardíaca' : 'Heart Rate'}</span>
              </div>
              <div className="ecg-bpm-readout">
                <output>{bpm}</output>
                <span>BPM</span>
              </div>
            </div>

            <div className="ecg-trace-container">
              <div className="ecg-trace-title">
                <span>{language === 'es' ? 'ECG ilustrativo' : 'Illustrative ECG'}</span>
                <span className={`pulse-status-badge ${playing ? 'running' : 'paused'}`}>
                  <i /> {playing ? (language === 'es' ? 'En reproducción' : 'Running') : (language === 'es' ? 'En pausa' : 'Paused')}
                </span>
              </div>
              <div className="ecg-svg-wrap">
                <LiveECGTrace phase={phase} bpm={bpm} playing={playing} />
              </div>
            </div>

            {/* Ajustar BPM slider & presets */}
            <div className="ecg-adjust-box">
              <div className="ecg-slider-header">
                <label htmlFor="bpm-slider">{language === 'es' ? 'Ajustar BPM' : 'Adjust BPM'}</label>
                <strong>{bpm} bpm · {cardiacZone.shortName}</strong>
              </div>
              <div className="ecg-slider-row">
                <span>40</span>
                <input
                  id="bpm-slider"
                  type="range"
                  min="40"
                  max="180"
                  value={bpm}
                  onChange={(e) => changeBpm(Number(e.target.value))}
                  style={{ '--range': `${((bpm - 40) / 140) * 100}%` }}
                />
                <span>180</span>
              </div>
              <div className="ecg-presets-row">
                {[60, 75, 120].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`ecg-preset-btn ${bpm === preset ? 'active' : ''}`}
                    onClick={() => changeBpm(preset)}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  className={`ecg-play-toggle ${playing ? 'is-playing' : ''}`}
                  onClick={() => setPlaying(!playing)}
                  title={playing ? 'Pausar' : 'Reproducir'}
                >
                  {playing ? (language === 'es' ? '⏸ Pausa' : '⏸ Pause') : (language === 'es' ? '▶ Reanudar' : '▶ Play')}
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta de integración Web Bluetooth BLE y Telemetría SM-R860 */}
          <div className="astronaut-vitals-card">
            <div className="vitals-header">
              <span>{language === 'es' ? 'CONEXIÓN GALAXY WATCH (BLE)' : 'GALAXY WATCH BLE'}</span>
              <span className="vitals-device-tag">SM-R860</span>
            </div>

            <div className="ble-connect-toolbar">
              <button
                type="button"
                className={`ble-connect-btn ${bleStatus === 'connected' ? 'connected' : bleStatus === 'connecting' ? 'connecting' : ''}`}
                onClick={handleToggleBle}
              >
                <Icon name="watch" size={13} />
                <span>
                  {bleStatus === 'connected'
                    ? (language === 'es' ? 'Desconectar reloj' : 'Disconnect watch')
                    : bleStatus === 'connecting'
                    ? (language === 'es' ? 'Conectando…' : 'Connecting…')
                    : (language === 'es' ? 'Emparejar Bluetooth (BLE)' : 'Pair Bluetooth (BLE)')}
                </span>
              </button>

              <label className="csv-replay-btn" title="Cargar CSV de BPM-por-minuto para reproducir">
                <Icon name="upload" size={12} />
                <span>{csvReplayMode ? (language === 'es' ? 'Cambiar CSV' : 'Change CSV') : (language === 'es' ? 'Reproducir CSV' : 'Replay CSV')}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleLoadCsvFile}
                />
              </label>
            </div>

            {bleStatus === 'connected' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 9.5,
                color: '#49ddb2',
                background: 'rgba(73,221,178,0.08)',
                border: '1px solid rgba(73,221,178,0.22)',
                borderRadius: 5,
                padding: '4px 8px',
                margin: '6px 0 2px',
                fontFamily: 'var(--mono)'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#49ddb2', boxShadow: '0 0 8px #49ddb2', flexShrink: 0 }} />
                <span>
                  {lastSavedTimeStr
                    ? (language === 'es' ? `Guardado en BD (último: ${lastSavedTimeStr})` : `Saved to DB (latest: ${lastSavedTimeStr})`)
                    : (language === 'es' ? 'Auto-guardado activo en BD (cada 15s)' : 'Auto-saving to DB (every 15s)')}
                </span>
              </div>
            )}

            {bleError && (
              <div className="ble-error-banner">
                <small>{bleError}</small>
              </div>
            )}

            {csvReplayMode && (
              <div className="csv-replay-status">
                <span>▶ Muestra {csvIndex + 1} de {csvSamples.length} ({csvFileName})</span>
                <button type="button" onClick={() => setCsvReplayMode(false)} title="Detener reproducción CSV">✕</button>
              </div>
            )}

            <div className="vitals-grid">
              <div className="vitals-item">
                <small>ZONA CARDÍACA</small>
                <strong style={{ color: cardiacZone.strokeHex, fontSize: 13 }}>{cardiacZone.name}</strong>
              </div>
              <div className="vitals-item">
                <small>HRV · RMSSD</small>
                <strong>{hrvMetrics.rmssdMs ? hrvMetrics.rmssdMs : '42'} <small>ms</small></strong>
              </div>
              <div className="vitals-item">
                <small>{language === 'es' ? 'Intervalo RR' : 'RR Interval'}</small>
                <strong>{currentRr} <small>ms</small></strong>
              </div>
              <div className="vitals-item">
                <small>TRAMA HEX BLE</small>
                <strong style={{ fontSize: 12 }}><code className="hex-telemetry-badge">{rawHex}</code></strong>
              </div>
            </div>
          </div>

          {/* Modos rápidos de actividad espacial */}
          <div className="space-scenarios-card">
            <div className="vitals-header">
              <span>{language === 'es' ? 'PERFILES OPERACIONALES' : 'OPERATIONAL MODES'}</span>
            </div>
            <div className="space-scenarios-grid">
              <button
                type="button"
                className={`scenario-pill ${bpm === 58 ? 'active' : ''}`}
                onClick={() => { setCsvReplayMode(false); changeBpm(58); }}
              >
                <i style={{ background: '#4ecdc4' }} />
                <span>{language === 'es' ? 'Reposo circadiano' : 'Circadian Rest'}</span>
                <small>58 bpm</small>
              </button>
              <button
                type="button"
                className={`scenario-pill ${bpm === 118 ? 'active' : ''}`}
                onClick={() => { setCsvReplayMode(false); changeBpm(118); }}
              >
                <i style={{ background: '#ffd93d' }} />
                <span>{language === 'es' ? 'Paseo espacial (EVA)' : 'EVA Spacewalk'}</span>
                <small>118 bpm</small>
              </button>
              <button
                type="button"
                className={`scenario-pill ${bpm === 142 ? 'active' : ''}`}
                onClick={() => { setCsvReplayMode(false); changeBpm(142); }}
              >
                <i style={{ background: '#ff6b6b' }} />
                <span>{language === 'es' ? 'Ejercicio ARED' : 'ARED Exercise'}</span>
                <small>142 bpm</small>
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            COLUMNA CENTRAL:
            Reconstrucción 3D del corazón bombeando al BPM actual
            ══════════════════════════════════════════════════════════════ */}
        <section className="monitor-col-panel monitor-heart-col" aria-label="Reconstrucción 3D del corazón">
          <div className="monitor-heart-stage-wrap">
            <iframe
              ref={iframeRef}
              src="/cardiac-simulator/index.html?view=heart-only"
              title={language === 'es' ? 'Reconstrucción 3D del corazón' : '3D Heart Reconstruction'}
              className="monitor-heart-iframe"
              onLoad={() => {
                setIframeReady(true);
                postToSimulator(bpm);
              }}
              allow="fullscreen"
            />
            {!iframeReady && (
              <div className="monitor-heart-loading">
                <div className="monitor-loading-spinner" />
                <p>{language === 'es' ? 'Cargando reconstrucción 3D del corazón…' : 'Loading 3D Heart model…'}</p>
                <small>Duke Heart 4D · WebGL 2.0</small>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            COLUMNA DERECHA:
            Arriba: Asistente de IA (Copilot)
            Abajo: Historial de mediciones
            ══════════════════════════════════════════════════════════════ */}
        <section className="monitor-col-panel monitor-right-col" aria-label="Asistente de IA e Historial">
          <CompactAssistant language={language} />
          <CompactHistory language={language} />
        </section>
      </div>
    </div>
  );
}
