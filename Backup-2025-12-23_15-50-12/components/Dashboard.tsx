
import React, { useState, useRef, useEffect } from 'react';
import { Emotion, UserProfile, Project, Sermon, TextSettings, Language, SectionType } from '../types';
import { Button } from './Button';
import { Sun, Battery, ArrowRight, Heart, Activity, BookOpen, Clock, Sparkles, Trash2, Edit, FolderOpen, Loader2, AlertTriangle, RefreshCw, Calendar as CalendarIcon, FileText, FileType, Presentation, Printer, MonitorPlay, FileUp, PenLine, Play, Plus, X, ChevronDown, Check, FileInput, Search, Link2, BookMarked } from 'lucide-react';
import { getDeepDiveAnalysis, generateUnifiedContent } from '../services/geminiService';
import { fetchVerseText, BIBLE_BOOKS } from '../services/bibleService';
import { useTranslation } from '../context/LanguageContext';

interface DashboardProps {
  userProfile: UserProfile;
  username: string;
  onNavigate: (view: string) => void;
  textSettings: TextSettings;
}

interface DeepDiveData {
  meaning: string;
  context: string;
  application: string;
}

const GREETING_VERSES: Record<Language, string[]> = {
  es: [
    "Que la paz de Dios gobierne hoy en tu corazón. (Colosenses 3:15)",
    "Nuevas son cada mañana sus misericordias. (Lamentaciones 3:23)",
    "El gozo del Señor es vuestra fuerza. (Nehemías 8:10)",
    "Encomienda a Jehová tu camino, y confía en él. (Salmos 37:5)",
    "Todo lo puedo en Cristo que me fortalece. (Filipenses 4:13)",
    "Lámpara es a mis pies tu palabra, y lumbrera a mi camino. (Salmos 119:105)"
  ],
  en: [
    "Let the peace of Christ rule in your hearts. (Colossians 3:15)",
    "His mercies are new every morning. (Lamentations 3:23)",
    "The joy of the Lord is your strength. (Nehemiah 8:10)",
    "Commit your way to the Lord; trust in him. (Psalm 37:5)",
    "I can do all things through Christ who strengthens me. (Philippians 4:13)",
    "Your word is a lamp for my feet, a light on my path. (Psalm 119:105)"
  ],
  pt: [
    "A paz de Cristo reine em vossos corações. (Colossenses 3:15)",
    "A alegria do Senhor é a vossa força. (Neemias 8:10)",
    "As suas misericórdias são inesgotáveis. (Lamentações 3:22)",
    "Entrega o teu caminho ao Senhor. (Salmos 37:5)",
    "Tudo posso naquele que me fortalece. (Filipenses 4:13)",
    "Lâmpada para os meus pés é a tua palavra. (Salmos 119:105)"
  ]
};

// Versículos potentes para "Cristo en tus días" (Referencias universales)
const RANDOM_DEEP_DIVE_VERSES = [
  "2 Timoteo 1:7", "Salmos 23:1", "Filipenses 4:13", "Isaías 41:10",
  "Jeremías 29:11", "Romanos 8:28", "Josué 1:9", "Mateo 11:28",
  "Proverbios 3:5", "Juan 3:16", "Salmos 46:1", "Gálatas 2:20"
];

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, username, onNavigate, textSettings }) => {
  const { t, language } = useTranslation();
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [currentMessage, setCurrentMessage] = useState<{ spiritual: string, psychological: string } | null>(null);
  const [historyProjects, setHistoryProjects] = useState<Project[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greetingVerse, setGreetingVerse] = useState("");

  // DEEP DIVE STATE
  const [verseQuery, setVerseQuery] = useState("");
  const [verseText, setVerseText] = useState("");
  const [deepDiveResult, setDeepDiveResult] = useState<DeepDiveData | null>(null);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

  // VERSE PICKER STATE
  const [showVersePicker, setShowVersePicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'books' | 'chapters' | 'verses'>('books');
  const [tempBook, setTempBook] = useState<typeof BIBLE_BOOKS[0] | null>(null);
  const [tempChapter, setTempChapter] = useState<number | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [showAurora, setShowAurora] = useState(false);

  // VERSE KEYWORD SEARCH STATE
  const [verseSearchQuery, setVerseSearchQuery] = useState('');
  const [verseSearchResults, setVerseSearchResults] = useState<Array<{ ref: string; text: string; relevance: string }>>([]);
  const [isSearchingVerses, setIsSearchingVerses] = useState(false);
  const [selectedSearchVerse, setSelectedSearchVerse] = useState<{ ref: string; text: string } | null>(null);

  // Load verse search state from localStorage on mount
  useEffect(() => {
    const savedSearch = localStorage.getItem('dashboard_verse_search');
    if (savedSearch) {
      try {
        const { query, results, selected } = JSON.parse(savedSearch);
        if (query) setVerseSearchQuery(query);
        if (results) setVerseSearchResults(results);
        if (selected) setSelectedSearchVerse(selected);
      } catch (e) { }
    }
  }, []);

  // Save verse search state to localStorage when it changes
  useEffect(() => {
    if (verseSearchQuery || verseSearchResults.length > 0) {
      localStorage.setItem('dashboard_verse_search', JSON.stringify({
        query: verseSearchQuery,
        results: verseSearchResults,
        selected: selectedSearchVerse
      }));
    }
  }, [verseSearchQuery, verseSearchResults, selectedSearchVerse]);

  // CONCORDANCE AT-NT STATE
  const [concordanceQuery, setConcordanceQuery] = useState('');
  const [concordanceResults, setConcordanceResults] = useState<Array<{
    atVerse: string;
    atText: string;
    ntVerse: string;
    ntText: string;
    connection: string;
    deepStudy: string;
  }>>([]);
  const [isSearchingConcordance, setIsSearchingConcordance] = useState(false);

  const handleConcordanceSearch = async () => {
    if (!concordanceQuery.trim()) return;
    setIsSearchingConcordance(true);
    setConcordanceResults([]);

    try {
      const prompt = `Busca conexiones proféticas/temáticas entre el Antiguo Testamento y el Nuevo Testamento sobre: "${concordanceQuery}".
      
      Devuelve un JSON array con máximo 4 conexiones AT-NT, cada una con:
      - "atVerse": referencia del AT (ej: "Isaías 7:14")
      - "atText": texto del versículo AT en español (Reina Valera)
      - "ntVerse": referencia del NT donde se cumple/conecta (ej: "Mateo 1:23")
      - "ntText": texto del versículo NT en español (Reina Valera)
      - "connection": explicación breve de la conexión profética o temática (1-2 oraciones)
      - "deepStudy": análisis profundo cristocéntrico de esta conexión (3-4 oraciones): contexto histórico, significado teológico, y relevancia para el creyente hoy
      
      Busca profecías mesiánicas, tipos y sombras, temas teológicos conectados, y cumplimientos proféticos.
      Solo devuelve el JSON array.`;

      const response = await generateUnifiedContent(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        if (Array.isArray(results)) {
          setConcordanceResults(results);
        }
      }
    } catch (e) {
      console.error('Error searching concordance:', e);
    } finally {
      setIsSearchingConcordance(false);
    }
  };

  // THEOLOGICAL GLOSSARY STATE
  const glossaryCategories = [
    {
      id: 'hermeneutica', icon: '📖', label: 'Hermenéutica y Estudio', terms: [
        'Exégesis', 'Hermenéutica', 'Canon', 'Apócrifos', 'Inspiración', 'Inerrancia', 'Tipología', 'Alegoría',
        'Contexto', 'Manuscritos', 'Septuaginta', 'Textus Receptus', 'Crítica Textual', 'Género Literario',
        'Paralelismo', 'Quiasmo', 'Literalismo', 'Concordancia', 'Léxico', 'Comentario Bíblico'
      ]
    },
    {
      id: 'doctrina', icon: '⛪', label: 'Doctrina y Teología', terms: [
        'Trinidad', 'Cristología', 'Soteriología', 'Pneumatología', 'Eclesiología', 'Teología Sistemática',
        'Teología Bíblica', 'Teología Natural', 'Revelación', 'Omnisciencia', 'Omnipotencia', 'Omnipresencia',
        'Soberanía', 'Providencia', 'Predestinación', 'Libre Albedrío', 'Gracia Común', 'Gracia Eficaz',
        'Propiciación', 'Expiación'
      ]
    },
    {
      id: 'liturgia', icon: '🍞', label: 'Liturgia y Sacramentos', terms: [
        'Eucaristía', 'Bautismo', 'Pascua', 'Pentecostés', 'Adviento', 'Cuaresma', 'Confirmación', 'Ordenación',
        'Unción', 'Matrimonio', 'Liturgia', 'Homilía', 'Doxología', 'Bendición', 'Consagración', 'Comunión',
        'Transubstanciación', 'Consubstanciación', 'Memorial', 'Aspersión'
      ]
    },
    {
      id: 'vida', icon: '✝️', label: 'Vida Cristiana', terms: [
        'Santificación', 'Justificación', 'Regeneración', 'Apostasía', 'Arrepentimiento', 'Redención',
        'Conversión', 'Nuevo Nacimiento', 'Adopción', 'Glorificación', 'Perseverancia', 'Obediencia',
        'Discipulado', 'Mayordomía', 'Diezmo', 'Ofrenda', 'Ayuno', 'Oración', 'Meditación', 'Comunión con Dios'
      ]
    },
    {
      id: 'escatologia', icon: '🔮', label: 'Escatología', terms: [
        'Parusía', 'Rapto', 'Milenio', 'Juicio Final', 'Nueva Jerusalén', 'Anticristo', 'Tribulación',
        'Armagedón', 'Resurrección', 'Cielo', 'Infierno', 'Hades', 'Gehenna', 'Lago de Fuego', 'Trono Blanco',
        'Premilenialismo', 'Postmilenialismo', 'Amilenialismo', 'Dispensacionalismo', 'Pacto de Gracia'
      ]
    },
    {
      id: 'historia', icon: '📜', label: 'Historia de la Iglesia', terms: [
        'Patrística', 'Reforma', 'Concilios', 'Credos', 'Denominaciones', 'Avivamientos', 'Apologética',
        'Gnosticismo', 'Arrianismo', 'Pelagianismo', 'Agustinismo', 'Escolástica', 'Inquisición', 'Contrarreforma',
        'Puritanos', 'Pietismo', 'Metodismo', 'Pentecostalismo', 'Ecumenismo', 'Fundamentalismo'
      ]
    }
  ];
  const [selectedGlossaryCategory, setSelectedGlossaryCategory] = useState<string | null>(null);
  const [selectedGlossaryTerm, setSelectedGlossaryTerm] = useState<string | null>(null);
  const [glossarySearchQuery, setGlossarySearchQuery] = useState('');
  const [glossaryContent, setGlossaryContent] = useState<{
    definition: string;
    biblical: string;
    historical: string;
    practical: string;
  } | null>(null);
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(false);

  const handleGlossaryTermClick = async (term: string) => {
    setSelectedGlossaryTerm(term);
    setIsLoadingGlossary(true);
    setGlossaryContent(null);

    try {
      const prompt = `Explica el término teológico/bíblico "${term}" de manera profunda pero accesible.
      
      Devuelve un JSON con:
      - "definition": definición clara y precisa del término (2-3 oraciones)
      - "biblical": fundamento bíblico con versículos clave y su contexto (3-4 oraciones)
      - "historical": desarrollo histórico del concepto en la iglesia (2-3 oraciones)
      - "practical": aplicación práctica para el creyente hoy, con un ejemplo concreto (3-4 oraciones)
      
      Solo devuelve el JSON.`;

      const response = await generateUnifiedContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setGlossaryContent(result);
      }
    } catch (e) {
      console.error('Error loading glossary:', e);
    } finally {
      setIsLoadingGlossary(false);
    }
  };

  // Inicialización y Carga Automática
  useEffect(() => {
    // 1. Saludo Aleatorio
    const verses = GREETING_VERSES[language] || GREETING_VERSES['es'];
    setGreetingVerse(verses[Math.floor(Math.random() * verses.length)]);

    // 2. Reloj
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 3. PERSISTENCIA DE CRISTO EN TUS DÍAS (SessionStorage)
    const sessionData = sessionStorage.getItem('dashboard_deep_dive');
    if (sessionData) {
      // Cargar estado previo si existe en la sesión
      const parsed = JSON.parse(sessionData);
      setVerseQuery(parsed.query);
      setVerseText(parsed.text);
      setDeepDiveResult(parsed.result);
    } else {
      // Si es una nueva sesión, cargar uno aleatorio
      pickAndLoadVerseText();
    }

    return () => clearInterval(timer);
  }, [language]);

  // Guardar estado de Deep Dive cada vez que cambia un resultado válido
  useEffect(() => {
    if (verseQuery && verseText) {
      sessionStorage.setItem('dashboard_deep_dive', JSON.stringify({
        query: verseQuery,
        text: verseText,
        result: deepDiveResult
      }));
    }
  }, [verseQuery, verseText, deepDiveResult]);

  const pickAndLoadVerseText = async () => {
    const randomVerse = RANDOM_DEEP_DIVE_VERSES[Math.floor(Math.random() * RANDOM_DEEP_DIVE_VERSES.length)];
    setVerseQuery(randomVerse);

    try {
      const text = await fetchVerseText(randomVerse, 'RVR1960');
      setVerseText(text);
      // Opcional: Cargar análisis automáticamente al inicio si se desea
      // handleDeepDiveLoad(randomVerse, text); 
    } catch (e) { console.error("Error fetching text", e); }
  };

  const handleDeepDiveLoad = async (verse: string, preloadedText?: string) => {
    if (!verse) return;
    setIsDeepDiveLoading(true);
    setDeepDiveError(null);

    let currentText = preloadedText || verseText;

    const loadText = async () => {
      try {
        const text = await fetchVerseText(verse, 'RVR1960');
        setVerseText(text);
        currentText = text;
      } catch (e) { console.error("Error fetching text", e); }
    };

    const loadAnalysis = async () => {
      try {
        const analysis = await getDeepDiveAnalysis(verse);
        setDeepDiveResult(analysis);
      } catch (e: any) {
        console.error("Error loading analysis", e);
        setDeepDiveError(e.message || "Error de conexión con IA");
      }
    };

    const promises = [loadAnalysis()];
    if (!preloadedText && (verse !== verseQuery || !verseText)) {
      promises.push(loadText());
    }

    await Promise.all(promises);
    setIsDeepDiveLoading(false);
  };

  // --- PICKER LOGIC ---
  const openPicker = () => {
    setPickerStep('books');
    setTempBook(null);
    setTempChapter(null);
    setShowVersePicker(true);
  };

  const handleBookSelect = (book: typeof BIBLE_BOOKS[0]) => {
    setTempBook(book);
    setPickerStep('chapters');
  };

  const handleChapterSelect = (chapter: number) => {
    setTempChapter(chapter);
    setPickerStep('verses');
  };

  const handleVerseSelect = (verse: number) => {
    if (!tempBook || !tempChapter) return;
    const ref = `${tempBook.name} ${tempChapter}:${verse}`;
    setVerseQuery(ref);
    setShowVersePicker(false);
    // Auto-trigger load
    handleDeepDiveLoad(ref);
  };

  const getEmotionalMessages = (emotion: Emotion) => {
    const r = (k: string) => t(`dashboard.emotions.${k}`);
    let emotionKey = 'joy';
    if (emotion === Emotion.NEUTRAL) emotionKey = 'neutral';
    if (emotion === Emotion.ANXIETY) emotionKey = 'anxiety';
    if (emotion === Emotion.SADNESS) emotionKey = 'sadness';
    if (emotion === Emotion.ANGER) emotionKey = 'anger';

    const spiritual = Array.from({ length: 20 }, (_, i) => r(`${emotionKey}_spiritual_${i + 1}`));
    const psychological = Array.from({ length: 20 }, (_, i) => r(`${emotionKey}_psych_${i + 1}`));

    return { spiritual, psychological };
  };

  useEffect(() => {
    const determineDisplayName = () => {
      if (userProfile.nickname && userProfile.nickname.trim() !== '') return userProfile.nickname;
      if (userProfile.name && userProfile.name.trim() !== '') return userProfile.name;
      try {
        const savedSermon = localStorage.getItem('current_sermon');
        if (savedSermon) {
          const parsed = JSON.parse(savedSermon);
          if (parsed.speaker && parsed.speaker.trim() !== '') return parsed.speaker;
        }
      } catch (e) { }
      return '';
    };
    setDisplayName(determineDisplayName());
  }, [userProfile, username]);

  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 6 && hour < 12) return t('dashboard.greeting.morning');
    if (hour >= 12 && hour < 20) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  };

  useEffect(() => {
    const historyJson = localStorage.getItem('sermon_history');
    if (historyJson) {
      try {
        const history: Sermon[] = JSON.parse(historyJson);
        setHistoryProjects(history.map(h => ({ id: h.id, title: h.title || 'Untitled', date: h.date, status: 'Draft' })));
      } catch (e) { }
    }
  }, []);

  const emotions = [
    { label: Emotion.JOY, icon: "😊", color: "bg-yellow-100 text-yellow-700", transKey: "emotion.joy" },
    { label: Emotion.NEUTRAL, icon: "😌", color: "bg-slate-100 text-slate-700", transKey: "emotion.neutral" },
    { label: Emotion.ANXIETY, icon: "😰", color: "bg-orange-100 text-orange-700", transKey: "emotion.anxiety" },
    { label: Emotion.SADNESS, icon: "😢", color: "bg-blue-100 text-blue-700", transKey: "emotion.sadness" },
    { label: Emotion.ANGER, icon: "😠", color: "bg-red-100 text-red-700", transKey: "emotion.anger" },
  ];

  const handleEmotionClick = (emotionLabel: Emotion) => {
    setSelectedEmotion(emotionLabel);
    if (emotionLabel === Emotion.JOY) {
      setShowAurora(true);
      setTimeout(() => setShowAurora(false), 5000);
    }
    const messages = getEmotionalMessages(emotionLabel);
    if (messages) {
      setCurrentMessage({
        spiritual: messages.spiritual[Math.floor(Math.random() * messages.spiritual.length)],
        psychological: messages.psychological[Math.floor(Math.random() * messages.psychological.length)]
      });
    }
  };

  // --- VERSE KEYWORD SEARCH ---
  const handleVerseKeywordSearch = async () => {
    if (!verseSearchQuery.trim()) return;
    setIsSearchingVerses(true);
    setVerseSearchResults([]);
    setSelectedSearchVerse(null);

    try {
      const prompt = `Un predicador o persona pregunta: "${verseSearchQuery}".
      Busca versículos de la Biblia que respondan o den contexto bíblico a esta pregunta/tema.
      Devuelve un JSON array con máximo 8 versículos relevantes, cada uno con:
      - "ref": referencia completa (ej: "Juan 3:16")
      - "text": texto del versículo en español (Reina Valera 1960)
      - "relevance": "directa" si responde directamente, o "contextual" si da contexto relacionado
      Ordena primero los directos, luego los contextuales. Solo devuelve el JSON array.`;

      const response = await generateUnifiedContent(prompt);
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const results = JSON.parse(jsonMatch[0]);
          if (Array.isArray(results)) {
            setVerseSearchResults(results);
          }
        } catch (parseErr) {
          console.error('Error parsing JSON:', parseErr);
        }
      }
    } catch (e) {
      console.error('Error searching verses:', e);
    } finally {
      setIsSearchingVerses(false);
    }
  };

  const handleSendToStudy = (verse: { ref: string; text: string }) => {
    // Save to last_study_session format so it appears in Estudio
    const studyData = {
      savedQuery: verse.ref,
      savedResult: {
        verses: [{ ref: verse.ref, text: verse.text, version: 'RVR1960' }],
        insight: { title: 'Versículo Seleccionado', content: `Versículo seleccionado desde búsqueda rápida: ${verse.ref}`, psychologicalConcept: 'Palabra de Dios' }
      },
      savedTab: 'search',
      savedDictResult: null
    };
    localStorage.setItem('last_study_session', JSON.stringify(studyData));
    onNavigate('search'); // Go to Estudio
  };

  const handleSendToMainVerse = (verse: { ref: string; text: string }) => {
    // Set as main verse in current sermon
    try {
      const saved = localStorage.getItem('current_sermon');
      const currentSermon: Sermon = saved ? JSON.parse(saved) : {
        id: Date.now().toString(), title: 'Nuevo Sermón', sections: []
      };
      currentSermon.mainVerse = verse.ref;
      localStorage.setItem('current_sermon', JSON.stringify(currentSermon));
      alert(`✓ "${verse.ref}" configurado como versículo base del sermón`);
    } catch (e) {
      console.error('Error setting main verse:', e);
    }
  };

  // --- MANEJO DE ARCHIVOS ROBUSTO ---
  const processFileAndNavigate = (file: File, targetView: string) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const parsed = JSON.parse(jsonContent);

        let dataToSave = parsed;
        if (parsed.meta && parsed.meta.type === 'pulpito_project' && parsed.data) {
          dataToSave = parsed.data;
        }
        if (!dataToSave.sections || !Array.isArray(dataToSave.sections)) {
          if (dataToSave.title) {
            dataToSave.sections = [];
          } else {
            throw new Error("El archivo no parece ser un sermón válido (faltan secciones).");
          }
        }
        localStorage.setItem('current_sermon', JSON.stringify(dataToSave));
        onNavigate(targetView);
      } catch (err: any) {
        console.error("Error parsing file", err);
        alert("Error al leer el archivo: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleEditorFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFileAndNavigate(file, 'editor');
    e.target.value = '';
  };

  const handleTeleprompterFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFileAndNavigate(file, 'teleprompter');
    e.target.value = '';
  };

  // --- EXPORT FUNCTIONS ---
  const handleDownloadDeepDiveTXT = () => {
    if (!deepDiveResult) return;
    const content = `CRISTO EN TUS DÍAS: ${verseQuery}\n\n` +
      `"${verseText}"\n\n` +
      `SIGNIFICADO:\n${deepDiveResult.meaning}\n\n` +
      `CONTEXTO:\n${deepDiveResult.context}\n\n` +
      `APLICACIÓN:\n${deepDiveResult.application}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Devocional_${verseQuery.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDeepDiveWord = () => {
    if (!deepDiveResult) return;
    const contentHtml = `
      <h1>Cristo en tus días: ${verseQuery}</h1>
      <p><i>"${verseText}"</i></p>
      <hr/>
      <h3>Significado</h3><p>${deepDiveResult.meaning}</p>
      <h3>Contexto</h3><p>${deepDiveResult.context}</p>
      <h3>Aplicación</h3><p>${deepDiveResult.application}</p>
    `;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${verseQuery}</title></head><body>`;
    const footer = "</body></html>";
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Devocional_${verseQuery.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintDeepDive = () => {
    if (!deepDiveResult) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const contentHtml = `
      <h1>Cristo en tus días: ${verseQuery}</h1>
      <p><i>"${verseText}"</i></p>
      <hr/>
      <h3>Significado</h3><p>${deepDiveResult.meaning}</p>
      <h3>Contexto</h3><p>${deepDiveResult.context}</p>
      <h3>Aplicación</h3><p>${deepDiveResult.application}</p>
    `;
    printWindow.document.write(`<html><head><title>Devocional</title><style>body { font-family: serif; padding: 40px; }</style></head><body>${contentHtml}<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`);
    printWindow.document.close();
  };

  // --- GLOSSARY EXPORT FUNCTIONS ---
  const handleDownloadGlossaryTXT = () => {
    if (!glossaryContent || !selectedGlossaryTerm) return;
    const content = `GLOSARIO TEOLÓGICO: ${selectedGlossaryTerm.toUpperCase()}\n\n` +
      `📖 DEFINICIÓN:\n${glossaryContent.definition}\n\n` +
      `📜 FUNDAMENTO BÍBLICO:\n${glossaryContent.biblical}\n\n` +
      `🏛️ CONTEXTO HISTÓRICO:\n${glossaryContent.historical}\n\n` +
      `💡 APLICACIÓN PRÁCTICA:\n${glossaryContent.practical}\n\n` +
      `---\nGenerado por Púlpito Dinámico`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Glosario_${selectedGlossaryTerm.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadGlossaryWord = () => {
    if (!glossaryContent || !selectedGlossaryTerm) return;
    const contentHtml = `
      <h1>📚 ${selectedGlossaryTerm}</h1>
      <h3>📖 Definición</h3><p>${glossaryContent.definition}</p>
      <h3>📜 Fundamento Bíblico</h3><p>${glossaryContent.biblical}</p>
      <h3>🏛️ Contexto Histórico</h3><p>${glossaryContent.historical}</p>
      <h3>💡 Aplicación Práctica</h3><p>${glossaryContent.practical}</p>
      <hr/><p><small>Púlpito Dinámico - Glosario Teológico</small></p>
    `;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${selectedGlossaryTerm}</title></head><body>`;
    const footer = "</body></html>";
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Glosario_${selectedGlossaryTerm.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintGlossary = () => {
    if (!glossaryContent || !selectedGlossaryTerm) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const contentHtml = `
      <h1>📚 ${selectedGlossaryTerm}</h1>
      <h3>📖 Definición</h3><p>${glossaryContent.definition}</p>
      <h3>📜 Fundamento Bíblico</h3><p>${glossaryContent.biblical}</p>
      <h3>🏛️ Contexto Histórico</h3><p>${glossaryContent.historical}</p>
      <h3>💡 Aplicación Práctica</h3><p>${glossaryContent.practical}</p>
      <hr/><p><small>Púlpito Dinámico - Glosario Teológico</small></p>
    `;
    printWindow.document.write(`<html><head><title>Glosario: ${selectedGlossaryTerm}</title><style>body { font-family: Georgia, serif; padding: 40px; line-height: 1.6; } h1 { color: #4338ca; } h3 { color: #6366f1; margin-top: 20px; }</style></head><body>${contentHtml}<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`);
    printWindow.document.close();
  };

  // --- CONCORDANCE EXPORT FUNCTIONS ---
  const handleDownloadConcordanceTXT = () => {
    if (concordanceResults.length === 0) return;
    let content = `CONCORDANCIA AT → NT: ${concordanceQuery.toUpperCase()}\n${'='.repeat(50)}\n\n`;

    concordanceResults.forEach((item, idx) => {
      content += `[${idx + 1}] CONEXIÓN PROFÉTICA\n`;
      content += `📜 AT: ${item.atVerse}\n"${item.atText}"\n\n`;
      content += `✝️ NT: ${item.ntVerse}\n"${item.ntText}"\n\n`;
      content += `🔗 Conexión: ${item.connection}\n\n`;
      content += `📖 Estudio: ${item.deepStudy}\n`;
      content += `${'-'.repeat(40)}\n\n`;
    });

    content += `\n---\nGenerado por Púlpito Dinámico`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Concordancia_${concordanceQuery.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadConcordanceWord = () => {
    if (concordanceResults.length === 0) return;
    let contentHtml = `<h1>🔗 Concordancia AT → NT: ${concordanceQuery}</h1>`;

    concordanceResults.forEach((item, idx) => {
      contentHtml += `
        <h2>Conexión ${idx + 1}</h2>
        <table border="1" cellpadding="8" style="width:100%; border-collapse: collapse;">
          <tr style="background: #fef3c7;"><td><strong>📜 Antiguo Testamento</strong><br/><b>${item.atVerse}</b><br/><i>"${item.atText}"</i></td></tr>
          <tr style="background: #dbeafe;"><td><strong>✝️ Nuevo Testamento</strong><br/><b>${item.ntVerse}</b><br/><i>"${item.ntText}"</i></td></tr>
        </table>
        <p><strong>🔗 Conexión:</strong> ${item.connection}</p>
        <p><strong>📖 Estudio Profundo:</strong> ${item.deepStudy}</p>
        <hr/>
      `;
    });

    contentHtml += `<p><small>Púlpito Dinámico - Concordancia Bíblica</small></p>`;

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Concordancia ${concordanceQuery}</title></head><body>`;
    const footer = "</body></html>";
    const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Concordancia_${concordanceQuery.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintConcordance = () => {
    if (concordanceResults.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    let contentHtml = `<h1>🔗 Concordancia AT → NT: ${concordanceQuery}</h1>`;

    concordanceResults.forEach((item, idx) => {
      contentHtml += `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h2 style="color: #7c3aed;">Conexión ${idx + 1}</h2>
          <div style="display: flex; gap: 20px;">
            <div style="flex: 1; background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="font-size: 10px; color: #b45309; font-weight: bold;">ANTIGUO TESTAMENTO</p>
              <p style="font-weight: bold; color: #92400e;">${item.atVerse}</p>
              <p style="font-style: italic;">"${item.atText}"</p>
            </div>
            <div style="flex: 1; background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="font-size: 10px; color: #1d4ed8; font-weight: bold;">NUEVO TESTAMENTO</p>
              <p style="font-weight: bold; color: #1e40af;">${item.ntVerse}</p>
              <p style="font-style: italic;">"${item.ntText}"</p>
            </div>
          </div>
          <p><strong>🔗 Conexión:</strong> ${item.connection}</p>
          <p style="background: #f3e8ff; padding: 10px; border-radius: 8px;"><strong>📖 Estudio:</strong> ${item.deepStudy}</p>
        </div>
      `;
    });

    contentHtml += `<hr/><p style="text-align: center; color: gray;"><small>Púlpito Dinámico - Concordancia Bíblica</small></p>`;

    printWindow.document.write(`<html><head><title>Concordancia: ${concordanceQuery}</title><style>body { font-family: Georgia, serif; padding: 30px; line-height: 1.5; } h1 { color: #4338ca; } @media print { .no-print { display: none; } }</style></head><body>${contentHtml}<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`);
    printWindow.document.close();
  };

  // --- INSERT TO PULPIT LOGIC ---
  const handleInsertToPulpit = () => {
    if (!deepDiveResult || !verseQuery) return;

    try {
      const saved = localStorage.getItem('current_sermon');
      const currentSermon: Sermon = saved ? JSON.parse(saved) : {
        id: Date.now().toString(), title: 'Nuevo Sermón', sections: []
      }; // Partial defaults handled by safe logic later

      if (!currentSermon.sections) currentSermon.sections = [];

      const newSection = {
        id: Date.now().toString(),
        type: SectionType.EXTRA,
        title: `Devocional: ${verseQuery}`,
        durationMin: 5,
        content: `
              <p><strong>Cita Base:</strong> ${verseQuery}</p>
              <p><em>"${verseText}"</em></p>
              <hr/>
              <p><strong>Significado:</strong> ${deepDiveResult.meaning}</p>
              <p><strong>Contexto:</strong> ${deepDiveResult.context}</p>
              <p><strong>Aplicación:</strong> ${deepDiveResult.application}</p>
            `
      };

      currentSermon.sections.push(newSection);
      localStorage.setItem('current_sermon', JSON.stringify(currentSermon));
      onNavigate('editor');
    } catch (e) {
      console.error("Error inserting to sermon", e);
      alert("Error al insertar sección.");
    }
  };

  return (
    <div className={`space-y-8 animate-fade-in relative transition-colors duration-1000 ${selectedEmotion === Emotion.JOY ? 'bg-gradient-to-b from-[var(--bg-primary)] to-yellow-50/30' : ''}`}>

      {showAurora && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden animate-fade-in transition-opacity duration-2000 ease-in-out">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[100%] bg-gradient-to-r from-indigo-400/20 via-purple-400/20 to-blue-400/20 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '6s' }}></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[100%] h-[100%] bg-gradient-to-l from-emerald-300/10 via-teal-300/10 to-cyan-300/10 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }}></div>
            <div className="absolute top-[30%] left-[30%] w-[50%] h-[50%] bg-yellow-200/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '5s' }}></div>
          </div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay"></div>
        </div>
      )}

      {selectedEmotion === Emotion.JOY && !showAurora && (
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
          <div className="w-[800px] h-[800px] bg-yellow-400/5 rounded-full blur-[100px] animate-pulse"></div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4 md:pt-0">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)] animate-slide-up flex items-center gap-2">
            <Sun className="w-8 h-8 text-orange-400 animate-spin-slow" />
            {getTimeBasedGreeting()}{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="text-[var(--text-secondary)] mt-2 font-reading italic text-sm md:text-base animate-slide-up animation-delay-200">
            "{greetingVerse}"
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 animate-slide-in-right">
          <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-4 py-2 rounded-full shadow-sm border border-[var(--border-color)]">
            <Battery className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-secondary)]">{t('dashboard.energy')}</p>
              <p className="text-sm font-bold text-[var(--text-primary)]">{t('energy.high')}</p>
            </div>
          </div>
          <p className="text-4xl font-mono font-bold text-[var(--text-primary)] tracking-widest tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 relative z-10">
        <button onClick={() => onNavigate('editor')} className="p-4 bg-[var(--accent-color)] text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-2 group">
          <div className="p-3 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
            <Edit className="w-6 h-6" />
          </div>
          <span className="font-bold">{t('dashboard.new')}</span>
        </button>

        <button className="p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-sm hover:shadow-md hover:border-[var(--accent-color)] transition-all flex flex-col items-center justify-center gap-2 group" onClick={() => document.getElementById('dashboard-file-upload')?.click()}>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-full group-hover:bg-[var(--accent-color)] group-hover:text-white transition-colors">
            <FolderOpen className="w-6 h-6" />
          </div>
          <span className="font-bold">{t('dashboard.load')}</span>
          <input type="file" id="dashboard-file-upload" className="hidden" accept=".json,.pulpito" onChange={handleEditorFileLoad} />
        </button>

        {/* TELEPROMPTER CARD */}
        <div className="p-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-sm hover:shadow-md hover:border-[var(--accent-color)] transition-all flex flex-col items-center justify-between group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
          <div className="flex flex-col items-center justify-center gap-2 mt-2" onClick={() => onNavigate('teleprompter')}>
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-full group-hover:bg-green-600 group-hover:text-white transition-colors cursor-pointer">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Teleprompter</span>
          </div>

          <div className="flex w-full justify-between mt-2 pt-2 border-t border-[var(--border-color)] gap-1">
            <button
              className="flex-1 flex flex-col items-center text-[10px] text-[var(--text-secondary)] hover:text-green-600 p-1 hover:bg-[var(--bg-tertiary)] rounded"
              onClick={() => document.getElementById('teleprompter-upload')?.click()}
              title="Subir archivo y proyectar"
            >
              <FileUp className="w-4 h-4 mb-0.5" />
              <span>Subir</span>
            </button>
            <input type="file" id="teleprompter-upload" className="hidden" accept=".json,.pulpito" onChange={handleTeleprompterFileLoad} />

            <button
              className="flex-1 flex flex-col items-center text-[10px] text-[var(--text-secondary)] hover:text-blue-600 p-1 hover:bg-[var(--bg-tertiary)] rounded"
              onClick={() => onNavigate('editor')}
              title="Escribir o Pegar en Editor"
            >
              <PenLine className="w-4 h-4 mb-0.5" />
              <span>Escribir</span>
            </button>

            <button
              className="flex-1 flex flex-col items-center text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-color)] p-1 hover:bg-[var(--bg-tertiary)] rounded"
              onClick={() => onNavigate('teleprompter')}
              title="Proyectar Actual"
            >
              <Play className="w-4 h-4 mb-0.5" />
              <span>Ir</span>
            </button>
          </div>
        </div>

        <button onClick={() => onNavigate('bible')} className="p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-sm hover:shadow-md hover:border-[var(--accent-color)] transition-all flex flex-col items-center justify-center gap-2 group">
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-full group-hover:bg-[var(--accent-color)] group-hover:text-white transition-colors">
            <BookOpen className="w-6 h-6" />
          </div>
          <span className="font-bold">{t('nav.bible')}</span>
        </button>
        <button onClick={() => onNavigate('search')} className="p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-sm hover:shadow-md hover:border-[var(--accent-color)] transition-all flex flex-col items-center justify-center gap-2 group">
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-full group-hover:bg-[var(--accent-color)] group-hover:text-white transition-colors">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="font-bold">{t('nav.study')}</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 relative z-10">

        {/* CONCORDANCE AT-NT */}
        <section className="bg-gradient-to-r from-amber-50 to-blue-50 dark:from-amber-900/20 dark:to-blue-900/20 rounded-2xl p-4 shadow-sm border border-amber-200 dark:border-amber-800">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-600" /> Concordancia AT → NT
            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2">Profecías y Cumplimientos</span>
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); handleConcordanceSearch(); }} className="flex gap-2 mb-4">
            <input
              type="text"
              value={concordanceQuery}
              onChange={(e) => setConcordanceQuery(e.target.value)}
              placeholder="Mesías, cordero, sacrificio, nacimiento virginal..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-[var(--text-primary)] focus:ring-2 focus:ring-purple-400 outline-none"
            />
            <button
              type="submit"
              disabled={isSearchingConcordance}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-blue-500 text-white rounded-lg hover:from-amber-600 hover:to-blue-600 disabled:opacity-50 transition-all font-bold text-sm shadow-md"
            >
              {isSearchingConcordance ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </button>
          </form>

          {/* Results */}
          {concordanceResults.length > 0 && (
            <div className="space-y-3">
              {/* Export Buttons */}
              <div className="flex justify-end gap-1 mb-2">
                <Button variant="outline" size="sm" onClick={handleDownloadConcordanceTXT} title="Descargar TXT">
                  <FileType className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadConcordanceWord} title="Descargar Word">
                  <FileText className="w-3 h-3" />
                </Button>
                <Button variant="primary" size="sm" onClick={handlePrintConcordance} title="Imprimir">
                  <Printer className="w-3 h-3 mr-1" /> Imprimir
                </Button>
              </div>
              {concordanceResults.map((item, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    {/* AT */}
                    <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-2 border-l-4 border-amber-500">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Antiguo Testamento</span>
                      <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">{item.atVerse}</p>
                      <p className="text-xs text-[var(--text-secondary)] italic">"{item.atText}"</p>
                    </div>
                    {/* NT */}
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 border-l-4 border-blue-500">
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase">Nuevo Testamento</span>
                      <p className="font-bold text-blue-800 dark:text-blue-300 text-sm">{item.ntVerse}</p>
                      <p className="text-xs text-[var(--text-secondary)] italic">"{item.ntText}"</p>
                    </div>
                  </div>
                  {/* Connection */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 mb-2">
                    <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold">🔗 CONEXIÓN:</span>
                    <p className="text-xs text-[var(--text-primary)]">{item.connection}</p>
                  </div>
                  {/* Deep Study */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Ver Estudio Profundo
                    </summary>
                    <div className="mt-2 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg text-xs text-[var(--text-primary)] leading-relaxed">
                      {item.deepStudy}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isSearchingConcordance && concordanceResults.length === 0 && (
            <div className="text-center py-4 text-[var(--text-secondary)]">
              <p className="text-xs">Busca una palabra o tema para ver las conexiones proféticas entre AT y NT</p>
              <p className="text-[10px] mt-1 opacity-70">Ej: "nacimiento virginal", "cordero de Dios", "siervo sufriente"</p>
            </div>
          )}

          {/* Loading */}
          {isSearchingConcordance && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500 mr-2" />
              <span className="text-sm text-[var(--text-secondary)]">Buscando conexiones...</span>
            </div>
          )}
        </section>

        {/* THEOLOGICAL GLOSSARY */}
        <section className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-4 shadow-sm border border-indigo-200 dark:border-indigo-800">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-indigo-600" /> Glosario Teológico
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-2">120 Términos</span>
          </h3>

          {/* Search Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={glossarySearchQuery}
              onChange={(e) => setGlossarySearchQuery(e.target.value)}
              placeholder="Buscar término: exégesis, trinidad, pascua..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <button
              onClick={() => {
                if (glossarySearchQuery.trim()) {
                  handleGlossaryTermClick(glossarySearchQuery.trim());
                }
              }}
              disabled={isLoadingGlossary || !glossarySearchQuery.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors font-bold text-sm"
            >
              {isLoadingGlossary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {glossaryCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedGlossaryCategory(selectedGlossaryCategory === cat.id ? null : cat.id);
                  setSelectedGlossaryTerm(null);
                  setGlossaryContent(null);
                  setGlossarySearchQuery('');
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${selectedGlossaryCategory === cat.id
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-gray-200 dark:border-gray-700'
                  }`}
              >
                <span>{cat.icon}</span>
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Terms Grid */}
          {selectedGlossaryCategory && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {glossaryCategories.find(c => c.id === selectedGlossaryCategory)?.terms.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleGlossaryTermClick(term)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${selectedGlossaryTerm === term
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-[var(--text-primary)] hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-600'
                      }`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoadingGlossary && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
              <span className="text-sm text-[var(--text-secondary)]">Generando explicación...</span>
            </div>
          )}

          {/* Term Content */}
          {glossaryContent && !isLoadingGlossary && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📚</span>
                  <h4 className="font-bold text-[var(--text-primary)]">{selectedGlossaryTerm}</h4>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handleDownloadGlossaryTXT} title="Descargar TXT">
                    <FileType className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadGlossaryWord} title="Descargar Word">
                    <FileText className="w-3 h-3" />
                  </Button>
                  <Button variant="primary" size="sm" onClick={handlePrintGlossary} title="Imprimir">
                    <Printer className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Definition */}
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border-l-3 border-indigo-500">
                <h5 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">📖 Definición</h5>
                <p className="text-xs text-[var(--text-primary)]">{glossaryContent.definition}</p>
              </div>

              {/* Biblical */}
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-3 border-amber-500">
                <h5 className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">📜 Fundamento Bíblico</h5>
                <p className="text-xs text-[var(--text-primary)]">{glossaryContent.biblical}</p>
              </div>

              {/* Historical */}
              <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-l-3 border-gray-400">
                <h5 className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">🏛️ Contexto Histórico</h5>
                <p className="text-xs text-[var(--text-primary)]">{glossaryContent.historical}</p>
              </div>

              {/* Practical */}
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-3 border-green-500">
                <h5 className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-1">💡 Aplicación Práctica Hoy</h5>
                <p className="text-xs text-[var(--text-primary)]">{glossaryContent.practical}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!selectedGlossaryCategory && !isLoadingGlossary && (
            <div className="text-center py-4 text-[var(--text-secondary)]">
              <p className="text-xs">Selecciona una categoría para explorar términos teológicos</p>
              <p className="text-[10px] mt-1 opacity-70">Cada término incluye definición, fundamento bíblico, historia y aplicación práctica</p>
            </div>
          )}
        </section>

        {/* EMOTIONAL CHECK-IN + VERSE SEARCH */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Emotional Section - More Compact */}
          <section className="lg:col-span-2 bg-[var(--bg-secondary)] rounded-xl p-3 shadow-sm border border-[var(--border-color)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-red-500" /> {t('dashboard.checkin.title')}
            </h3>

            <div className="flex justify-between gap-0.5 mb-2 overflow-x-auto scrollbar-hide">
              {emotions.map((emotion) => (
                <button
                  key={emotion.label}
                  onClick={() => handleEmotionClick(emotion.label)}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg min-w-[50px] transition-all ${selectedEmotion === emotion.label ? `${emotion.color} shadow-sm` : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >
                  <span className="text-lg">{emotion.icon}</span>
                  <span className="text-[9px] font-semibold">{t(emotion.transKey)}</span>
                </button>
              ))}
            </div>

            {currentMessage && (
              <div className="animate-fade-in grid grid-cols-2 gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 rounded-r-lg">
                  <h4 className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-0.5">{t('card.spiritual')}</h4>
                  <p className="text-[11px] font-reading italic text-[var(--text-primary)] line-clamp-3">"{currentMessage.spiritual}"</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-500 rounded-r-lg">
                  <h4 className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-0.5">{t('card.psychological')}</h4>
                  <p className="text-[10px] text-[var(--text-primary)] line-clamp-3">{currentMessage.psychological}</p>
                </div>
              </div>
            )}
          </section>

          {/* Verse Keyword Search Sidebar */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] flex flex-col">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" /> Estudiemos para entender
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); handleVerseKeywordSearch(); }} className="flex gap-2 mb-3">
              <input
                type="text"
                value={verseSearchQuery}
                onChange={(e) => setVerseSearchQuery(e.target.value)}
                placeholder="¿Por qué Dios permite el sufrimiento?"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-amber-400 outline-none"
              />
              <button
                type="submit"
                disabled={isSearchingVerses}
                className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isSearchingVerses ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[200px]">
              {verseSearchResults.length > 0 ? (
                verseSearchResults.map((verse, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedSearchVerse(verse)}
                    className={`p-2 rounded-lg cursor-pointer transition-all text-xs border ${selectedSearchVerse?.ref === verse.ref
                      ? 'bg-amber-100 border-amber-400 dark:bg-amber-900/30'
                      : verse.relevance === 'directa'
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 hover:bg-green-100'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:bg-[var(--bg-primary)]'
                      }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[var(--text-primary)]">{verse.ref}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${verse.relevance === 'directa' ? 'bg-green-200 text-green-800' : 'bg-blue-100 text-blue-700'}`}>
                        {verse.relevance}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] line-clamp-2">{verse.text}</p>
                  </div>
                ))
              ) : !isSearchingVerses && (
                <div className="text-center text-[var(--text-secondary)] text-xs py-4">
                  <p>Escribe una pregunta o tema para encontrar respuestas bíblicas</p>
                </div>
              )}
            </div>

            {selectedSearchVerse && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex gap-2">
                <button
                  onClick={() => handleSendToStudy(selectedSearchVerse)}
                  className="flex-1 py-2 text-xs font-bold bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Estudio
                </button>
                <button
                  onClick={() => handleSendToMainVerse(selectedSearchVerse)}
                  className="flex-1 py-2 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-3 h-3" /> Verso Base
                </button>
              </div>
            )}
          </section>
        </div>

        {/* DEEP DIVE / VERSE OF THE DAY */}
        <section className="w-full bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)] flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" /> {t('dashboard.deepdive.title')}
            </h3>
            {deepDiveResult && (
              <div className="flex gap-1 animate-fade-in">
                <Button variant="outline" size="sm" onClick={handleInsertToPulpit} title="Insertar en Púlpito" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
                  <FileInput className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadDeepDiveWord} title={t('export.word')}><FileText className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={handleDownloadDeepDiveTXT} title={t('export.txt')}><FileType className="w-4 h-4" /></Button>
                <Button variant="primary" size="sm" onClick={handlePrintDeepDive} title={t('export.print')}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
              </div>
            )}
          </div>

          <div className="space-y-4 flex-1 flex flex-col">

            {/* VISUAL VERSE PICKER TRIGGER */}
            <div
              onClick={openPicker}
              className="w-full p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] flex justify-between items-center cursor-pointer hover:border-[var(--accent-color)] transition-colors group"
            >
              <span className="text-sm font-medium">{verseQuery || t('dashboard.deepdive.placeholder')}</span>
              <div className="p-1 rounded-full bg-[var(--bg-secondary)] group-hover:bg-[var(--accent-color)] group-hover:text-white transition-colors">
                {isDeepDiveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {deepDiveError && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Error de Análisis</p>
                  <p>{deepDiveError}</p>
                  <button onClick={() => handleDeepDiveLoad(verseQuery)} className="mt-2 text-red-700 underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reintentar</button>
                </div>
              </div>
            )}

            {/* Verse Text Always Visible if loaded */}
            {verseText && (
              <div className="p-5 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
                <p className="font-reading text-lg md:text-xl italic text-[var(--text-primary)] leading-relaxed text-center">"{verseText}"</p>
              </div>
            )}

            {deepDiveResult ? (
              <div className="space-y-4 animate-fade-in flex-1">
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-xs font-bold uppercase text-green-700 dark:text-green-300 block mb-2 tracking-wider flex items-center gap-2"><BookOpen className="w-4 h-4" /> {t('deepdive.meaning')}</span>
                  <p className="text-base text-[var(--text-primary)] font-serif leading-relaxed text-justify">{deepDiveResult.meaning}</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300 block mb-2 tracking-wider flex items-center gap-2"><Clock className="w-4 h-4" /> {t('deepdive.context')}</span>
                  <p className="text-base text-[var(--text-primary)] font-serif leading-relaxed text-justify">{deepDiveResult.context}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-xs font-bold uppercase text-orange-700 dark:text-orange-300 block mb-2 tracking-wider flex items-center gap-2"><Sparkles className="w-4 h-4" /> {t('deepdive.application')}</span>
                  <p className="text-base text-[var(--text-primary)] font-serif leading-relaxed text-justify">{deepDiveResult.application}</p>
                </div>
              </div>
            ) : (
              !isDeepDiveLoading && !deepDiveError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                  <Sparkles className="w-12 h-12 text-[var(--text-secondary)] mb-3" />
                  <p className="text-sm text-[var(--text-secondary)]">Pulsa el buscador para generar un devocional profundo.</p>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {/* VERSE PICKER MODAL */}
      {showVersePicker && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-secondary)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-tertiary)] shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--accent-color)]" />
                <span className="font-bold text-[var(--text-primary)]">
                  {pickerStep === 'books' ? 'Selecciona Libro' : pickerStep === 'chapters' ? tempBook?.name : `${tempBook?.name} ${tempChapter}`}
                </span>
              </div>
              <button onClick={() => setShowVersePicker(false)} className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)]"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex items-center gap-2 p-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
              <button onClick={() => { setPickerStep('books'); setTempBook(null); setTempChapter(null); }} className={`px-3 py-1 rounded text-xs font-bold ${pickerStep === 'books' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>Libros</button>
              <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] -rotate-90" />
              <button disabled={!tempBook} onClick={() => { if (tempBook) { setPickerStep('chapters'); setTempChapter(null); } }} className={`px-3 py-1 rounded text-xs font-bold ${pickerStep === 'chapters' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30'}`}>Capítulos</button>
              <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] -rotate-90" />
              <button disabled={!tempChapter} className={`px-3 py-1 rounded text-xs font-bold ${pickerStep === 'verses' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30'}`}>Versículos</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-primary)]">
              {pickerStep === 'books' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {BIBLE_BOOKS.map(b => (
                    <button key={b.id} onClick={() => handleBookSelect(b)} className="p-2 text-xs text-center border border-[var(--border-color)] rounded hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] bg-[var(--bg-secondary)] transition-colors">
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
              {pickerStep === 'chapters' && tempBook && (
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                  {Array.from({ length: tempBook.chapters }, (_, i) => i + 1).map(c => (
                    <button key={c} onClick={() => handleChapterSelect(c)} className="aspect-square flex items-center justify-center border border-[var(--border-color)] rounded hover:bg-[var(--accent-color)] hover:text-white font-bold text-sm bg-[var(--bg-secondary)] transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {pickerStep === 'verses' && tempBook && tempChapter && (
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                  {Array.from({ length: 50 }, (_, i) => i + 1).map(v => (
                    <button key={v} onClick={() => handleVerseSelect(v)} className="aspect-square flex items-center justify-center border border-[var(--border-color)] rounded hover:bg-[var(--accent-color)] hover:text-white font-bold text-sm bg-[var(--bg-secondary)] transition-colors">
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Projects */}
      <section className="px-4 pb-8 relative z-10">
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" /> {t('dashboard.history.title')}
            </h3>
            <button className="text-xs font-bold text-[var(--accent-color)] hover:underline uppercase tracking-wide">Ver Todo</button>
          </div>

          {historyProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historyProjects.map((project, i) => (
                <div key={i} className="group p-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all cursor-pointer flex justify-between items-center" onClick={() => onNavigate('editor')}>
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">{project.title}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {new Date(project.date).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transform group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-[var(--text-secondary)]">
              <p>{t('dashboard.history.empty')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
