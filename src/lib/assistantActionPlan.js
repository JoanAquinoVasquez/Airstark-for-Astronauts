const PLAN_HEADING = /(^|\s)(?:#{1,6}[ \t]+)?(?:\*\*|__)?(plan[ \t]+de[ \t]+acci[oó]n|action[ \t]+plan)[ \t]*:?(?:\*\*|__)?[ \t]*:?(?=\s|$)/giu;
const LINE_ITEM = /^[ \t]*([-*+•]|\d{1,3}[.)])[ \t]+(?=\S)/gm;
const END_HEADING = /^[ \t]*(?:#{1,6}[ \t]+\S|(?:\*\*|__)?(?:advertencias?|nota|resumen|explicaci[oó]n|recomendaciones?|señales de (?:alarma|urgencia)|warning(?: signs)?|notes?|summary|explanation|recommendations?)(?:\*\*|__)?[ \t]*(?::|$)|(?:\*\*|__)[^\n]+?(?:\*\*|__)[ \t]*$)/imu;

function readSteps(list) {
  const markers = [...list.matchAll(LINE_ITEM)];
  if (markers[0]?.index !== 0) return [];

  // A flattened list uses the same marker on every item, or sequential numbers.
  if (markers.length === 1 && !list.includes('\n')) {
    const firstMarker = markers[0][1];
    const ordered = /^\d/.test(firstMarker);
    let nextNumber = parseInt(firstMarker, 10) + 1;
    for (const match of list.matchAll(/[ \t]+([-*+•]|\d{1,3}[.)])[ \t]+(?=\S)/g)) {
      const marker = match[1];
      if (ordered ? marker === `${nextNumber}${firstMarker.at(-1)}` : marker === firstMarker) {
        markers.push(match);
        if (ordered) nextNumber += 1;
      }
    }
  }

  return markers.map((marker, index) => (
    list.slice(marker.index + marker[0].length, markers[index + 1]?.index).trim()
  )).filter(Boolean);
}

export function splitAssistantActionPlan(text) {
  const message = text.replace(/\r\n?/g, '\n');
  for (const match of message.matchAll(PLAN_HEADING)) {
    const body = message.slice(match.index + match[0].length).trim();
    const end = body.search(END_HEADING);
    const steps = readSteps(end < 0 ? body : body.slice(0, end).trimEnd());
    if (steps.length) {
      return {
        intro: message.slice(0, match.index).trim(),
        heading: match[2].replace(/[ \t]+/g, ' '),
        steps,
        outro: end < 0 ? '' : body.slice(end).trim(),
      };
    }
  }
  return null;
}
