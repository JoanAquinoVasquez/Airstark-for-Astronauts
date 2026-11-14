import { useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { copy, LanguageContext } from './i18n.jsx';
import brandLogo from '../assets/airstark-logo.jpg';
import Dashboard from './pages/Dashboard.jsx';
import LiveMonitor from './pages/LiveMonitor.jsx';
import DigitalTwin from './pages/DigitalTwin.jsx';
import HealthData from './pages/HealthData.jsx';
import HealthForm from './pages/HealthForm.jsx';
import History from './pages/History.jsx';
import Assistant from './pages/Assistant.jsx';
import Profile from './pages/Profile.jsx';
import { astronautInitials, getAstronautProfile } from './lib/profile.js';
import Icon from './components/Icon.jsx';
import AstronautSetup from './components/AstronautSetup.jsx';
import { isSupabaseConfigured, loadCloudData, NOTIFICATIONS_STORAGE_KEY, supabase } from './lib/supabase.js';
import { HEALTH_STORAGE_KEY } from './lib/health.js';
import { PROFILE_STORAGE_KEY } from './lib/profile.js';

const navigation = [
  { to: '/', label: 0, icon: 'overview', end: true },
  { to: '/monitor', label: 1, icon: 'pulse' },
  { to: '/gemelo-3d', label: 2, icon: 'cube' },
  { to: '/datos', label: 3, icon: 'watch' },
  { to: '/registro', label: 4, icon: 'plus' },
  { to: '/historial', label: 5, icon: 'history' },
  { to: '/asistente', label: 6, icon: 'assistant' },
  { to: '/perfil', label: 7, icon: 'user' },
];

function AppShell({ session }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState('');
  const { language, setLanguage } = useContext(LanguageContext);
  const [astronaut, setAstronaut] = useState(getAstronautProfile);
  const text = copy[language];
  const location = useLocation();
  const current = navigation.find((item) => item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)) || navigation[0];
  useEffect(() => {
    if (location.hash === '#notifications-panel') requestAnimationFrame(() => document.getElementById('notifications-panel')?.scrollIntoView({ behavior: 'smooth' }));
  }, [location.hash, location.pathname]);
  useEffect(() => {
    const updateProfile = (event) => setAstronaut(event.detail || getAstronautProfile());
    window.addEventListener('airstark-profile-updated', updateProfile);
    return () => window.removeEventListener('airstark-profile-updated', updateProfile);
  }, []);
  useEffect(() => {
    if (!signOutMessage) return undefined;
    const timer = window.setTimeout(() => setSignOutMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [signOutMessage]);

  async function closeSession() {
    const warning = session?.user?.is_anonymous
      ? (language === 'en' ? 'End this demo session? Its cloud data cannot be recovered after signing out. A new session will start.' : '¿Cerrar esta sesión demo? No podrás recuperar sus datos en la nube al salir. Se iniciará una sesión nueva.')
      : (language === 'en' ? 'Sign out and return to the demo welcome screen?' : '¿Cerrar la sesión y volver a la bienvenida de la demo?');
    if (!signOutConfirm) { setSignOutMessage(warning); setSignOutConfirm(true); return; }
    setSignOutPending(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      for (const key of [HEALTH_STORAGE_KEY, PROFILE_STORAGE_KEY, NOTIFICATIONS_STORAGE_KEY, 'airstark.agentSession.v1']) localStorage.removeItem(key);
      window.location.reload();
    } catch (error) {
      setSignOutConfirm(false);
      setSignOutMessage(language === 'en' ? `Could not sign out: ${error.message}` : `No se pudo cerrar la sesión: ${error.message}`);
      setSignOutPending(false);
    }
  }

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
              <span className="nav-icon"><Icon name={item.icon} size={16} /></span>{text.app.nav[item.label]}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="mission-card"><span className="live-dot" /><div><small>{text.app.missionStatus}</small><strong>{text.app.simulation}</strong></div><span className="mission-orbit"><Icon name="sparkles" size={15} /></span></div>
        <NavLink className="sidebar-foot profile-sidebar-link" to="/perfil"><span className="avatar">{astronautInitials(astronaut.name)}</span><span className="crew"><strong>{astronaut.name}</strong><small>{language === 'en' ? `Crew · ${astronaut.crewId}` : `Tripulación · ${astronaut.crewId}`}</small></span><span className="more"><Icon name="more" size={15} /></span></NavLink>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" aria-label={text.app.menu} onClick={() => setMenuOpen((open) => !open)}><Icon name="menu" size={17} /></button>
          <div className="breadcrumb">AIRSTARK <span>/</span> <b>{text.app.nav[current.label]}</b></div>
          <div className="top-actions"><Link className="notifications-shortcut" to="/#notifications-panel" aria-label={language === 'en' ? 'Notifications' : 'Notificaciones'} title={language === 'en' ? 'Notifications' : 'Notificaciones'}><Icon name="bell" size={16} /><i /></Link><div className="language-switch" role="group" aria-label="Choose language / Elegir idioma"><button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button type="button" className={language === 'es' ? 'active' : ''} aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button></div><span className="mission-pill"><i /> {text.app.missionDemo}</span><a className="space-apps-mark" href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer" aria-label="NASA Space Apps Challenge"><img src="https://assets.spaceappschallenge.org/media/images/Space_Apps_Logo_Color_and_White.width-440.jpegquality-60.png" alt="NASA Space Apps Challenge" /></a><Link className="top-avatar" to="/perfil" aria-label={text.app.nav[7]}>{astronautInitials(astronaut.name)}</Link>{session && <button className="auth-signout" type="button" onClick={closeSession}><Icon name="logout" size={13} /><span>{language === 'en' ? 'Sign out' : 'Cerrar sesión'}</span></button>}</div>
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
            <Route path="/perfil" element={<Profile />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
        <footer className="footer"><span>AIRSTARK <b>·</b> {text.app.footer}</span><span>{text.app.prototype} <b>·</b> {text.app.mock}</span></footer>
      </main>
      {(signOutConfirm || signOutMessage) && <div className={`app-toast${signOutConfirm ? ' confirm' : ' error'}`} role="status" aria-live="polite"><div className="app-toast-icon"><Icon name={signOutConfirm ? 'info' : 'close'} size={15} /></div><div className="app-toast-copy"><strong>{signOutConfirm ? (language === 'en' ? 'Confirm sign out' : 'Confirmar cierre de sesión') : (language === 'en' ? 'Session notice' : 'Aviso de sesión')}</strong><p>{signOutMessage}</p>{signOutConfirm && <div className="app-toast-actions"><button type="button" className="toast-cancel" onClick={() => { setSignOutConfirm(false); setSignOutMessage(''); }}>{language === 'en' ? 'Cancel' : 'Cancelar'}</button><button type="button" className="toast-confirm" onClick={closeSession} disabled={signOutPending}>{signOutPending ? (language === 'en' ? 'Closing…' : 'Cerrando…') : (language === 'en' ? 'Sign out' : 'Cerrar sesión')}</button></div>}</div><button type="button" className="app-toast-close" aria-label={language === 'en' ? 'Dismiss notice' : 'Cerrar aviso'} onClick={() => { setSignOutConfirm(false); setSignOutMessage(''); }}><Icon name="close" size={13} /></button></div>}
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('airstark.language') || 'en');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const [cloudError, setCloudError] = useState('');
  const [profileReady, setProfileReady] = useState(() => Boolean(localStorage.getItem(PROFILE_STORAGE_KEY)));

  useEffect(() => localStorage.setItem('airstark.language', language), [language]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) setSession(data.session);
        else {
          const result = await supabase.auth.signInAnonymously();
          if (result.error) throw result.error;
          setSession(result.data.session);
        }
      } catch (error) {
        if (active) setCloudError(language === 'en'
          ? `Anonymous access is not enabled in Supabase. Enable it under Authentication settings to sync this demo. ${error.message || ''}`
          : `El acceso anónimo no está habilitado en Supabase. Actívalo en la configuración de Authentication para sincronizar esta demo. ${error.message || ''}`);
      } finally { if (active) setAuthReady(true); }
    };
    initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setCloudReady(false); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    let active = true;
    const existingLocalProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

    loadCloudData().then(async ({ records, notifications, profile }) => {
      if (!active) return;
      if (records?.length) {
        localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(records));
      }
      if (notifications?.length) {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
      }

      if (profile) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
        setProfileReady(true);
        window.dispatchEvent(new CustomEvent('airstark-profile-updated', { detail: profile }));
      } else if (existingLocalProfile) {
        setProfileReady(true);
        try {
          const parsed = JSON.parse(existingLocalProfile);
          if (parsed?.name) {
            await saveCloudProfile(parsed);
          }
        } catch {
          // ignore background sync errors
        }
      } else {
        setProfileReady(false);
      }

      setCloudReady(true);
      setCloudError('');
      window.dispatchEvent(new Event('airstark-cloud-data-loaded'));
    }).catch((error) => {
      if (active) {
        setCloudError(error.message || 'Supabase connection failed.');
        setCloudReady(true);
        if (localStorage.getItem(PROFILE_STORAGE_KEY)) {
          setProfileReady(true);
        }
      }
    });

    return () => { active = false; };
  }, [session]);

  const content = !authReady || (session && !cloudReady && !profileReady)
    ? <main className="auth-screen"><section className="panel auth-panel"><span className="section-kicker">AIRSTARK</span><p>{language === 'en' ? 'Connecting securely…' : 'Conectando de forma segura…'}</p></section></main>
    : !profileReady
      ? <AstronautSetup language={language} cloudError={cloudError} onDone={() => setProfileReady(true)} />
      : <><AppShell session={session} />{cloudError && <div className="cloud-error" role="status">{language === 'en' ? 'Cloud sync unavailable: ' : 'Sincronización no disponible: '}{cloudError}</div>}</>;
  return <LanguageContext.Provider value={{ language, setLanguage }}>{content}</LanguageContext.Provider>;
}
