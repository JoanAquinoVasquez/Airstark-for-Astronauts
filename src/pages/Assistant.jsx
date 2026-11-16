import { useEffect, useRef, useState } from 'react';
import { askAgent } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { speakText, useVoiceRecognition } from '../hooks/useVoiceRecognition.js';
import Icon from '../components/Icon.jsx';
import CardiacScenarioLink from '../components/CardiacScenarioLink.jsx';
import AssistantMessageContent from '../components/AssistantMessageContent.jsx';
import { hasReportHotspots, isCardiacScenario } from '../lib/cardiacScenario.js';
import { useCardiacHotspotsBridge } from '../hooks/useCardiacHotspotsBridge.js';
import './assistant-simulation.css';

function CardiacPreview({ visualization, language, onDismiss }) {
  const iframeRef = useRef(null);
  const en = language === 'en';
  const hasFindings = hasReportHotspots(visualization.interpretability);
  const title = hasFindings
    ? (en ? 'Areas highlighted in the report' : 'Zonas señaladas en el informe')
    : (en ? 'Educational cardiac simulation' : 'Simulación cardíaca educativa');
  const dismissLabel = en ? 'Close cardiac preview' : 'Cerrar vista del corazón';
  const sendToViewer = useCardiacHotspotsBridge(iframeRef, hasFindings ? visualization : null);
  const params = new URLSearchParams({ view: 'heart-only' });
  if (!hasFindings) params.set('scenario', visualization.visualScenario);

  return (
    <aside className="panel assistant-simulation-preview" aria-labelledby="assistant-simulation-title">
      <header>
        <h2 id="assistant-simulation-title">{title}</h2>
        <button type="button" aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <iframe ref={iframeRef} onLoad={sendToViewer} src={`/cardiac-simulator/index.html?${params}`}
        title={title} allowFullScreen />
    </aside>
  );
}

export default function Assistant() {
  const { language } = useLanguage();
  const t = copy[language].assistant;
  const voice = useVoiceRecognition(language);
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: t.welcome }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [visualization, setVisualization] = useState(null);
  const bottom = useRef(null);
  const callRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => () => { callRef.current = false; window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, pending]);

  function beginListening() {
    if (!callRef.current || pendingRef.current) return;
    voice.start((transcript) => send(transcript, true), { continuous: true });
  }

  async function send(text = question, fromCall = false) {
    const clean = text.trim();
    if (!clean || pendingRef.current) return;
    if (fromCall) voice.stop();
    setQuestion(''); setPending(true); pendingRef.current = true;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', text: clean }]);
    try {
      const { answer, visualScenario, interpretability } = await askAgent(clean, language);
      const id = crypto.randomUUID();
      setMessages((items) => [...items, { id, role: 'assistant', text: answer, visualScenario, interpretability }]);
      setVisualization(hasReportHotspots(interpretability) || isCardiacScenario(visualScenario)
        ? { id, visualScenario, interpretability }
        : null);
      if (fromCall && callRef.current) speakText(answer, language, beginListening);
    } catch (error) {
      console.error('AIRSTARK Copilot request failed.', error);
      const failed = t.failed;
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', error: true, text: failed }]);
      if (fromCall && callRef.current) speakText(failed, language, beginListening);
    } finally { setPending(false); pendingRef.current = false; }
  }

  function toggleCall() {
    if (callRef.current) {
      callRef.current = false; setCallActive(false); voice.stop(); window.speechSynthesis?.cancel();
      return;
    }
    callRef.current = true; setCallActive(true); beginListening();
  }

  const chatPanel = (
    <section className={`panel assistant-panel assistant-page-panel${callActive ? ' call-active' : ''}`}>
      <div className="voice-call-bar">
        <div className="voice-call-copy"><span className={`call-status-dot${callActive ? ' active' : ''}`} /><div><strong>{callActive ? t.callLive : t.callReady}</strong><small>{callActive ? t.callHint : t.callIntro}</small></div></div>
        <button type="button" className={`call-toggle${callActive ? ' end' : ''}`} onClick={toggleCall} disabled={!voice.supported} aria-pressed={callActive}><Icon name={callActive ? 'close' : 'microphone'} size={16} /><span>{callActive ? t.endCall : t.startCall}</span></button>
      </div>
      {!voice.supported && <p className="call-unavailable">{copy[language].voice.unavailable}</p>}
      <div className="chat-window assistant-chat-window" role="log" aria-live="polite" aria-label={t.aria}>
        {messages.map((message) => (
          <div className={`chat-message ${message.role}${message.error ? ' error' : ''}`} key={message.id}>
            {message.role === 'assistant' && <span className="chat-avatar"><Icon name="assistant" size={15} /></span>}
            <div className={`chat-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              {message.role === 'assistant' ? (
                <AssistantMessageContent text={message.text} language={language} />
              ) : message.text}
              <CardiacScenarioLink scenario={message.visualScenario} interpretability={message.interpretability}
                reportId={message.id} language={language} />
              {message.role === 'assistant' && (
                <button type="button" className="speak-button" onClick={() => speakText(message.text, language)}
                  aria-label={language === 'en' ? 'Read response aloud' : 'Leer respuesta en voz alta'}
                  title={language === 'en' ? 'Read aloud' : 'Leer en voz alta'}>
                  <Icon name="volume" size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {pending && <div className="chat-message assistant pending"><span className="chat-avatar"><Icon name="assistant" size={15} /></span><div className="chat-bubble assistant-bubble">{t.pending} <span className="typing-dots"><i /><i /><i /></span></div></div>}
        <div ref={bottom} />
      </div>
      <div className="suggested-questions"><span>{t.suggestionsLabel}</span>{t.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><label className="sr-only" htmlFor="chatQuestion">{t.inputLabel}</label><textarea id="chatQuestion" rows="1" maxLength="2000" placeholder={t.placeholder} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={pending} /><button className="send-button" type="submit" aria-label={t.send} disabled={pending || !question.trim()}><span>{t.send}</span><Icon name="arrowUp" size={14} /></button></form>
      {voice.listening && <div className="voice-feedback">{callActive ? t.listeningCall : copy[language].voice.listening}</div>}{voice.error && <div className="voice-feedback error">{voice.error}</div>}
      <div className="chat-footnote"><Icon name="arrowRight" size={12} /> {t.footnote}<br /><Icon name="microphone" size={12} /> {t.safetyNote}</div>
    </section>
  );

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <div className={visualization ? 'assistant-with-scenario' : undefined}>
        {chatPanel}
        {visualization && (
          <CardiacPreview
            key={visualization.id}
            visualization={visualization}
            language={language}
            onDismiss={() => setVisualization(null)}
          />
        )}
      </div>
    </>
  );
}
