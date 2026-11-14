import { useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import brandLogo from '../assets/airstark-logo.jpg';
import Dashboard from './pages/Dashboard.jsx';
import LiveMonitor from './pages/LiveMonitor.jsx';
import DigitalTwin from './pages/DigitalTwin.jsx';
import HealthData from './pages/HealthData.jsx';
import HealthForm from './pages/HealthForm.jsx';
import History from './pages/History.jsx';
import Assistant from './pages/Assistant.jsx';

const navigation = [
  { to: '/', label: 'Resumen de salud', icon: '◫', end: true },
  { to: '/monitor', label: 'Monitor en vivo', icon: '⌁' },
  { to: '/gemelo-3d', label: 'Gemelo digital 3D', icon: '◇' },
  { to: '/datos', label: 'Datos del reloj', icon: '⌚' },
  { to: '/registro', label: 'Registro de salud', icon: '＋' },
  { to: '/historial', label: 'Historial', icon: '◷' },
  { to: '/asistente', label: 'Asistente IA', icon: '✧' },
];

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="nav-label">CENTRO DE MISIÓN</div>
        <nav className="nav-links" aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="mission-card"><span className="live-dot" /><div><small>ESTADO DE MISIÓN</small><strong>Simulación activa</strong></div><span className="mission-orbit">✳</span></div>
        <div className="sidebar-foot"><span className="avatar">AC</span><span className="crew"><strong>Alex Crew</strong><small>Tripulación · A-01</small></span><span className="more">···</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumb">AIRSTARK <span>/</span> <b>{current.label}</b></div>
          <div className="top-actions"><span className="mission-pill"><i /> MISIÓN DEMO</span><a className="space-apps-mark" href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer" aria-label="NASA Space Apps Challenge"><img src="https://assets.spaceappschallenge.org/media/images/Space_Apps_Logo_Color_and_White.width-440.jpegquality-60.png" alt="NASA Space Apps Challenge" /></a><span className="top-avatar">AC</span></div>
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
        <footer className="footer"><span>AIRSTARK <b>·</b> Tu salud, nuestra misión.</span><span>PROTOTIPO DE HACKATÓN <b>·</b> DATOS MOCK</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
