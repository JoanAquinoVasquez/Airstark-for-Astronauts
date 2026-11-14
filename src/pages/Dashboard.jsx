import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, getCurrentRecords, getSavedRecords, stressLabel } from '../lib/health.js';
import { MetricCard, PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import Icon from '../components/Icon.jsx';

function HeartRateTrend({ records, language, text }) {
  const samples = useMemo(() => records.filter((record) => Number.isFinite(Number(record.heartRate)) && Number(record.heartRate) > 0).slice(0, 7).reverse(), [records]);
  if (!samples.length) return <div className="dashboard-chart-empty">{text.empty}</div>;
  const values = samples.map((record) => Number(record.heartRate));
  const points = values.map((value, index) => `${samples.length === 1 ? 460 : 24 + (index / (samples.length - 1)) * 912},${135 - ((value - 40) / 100) * 106}`).join(' ');
  const area = `24,135 ${points} 936,135`;
  return <div className="dashboard-trend-graph">
    <div className="trend-axis-labels"><span>140</span><span>110</span><span>80</span><span>50</span></div>
    <svg viewBox="0 0 960 160" preserveAspectRatio="none" role="img" aria-label={text.trendAlt}>
      <defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#47c9dc" stopOpacity=".27"/><stop offset="100%" stopColor="#47c9dc" stopOpacity="0"/></linearGradient></defs>
      {[28, 64, 99, 135].map((y) => <line key={y} x1="24" x2="936" y1={y} y2={y} className="trend-grid-line" />)}
      <polygon points={area} fill="url(#trendFill)" />
      <polyline points={points} className="trend-chart-line" />
      {samples.map((record, index) => <circle key={`${record.date}-${index}`} cx={samples.length === 1 ? 460 : 24 + (index / (samples.length - 1)) * 912} cy={135 - ((Number(record.heartRate) - 40) / 100) * 106} r={index === samples.length - 1 ? 4 : 2} className={index === samples.length - 1 ? 'trend-chart-point latest' : 'trend-chart-point'} />)}
    </svg>
    <div className="trend-date-labels">{samples.map((record, index) => <span key={`${record.date}-label-${index}`}>{formatDate(record.date, { day: '2-digit', month: 'short' }, language === 'en' ? 'en-US' : 'es-PE')}</span>)}</div>
  </div>;
}

export default function Dashboard() {
  const { language } = useLanguage();
  const text = copy[language].dashboard;
  const records = useMemo(() => getCurrentRecords(), []);
  const activity = useMemo(() => getSavedRecords().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4), []);
  const latest = records[0] || getLatestRecord();
  const hasRealRecords = records.some((record) => record.source !== 'demo');
  const heartRate = latest?.heartRate ?? '—';
  const bmi = latest?.bmi ? Number(latest.bmi).toFixed(1) : '—';
  const normalizedStress = stressLabel(latest?.stress);
  const stress = language === 'en' ? ({ Bajo: 'Low', Moderado: 'Moderate', Alto: 'Highly stressed' }[normalizedStress] || normalizedStress) : normalizedStress;
  const stressLevel = normalizedStress === 'Alto' ? 3 : normalizedStress === 'Moderado' ? 2 : 1;

  return <>
    <PageHeading eyebrow={text.eyebrow} title={<>{text.title} <span>{text.accent}</span></>} description={text.description} action={<div className="date-card"><span className="date-icon"><Icon name="clock" size={17} /></span><div><small>{text.date}</small><strong>{formatDate(new Date(), { year: 'numeric' }, language === 'en' ? 'en-US' : 'es-PE').toUpperCase()}</strong></div></div>} />
    <div className="status-banner"><div className="status-icon"><Icon name="sparkles" size={17} /></div><div className="status-copy"><strong>{hasRealRecords ? text.realTitle : text.demoTitle}</strong><span>{hasRealRecords ? text.realText : text.demoText}</span></div>{!hasRealRecords && <span className="demo-tag"><i /> {text.mock}</span>}</div>
    <section className="metrics-section"><div className="section-heading"><div><span className="section-kicker">{text.quick}</span><h2>{text.metrics}</h2></div><span className="updated-label"><span className="live-dot" />{hasRealRecords ? text.latest : text.sample}</span></div>
      <div className="metrics-grid">
        <MetricCard icon="heart" label={text.heart} value={heartRate} unit="bpm" detail={text.heartDetail} status={hasRealRecords ? text.registered : text.sampleData} />
        <MetricCard icon="bmi" label={text.bmi} value={bmi} unit={language === 'en' ? 'BMI' : 'IMC'} detail={text.bmiDetail} tone="blue" visual="bmi" status={hasRealRecords ? text.registered : text.sampleData} />
        <MetricCard icon="stress" label={text.stress} value={stress} detail={text.stressDetail} tone="green" visual="stress" level={stressLevel} status={hasRealRecords ? text.registered : text.sampleData} />
      </div>
    </section>
    <section className="dashboard-trend-panel panel"><div className="dashboard-trend-heading"><div><span className="section-kicker">{text.trend}</span><h2>{text.heartTrend}</h2><div className="trend-current-value"><strong>{heartRate}</strong><span>bpm</span><small>{hasRealRecords ? text.latestRecord : text.sampleReading}</small></div></div><span className="trend-unit">{text.trendUnit}</span></div><HeartRateTrend records={records} language={language} text={text} /></section>
    <section className="dashboard-bottom-grid">
      <article className="panel dashboard-activity-panel"><span className="section-kicker">{text.activityEyebrow}</span><h2>{text.activityTitle}</h2>{activity.length ? <div className="mission-activity-list">{activity.map((record, index) => <div className="mission-activity-item" key={`${record.date}-${index}`}><span className={`activity-marker ${record.source === 'csv' ? 'csv' : 'manual'}`}><Icon name={record.source === 'csv' ? 'watch' : 'plus'} size={13} /></span><span className="activity-copy"><strong>{record.source === 'csv' ? text.csvEvent : text.manualEvent}</strong><small>{formatDate(record.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, language === 'en' ? 'en-US' : 'es-PE')}</small></span><span className="activity-reading">{record.heartRate ? `${record.heartRate} bpm` : record.bmi ? `BMI ${Number(record.bmi).toFixed(1)}` : '—'}</span></div>)}</div> : <p className="dashboard-empty-copy">{text.activityEmpty}</p>}</article>
      <article className="panel dashboard-notifications-panel" id="notifications-panel"><div className="dashboard-notifications-head"><div><span className="section-kicker">{text.notificationsEyebrow}</span><h2>{text.notificationsTitle}</h2></div><span className="notification-bell" aria-hidden="true"><Icon name="bell" size={16} /></span></div><div className="notifications-empty"><span className="notification-status-dot" /><strong>{text.noAlerts}</strong><p>{text.noAlertsHint}</p><Link to="/asistente" className="notification-action">{text.copilot} <Icon name="arrowRight" size={13} /></Link></div><small className="notification-disclaimer">{text.panelNotice}</small></article>
    </section>
  </>;
}
