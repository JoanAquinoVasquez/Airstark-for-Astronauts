export const HEALTH_STORAGE_KEY = 'airstark.healthRecords.v1';
const CHAT_SESSION_STORAGE_KEY = 'airstark.agentSession.v1';
export const AGENT_WEBHOOK = 'https://www.mrsoft-ai.com/webhook/a5fa83ae-77ad-4c15-b3bd-196acdea9960/chat';

export const DEMO_RECORDS = [
  { date: '2026-11-14T09:20:00', heartRate: 72, bmi: 22.4, stress: 'Bajo', pressure: null, glucose: null, source: 'demo' },
  { date: '2026-11-13T09:15:00', heartRate: 74, bmi: 22.4, stress: 'Bajo', pressure: null, glucose: null, source: 'demo' },
  { date: '2026-11-12T08:55:00', heartRate: 71, bmi: 22.3, stress: 'Moderado', pressure: null, glucose: null, source: 'demo' },
  { date: '2026-11-11T09:08:00', heartRate: 76, bmi: 22.3, stress: 'Bajo', pressure: null, glucose: null, source: 'demo' },
  { date: '2026-11-10T08:48:00', heartRate: 73, bmi: 22.2, stress: 'Bajo', pressure: null, glucose: null, source: 'demo' },
];

export function getSavedRecords() {
  try { return JSON.parse(localStorage.getItem(HEALTH_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function saveRecords(records) {
  localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(records));
}

export function getCurrentRecords() {
  return [...getSavedRecords(), ...DEMO_RECORDS].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getLatestRecord() {
  return getCurrentRecords()[0] || null;
}

export function formatDate(value, options = {}, locale = 'es-PE') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', ...options }).format(new Date(value)).replace('.', '');
}

export function stressLabel(value) {
  const text = String(value || '').toLowerCase();
  if (/alto|high|severo/.test(text)) return 'Alto';
  if (/regular|moderado|medium|moderate/.test(text)) return 'Moderado';
  if (/bajo|low|leve|mild/.test(text)) return 'Bajo';
  return value || '—';
}

function parseCSV(text) {
  const rows = [];
  let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((part) => part !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some((part) => part !== '')) rows.push(row); }
  if (rows.length < 2) throw new Error('El CSV debe tener encabezados y al menos una fila.');
  return rows;
}

function headerKind(header) {
  const normalized = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (/^bpm$/.test(normalized) || /heart|card|pulso|ritmo|frecuencia/.test(normalized)) return 'heartRate';
  if (/bmi|imc|indice masa/.test(normalized)) return 'bmi';
  if (/stress|estres/.test(normalized)) return 'stress';
  if (/date|time|fecha|hora|timestamp/.test(normalized)) return 'date';
  if (/zona|zone/.test(normalized)) return 'zone';
  if (/contacto|contact/.test(normalized)) return 'sensorContact';
  if (/rr intervals|intervalos rr/.test(normalized)) return 'rrIntervals';
  if (/energia|energy/.test(normalized)) return 'energy';
  if (/origen|source/.test(normalized)) return 'telemetrySource';
  return null;
}

export async function readSmartwatchCsv(file) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
  if (!/\.csv$/i.test(file.name)) throw new Error('Selecciona un archivo con extensión .csv.');
  const rows = parseCSV((await file.text()).replace(/^\uFEFF/, ''));
  const headers = rows[0].map(headerKind);
  if (!headers.includes('heartRate') && !headers.includes('bmi') && !headers.includes('stress')) {
    throw new Error('No reconocí las columnas del CSV. Se requiere BPM, frecuencia cardíaca, IMC o estrés.');
  }
  const records = []; let ignoredZeroReadings = 0;
  for (const cells of rows.slice(1)) {
    const record = { source: 'csv', sourceFile: file.name, date: new Date().toISOString() };
    headers.forEach((kind, index) => {
      if (!kind || !cells[index]) return;
      if (kind === 'date') {
        const parsedDate = new Date(cells[index]);
        if (!Number.isNaN(parsedDate.valueOf())) record.date = parsedDate.toISOString();
      } else if (kind === 'heartRate' || kind === 'bmi') {
        const number = Number(cells[index].replace(',', '.'));
        if (Number.isFinite(number)) record[kind] = number;
      } else record[kind] = cells[index];
    });
    if (record.heartRate === 0) { ignoredZeroReadings += 1; continue; }
    if (record.heartRate || record.bmi || record.stress) records.push(record);
  }
  if (!records.length) throw new Error('No encontré filas con mediciones válidas.');
  return { records, ignoredZeroReadings };
}

export function getAstronautContext() {
  const records = getCurrentRecords().slice(0, 7).map((record) => ({
    recordedAt: record.date,
    heartRateBpm: record.heartRate ?? null,
    bmi: record.bmi ?? null,
    stressLevel: record.stress ?? null,
    bloodPressureMmHg: record.pressure && record.pressure !== '—' ? record.pressure : null,
    glucoseMgDl: record.glucose ?? null,
    weightKg: record.weight ?? null,
    heightCm: record.heightCm ?? null,
    diabetesType: record.diabetes ?? null,
    source: record.source || 'unknown',
    isMock: record.source === 'demo',
  }));
  return { latest: records[0] || null, recentRecords: records, containsMockData: records.some((record) => record.isMock) };
}

function getChatSessionId() {
  let sessionId = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = globalThis.crypto?.randomUUID?.() || `airstark-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

function extractResponse(payload) {
  if (typeof payload === 'string') return payload.trim();
  if (Array.isArray(payload)) return payload.map(extractResponse).filter(Boolean).join('\n\n');
  if (payload && typeof payload === 'object') {
    for (const key of ['answer', 'response', 'output', 'message', 'reply', 'text']) {
      if (payload[key] !== undefined) { const value = extractResponse(payload[key]); if (value) return value; }
    }
    return JSON.stringify(payload, null, 2);
  }
  return String(payload ?? '');
}

export async function askAgent(question, language = 'en') {
  const astronautData = getAstronautContext();
  const answerLanguage = language === 'es' ? 'Spanish' : 'English';
  const healthContextLabel = language === 'es' ? 'Contexto de salud AIRSTARK (JSON; isMock=true identifica datos simulados)' : 'AIRSTARK health context (JSON; isMock=true identifies simulated data)';
  const chatInput = `Reply to the astronaut in ${answerLanguage}. ${question}\n\n${healthContextLabel}:\n${JSON.stringify(astronautData)}`;
  const chatUrl = new URL(AGENT_WEBHOOK);
  chatUrl.searchParams.set('action', 'sendMessage');
  const response = await fetch(chatUrl, {
    method: 'POST', mode: 'cors', credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sendMessage', sessionId: getChatSessionId(), chatInput, question, language, astronautData }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Webhook request failed: ${response.status}`);
  let payload = body;
  try { payload = body ? JSON.parse(body) : ''; } catch { /* plain-text response */ }
  return extractResponse(payload) || (language === 'es' ? 'El asistente respondió sin contenido.' : 'The assistant returned an empty response.');
}

export function exportRecords(records) {
  const columns = ['fecha', 'ritmo_cardiaco_bpm', 'presion_arterial_mmhg', 'glucosa_mg_dl', 'peso_kg', 'estatura_cm', 'imc', 'estres', 'diabetes', 'notas', 'origen'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = records.map((record) => [record.date, record.heartRate, record.pressure, record.glucose, record.weight, record.heightCm, record.bmi, record.stress, record.diabetes, record.notes, record.source].map(quote).join(','));
  const blob = new Blob(['\uFEFF', columns.join(','), '\r\n', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `airstark-registros-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
