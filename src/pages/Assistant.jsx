import { useEffect, useRef, useState } from 'react';
import { askAgent } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { speakText, useVoiceRecognition } from '../hooks/useVoiceRecognition.js';
import Icon from '../components/Icon.jsx';

function renderMessage(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

export default function Assistant() {
  const { language } = useLanguage();
  const t = copy[language].assistant;
  const voice = useVoiceRecognition(language);
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: t.welcome }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [callActive, setCallActive] = useState(false);
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
      const answer = await askAgent(clean, language);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', text: answer }]);
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

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <section className={`panel assistant-panel assistant-page-panel${callActive ? ' call-active' : ''}`}>
      <div className="voice-call-bar">
        <div className="voice-call-copy"><span className={`call-status-dot${callActive ? ' active' : ''}`} /><div><strong>{callActive ? t.callLive : t.callReady}</strong><small>{callActive ? t.callHint : t.callIntro}</small></div></div>
        <button type="button" className={`call-toggle${callActive ? ' end' : ''}`} onClick={toggleCall} disabled={!voice.supported} aria-pressed={callActive}><Icon name={callActive ? 'close' : 'microphone'} size={16} /><span>{callActive ? t.endCall : t.startCall}</span></button>
      </div>
      {!voice.supported && <p className="call-unavailable">{copy[language].voice.unavailable}</p>}
      <div className="chat-window assistant-chat-window" role="log" aria-live="polite" aria-label={t.aria}>
        {messages.map((message) => <div className={`chat-message ${message.role}${message.error ? ' error' : ''}`} key={message.id}>{message.role === 'assistant' && <span className="chat-avatar"><Icon name="assistant" size={15} /></span>}<div className={`chat-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>{message.role === 'assistant' ? renderMessage(message.text) : message.text}{message.role === 'assistant' && <button type="button" className="speak-button" onClick={() => speakText(message.text, language)} aria-label={language === 'en' ? 'Read response aloud' : 'Leer respuesta en voz alta'} title={language === 'en' ? 'Read aloud' : 'Leer en voz alta'}><Icon name="volume" size={13} /></button>}</div></div>)}
        {pending && <div className="chat-message assistant pending"><span className="chat-avatar"><Icon name="assistant" size={15} /></span><div className="chat-bubble assistant-bubble">{t.pending} <span className="typing-dots"><i /><i /><i /></span></div></div>}
        <div ref={bottom} />
      </div>
      <div className="suggested-questions"><span>{t.suggestionsLabel}</span>{t.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><label className="sr-only" htmlFor="chatQuestion">{t.inputLabel}</label><textarea id="chatQuestion" rows="1" maxLength="2000" placeholder={t.placeholder} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={pending} /><button className="send-button" type="submit" aria-label={t.send} disabled={pending || !question.trim()}><span>{t.send}</span><Icon name="arrowUp" size={14} /></button></form>
      {voice.listening && <div className="voice-feedback">{callActive ? t.listeningCall : copy[language].voice.listening}</div>}{voice.error && <div className="voice-feedback error">{voice.error}</div>}
      <div className="chat-footnote"><Icon name="arrowRight" size={12} /> {t.footnote}<br /><Icon name="microphone" size={12} /> {t.safetyNote}</div>
    </section>
  </>;
}
