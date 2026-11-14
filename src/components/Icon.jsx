const shapes = {
  overview: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></>,
  pulse: <><path d="M3 12h4l2.5-7L14 19l2.5-7H21"/><path d="M5 4a2 2 0 1 0 0 4M19 16a2 2 0 1 0 0 4" opacity=".45"/></>,
  cube: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path d="m3.5 8 8.5 5 8.5-5M12 13v8M7.5 5.5l9 5"/></>,
  watch: <><rect x="6" y="7" width="12" height="10" rx="3"/><path d="m9 3 1 4m5-4-1 4m-5 10-1 4m6-4 1 4M12 10v4m-2-2h4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M4 4v4h4"/></>,
  assistant: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2L12 8Z"/></>,
  heart: <><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z"/></>,
  bmi: <><path d="M4 19V5m0 14h16"/><path d="m7 15 4-4 3 2 5-6"/><path d="M15 7h4v4"/></>,
  stress: <><path d="M3 12h3l2-5 4 10 3-7 2 3h4"/><path d="M5 4h14M5 20h14" opacity=".4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></>,
  arrowRight: <><path d="M4 12h15m-6-6 6 6-6 6"/></>,
  arrowUp: <><path d="M12 19V5m-6 6 6-6 6 6"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.3 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
  neutral: <><circle cx="12" cy="12" r="9"/><path d="M8 15h8M9 9h.01M15 9h.01"/></>,
  frown: <><circle cx="12" cy="12" r="9"/><path d="M8 16s1.3-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  microphone: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8"/></>,
  volume: <><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></>,
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, className = '' }) {
  return <svg className={`airstark-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name] || shapes.sparkles}</svg>;
}
