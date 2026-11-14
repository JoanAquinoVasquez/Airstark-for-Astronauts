import { useEffect, useRef, useState } from 'react';
import { askAgent } from '../lib/health.js';
import { PageHeading, VoiceButton } from '../components/ui.jsx';
import { copy, useLanguage } from '../i18n.jsx';
import { speakText, useVoiceRecognition } from '../hooks/useVoiceRecognition.js';

export default function Assistant() {
  const { language } = useLanguage();
  const t = copy[language].assistant;
  const voice = useVoiceRecognition(language);
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: t.welcome }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const bottom = useRef(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  async function send(text = question) {
    const clean = text.trim();
    if (!clean || pending) return;
    setQuestion(''); setPending(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', text: clean }]);
    try {
      const answer = await askAgent(clean, language);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', text: answer }]);
    } catch (error) {
      console.error('AIRSTARK Copilot request failed.', error);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', error: true, text: t.failed }]);
    } finally { setPending(false); }
  }

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <section className="panel assistant-panel assistant-page-panel">
      <div className="chat-window assistant-chat-window" role="log" aria-live="polite" aria-label={t.aria}>
        {messages.map((message) => <div className={`chat-message ${message.role}${message.error ? ' error' : ''}`} key={message.id}>{message.role === 'assistant' && <span className="chat-avatar">✧</span>}<div className={`chat-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>{message.id === 'welcome' ? t.welcome : message.text}{message.role === 'assistant' && <button type="button" className="speak-button" onClick={() => speakText(message.id === 'welcome' ? t.welcome : message.text, language)} aria-label={language === 'en' ? 'Read response aloud' : 'Leer respuesta en voz alta'} title={language === 'en' ? 'Read aloud' : 'Leer en voz alta'}>◖))</button>}</div></div>)}
        {pending && <div className="chat-message assistant pending"><span className="chat-avatar">✧</span><div className="chat-bubble assistant-bubble">{t.pending} <span className="typing-dots"><i /><i /><i /></span></div></div>}
        <div ref={bottom} />
      </div>
      <div className="suggested-questions"><span>{t.suggestionsLabel}</span>{t.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><label className="sr-only" htmlFor="chatQuestion">{t.inputLabel}</label><textarea id="chatQuestion" rows="1" maxLength="2000" placeholder={t.placeholder} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={pending} /><VoiceButton listening={voice.listening} label={copy[language].voice.dictate} onClick={() => voice.listening ? voice.stop() : voice.start((transcript) => send(transcript))} /><button className="send-button" type="submit" aria-label={t.send} disabled={pending || !question.trim()}><span>{t.send}</span><b>↑</b></button></form>
      {voice.listening && <div className="voice-feedback">{copy[language].voice.listening}</div>}{voice.error && <div className="voice-feedback error">{voice.error}</div>}
      <div className="chat-footnote"><span>↗</span> {t.footnote}<br /><span>🎙</span> {copy[language].voice.assistantHint}</div>
    </section>
  </>;
}
