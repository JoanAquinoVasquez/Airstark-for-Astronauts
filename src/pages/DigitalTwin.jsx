import { ModuleState, PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';

export default function DigitalTwin() {
  const { language } = useLanguage();
  const t = copy[language].twin;
  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} action={<ModuleState>{t.pending}</ModuleState>} />
    <section className="mission-module panel" id="gemelo-digital">
      <div className="module-heading"><div><span className="section-kicker">{t.teamModule}</span><h2>{t.viewer}</h2><p>{t.controls}</p></div><ModuleState>{t.pending}</ModuleState></div>
      <div className="module-mount twin-module-mount" id="airstark-digital-twin-root" data-airstark-module="digital-twin" aria-label={t.aria}><div className="twin-orbit orbit-one" /><div className="twin-orbit orbit-two" /><div className="twin-core"><span>◇</span></div><div className="twin-placeholder-copy"><strong>{t.placeholder}</strong><span>{t.teammate}</span></div><span className="twin-coordinate">{t.slot}</span></div>
    </section>
    <p className="integration-note">{t.note} <code>#airstark-digital-twin-root</code>.</p>
  </>;
}
