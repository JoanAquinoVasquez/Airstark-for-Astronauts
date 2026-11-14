import { useEffect, useRef, useState } from 'react';
import { askAgent } from '../lib/health.js';
import { PageHeading } from '../components/ui.jsx';

const suggestions = ['¿Qué indicadores de salud puedo consultar?', '¿Cómo funciona el registro de salud?'];

export default function Assistant() {
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: '¿En qué puedo ayudarte con tu salud durante la misión?' }]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, pending]);

  async function send(text = question) {
    const clean = text.trim();
    if (!clean || pending) return;
    setQuestion(''); setPending(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', text: clean }]);
    try {
      const answer = await askAgent(clean);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', text: answer }]);
    } catch (error) {
      console.error('AIRSTARK Copilot request failed.', error);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', error: true, text: 'No pude procesar tu pregunta en este momento. Inténtalo de nuevo en unos instantes.' }]);
    } finally { setPending(false); }
  }

  return <>
    <PageHeading eyebrow="ASISTENTE DE MISIÓN" title="AIRSTARK Copilot" description="Pregunta sobre tus indicadores o el registro de salud." />
    <section className="panel assistant-panel assistant-page-panel">
      <div className="chat-window assistant-chat-window" role="log" aria-live="polite" aria-label="Conversación con AIRSTARK Copilot">
        {messages.map((message) => <div className={`chat-message ${message.role}${message.error ? ' error' : ''}`} key={message.id}>{message.role === 'assistant' && <span className="chat-avatar">✧</span>}<div className={`chat-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>{message.text}</div></div>)}
        {pending && <div className="chat-message assistant pending"><span className="chat-avatar">✧</span><div className="chat-bubble assistant-bubble">El agente está procesando tu pregunta <span className="typing-dots"><i /><i /><i /></span></div></div>}
        <div ref={bottom} />
      </div>
      <div className="suggested-questions"><span>PRUEBA CON</span>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><label className="sr-only" htmlFor="chatQuestion">Escribe tu pregunta para el agente</label><textarea id="chatQuestion" rows="1" maxLength="2000" placeholder="Escribe tu pregunta…" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={pending} /><button className="send-button" type="submit" aria-label="Enviar pregunta" disabled={pending || !question.trim()}><span>Enviar</span><b>↑</b></button></form>
      <div className="chat-footnote"><span>↗</span> El agente recibe tu pregunta y hasta siete registros recientes de salud.</div>
    </section>
  </>;
}
