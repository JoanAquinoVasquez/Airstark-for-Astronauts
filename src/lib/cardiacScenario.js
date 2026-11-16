export const INFARCT_SCENARIO = 'simulated-infarct';
export const INFARCT_OUTPUT_MARKER = `[AIRSTARK_3D:${INFARCT_SCENARIO}]`;
export const HOTSPOT_OUTPUT_MARKER = '[AIRSTARK_HOTSPOTS]';

export const supportedCardiacStructures = {
  'left-ventricle': 'Ventrículo izquierdo',
  'right-ventricle': 'Ventrículo derecho',
  'left-atrium': 'Aurícula izquierda',
  'right-atrium': 'Aurícula derecha',
  myocardium: 'Miocardio',
  'heart-wall': 'Pared cardíaca',
  aorta: 'Aorta',
  'pulmonary-artery': 'Arteria pulmonar',
  'right-coronary-artery': 'Coronaria derecha',
  'left-coronary-artery': 'Coronaria izquierda',
};

export function isCardiacScenario(value) {
  return value === INFARCT_SCENARIO;
}

export function hasReportHotspots(interpretability) {
  return Array.isArray(interpretability?.hotspots) && interpretability.hotspots.length > 0;
}

// Keep the report available for navigation within this tab without persisting its text.
let selectedReport = null;

export function selectCardiacReport(id, interpretability) {
  selectedReport = { id, interpretability };
}

export function getSelectedCardiacReport(id) {
  return selectedReport?.id === id ? selectedReport : null;
}

export function readCardiacInterpretability(data) {
  const hotspots = [];
  if (!Array.isArray(data?.hotspots)) return { hotspots };
  const seen = new Set();
  for (const entry of data.hotspots) {
    if (typeof entry?.structureId !== 'string' || !Object.hasOwn(supportedCardiacStructures, entry.structureId)) continue;
    const { structureId } = entry;
    const cause = typeof entry.cause === 'string' ? entry.cause.trim() : '';
    const explanation = typeof entry.explanation === 'string' ? entry.explanation.trim() : '';
    if (!cause || !explanation || cause.length > 500 || explanation.length > 750 || seen.has(structureId)) continue;
    hotspots.push({ structureId, cause, explanation });
    seen.add(structureId);
    if (hotspots.length === 3) break;
  }
  return { hotspots };
}

export function requestsInfarctDemo(question) {
  const text = question.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return /\b(infartos?|ataque al corazon|heart attack|myocardial infarction)\b/.test(text)
    && /\b(simul\w*|demostra\w*|demonstrat\w*|educativ\w*|3d)\b/.test(text);
}
