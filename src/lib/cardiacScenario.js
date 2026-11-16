export const INFARCT_SCENARIO = 'simulated-infarct';
export const INFARCT_OUTPUT_MARKER = `[AIRSTARK_3D:${INFARCT_SCENARIO}]`;

export function isCardiacScenario(value) {
  return value === INFARCT_SCENARIO;
}

const infarctDemo = /\b(infarto(?:s)?|ataque al corazon|heart attack|myocardial infarction)\b/;
const rhythmTopic = /\b(arritmias?|taquicardia|bradicardia|arrhythmias?|tachycardia|bradycardia)\b/;
const heartTopic = /\b(corazon|cardiac[oa]s?|cardiovascular(?:es)?|coronari[oa]s?|heart|cardiac|coronary)\b/;
const consultation = /\b(sintomas?|diagnos\w*|symptoms?|que (?:podria|puede) ser|que (?:podria|puedo) tener|que tengo|what (?:might|could) (?:this|it) be|what could i have|what do i have)\b/;
const symptomWording = /\b(senales?|signos?|dolor(?:es)?|duele|molestias?|opresion|signs?|pain|hurts?|pressure|tightness|discomfort)\b/;
const conditionConcern = /\b(tengo|tener|puede ser|podria ser|como saber|do i have|could (?:i|this|it))\b/;
const symptomMention = /\b(palpitaciones|palpitations|chest (?:pain|pressure|tightness|discomfort)|(?:dolor(?:es)?|duele|molestias?|opresion|presion) (?:\w+ ){0,3}(?:pecho|torax))\b/;
const demoRequest = /\b(simul\w*|3d|muestra\w*|visualiz\w*|show|demonstrat\w*)\b/;

export function scenarioForConsultation(question) {
  const text = question.toLowerCase().normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // This selects an educational illustration by wording, independent of the agent's assessment.
  const mentionsInfarct = infarctDemo.test(text);
  const mentionsCondition = mentionsInfarct || rhythmTopic.test(text);
  if (consultation.test(text)
    || symptomMention.test(text)
    || ((mentionsCondition || heartTopic.test(text)) && symptomWording.test(text))
    || (mentionsCondition && conditionConcern.test(text))
    || (mentionsInfarct && demoRequest.test(text))) {
    return INFARCT_SCENARIO;
  }
  return null;
}
