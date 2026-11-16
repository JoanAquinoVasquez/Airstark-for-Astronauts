import { getAstronautProfile } from './profile.js';
import { getCurrentUserId } from './supabase.js';
import { INFARCT_OUTPUT_MARKER, INFARCT_SCENARIO, isCardiacScenario, scenarioForConsultation } from './cardiacScenario.js';

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
  const saved = getSavedRecords();
  if (saved.length > 0) {
    return [...saved].sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return [...DEMO_RECORDS].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getLatestRecord() {
  return getCurrentRecords()[0] || null;
}

export function formatDate(value, options = {}, locale = 'es-PE') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', ...options }).format(new Date(value)).replace('.', '');
}

export function stressLabel(value) {
  if (value == null || value === '') return '—';
  const rawNum = String(value).trim().replace(',', '.').replace('%', '');
  const num = Number(rawNum);
  if (rawNum !== '' && Number.isFinite(num)) {
    if (num <= 33) return 'Bajo';
    if (num <= 66) return 'Moderado';
    return 'Alto';
  }
  const text = String(value).toLowerCase();
  if (/alto|altamente|high|severo/.test(text)) return 'Alto';
  if (/regular|moderado|medium|moderate/.test(text)) return 'Moderado';
  if (/bajo|low|leve|mild/.test(text)) return 'Bajo';
  return value || '—';
}

export function localizeStress(value, language = 'es', score = null) {
  const normalized = stressLabel(value);
  let numScore = score;
  if (numScore == null) {
    const rawNum = String(value).trim().replace(',', '.').replace('%', '');
    const num = Number(rawNum);
    if (rawNum !== '' && Number.isFinite(num)) numScore = num;
  }
  const scoreSuffix = numScore != null && Number.isFinite(Number(numScore)) ? ` (${numScore}%)` : '';
  if (language === 'en') {
    const map = { Bajo: 'Low', Moderado: 'Moderate', Alto: 'Highly stressed' };
    const label = map[normalized] || normalized;
    return `${label}${scoreSuffix}`;
  }
  const map = { Bajo: 'Bajo', Moderado: 'Moderado', Alto: 'Alto' };
  const label = map[normalized] || normalized;
  return `${label}${scoreSuffix}`;
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
  if (/peso|weight/.test(normalized)) return 'weight';
  if (/altura|height|estatura|talla/.test(normalized)) return 'heightCm';
  if (/grasa|fat|body fat/.test(normalized)) return 'bodyFat';
  if (/trama|hex|raw hex/.test(normalized)) return 'rawHex';
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
  if (!headers.includes('heartRate') && !headers.includes('bmi') && !headers.includes('stress') && !headers.includes('weight')) {
    throw new Error('No reconocí las columnas del CSV. Se requiere BPM, frecuencia cardíaca, IMC, peso o estrés.');
  }
  const records = []; let ignoredZeroReadings = 0;
  for (const cells of rows.slice(1)) {
    const record = { source: 'csv', sourceFile: file.name, date: new Date().toISOString() };
    headers.forEach((kind, index) => {
      const cellValue = cells[index];
      if (!kind || cellValue === undefined || cellValue === '') return;
      if (kind === 'date') {
        const parsedDate = new Date(cellValue);
        if (!Number.isNaN(parsedDate.valueOf())) record.date = parsedDate.toISOString();
      } else if (['heartRate', 'bmi', 'weight', 'heightCm', 'bodyFat', 'energy'].includes(kind)) {
        const number = Number(cellValue.replace(',', '.'));
        if (Number.isFinite(number)) record[kind] = number;
      } else if (kind === 'stress') {
        const raw = cellValue.trim();
        const num = Number(raw.replace(',', '.').replace('%', ''));
        if (Number.isFinite(num) && raw !== '') {
          record.stressScore = num;
          record.stress = num <= 33 ? 'Bajo' : num <= 66 ? 'Moderado' : 'Alto';
        } else {
          record.stress = raw;
        }
      } else {
        record[kind] = cellValue;
      }
    });

    // Auto-cálculo de IMC si tenemos peso y estatura y no vino IMC
    if (!record.bmi && record.weight && record.heightCm) {
      const heightM = record.heightCm / 100;
      record.bmi = Number((record.weight / (heightM * heightM)).toFixed(1));
    }

    if (record.heartRate === 0) { ignoredZeroReadings += 1; continue; }
    if (record.heartRate || record.bmi || record.stress || record.weight) records.push(record);
  }
  if (!records.length) throw new Error('No encontré filas con mediciones válidas.');
  return { records, ignoredZeroReadings };
}

export function getAstronautContext() {
  const astronaut = getAstronautProfile();
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
  return { astronaut, latest: records[0] || null, recentRecords: records, containsMockData: records.some((record) => record.isMock) };
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
  if (typeof payload === 'string') {
    const text = payload.trim();
    const json = text.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/i)?.[1] ?? text;
    if (json.startsWith('{') || json.startsWith('[')) {
      try { return extractResponse(JSON.parse(json)); } catch { /* Keep plain text. */ }
    }
    const lastLineStart = text.lastIndexOf('\n') + 1;
    if (text.slice(lastLineStart).trim() === INFARCT_OUTPUT_MARKER) {
      const answer = text.slice(0, lastLineStart).trimEnd();
      return { answer, visualScenario: answer ? INFARCT_SCENARIO : null };
    }
    return { answer: text, visualScenario: null };
  }
  if (Array.isArray(payload)) {
    const replies = payload.map(extractResponse);
    return {
      answer: replies.map((reply) => reply.answer).filter(Boolean).join('\n\n'),
      visualScenario: replies.find((reply) => reply.visualScenario)?.visualScenario ?? null,
    };
  }
  if (payload && typeof payload === 'object') {
    const visualScenario = isCardiacScenario(payload.visualScenario) ? payload.visualScenario : null;
    for (const key of ['answer', 'response', 'output', 'message', 'reply', 'text']) {
      if (payload[key] === undefined) continue;
      const reply = extractResponse(payload[key]);
      if (reply.answer) return { answer: reply.answer, visualScenario: visualScenario ?? reply.visualScenario };
    }
    return { answer: '', visualScenario: null };
  }
  return { answer: '', visualScenario: null };
}

export async function askAgent(question, language = 'en') {
  const profile = getAstronautProfile();
  const userId = (await getCurrentUserId()) || profile?.userId || profile?.user_id || null;

  const visualInstructions = `Responde con texto para el astronauta en el idioma solicitado. Si pide una simulación educativa de un infarto en 3D o pregunta por síntomas o diagnóstico, la app puede mostrar un caso cardíaco ficticio junto a la respuesta. No lo uses para afirmar un diagnóstico ni relacionar la arteria resaltada con los datos personales del astronauta. Para activar el caso educativo en otras consultas pertinentes, puedes añadir ${INFARCT_OUTPUT_MARKER} como última línea, sin comillas ni formato.`;
  const chatInput = [userId && `user_id: ${userId}`, visualInstructions, `Mensaje del astronauta:\n${question}`].filter(Boolean).join('\n\n');
  const chatUrl = new URL(AGENT_WEBHOOK);
  chatUrl.searchParams.set('action', 'sendMessage');

  const requestPayload = {
    action: 'sendMessage',
    sessionId: getChatSessionId(),
    chatInput,
    message: question,
    question,
    user_id: userId,
    userId: userId,
    crew_id: profile?.crewId || 'A-9K21',
    language,
    supportedVisualScenarios: [INFARCT_SCENARIO],
  };

  const response = await fetch(chatUrl, {
    method: 'POST', mode: 'cors', credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Webhook request failed: ${response.status}`);
  let payload = body;
  try { payload = body ? JSON.parse(body) : ''; } catch { /* plain-text response */ }
  const reply = extractResponse(payload);
  if (reply.answer) {
    return {
      ...reply,
      visualScenario: reply.visualScenario ?? scenarioForConsultation(question),
    };
  }
  return {
    answer: language === 'es' ? 'El asistente respondió sin contenido.' : 'The assistant returned an empty response.',
    visualScenario: null,
  };
}

export function exportRecords(records) {
  const columns = ['fecha', 'ritmo_cardiaco_bpm', 'presion_arterial_mmhg', 'glucosa_mg_dl', 'peso_kg', 'estatura_cm', 'imc', 'grasa_corporal_pct', 'estres', 'trama_hex', 'diabetes', 'notas', 'origen'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = records.map((record) => [
    record.date,
    record.heartRate,
    record.pressure,
    record.glucose,
    record.weight,
    record.heightCm,
    record.bmi,
    record.bodyFat,
    record.stressScore != null ? record.stressScore : record.stress,
    record.rawHex,
    record.diabetes,
    record.notes,
    record.source,
  ].map(quote).join(','));
  const blob = new Blob(['\uFEFF', columns.join(','), '\r\n', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `airstark-registros-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
