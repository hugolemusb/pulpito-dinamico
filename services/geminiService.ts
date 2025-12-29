
import { GoogleGenAI } from "@google/genai";
import { SearchResult, DictionaryResult, AIConfig } from "../types";
import { getAILanguageInstruction, getCurrentLanguage, LANGUAGE_NAMES } from "./i18n";

// Helper to get current config
const getConfig = (): AIConfig => {
  const saved = localStorage.getItem('app_ai_config');
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    provider: 'gemini',
    apiKey: process.env.API_KEY || ''
  };
};

const cleanUrl = (url?: string) => {
  if (!url) return '';
  return url.replace(/\/+$/, '');
};

const getFetchUrl = (url: string, useProxy?: boolean) => {
  if (useProxy) {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return url;
};

/**
 * Extrae frases de fuerza y palabras clave de cada sección del sermón usando IA
 * @param sections - Secciones del sermón (lectura, desarrollo, llamado, conclusión)
 * @returns JSON con palabras clave y referencias por sección
 */

const CACHE_KEYS = {
  STRUCTURE: 'sermon_structure_cache',
  SEARCH: 'semantic_search_cache',
  REFS: 'cross_refs_cache',
  DICT: 'theology_dict_cache'
};

export interface SectionPowerPhrases {
  palabras_clave: string[]; // Palabras individuales más importantes
  referencias: string[]; // 3-5 frases cortas usando las palabras clave
}

export interface PowerPhrasesResult {
  lectura_y_contexto: SectionPowerPhrases;
  desarrollo_idea: SectionPowerPhrases;
  llamado: SectionPowerPhrases;
  conclusion_reflexion: SectionPowerPhrases;
}

/**
 * Extrae palabras destacadas del HTML del sermón
 * Detecta: bold, strong, mark, colores, backgrounds, tipografías diferentes
 */
/**
 * Extrae palabras destacadas del HTML del sermón
 * Detecta: bold, strong, mark, colores, backgrounds, tipografías diferentes
 */
export const extractColoredWords = (html: string): string[] => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const coloredWords: string[] = [];
  const addWord = (text?: string | null) => {
    if (!text) return;
    const cleaned = text.trim();
    if (cleaned.length > 2 && !coloredWords.includes(cleaned)) coloredWords.push(cleaned);
  };

  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    const element = el as HTMLElement;
    const style = element.style;
    const computedStyle = element.getAttribute('style') || '';

    // A. Colores de texto (color: ...)
    if (style.color || computedStyle.includes('color:')) addWord(element.textContent);

    // B. Colores de fondo (background-color: ...)
    if ((style.backgroundColor || computedStyle.includes('background')) &&
      style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== '#ffffff') {
      addWord(element.textContent);
    }

    // C. Clases de editor con color
    if (element.className && (element.className.includes('color') || element.className.includes('bg-'))) {
      addWord(element.textContent);
    }
    // D. Tags semánticos de resaltado (mark)
    if (element.tagName === 'MARK') addWord(element.textContent);

    // E. Legacy font tag
    if (element.tagName === 'FONT' && (element.getAttribute('color') || element.getAttribute('style')?.includes('color'))) {
      addWord(element.textContent);
    }
  });

  return [...new Set(coloredWords)];
};

export const extractBoldWords = (html: string): string[] => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const boldWords: string[] = [];
  const addWord = (text?: string | null) => {
    if (!text) return;
    const cleaned = text.trim();
    if (cleaned.length > 2 && !boldWords.includes(cleaned)) boldWords.push(cleaned);
  };

  // 1. Tags semánticos directos (negrita, subrayado, itálica, resaltado)
  const semanticTags = temp.querySelectorAll('strong, b, mark, em, i, u, ins');
  semanticTags.forEach(el => addWord(el.textContent));

  // 2. Estilos inline NO relacionados con color (Font-Weight, Underline, Fonts)
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    const element = el as HTMLElement;
    const style = element.style;
    const computedStyle = element.getAttribute('style') || '';

    if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600 || computedStyle.includes('font-weight: bold')) addWord(element.textContent);
    if (style.textDecoration.includes('underline') || computedStyle.includes('text-decoration: underline')) addWord(element.textContent);
    if ((style.borderBottom && style.borderBottom !== 'none') || computedStyle.includes('border-bottom')) addWord(element.textContent);
    if (element.tagName.match(/^H[1-6]$/)) addWord(element.textContent);
  });

  return [...new Set(boldWords)];
};

export const extractPowerPhrases = async (sections: {
  lectura: string;
  desarrollo: string;
  llamado: string;
  conclusion: string;
}): Promise<PowerPhrasesResult> => {
  // Extraer palabras destacadas de cada sección 
  const boldWordsLectura = extractBoldWords(sections.lectura);
  const boldWordsDesarrollo = extractBoldWords(sections.desarrollo);
  const boldWordsLlamado = extractBoldWords(sections.llamado);
  const boldWordsConclusion = extractBoldWords(sections.conclusion);

  // Limpiar HTML para el prompt
  const cleanLectura = sections.lectura.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanDesarrollo = sections.desarrollo.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanLlamado = sections.llamado.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanConclusion = sections.conclusion.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const prompt = `Actúa como asistente de predicación para una app llamada "Púlpito Dinámico".
El sermón está dividido en 4 secciones:

1) Lectura del versículo y su contexto:
"""
${cleanLectura}
"""
PALABRAS YA DESTACADAS POR EL PREDICADOR (priorizar): ${boldWordsLectura.join(', ') || 'ninguna'}

2) Desarrollo de la idea:
"""
${cleanDesarrollo}
"""
PALABRAS YA DESTACADAS POR EL PREDICADOR (priorizar): ${boldWordsDesarrollo.join(', ') || 'ninguna'}

3) Llamado por medio de la Palabra:
"""
${cleanLlamado}
"""
PALABRAS YA DESTACADAS POR EL PREDICADOR (priorizar): ${boldWordsLlamado.join(', ') || 'ninguna'}

4) Conclusión y reflexión:
"""
${cleanConclusion}
"""
PALABRAS YA DESTACADAS POR EL PREDICADOR (priorizar): ${boldWordsConclusion.join(', ') || 'ninguna'}

TAREA CRÍTICA - EXTRACCIÓN INTELIGENTE DE PALABRAS CLAVE:

1. **IDENTIFICAR PALABRAS CLAVE核** (no frases completas):
   - De cada frase destacada, extrae la palabra o palabras MÁS IMPORTANTES
   - Ejemplo: "el futuro solo le pertenece a Dios" → palabra clave: "futuro", "Dios"
   - Ignora artículos, preposiciones, verbos auxiliares
   - Enfócate en sustantivos y verbos de acción principales

2. **GENERAR 3-5 REFERENCIAS POR SECCIÓN**:
   - Crea frases cortas (3-6 palabras) usando las palabras clave
   - Ejemplo: palabra clave "futuro" → referencia: "tu futuro es Dios"
   - Mantén el CONTEXTO y SIGNIFICADO original
   - Variedad: usa diferentes estructuras pero mismo concepto
   - Cantidad: 3 referencias mínimo, 5 máximo (según contenido disponible)

3. **ESTRUCTURA DE RESPUESTA**:
   - \`palabras_clave\`: array de palabras individuales MÁS importantes (no frases)
   - \`referencias\`: array de 4 a 5 frases cortas que usen esas palabras clave
   - Ejemplo completo:
     \`\`\`
     Frase destacada: "el futuro solo le pertenece a Dios"
     palabras_clave: ["futuro", "Dios"]
     referencias: [
       "tu futuro es Dios",
       "Dios controla tu futuro",
       "el futuro pertenece a Dios",
       "confía tu futuro a Dios",
       "Dios sostiene tu mañana"
     ]
     \`\`\`

FORMATO DE RESPUESTA (JSON):
{
  "lectura_y_contexto": {
    "palabras_clave": ["Cristo", "habita", "creyente"],
    "referencias": [
      "Cristo vive en ti",
      "Cristo habita en creyentes",
      "el creyente tiene a Cristo",
      "somos templo de Dios",
      "la presencia real es Cristo"
    ]
  },
  "desarrollo_idea": {
    "palabras_clave": [...],
    "referencias": [...]
  },
  "llamado": {
    "palabras_clave": [...],
    "referencias": [...]
  },
  "conclusion_reflexion": {
    "palabras_clave": [...],
    "referencias": [...]
  }
}

RECUERDA: 
- Palabras clave = palabras INDIVIDUALES más importantes
- Referencias = 4 a 5 frases cortas con esas palabras (OBLIGATORIO)
- Mantén contexto original de las palabras destacadas`;

  const systemInstruction = `Eres un experto en homilética y comunicación visual para predicadores.
    Tu tarea es usar las PALABRAS YA DESTACADAS por el predicador como base principal para crear frases visuales.
    PRIORIDAD ABSOLUTA: Construye frases de fuerza alrededor de las palabras que el predicador destacó en su sermón.
    Mantén el contexto y significado original de cada palabra destacada.
    IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional ni formato markdown.`;

  try {
    const response = await generateUnifiedContent(prompt, systemInstruction, true);

    // Parse JSON response
    const cleaned = response.replace(/```json\n ? /g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    return result as PowerPhrasesResult;
  } catch (error) {
    console.error('Error extracting power phrases:', error);
    throw new Error('No se pudieron extraer las frases de fuerza. Verifica tu conexión y clave API.');
  }
};

// --- UNIFIED GENERATION FUNCTION ---
export const generateUnifiedContent = async (
  prompt: string,
  systemInstruction?: string,
  jsonMode: boolean = false,
  temperature?: number
): Promise<string> => {

  if (!navigator.onLine) {
    throw new Error("No hay conexión a internet. El modo offline permite editar, pero no consultar a la IA.");
  }

  const config = getConfig();

  // 1. INJECT MANDATORY LANGUAGE INSTRUCTION
  const langSystemInstruction = getAILanguageInstruction();
  const currentLang = getCurrentLanguage();
  const langName = LANGUAGE_NAMES[currentLang];

  // Combine system instructions: Strict Lang instruction first
  const finalSystemInstruction = systemInstruction
    ? `${langSystemInstruction} \n\n${systemInstruction} `
    : langSystemInstruction;

  // 2. INJECT USER MESSAGE REMINDER
  const finalPrompt = `${prompt} \n\n[Importante: Responde en ${langName}]`;

  // 1. GOOGLE GEMINI STRATEGY
  if (config.provider === 'gemini') {
    const finalApiKey = config.apiKey || process.env.API_KEY;

    if (!finalApiKey) {
      throw new Error("⚠️ Falta API Key. Ve a Configuración (⚙️) e ingresa una clave válida de Gemini.");
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction: finalSystemInstruction,
          responseMimeType: jsonMode ? "application/json" : "text/plain",
          temperature: temperature ?? 0.7
        }
      });
      return response.text || "";
    } catch (error: any) {
      // Check for quota error FIRST to avoid noisy logs
      let errorMsg = error.message || error.toString();
      const detailed = JSON.stringify(error);
      const isQuota =
        errorMsg.includes('429') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        detailed.includes('"code":429') ||
        detailed.includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        throw new Error("⚠️ Cuota excedida de Google Gemini. Ve a Configuración (Engranaje) y usa tu propia API Key para continuar sin límites.");
      }

      // Log other errors
      console.error("Gemini Error Raw:", error);
      throw error;
    }
  }

  // 2. EXTERNAL API STRATEGY
  if (config.provider === 'external') {
    if (!config.baseUrl || !config.apiKey) throw new Error("Configuración externa incompleta");

    const baseUrl = cleanUrl(config.baseUrl).trim();
    // FIX: Remove space before /chat/completions
    const endpoint = `${baseUrl}/chat/completions`;
    const fetchUrl = getFetchUrl(endpoint, config.useCorsProxy);
    const apiKey = config.apiKey.trim();

    const messages = [];
    if (finalSystemInstruction) {
      messages.push({ role: 'system', content: finalSystemInstruction });
    }
    messages.push({ role: 'user', content: finalPrompt });

    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // FIX: Remove space after bearer token
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: messages,
          temperature: 0.8,
          // DeepSeek and OpenAI support json_object, but ensure safety
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Error 401: Credenciales inválidas. Verifica tu API Key.");
        }
        throw new Error(`External API Error: ${response.status}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error("External API Error:", error);
      throw error;
    }
  }

  return "Error: Proveedor de IA no configurado.";
};

export const validateAIConfig = async (config: AIConfig): Promise<{ isValid: boolean, error?: string }> => {
  // Simple validation logic
  if (!config.apiKey) return { isValid: false, error: "Falta API Key" };

  try {
    if (config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Hola",
      });
    } else {
      const baseUrl = cleanUrl(config.baseUrl);
      const endpoint = `${baseUrl}/chat/completions`; // Fixed: Removed space
      const fetchUrl = getFetchUrl(endpoint, config.useCorsProxy);
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` }, // Fixed: Removed space
        body: JSON.stringify({ model: config.modelId || 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'Hola' }], max_tokens: 5 })
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
    }
    return { isValid: true };
  } catch (e: any) {
    let msg = e.message || "Error de conexión";
    if (msg.includes('401') || msg.includes('403')) msg = "API Key inválida (401)";
    else if (msg.includes('429')) msg = "Cuota excedida (429)";
    else if (msg.includes('Failed to fetch')) msg = "Error de Red/CORS. Activa 'Proxy Web'.";
    return { isValid: false, error: msg };
  }
};


const SYSTEM_INSTRUCTION_ADVISOR = `
Eres un asistente teológico experto en la Biblia y predicación cristiana. 
Tu nombre es "Asesor Púlpito".
Usa un tono pastoral, académico pero accesible.
Cuando te pidan generar contenido para sermones, usa formato HTML simple(<p>, <b>, <i>, <ul>, <li>).
`;



const getFromCache = (storageKey: string, queryKey: string) => {
  try {
    const storage = localStorage.getItem(storageKey);
    if (!storage) return null;
    const cache = JSON.parse(storage);
    return cache[queryKey] || null;
  } catch (e) { return null; }
};

const saveToCache = (storageKey: string, queryKey: string, data: any) => {
  try {
    const storage = localStorage.getItem(storageKey);
    const cache = storage ? JSON.parse(storage) : {};
    const keys = Object.keys(cache);
    if (keys.length > 20) delete cache[keys[0]];
    cache[queryKey] = data;
    localStorage.setItem(storageKey, JSON.stringify(cache));
  } catch (e) { }
};

export const chatWithAdvisor = async (history: { role: string, content: string }[], message: string): Promise<string> => {
  try {
    const prompt = message;
    const context = SYSTEM_INSTRUCTION_ADVISOR + "\nContexto anterior: " + JSON.stringify(history.slice(-2));
    return await generateUnifiedContent(prompt, context);
  } catch (e: any) {
    return `Error: ${e.message} `;
  }
};

export const getSectionHelper = async (type: string, currentContent: string, context: string, bypassCache: boolean = false): Promise<string> => {
  let prompt = "";

  // Si bypassCache es true, inyectamos una instrucción fuerte para ignorar lo anterior y un seed aleatorio en el prompt
  // para evitar que el modelo repita la misma salida determinista.
  const seed = Date.now();
  const variationInstruction = bypassCache
    ? `\n[INSTRUCCIÓN DE REGENERACIÓN ${seed}]: El usuario ha solicitado una NUEVA propuesta.IGNORA el estilo o contenido exacto del texto anterior(si existe).Genera una versión COMPLETAMENTE FRESCA, con un enfoque, analogía o profundidad diferente.Sé creativo y pastoral.`
    : "Mejora el siguiente contenido manteniendo la esencia.";

  switch (type) {
    case 'LECTURA':
      prompt = `
        Contexto del Sermón: "${context}".

    TAREA: Redacta una LECTURA BÍBLICA COMENTADA profunda y cristocéntrica.
      ${variationInstruction}
        
        Requisitos OBLIGATORIOS:
  1. ** CONTEXTO HISTÓRICO - CULTURAL **: Explica brevemente la época, autor, audiencia original y circunstancias del pasaje.
        2. ** SIGNIFICADO ORIGINAL **: ¿Qué significaba este texto para los primeros oyentes / lectores ?
    3. ** RAZONAMIENTO ESPIRITUAL **: Analiza el principio espiritual eterno que contiene el pasaje.
        4. ** VISIÓN CRISTOCÉNTRICA **: Conecta SIEMPRE el pasaje con Cristo. ¿Cómo apunta a Jesús, su obra redentora, su carácter o sus enseñanzas ? (Aunque sea AT, encuentra la conexión tipológica o profética).
  5. ** RELEVANCIA MODERNA **: Una reflexión breve sobre cómo aplica este texto al creyente de hoy.

    Formato: Usa HTML(<p>, <b>, <i>, <ul>, <li>).Resalta frases clave en negrita.Incluye la cita bíblica completa citada textualmente al inicio.
      Extensión: 3 - 5 párrafos bien desarrollados.
      `;
      break;

    case 'DESARROLLO':
      prompt = `
        Contexto del Sermón: "${context}".

    TAREA: Desarrolla el cuerpo del mensaje.
      ${variationInstruction}

  Requisitos:
  1. Incluye 2 citas bíblicas de apoyo(referencias).
        2. Provee 1 aplicación conceptual clara para la vida moderna.
        3. Usa formato HTML(<p>, <ul>, <li>).Resalta frases de impacto en color azul(style = "color: #2563eb").
      `;
      break;

    case 'LLAMADO':
      prompt = `
        Contexto del Sermón: "${context}".

    TAREA: Escribe el momento del llamado o invitación(Altar Call).
      ${variationInstruction}

  Requisitos:
  1. Tono emotivo, centrado en la gracia, el perdón y la restauración.
        2. Enfócate en el amor de Cristo.
        3. Usa formato HTML.
      `;
      break;

    case 'CIERRE':
      prompt = `
        Contexto del Sermón: "${context}".

    TAREA: Escribe la conclusión y despedida.
      ${variationInstruction}

  Requisitos:
  1. Conecta brevemente con una realidad actual(noticia genérica, tendencia o sentimiento común).
        2. Termina con una bendición pastoral.
        3. Usa formato HTML.
      `;
      break;

    default:
      prompt = `
  Contexto: "${context}".
        Texto existente(referencia): "${currentContent.substring(0, 200)}..."

  TAREA: Escribe contenido para esta sección extra.
    ${variationInstruction}
        Usa formato HTML básico.
      `;
  }

  prompt += `\nIMPORTANTE:
  1. Devuelve SOLO el código HTML válido dentro de un div implícito.No uses markdown(\`\`\`).
  2. Encierra CADA párrafo en etiquetas <p style="text-align: justify; margin-bottom: 1.5em;"></p> para asegurar que el texto esté justificado y tenga una línea de espacio al final.`;

  return generateUnifiedContent(prompt, SYSTEM_INSTRUCTION_ADVISOR);
};

export const generateFullSermonStructure = async (verse: string, verseText: string, bypassCache: boolean = false): Promise<any | null> => {
  const cacheKey = `${verse}_${verseText.substring(0, 20)}`;
  const cached = getFromCache(CACHE_KEYS.STRUCTURE, cacheKey);
  if (cached && !bypassCache) return cached;

  const variation = bypassCache ? `(Genera una estructura totalmente fresca y diferente a la habitual)` : "";

  const prompt = `
    Genera 4 secciones para un sermón cristocéntrico basado en: "${verse}" - "${verseText}". ${variation}
    
    INSTRUCCIONES POR SECCIÓN:
    
    1. reading (LECTURA BÍBLICA): 
       - Cita el versículo completo
       - Contexto histórico y cultural de la época
       - Significado para la audiencia original
       - Visión CRISTOCÉNTRICA: cómo este pasaje apunta a Cristo (su persona, obra, enseñanzas o tipología)
       - Razonamiento espiritual profundo
    
    2. development (DESARROLLO): 
       - Análisis teológico del tema principal
       - 2-3 versículos de apoyo con referencias completas
       - Principios prácticos para la vida cristiana moderna
       - Conexión con las enseñanzas de Jesús
    
    3. call (LLAMADO): 
       - Mensaje de transformación centrado en la gracia de Cristo
       - Invitación a la acción/decisión espiritual
       - Tono emotivo pero bíblicamente fundamentado
    
    4. conclusion (CIERRE): 
       - Resumen del mensaje central
       - Aplicación práctica final
       - Bendición pastoral
    
    Formato JSON: { "reading": "<HTML>", "development": "<HTML>", "call": "<HTML>", "conclusion": "<HTML>" }
    Contenido HTML dentro del JSON. Cada párrafo con: <p style="text-align: justify; margin-bottom: 1.5em;">.
    Los versículos de apoyo deben incluir la referencia y el texto citado.
  `;
  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const data = JSON.parse(cleanText);
      saveToCache(CACHE_KEYS.STRUCTURE, cacheKey, data);
      return data;
    }
    return null;
  } catch (error: any) { throw error; }
};

export const getCrossReferences = async (verse: string, bypassCache: boolean = false): Promise<{ ref: string, text: string }[]> => {
  const cached = getFromCache(CACHE_KEYS.REFS, verse);
  if (cached && !bypassCache) return cached;

  // Agregar variabilidad al prompt si se fuerza el refresco
  const variance = bypassCache ? `(Intenta encontrar referencias diferentes a la búsqueda anterior para "${Date.now()}")` : "";
  const prompt = `Encuentra 3 referencias cruzadas teológicamente ricas para: "${verse}". ${variance} JSON array: [{"ref": "Libro X:Y", "text": "Texto..."}].`;

  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const data = JSON.parse(cleanText);
      saveToCache(CACHE_KEYS.REFS, verse, data); // Update cache with new data
      return data;
    }
    return [];
  } catch (e) { return []; }
};

export const searchSemanticInsights = async (query: string): Promise<SearchResult | null> => {
  const cached = getFromCache(CACHE_KEYS.SEARCH, query);
  if (cached) return cached;
  const prompt = `Analiza consulta: "${query}". JSON: { "verses": [{"ref":"", "version":"", "text":"", "tags":[]}], "insight": {"title":"", "psychologicalConcept":"", "content":""} }.`;
  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const data = JSON.parse(cleanText);
      saveToCache(CACHE_KEYS.SEARCH, query, data);
      return data;
    }
    return null;
  } catch (e) { throw e; }
};

export const lookupDictionaryTerm = async (term: string): Promise<DictionaryResult | null> => {
  const cached = getFromCache(CACHE_KEYS.DICT, term);
  if (cached) return cached;
  const prompt = `Diccionario Teológico. Define: "${term}". JSON: { "term":"", "originalWord":"", "language":"", "phonetic":"", "definition":"", "theologicalSignificance":"", "biblicalReferences":[] }.`;
  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const data = JSON.parse(cleanText);
      saveToCache(CACHE_KEYS.DICT, term, data);
      return data;
    }
    return null;
  } catch (e) { return null; }
};

export const getDeepDiveAnalysis = async (verse: string): Promise<any | null> => {
  const prompt = `Micro-exégesis de: "${verse}". JSON: { "meaning":"", "context":"", "application":"" }.`;
  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (!text) return null;
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanText);
  } catch (e) { throw e; }
};

export const translateForImageSearch = async (query: string): Promise<string> => {
  const prompt = `Convert concept "${query}" into 4-5 concrete visual keywords in English only. No art style.`;
  return generateUnifiedContent(prompt);
};

export const extractVisualKeywords = async (text: string): Promise<string> => {
  const prompt = `Extract 4-5 concrete visual keywords in English from: "${text.substring(0, 500)}".`;
  return generateUnifiedContent(prompt);
};

// --- THEME-BASED VERSE SEARCH ---
export interface ThemeVerseResult {
  ref: string;
  text: string;
  relevance: string;
}

export const searchVersesByTheme = async (theme: string): Promise<ThemeVerseResult[]> => {
  const cacheKey = `theme_${theme.toLowerCase().trim()}`;
  const cached = getFromCache(CACHE_KEYS.SEARCH, cacheKey);
  if (cached) return cached;

  const prompt = `
    Busca 6 versículos bíblicos que se relacionen directamente con el tema: "${theme}".
    
    Para cada versículo incluye:
    1. "ref": La referencia bíblica completa (ej: "Juan 3:16", "Salmos 23:1-3")
    2. "text": El texto del versículo (máximo 100 caracteres, puede ser un extracto)
    3. "relevance": Por qué este versículo es relevante para el tema (máximo 50 caracteres)
    
    REGLAS:
    - Prioriza versículos conocidos y poderosos.
    - Incluye versículos tanto del Antiguo como del Nuevo Testamento cuando sea posible.
    - IMPORTANTE: Todos los campos ("ref", "text", "relevance") deben estar en ESPAÑOL.
    
    Responde SOLO en formato JSON array:
    [{"ref": "...", "text": "...", "relevance": "..."}]
  `;

  try {
    const text = await generateUnifiedContent(prompt, undefined, true);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanText);
      saveToCache(CACHE_KEYS.SEARCH, cacheKey, data);
      return data;
    }
    return [];
  } catch (e) {
    console.error('Error searching verses by theme:', e);
    return [];
  }
};

export const refineHighlightsWithContext = async (
  highlights: string[],
  context: { title: string; mainIdea: string },
  fullContent?: string,
  variationSeed?: number
): Promise<string[]> => {
  // Bypassing cache if variationSeed is present
  const cacheKey = `refine_${context.title}_${highlights.length}_${highlights[0] || ''}_${variationSeed || ''}`;
  if (!variationSeed) {
    const cached = getFromCache(CACHE_KEYS.SEARCH, cacheKey);
    if (cached) return cached;
  }

  const variationInstruction = variationSeed
    ? `\n[VARIACIÓN CREATIVA OBLIGATORIA #${variationSeed}]:
       - El usuario NO quiere frases motivacionales genéricas.
       - BUSCA EN LA PROFUNDIDAD DE LA BIBLIA.
       - Si la palabra es "Fe", dame: "Abraham saliendo sin saber a dónde iba" (Historia).
       - Si la palabra es "Amor", dame: "Como Cristo amó a la iglesia" (Concepto).
       - MEZCLA TIPOS DE RESPUESTA: Sinónimos potentes, Referencias a historias bíblicas (muy breves), Fragmentos de versículos clave.`
    : "";

  const prompt = `
    Actúa como un asistente biblico avanzado.
    
    CONTEXTO DEL SERMÓN:
    Título: "${context.title}"
    Idea Central: "${context.mainIdea}"
    
    PALABRAS/FRASES DESTACADAS POR EL PREDICADOR (Raw):
    ${JSON.stringify(highlights.slice(0, 50))}

    TAREA (INTENTO #${variationSeed}):
    El usuario ya tiene los términos originales. TU TAREA ES GENERAR SOLO LAS VARIACIONES CREATIVAS Y PROFUNDAS.
    
    MODO DE GENERACIÓN OBLIGATORIO (Rotación por intento):
    ${(variationSeed || 0) % 3 === 0 ?
      "👉 ENFOQUE: HISTORIAS Y ANTIGUO TESTAMENTO. (Ej: 'La valentía de David', 'La fe de Abraham', 'El fuego de Elías'). Evita conceptos abstractos, dame NOMBRES y SITUACIONES." :
      (variationSeed || 0) % 3 === 1 ?
        "👉 ENFOQUE: TEOLOGÍA Y NUEVO TESTAMENTO. (Ej: 'Justificación por Fe', 'Gracia sobre Gracia', 'El Verbo hecho carne'). Usa lenguaje doctrinal y cristocéntrico." :
        "👉 ENFOQUE: METÁFORAS Y APLICACIÓN PRÁCTICA. (Ej: 'Ancla del alma', 'Luz en la oscuridad', 'Caminar sobre las aguas'). Usa lenguaje poético y visual."
    }
    
    ESTRUCTURA DE RESPUESTA:
    - NO incluyas el término original exacto.
    - Sigue ESTRICTAMENTE el ENFOQUE asignado arriba.
    
    ${variationInstruction}
    
    GENERA UNA LISTA PLANA DE FRASES FINAL (SOLO LAS VARIACIONES):
    
    IMPORTANTE: ESTA ES UNA NUEVA SOLICITUD. IGNORA CUALQUIER RESPUESTA ANTERIOR.
    DAME RESULTADOS DIFERENTES AHORA.
    
    ESTRATEGIA DE GENERACIÓN (Mezcla estos tipos):
    1. **Sinónimos Bíblicos**: (ej: Para "Poder" -> "Dunamys / Autoridad Celestial")
    2. **Historias Referentes**: (ej: Para "Valentía" -> "David frente a Goliat")
    3. **Versículos Cortos**: (ej: Para "Paz" -> "La paz que sobrepasa entendimiento")
    4. **Enseñanzas Relacionadas**: (ej: Para "Perdón" -> "Setenta veces siete")
    
    REGLAS:
    - MÁXIMO 1 LÍNEA por resultado.
    - Deben ser visualmente evocadoras.
    - NO repitas el mismo concepto.
    - Genera entre 8 y 12 items en total.
    
    SALIDA ESPERADA:
    Un array JSON simple de strings.
    Ejemplo: ["Pedro caminando sobre el mar", "Dunamys: Poder explosivo", "No temáis manada pequeña", "La viuda y el aceite"]
    
    Responde SOLO el JSON.
  `;

  try {
    // Force high temperature if variationSeed is present
    const temp = variationSeed ? 1.2 : 0.7;
    const text = await generateUnifiedContent(prompt, undefined, true, temp);
    if (text) {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanText);
      if (Array.isArray(data)) {
        saveToCache(CACHE_KEYS.SEARCH, cacheKey, data);
        return data.slice(0, 12);
      }
    }
    return highlights.slice(0, 12); // Fallback: return raw highlights
  } catch (e) {
    console.error('Error refining highlights:', e);
    return highlights.slice(0, 12);
  }
};
