
import { generateUnifiedContent } from "./geminiService";
import { Language } from "../types";

export interface BibleVersion {
  id: string;
  name: string;
}

export const BIBLE_BOOKS = [
  // OLD TESTAMENT
  { id: 'Gen', name: 'Génesis', chapters: 50, test: 'AT' },
  { id: 'Exo', name: 'Éxodo', chapters: 40, test: 'AT' },
  { id: 'Lev', name: 'Levítico', chapters: 27, test: 'AT' },
  { id: 'Num', name: 'Números', chapters: 36, test: 'AT' },
  { id: 'Deu', name: 'Deuteronomio', chapters: 34, test: 'AT' },
  { id: 'Jos', name: 'Josué', chapters: 24, test: 'AT' },
  { id: 'Jdg', name: 'Jueces', chapters: 21, test: 'AT' },
  { id: 'Rut', name: 'Rut', chapters: 4, test: 'AT' },
  { id: '1Sa', name: '1 Samuel', chapters: 31, test: 'AT' },
  { id: '2Sa', name: '2 Samuel', chapters: 24, test: 'AT' },
  { id: '1Ki', name: '1 Reyes', chapters: 22, test: 'AT' },
  { id: '2Ki', name: '2 Reyes', chapters: 25, test: 'AT' },
  { id: '1Ch', name: '1 Crónicas', chapters: 29, test: 'AT' },
  { id: '2Ch', name: '2 Crónicas', chapters: 36, test: 'AT' },
  { id: 'Ezr', name: 'Esdras', chapters: 10, test: 'AT' },
  { id: 'Neh', name: 'Nehemías', chapters: 13, test: 'AT' },
  { id: 'Est', name: 'Ester', chapters: 10, test: 'AT' },
  { id: 'Job', name: 'Job', chapters: 42, test: 'AT' },
  { id: 'Psa', name: 'Salmos', chapters: 150, test: 'AT' },
  { id: 'Pro', name: 'Proverbios', chapters: 31, test: 'AT' },
  { id: 'Ecc', name: 'Eclesiastés', chapters: 12, test: 'AT' },
  { id: 'Sol', name: 'Cantares', chapters: 8, test: 'AT' },
  { id: 'Isa', name: 'Isaías', chapters: 66, test: 'AT' },
  { id: 'Jer', name: 'Jeremías', chapters: 52, test: 'AT' },
  { id: 'Lam', name: 'Lamentaciones', chapters: 5, test: 'AT' },
  { id: 'Eze', name: 'Ezequiel', chapters: 48, test: 'AT' },
  { id: 'Dan', name: 'Daniel', chapters: 12, test: 'AT' },
  { id: 'Hos', name: 'Oseas', chapters: 14, test: 'AT' },
  { id: 'Joe', name: 'Joel', chapters: 3, test: 'AT' },
  { id: 'Amo', name: 'Amós', chapters: 9, test: 'AT' },
  { id: 'Oba', name: 'Abdías', chapters: 1, test: 'AT' },
  { id: 'Jon', name: 'Jonás', chapters: 4, test: 'AT' },
  { id: 'Mic', name: 'Miqueas', chapters: 7, test: 'AT' },
  { id: 'Nah', name: 'Nahúm', chapters: 3, test: 'AT' },
  { id: 'Hab', name: 'Habacuc', chapters: 3, test: 'AT' },
  { id: 'Zep', name: 'Sofonías', chapters: 3, test: 'AT' },
  { id: 'Hag', name: 'Hageo', chapters: 2, test: 'AT' },
  { id: 'Zec', name: 'Zacarías', chapters: 14, test: 'AT' },
  { id: 'Mal', name: 'Malaquías', chapters: 4, test: 'AT' },
  // NEW TESTAMENT
  { id: 'Mat', name: 'Mateo', chapters: 28, test: 'NT' },
  { id: 'Mar', name: 'Marcos', chapters: 16, test: 'NT' },
  { id: 'Luk', name: 'Lucas', chapters: 24, test: 'NT' },
  { id: 'Joh', name: 'Juan', chapters: 21, test: 'NT' },
  { id: 'Act', name: 'Hechos', chapters: 28, test: 'NT' },
  { id: 'Rom', name: 'Romanos', chapters: 16, test: 'NT' },
  { id: '1Co', name: '1 Corintios', chapters: 16, test: 'NT' },
  { id: '2Co', name: '2 Corintios', chapters: 13, test: 'NT' },
  { id: 'Gal', name: 'Gálatas', chapters: 6, test: 'NT' },
  { id: 'Eph', name: 'Efesios', chapters: 6, test: 'NT' },
  { id: 'Phi', name: 'Filipenses', chapters: 4, test: 'NT' },
  { id: 'Col', name: 'Colosenses', chapters: 4, test: 'NT' },
  { id: '1Th', name: '1 Tesalonicenses', chapters: 5, test: 'NT' },
  { id: '2Th', name: '2 Tesalonicenses', chapters: 3, test: 'NT' },
  { id: '1Ti', name: '1 Timoteo', chapters: 6, test: 'NT' },
  { id: '2Ti', name: '2 Timoteo', chapters: 4, test: 'NT' },
  { id: 'Tit', name: 'Tito', chapters: 3, test: 'NT' },
  { id: 'Phm', name: 'Filemón', chapters: 1, test: 'NT' },
  { id: 'Heb', name: 'Hebreos', chapters: 13, test: 'NT' },
  { id: 'Jam', name: 'Santiago', chapters: 5, test: 'NT' },
  { id: '1Pe', name: '1 Pedro', chapters: 5, test: 'NT' },
  { id: '2Pe', name: '2 Pedro', chapters: 3, test: 'NT' },
  { id: '1Jn', name: '1 Juan', chapters: 5, test: 'NT' },
  { id: '2Jn', name: '2 Juan', chapters: 1, test: 'NT' },
  { id: '3Jn', name: '3 Juan', chapters: 1, test: 'NT' },
  { id: 'Jud', name: 'Judas', chapters: 1, test: 'NT' },
  { id: 'Rev', name: 'Apocalipsis', chapters: 22, test: 'NT' }
];

const VERSIONS_BY_LANG: Record<string, BibleVersion[]> = {
  es: [
    { id: 'RVR1960', name: 'Reina Valera 1960' },
    { id: 'NVI', name: 'Nueva Versión Internacional' },
    { id: 'LBLA', name: 'La Biblia de las Américas' },
    { id: 'NTV', name: 'Nueva Traducción Viviente' },
    { id: 'BJ', name: 'Biblia de Jerusalén' },
    { id: 'BL95', name: 'Biblia Latinoamericana' }
  ],
  en: [
    { id: 'KJV', name: 'King James Version' },
    { id: 'NIV', name: 'New International Version' },
    { id: 'ESV', name: 'English Standard Version' },
    { id: 'NKJV', name: 'New King James Version' }
  ],
  pt: [
    { id: 'ARC', name: 'Almeida Revista e Corrigida' },
    { id: 'NVI-PT', name: 'Nova Versão Internacional' },
    { id: 'ARA', name: 'Almeida Revista e Atualizada' }
  ]
};

export const getBibleVersions = (lang: Language = 'es'): BibleVersion[] => {
  return VERSIONS_BY_LANG[lang] || VERSIONS_BY_LANG['es'];
};

export const fetchVerseText = async (reference: string, version: string, forceVariation: boolean = false): Promise<string> => {
  try {
    const lang = (localStorage.getItem('app_language') as Language) || 'es';

    // If version is generic or mismatching, default to the best for the language
    let targetVersion = version;
    if (!targetVersion) {
      const defaults = getBibleVersions(lang);
      targetVersion = defaults[0].id;
    }

    const variationPrompt = forceVariation
      ? `\nNOTA: El usuario solicita refrescar la cita. Asegúrate de verificar nuevamente la fuente. Si es posible, provee una variación en la presentación, corrige cualquier corte previo o busca una traducción alternativa válida dentro del mismo contexto si la versión lo permite. (Intento ${Date.now()})`
      : "";

    const prompt = `Escribe el texto bíblico completo para la cita: "${reference}" en la versión "${targetVersion}" (Idioma: ${lang}).
      REGLAS:
      1. Solo entrega el texto del versículo, sin introducción ni comentarios.
      2. Mantén los números de versículos si es posible.
      3. Si no encuentras la cita exacta, busca la más cercana posible en el contexto.
      4. Responde SIEMPRE en Español, salvo que se pida otra versión específica.
      5. Si es inválido, responde "ERROR: No encontrado".
      ${variationPrompt}`;

    const text = await generateUnifiedContent(prompt);

    // Check for explicit error or empty response
    if (!text || text.trim().startsWith("ERROR:")) {
      throw new Error("Texto no encontrado o referencia inválida.");
    }

    return text.trim();
  } catch (error: any) {
    const isQuota = error.message && (error.message.includes("Cuota excedida") || error.message.includes("Quota") || error.message.includes("429"));

    // Propagate quota errors specifically so UI can show upgrade message
    if (isQuota) {
      throw new Error("⚠️ Cuota excedida. Configura tu API Key en el engranaje.");
    }

    // Propagate generic errors
    throw error;
  }
};
