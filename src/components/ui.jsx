import { Link } from 'react-router-dom';

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function MetricCard({ icon, label, value, unit, detail, tone = 'cyan' }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></div><div className="metric-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</div><div className="metric-bottom"><span className="metric-context">{detail}</span></div></article>;
}

export function ModuleState({ children = 'PENDIENTE DE INTEGRACIÓN' }) {
  return <span className="module-state"><i />{children}</span>;
}

export function QuickLink({ to, icon, title, description }) {
  return <Link className="quick-link-card" to={to}><span className="quick-link-icon">{icon}</span><span className="quick-link-copy"><strong>{title}</strong><small>{description}</small></span><span className="quick-link-arrow">→</span></Link>;
}
