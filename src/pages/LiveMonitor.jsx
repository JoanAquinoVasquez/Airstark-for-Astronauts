import { ModuleState, PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import Icon from '../components/Icon.jsx';

export default function LiveMonitor() {
  const { language } = useLanguage();
  const t = copy[language].monitor;
  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} action={<ModuleState>{t.pending}</ModuleState>} />
    <section className="mission-module panel" id="monitor-en-vivo">
      <div className="module-heading"><div><span className="section-kicker">{t.teamModule}</span><h2>{t.heartTitle}</h2><p>{t.heartDescription}</p></div><ModuleState>{t.pending}</ModuleState></div>
      <div className="module-mount live-module-mount" id="airstark-live-monitor-root" data-airstark-module="live-monitor" aria-label={t.aria}>
        <div className="live-module-sidebar">
          <div className="live-module-card live-heart-card"><span className="live-placeholder-status"><i /> {t.noSignal}</span><div className="live-placeholder-value">— <small>BPM</small></div><p>{t.placeholder}</p><div className="live-divider" /><span className="live-module-label">{t.telemetry}</span><div className="live-module-row"><span>{t.device}</span><strong>{t.pendingValue}</strong></div><div className="live-module-row"><span>{t.sensor}</span><strong>{t.wrist}</strong></div></div>
          <div className="live-module-card live-stats-card"><span className="live-module-label">{t.session}</span><div className="live-stat-grid"><div><small>{t.samples}</small><strong>—</strong></div><div><small>{t.average}</small><strong>— <small>bpm</small></strong></div><div><small>HRV · RMSSD</small><strong>— <small>ms</small></strong></div><div><small>{t.rr}</small><strong>— <small>ms</small></strong></div></div></div>
        </div>
        <div className="live-module-charts"><article className="live-module-card live-chart-card"><div className="live-chart-title"><div><strong>{t.osc}</strong><small>{t.signal}</small></div><span>{t.waiting}</span></div><div className="live-chart-canvas"><div className="live-chart-placeholder"><span className="pulse-mark"><Icon name="pulse" size={20} /></span><span>{t.noReadings}</span></div></div></article><article className="live-module-card live-chart-card"><div className="live-chart-title"><div><strong>{t.recent}</strong><small>{t.series}</small></div><span>— BPM</span></div><div className="live-chart-canvas trend-placeholder"><div className="chart-gridlines"><i /><i /><i /><i /></div><div className="live-chart-placeholder"><span>{t.graphPending}</span></div></div></article></div>
      </div>
    </section>
    <p className="integration-note">{t.integrationNote}</p>
  </>;
}
