import { useCallback, useEffect, useRef, useState } from 'react';

export function useVoiceRecognition(language = 'en') {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);
  const start = useCallback((onTranscript) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(language === 'en' ? 'Voice input is not supported in this browser.' : 'Este navegador no admite dictado por voz.');
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();
    setError('');
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'en' ? 'en-US' : 'es-PE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => onTranscript(event.results?.[0]?.[0]?.transcript?.trim() || '');
    recognition.onerror = (event) => {
      const messages = language === 'en'
        ? { 'not-allowed': 'Allow microphone access to use voice input.', 'service-not-allowed': 'Voice recognition is unavailable.', 'no-speech': 'No speech was detected. Try again.', 'network': 'Voice recognition needs a network connection.' }
        : { 'not-allowed': 'Permite el acceso al micrófono para usar la voz.', 'service-not-allowed': 'El reconocimiento de voz no está disponible.', 'no-speech': 'No se detectó voz. Inténtalo de nuevo.', 'network': 'El reconocimiento de voz necesita conexión a internet.' };
      setError(messages[event.error] || (language === 'en' ? 'Voice input failed. Try again.' : 'Falló el dictado. Inténtalo de nuevo.'));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); }
    catch { setListening(false); setError(language === 'en' ? 'Could not start the microphone.' : 'No se pudo iniciar el micrófono.'); }
  }, [language]);

  useEffect(() => () => recognitionRef.current?.abort(), []);
  return { supported, listening, error, start, stop };
}

export function speakText(text, language = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'en' ? 'en-US' : 'es-PE';
  window.speechSynthesis.speak(utterance);
  return true;
}
