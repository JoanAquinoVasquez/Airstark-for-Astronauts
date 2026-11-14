import { ModuleState, PageHeading } from '../components/ui.jsx';

export default function DigitalTwin() {
  return <>
    <PageHeading eyebrow="VISUALIZACIÓN MÉDICA" title="Gemelo digital 3D" description="Ventana independiente para explorar el visor volumétrico del equipo." action={<ModuleState />} />
    <section className="mission-module panel" id="gemelo-digital">
      <div className="module-heading"><div><span className="section-kicker">MÓDULO DEL EQUIPO</span><h2>Visor volumétrico</h2><p>Modelo anatómico y controles interactivos.</p></div><ModuleState /></div>
      <div className="module-mount twin-module-mount" id="airstark-digital-twin-root" data-airstark-module="digital-twin" aria-label="Espacio reservado para el visor de salud 3D"><div className="twin-orbit orbit-one" /><div className="twin-orbit orbit-two" /><div className="twin-core"><span>◇</span></div><div className="twin-placeholder-copy"><strong>El visor 3D se integrará aquí</strong><span>El módulo de tu compañero ocupará esta ventana.</span></div><span className="twin-coordinate">AIRSTARK · 3D MODULE SLOT</span></div>
    </section>
    <p className="integration-note">Punto de montaje listo: <code>#airstark-digital-twin-root</code>.</p>
  </>;
}
