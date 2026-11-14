import { useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { copy, LanguageContext } from './i18n.jsx';
import brandLogo from '../assets/airstark-logo.jpg';
import Dashboard from './pages/Dashboard.jsx';
import LiveMonitor from './pages/LiveMonitor.jsx';
import DigitalTwin from './pages/DigitalTwin.jsx';
import HealthData from './pages/HealthData.jsx';
import HealthForm from './pages/HealthForm.jsx';
import History from './pages/History.jsx';
import Assistant from './pages/Assistant.jsx';

const navigation = [
  { to: '/', label: 0, icon: '◫', end: true },
  { to: '/monitor', label: 1, icon: '⌁' },
  { to: '/gemelo-3d', label: 2, icon: '◇' },
  { to: '/datos', label: 3, icon: '⌚' },
  { to: '/registro', label: 4, icon: '＋' },
  { to: '/historial', label: 5, icon: '◷' },
  { to: '/asistente', label: 6, icon: '✧' },
];

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage } = useContext(LanguageContext);
  const text = copy[language];
  const location = useLocation();
  const current = navigation.find((item) => item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)) || navigation[0];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <NavLink className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <img className="brand-logo" src={brandLogo} alt="" />
          <span className="brand-name">AIRSTARK<span>FOR ASTRONAUTS</span></span>
        </NavLink>
        <div className="nav-label">{text.app.missionCenter}</div>
        <nav className="nav-links" aria-label={language === 'en' ? 'Main navigation' : 'Navegación principal'}>
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span>{item.icon}</span>{text.app.nav[item.label]}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="mission-card"><span className="live-dot" /><div><small>{text.app.missionStatus}</small><strong>{text.app.simulation}</strong></div><span className="mission-orbit">✳</span></div>
        <div className="sidebar-foot"><span className="avatar">AC</span><span className="crew"><strong>Alex Crew</strong><small>{language === 'en' ? 'Crew · A-01' : 'Tripulación · A-01'}</small></span><span className="more">···</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" aria-label={text.app.menu} onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumb">AIRSTARK <span>/</span> <b>{text.app.nav[current.label]}</b></div>
          <div className="top-actions"><div className="language-switch" role="group" aria-label="Choose language / Elegir idioma"><button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button type="button" className={language === 'es' ? 'active' : ''} aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button></div><span className="mission-pill"><i /> {text.app.missionDemo}</span><a className="space-apps-mark" href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer" aria-label="NASA Space Apps Challenge"><img src="https://assets.spaceappschallenge.org/media/images/Space_Apps_Logo_Color_and_White.width-440.jpegquality-60.png" alt="NASA Space Apps Challenge" /></a><span className="top-avatar">AC</span></div>
        </header>
        <div className="route-content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitor" element={<LiveMonitor />} />
            <Route path="/gemelo-3d" element={<DigitalTwin />} />
            <Route path="/datos" element={<HealthData />} />
            <Route path="/registro" element={<HealthForm />} />
            <Route path="/historial" element={<History />} />
            <Route path="/asistente" element={<Assistant />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
        <footer className="footer"><span>AIRSTARK <b>·</b> {text.app.footer}</span><span>{text.app.prototype} <b>·</b> {text.app.mock}</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('airstark.language') || 'en');
  useEffect(() => localStorage.setItem('airstark.language', language), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}><AppShell /></LanguageContext.Provider>;
}
