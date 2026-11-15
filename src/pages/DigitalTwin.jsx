import { useState, useRef } from 'react';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import Icon from '../components/Icon.jsx';

export default function DigitalTwin() {
  const { language } = useLanguage();
  const t = copy[language].twin;
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sourceMode, setSourceMode] = useState('embedded'); // 'embedded' | 'live'

  const simulatorUrl = sourceMode === 'live'
    ? 'http://127.0.0.1:5173'
    : '/cardiac-simulator/index.html';

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <div className="twin-active-badge">
            <span className="live-dot" />
            <span>{t.activeStatus || 'SIMULACIÓN ACTIVA'}</span>
            <span className="twin-study-pill">{t.studyBadge || 'DUKE HEART 4D'}</span>
          </div>
        }
      />

      <section
        className={`mission-module panel twin-panel ${isFullscreen ? 'fullscreen-mode' : ''}`}
        id="gemelo-digital"
        ref={containerRef}
      >
        <div className="module-heading twin-module-heading">
          <div>
            <div className="twin-kicker-row">
              <span className="section-kicker">{t.teamModule || 'SIMULADOR CARDÍACO 3D'}</span>
              <span className="twin-dataset-chip">16 Fases 4D CT/ECG</span>
            </div>
            <h2>{t.viewer || 'Modelo Cardíaco Volumétrico'}</h2>
            <p>{t.controls || 'Reconstrucción anatómica 3D, cortes ortogonales y segmentación.'}</p>
          </div>

          <div className="twin-actions">
            <button
              type="button"
              className="twin-action-button"
              onClick={toggleFullscreen}
              title={isFullscreen ? (t.exitFullscreen || 'Salir de pantalla completa') : (t.fullscreen || 'Pantalla completa')}
            >
              <Icon name="cube" size={14} />
              <span>{isFullscreen ? (t.exitFullscreen || 'Salir') : (t.fullscreen || 'Pantalla completa')}</span>
            </button>
            <a
              href={simulatorUrl}
              target="_blank"
              rel="noreferrer"
              className="twin-action-button"
              title={t.newTab || 'Abrir en pestaña nueva'}
            >
              <Icon name="arrowRight" size={14} />
              <span>{t.newTab || 'Nueva pestaña'}</span>
            </a>
          </div>
        </div>

        {/* Embedded 3D Interactive Simulator Frame */}
        <div className="twin-frame-wrapper" id="airstark-digital-twin-root">
          <iframe
            src={simulatorUrl}
            title="AIRSTARK 3D Cardiac Simulator"
            className="twin-simulator-iframe"
            allow="fullscreen; accelerometer; gyroscope"
            loading="eager"
          />
        </div>
      </section>

      <div className="twin-bottom-info">
        <div className="twin-info-card">
          <span className="twin-info-icon"><Icon name="pulse" size={15} /></span>
          <div>
            <strong>{language === 'en' ? 'ECG & Hemodynamic Synchronization' : 'Sincronización ECG y Hemodinámica'}</strong>
            <p>{language === 'en' ? 'Supports variable cardiac rates from 40 to 180 BPM in orbit.' : 'Soporta frecuencias cardíacas variables de 40 a 180 BPM en órbita.'}</p>
          </div>
        </div>

        <div className="twin-info-card">
          <span className="twin-info-icon"><Icon name="cube" size={15} /></span>
          <div>
            <strong>{language === 'en' ? 'Orthogonal Multiplanar Reconstruction' : 'Reconstrucción Multiplanar Ortogonal'}</strong>
            <p>{language === 'en' ? 'Axial, coronal, and sagittal cross-sections with anatomical segmentations.' : 'Cortes axial, coronal y sagital con segmentaciones anatómicas.'}</p>
          </div>
        </div>

        <div className="twin-info-card">
          <span className="twin-info-icon"><Icon name="shield" size={15} /></span>
          <div>
            <strong>{language === 'en' ? 'Duke Heart 4D Open Dataset' : 'Dataset Abierto Duke Heart 4D'}</strong>
            <p>{language === 'en' ? 'Project MONAI physio-validated spatial model for educational aerospace research.' : 'Modelo espacial validado por Project MONAI para investigación aeroespacial.'}</p>
          </div>
        </div>
      </div>
    </>
  );
}
