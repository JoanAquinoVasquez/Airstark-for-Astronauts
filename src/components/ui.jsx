import { Link } from 'react-router-dom';
import { copy, useLanguage } from '../i18n.jsx';

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

const chartSeries = {
  cyan: [20, 25, 21, 32, 28, 36, 31, 40, 35, 44, 39, 50, 46, 56, 48, 61, 54, 68],
  blue: [50, 47, 48, 42, 46, 43, 40, 44, 38, 41, 35, 39, 34, 36, 30, 33, 28, 31],
  green: [26, 31, 28, 37, 33, 40, 35, 44, 38, 48, 43, 52, 47, 57, 52, 62, 56, 67],
};

export function MetricCard({ icon, label, value, unit, detail, tone = 'cyan', status = 'Dato de muestra', visual = 'sparkline', level = 2 }) {
  const { language } = useLanguage();
  const text = copy[language].dashboard;
  const points = chartSeries[tone] || chartSeries.cyan;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${(index / (points.length - 1)) * 300} ${34 - point * 0.35}`).join(' ');
  return <article className={`metric-card ${tone === 'blue' ? 'bmi-card' : tone === 'green' ? 'stress-card' : 'heart-card'}`}><div className="metric-top"><span className={`metric-icon ${tone === 'blue' ? 'bmi-icon' : tone === 'green' ? 'stress-icon' : ''}`}>{icon}</span><span className="metric-label">{label}</span><span className="metric-menu" aria-hidden="true">···</span></div><div className="metric-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</div><div className="metric-bottom"><span className="metric-status good"><i />{status}</span><span className="metric-context">{detail}</span></div>{visual === 'sparkline' ? <div className="sparkline" role="img" aria-label={`${label} trend`}><svg viewBox="0 0 300 36" preserveAspectRatio="none"><path d={path} /></svg></div> : visual === 'bmi' ? <div className="bmi-scale" aria-label={language === 'en' ? 'Visual body mass index scale' : 'Escala visual del índice de masa corporal'}><div className="scale-bar"><span style={{ left: `${Math.min(96, Math.max(4, ((Number(value) - 15) / 25) * 100))}%` }} /></div><div className="scale-labels"><span>{text.low}</span><span>{text.reference}</span><span>{text.high}</span></div></div> : <div className="stress-bars" role="img" aria-label={`${language === 'en' ? 'Stress level' : 'Nivel de estrés'}: ${value}`}>{Array.from({ length: 12 }, (_, index) => <i className={index < level * 3 ? 'filled' : ''} key={index} />)}</div>}</article>;
}

export function ModuleState({ children = 'PENDIENTE DE INTEGRACIÓN' }) {
  return <span className="module-state"><i />{children}</span>;
}

export function QuickLink({ to, icon, title, description }) {
  return <Link className="quick-link-card" to={to}><span className="quick-link-icon">{icon}</span><span className="quick-link-copy"><strong>{title}</strong><small>{description}</small></span><span className="quick-link-arrow">→</span></Link>;
}
