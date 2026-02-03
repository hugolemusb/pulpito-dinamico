
import { Language } from '../types';

export const stripHtmlForAudio = (html: string): string => {
  if (!html) return "";
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Reemplazar saltos de línea visuales con puntuación para que la voz haga pausas
  const text = temp.innerText || temp.textContent || "";
  return text.replace(/\n/g, '. ');
};

// Divide el texto en oraciones o frases lógicas para navegación
export const splitTextIntoChunks = (text: string): string[] => {
  if (!text) return [];
  // Regex: Divide por punto, interrogación o exclamación seguido de espacio o fin de línea.
  // Mantiene el delimitador con la frase anterior.
  const rawChunks = text.match(/[^.?!]+[.?!]+["']?|[^.?!]+$/g);
  
  if (!rawChunks) return [text];

  return rawChunks
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0); // Eliminar vacíos
};

// Helper para encontrar voz femenina
const getPreferredVoice = (voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null => {
  // Filtrar por idioma
  const langVoices = voices.filter(v => v.lang.startsWith(lang));
  
  if (langVoices.length === 0) return null;

  // Prioridad 1: Voces conocidas de alta calidad o femeninas explícitas
  const femaleKeywords = ['female', 'mujer', 'monica', 'zira', 'samantha', 'victoria', 'paulina', 'helena', 'google español'];
  
  const femaleVoice = langVoices.find(v => 
    femaleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
  );

  // Si encuentra voz femenina específica, úsala. Si no, usa la primera del idioma (generalmente Google Standard)
  return femaleVoice || langVoices[0];
};

export const speakText = (text: string, language: Language = 'es', onEnd?: () => void, onError?: () => void) => {
  // Cancelar cualquier audio previo
  window.speechSynthesis.cancel();

  if (!text.trim()) {
    if (onEnd) onEnd();
    return;
  }

  // Asegurar que las voces estén cargadas (bug fix para Chrome)
  let voices = window.speechSynthesis.getVoices();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Mapeo de idioma app -> idioma navegador
  let langCode = 'es-ES';
  switch (language) {
    case 'en': langCode = 'en-US'; break;
    case 'pt': langCode = 'pt-BR'; break;
    default: langCode = 'es-ES'; break; // Intenta español de España o Latino
  }
  
  utterance.lang = langCode;

  // Intentar seleccionar voz femenina
  if (voices.length > 0) {
    const preferred = getPreferredVoice(voices, langCode.split('-')[0]); // Busca 'es', 'en', 'pt' genérico
    if (preferred) {
      utterance.voice = preferred;
    }
  }

  // Configuración "Audiolibro" - Más limpia y pausada
  utterance.rate = 0.9; // Un poco más lento para claridad
  utterance.pitch = 1.1; // Tono ligeramente más alto (suele sonar más femenino/claro si la voz es sintética)
  utterance.volume = 1.0;

  if (onEnd) {
    utterance.onend = () => {
      onEnd();
    };
  }

  if (onError) {
    utterance.onerror = (e) => {
      // Ignorar errores de cancelación o interrupción intencional
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.error("Speech error details:", e.error);
      onError();
    };
  }

  window.speechSynthesis.speak(utterance);
};

export const stopAudio = () => {
  window.speechSynthesis.cancel();
};

export const isSpeaking = (): boolean => {
  return window.speechSynthesis.speaking;
};
