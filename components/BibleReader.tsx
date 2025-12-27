
import React, { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, ChevronLeft, Check, Grid, List, ChevronDown, ChevronUp, Copy, RefreshCw, X, ArrowRight, FileInput, SplitSquareHorizontal, BookText, ChevronRight, Image, Download, Share2 } from 'lucide-react';
import { Button } from './Button';
import { fetchVerseText, getBibleVersions, BIBLE_BOOKS } from '../services/bibleService';
import { TextSettings, Sermon, SectionType } from '../types';
import { useTranslation } from '../context/LanguageContext';

interface BibleReaderProps {
  textSettings?: TextSettings;
  onNavigate?: (view: string) => void;
}

export const BibleReader: React.FC<BibleReaderProps> = ({ textSettings, onNavigate }) => {
  const { t, language } = useTranslation();
  const versions = getBibleVersions(language);

  // --- STATE MANAGEMENT ---
  // Navigation State
  const [pickerStep, setPickerStep] = useState<'books' | 'chapters' | 'verses' | 'reading' | 'search' | 'browse'>('books');

  // Selection State
  const [selectedBook, setSelectedBook] = useState<typeof BIBLE_BOOKS[0] | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);

  // Version State
  const [primaryVersion, setPrimaryVersion] = useState<string>(versions[0].id);

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonVersion, setComparisonVersion] = useState<string>(versions.length > 1 ? versions[1].id : versions[0].id);

  // Content State
  const [currentReference, setCurrentReference] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [comparisonText, setComparisonText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Keyword Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ ref: string; text: string; relevance: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Browse Mode State (NEW)
  const [isSplitView, setIsSplitView] = useState(false);
  const [browseChapterText, setBrowseChapterText] = useState('');
  const [browseChapterTextSecondary, setBrowseChapterTextSecondary] = useState('');
  const [browseSidebarOpen, setBrowseSidebarOpen] = useState(true);
  const [browseBookFilter, setBrowseBookFilter] = useState('');

  // Verse Card Generator State (NEW)
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardSize, setCardSize] = useState<'instagram' | 'story' | 'facebook' | 'twitter' | 'presentation' | 'square'>('instagram');
  const [cardTheme, setCardTheme] = useState<'light' | 'dark' | 'gradient1' | 'gradient2' | 'nature' | 'elegant'>('gradient1');
  const [cardText, setCardText] = useState('');
  const [cardRef, setCardRef] = useState('');
  const cardCanvasRef = useRef<HTMLDivElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  // Background Image & Icons State (NEW)
  const [cardBgImage, setCardBgImage] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPosition, setIconPosition] = useState<'top' | 'bottom' | 'none'>('none');

  // Visual Editor State (NEW)
  const [cardBrightness, setCardBrightness] = useState(50); // 0=dark, 100=light
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 }); // percentage
  const [textSize, setTextSize] = useState(100); // percentage scale
  const [iconPos, setIconPos] = useState({ x: 50, y: 15 }); // percentage  
  const [iconSize, setIconSize] = useState(100); // percentage scale
  const [textColor, setTextColor] = useState('#ffffff'); // custom text color
  const [textBgOpacity, setTextBgOpacity] = useState(0); // 0-100 for text background
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('center');
  const [showBullets, setShowBullets] = useState(false);

  // Size presets for social media
  const CARD_SIZES = {
    instagram: { width: 1080, height: 1080, label: 'Instagram Post', ratio: '1:1' },
    story: { width: 1080, height: 1920, label: 'Instagram/FB Story', ratio: '9:16' },
    facebook: { width: 1200, height: 630, label: 'Facebook Post', ratio: '1.9:1' },
    twitter: { width: 1200, height: 675, label: 'Twitter/X', ratio: '16:9' },
    presentation: { width: 1920, height: 1080, label: 'Presentación', ratio: '16:9' },
    square: { width: 800, height: 800, label: 'Cuadrado', ratio: '1:1' }
  };

  // Design themes
  const CARD_THEMES = {
    light: { bg: 'bg-white', text: 'text-gray-800', accent: 'text-blue-600', name: 'Claro' },
    dark: { bg: 'bg-gray-900', text: 'text-white', accent: 'text-yellow-400', name: 'Oscuro' },
    gradient1: { bg: 'bg-gradient-to-br from-blue-600 to-purple-700', text: 'text-white', accent: 'text-yellow-300', name: 'Azul-Púrpura' },
    gradient2: { bg: 'bg-gradient-to-br from-orange-500 to-pink-600', text: 'text-white', accent: 'text-yellow-200', name: 'Cálido' },
    nature: { bg: 'bg-gradient-to-br from-green-600 to-teal-700', text: 'text-white', accent: 'text-lime-300', name: 'Naturaleza' },
    elegant: { bg: 'bg-gradient-to-br from-gray-800 to-gray-900', text: 'text-gray-100', accent: 'text-amber-400', name: 'Elegante' }
  };

  // Christian Icons Library (FREE Unicode/Emoji symbols)
  const CHRISTIAN_ICONS = [
    { id: 'cross', icon: '✝️', name: 'Cruz' },
    { id: 'dove', icon: '🕊️', name: 'Paloma' },
    { id: 'pray', icon: '🙏', name: 'Oración' },
    { id: 'heart', icon: '❤️', name: 'Amor' },
    { id: 'star', icon: '⭐', name: 'Estrella' },
    { id: 'light', icon: '✨', name: 'Luz' },
    { id: 'fire', icon: '🔥', name: 'Fuego' },
    { id: 'crown', icon: '👑', name: 'Corona' },
    { id: 'book', icon: '📖', name: 'Biblia' },
    { id: 'church', icon: '⛪', name: 'Iglesia' },
    { id: 'lamb', icon: '🐑', name: 'Cordero' },
    { id: 'olive', icon: '🫒', name: 'Olivo' },
    { id: 'bread', icon: '🍞', name: 'Pan' },
    { id: 'wine', icon: '🍷', name: 'Vino' },
    { id: 'candle', icon: '🕯️', name: 'Vela' },
    { id: 'angel', icon: '👼', name: 'Ángel' },
    { id: 'rainbow', icon: '🌈', name: 'Arcoíris' },
    { id: 'sun', icon: '☀️', name: 'Sol' },
    { id: 'moon', icon: '🌙', name: 'Luna' },
    { id: 'fish', icon: '🐟', name: 'Pez' },
    { id: 'hands', icon: '🤲', name: 'Manos' },
    { id: 'peace', icon: '☮️', name: 'Paz' },
    { id: 'infinity', icon: '♾️', name: 'Infinito' },
    { id: 'anchor', icon: '⚓', name: 'Ancla' },
  ];

  // --- PERSISTENCE ---
  useEffect(() => {
    const saved = localStorage.getItem('bible_reader_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.pickerStep) setPickerStep(state.pickerStep);
        if (state.selectedBook) setSelectedBook(state.selectedBook);
        if (state.selectedChapter) setSelectedChapter(state.selectedChapter);
        if (state.selectedVerses) setSelectedVerses(state.selectedVerses);
        if (state.primaryVersion) setPrimaryVersion(state.primaryVersion);
        if (state.comparisonVersion) setComparisonVersion(state.comparisonVersion);
        if (state.isComparing !== undefined) setIsComparing(state.isComparing);
        if (state.currentReference) setCurrentReference(state.currentReference);
        if (state.primaryText) setPrimaryText(state.primaryText);
        if (state.comparisonText) setComparisonText(state.comparisonText);
      } catch (e) {
        console.error("Failed to load bible state", e);
      }
    }
  }, []);

  useEffect(() => {
    const state = {
      pickerStep,
      selectedBook,
      selectedChapter,
      selectedVerses,
      primaryVersion,
      comparisonVersion,
      isComparing,
      currentReference,
      primaryText,
      comparisonText
    };
    localStorage.setItem('bible_reader_state', JSON.stringify(state));
  }, [pickerStep, selectedBook, selectedChapter, selectedVerses, primaryVersion, comparisonVersion, isComparing, currentReference, primaryText, comparisonText]);

  // --- LOGIC ---

  const handleBookClick = (book: typeof BIBLE_BOOKS[0]) => {
    setSelectedBook(book);
    setPickerStep('chapters');
    setSelectedChapter(null);
    setSelectedVerses([]);
  };

  const handleChapterClick = (chapter: number) => {
    setSelectedChapter(chapter);
    setPickerStep('verses');
    setSelectedVerses([]);
  };

  const handleVerseToggle = (verse: number) => {
    setSelectedVerses(prev => {
      if (prev.includes(verse)) {
        return prev.filter(v => v !== verse);
      } else {
        return [...prev, verse].sort((a, b) => a - b);
      }
    });
  };

  const constructReference = () => {
    if (!selectedBook || !selectedChapter) return "";
    const bookName = selectedBook.name; // Usar nombre completo directo

    if (selectedVerses.length === 0) return `${bookName} ${selectedChapter}`;

    let verseString = "";
    if (selectedVerses.length === 1) {
      verseString = selectedVerses[0].toString();
    } else {
      const min = Math.min(...selectedVerses);
      const max = Math.max(...selectedVerses);
      const isContinuous = (max - min + 1) === selectedVerses.length;

      if (isContinuous) {
        verseString = `${min}-${max}`;
      } else {
        verseString = selectedVerses.join(',');
      }
    }
    return `${bookName} ${selectedChapter}:${verseString}`;
  };

  const loadReading = async (forceRef?: string) => {
    const ref = forceRef || constructReference();
    if (!ref) return;

    setIsLoading(true);
    setPickerStep('reading');
    setCurrentReference(ref);

    try {
      // Carga paralela si está comparando, si no, solo primaria
      const pTextPromise = fetchVerseText(ref, primaryVersion);
      const cTextPromise = isComparing ? fetchVerseText(ref, comparisonVersion) : Promise.resolve(null);

      const [pText, cText] = await Promise.all([pTextPromise, cTextPromise]);

      setPrimaryText(pText);
      if (cText) setComparisonText(cText);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComparison = async () => {
    const newState = !isComparing;
    setIsComparing(newState);
    if (newState && currentReference) {
      // Cargar el texto comparativo si acabamos de abrir la comparación
      setIsLoading(true);
      try {
        const text = await fetchVerseText(currentReference, comparisonVersion);
        setComparisonText(text);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleComparisonVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ver = e.target.value;
    setComparisonVersion(ver);
    if (currentReference) {
      setIsLoading(true);
      try {
        const text = await fetchVerseText(currentReference, ver);
        setComparisonText(text);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePrimaryVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ver = e.target.value;
    setPrimaryVersion(ver);
    if (currentReference) {
      setIsLoading(true);
      try {
        const text = await fetchVerseText(currentReference, ver);
        setPrimaryText(text);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInsertToPulpit = () => {
    if (!currentReference || !primaryText) return;
    if (!onNavigate) {
      alert("Navegación no disponible");
      return;
    }

    try {
      const saved = localStorage.getItem('current_sermon');
      const currentSermon: Sermon = saved ? JSON.parse(saved) : {
        id: Date.now().toString(), title: 'Nuevo Sermón', sections: []
      };
      if (!currentSermon.sections) currentSermon.sections = [];

      const newSection = {
        id: Date.now().toString(),
        type: SectionType.EXTRA,
        title: `Lectura: ${currentReference}`,
        durationMin: 5,
        content: `
              <h3>${currentReference} (${primaryVersion})</h3>
              <p><em>"${primaryText}"</em></p>
              ${comparisonText ? `<hr/><p><strong>Comparativa (${comparisonVersion}):</strong><br/><em>"${comparisonText}"</em></p>` : ''}
            `
      };

      currentSermon.sections.push(newSection);
      localStorage.setItem('current_sermon', JSON.stringify(currentSermon));
      onNavigate('editor');
    } catch (e) {
      console.error(e);
      alert("Error al insertar");
    }
  };

  // Handle keyword search for verses
  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const { generateUnifiedContent } = await import('../services/geminiService');
      const prompt = `Busca versículos bíblicos que contengan o se relacionen con: "${searchQuery}"
      
      Responde en formato JSON con un array de objetos, cada uno con:
      - ref: referencia bíblica (ej: "Juan 3:16")
      - text: texto del versículo (máximo 100 palabras)
      - relevance: "exacto" si contiene la palabra exacta, "relacionado" si es temáticamente relacionado
      
      Ordena primero los exactos, luego los relacionados. Máximo 8 resultados.
      Responde SOLO el JSON, sin markdown ni explicaciones.`;

      const response = await generateUnifiedContent(prompt);

      // Parse JSON response
      let results: Array<{ ref: string; text: string; relevance: string }> = [];
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          results = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error('Failed to parse search results');
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = async (ref: string) => {
    setIsLoading(true);
    setPickerStep('reading');
    setCurrentReference(ref);

    try {
      const text = await fetchVerseText(ref, primaryVersion);
      setPrimaryText(text);
      if (isComparing) {
        const cText = await fetchVerseText(ref, comparisonVersion);
        setComparisonText(cText);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load complete chapter for browse mode
  const loadBrowseChapter = async (book: typeof BIBLE_BOOKS[0], chapter: number) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setIsLoading(true);

    const ref = `${book.name} ${chapter}`;
    setCurrentReference(ref);

    try {
      const primaryPromise = fetchVerseText(ref, primaryVersion);
      const secondaryPromise = isSplitView ? fetchVerseText(ref, comparisonVersion) : Promise.resolve('');

      const [primary, secondary] = await Promise.all([primaryPromise, secondaryPromise]);
      setBrowseChapterText(primary);
      if (isSplitView) {
        setBrowseChapterTextSecondary(secondary);
      }
    } catch (e) {
      console.error('Error loading chapter:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle split view and reload if needed
  const toggleSplitView = async () => {
    const newState = !isSplitView;
    setIsSplitView(newState);

    if (newState && selectedBook && selectedChapter) {
      setIsLoading(true);
      try {
        const ref = `${selectedBook.name} ${selectedChapter}`;
        const text = await fetchVerseText(ref, comparisonVersion);
        setBrowseChapterTextSecondary(text);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Open card generator modal
  const openCardGenerator = (text: string, reference: string) => {
    setCardText(text);
    setCardRef(reference);
    setShowCardModal(true);
  };

  // Handle background image upload
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCardBgImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Clear background image
  const clearCardBg = () => {
    setCardBgImage(null);
    if (bgImageInputRef.current) {
      bgImageInputRef.current.value = '';
    }
  };

  // Download card as image
  const downloadCard = async () => {
    if (!cardCanvasRef.current) return;

    try {
      // Dynamic import html2canvas
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(cardCanvasRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null
      });

      const link = document.createElement('a');
      link.download = `versiculo-${cardRef.replace(/\s+/g, '-')}-${cardSize}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error al generar imagen. Asegúrate de tener conexión a internet.');
    }
  };

  // --- RENDER ---

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      <header className="h-[60px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h1 className="font-bold text-lg text-[var(--text-primary)] hidden md:block">Biblia</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Toggle Button */}
          <Button
            variant={pickerStep === 'search' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setPickerStep(pickerStep === 'search' ? 'books' : 'search')}
            title="Buscar por palabra"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Browse/Reading Mode Button - HIGHLIGHTED */}
          <Button
            variant={pickerStep === 'browse' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPickerStep(pickerStep === 'browse' ? 'books' : 'browse')}
            title="Modo Lectura Continua"
            className={pickerStep === 'browse'
              ? 'bg-green-600 hover:bg-green-700'
              : 'border-green-500 text-green-600 hover:bg-green-50 animate-pulse'
            }
          >
            <BookText className="w-4 h-4" />
            <span className="ml-1 text-xs font-bold hidden sm:inline">Leer</span>
          </Button>

          {/* Split View Toggle (only in browse mode) */}
          {pickerStep === 'browse' && (
            <Button
              variant={isSplitView ? 'primary' : 'outline'}
              size="sm"
              onClick={toggleSplitView}
              title="Vista Paralela"
              className={isSplitView ? '' : 'text-purple-600 border-purple-200 hover:bg-purple-50'}
            >
              <SplitSquareHorizontal className="w-4 h-4" />
            </Button>
          )}

          {pickerStep === 'reading' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setPickerStep('books')}>
                <Grid className="w-4 h-4 mr-2" /> Selector
              </Button>
              <Button variant="outline" size="sm" onClick={handleInsertToPulpit} title="Insertar en Púlpito" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
                <FileInput className="w-4 h-4" />
              </Button>
            </>
          )}

          <div className="relative">
            <select
              value={primaryVersion}
              onChange={handlePrimaryVersionChange}
              className="appearance-none bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--text-primary)] px-3 py-2 pr-8 rounded-lg border border-[var(--border-color)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer shadow-sm"
            >
              {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          </div>

          {/* Secondary Version Selector (for split view) */}
          {isSplitView && pickerStep === 'browse' && (
            <div className="relative">
              <select
                value={comparisonVersion}
                onChange={handleComparisonVersionChange}
                className="appearance-none bg-purple-100 dark:bg-purple-900/30 text-xs font-bold text-purple-700 dark:text-purple-300 px-3 py-2 pr-8 rounded-lg border border-purple-300 dark:border-purple-700 focus:outline-none cursor-pointer shadow-sm"
              >
                {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto h-full flex flex-col">

          {/* --- SEARCH MODE --- */}
          {pickerStep === 'search' && (
            <div className="animate-fade-in flex-1 flex flex-col space-y-4">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  {t('bible.search_title') || 'Buscar Versículos por Palabra'}
                </h3>
                <form onSubmit={handleKeywordSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('bible.search_placeholder') || 'Escribe una palabra o frase (ej: amor, fe, esperanza)'}
                    className="flex-1 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none"
                  />
                  <Button type="submit" loading={isSearching} disabled={!searchQuery.trim()}>
                    <Search className="w-4 h-4 mr-2" /> {t('ui.search') || 'Buscar'}
                  </Button>
                </form>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <p className="text-xs text-[var(--text-secondary)] px-1">
                      {searchResults.length} {t('bible.results_found') || 'resultados encontrados'}
                    </p>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => handleSearchResultClick(result.ref)}
                        className={`bg-[var(--bg-secondary)] border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[var(--accent-color)] transition-all ${result.relevance === 'exacto'
                          ? 'border-l-4 border-l-green-500 border-[var(--border-color)]'
                          : 'border-[var(--border-color)]'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[var(--accent-color)]">{result.ref}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${result.relevance === 'exacto'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                            }`}>
                            {result.relevance === 'exacto' ? 'Coincidencia exacta' : 'Relacionado'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] line-clamp-3">{result.text}</p>
                      </div>
                    ))}
                  </>
                ) : searchQuery && !isSearching ? (
                  <div className="text-center py-12 text-[var(--text-secondary)]">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('bible.no_results') || 'No se encontraron resultados'}</p>
                    <p className="text-xs mt-2">{t('bible.try_another') || 'Intenta con otra palabra o frase'}</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--text-secondary)]">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('bible.search_hint') || 'Escribe una palabra para buscar versículos'}</p>
                    <p className="text-xs mt-2">Ejemplos: amor, fe, esperanza, perdón, salvación</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- PICKER MODE (Steps like Editor) --- */}
          {pickerStep !== 'reading' && pickerStep !== 'search' && (
            <div className="animate-fade-in flex-1 flex flex-col space-y-6">
              {/* Breadcrumbs Navigation */}
              <div className="flex items-center gap-2 text-sm bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                <button
                  onClick={() => { setPickerStep('books'); setSelectedBook(null); setSelectedChapter(null); }}
                  className={`px-3 py-1 rounded-lg transition-colors ${pickerStep === 'books' ? 'bg-[var(--accent-color)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                >
                  Libros
                </button>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] -rotate-90" />
                <button
                  onClick={() => { if (selectedBook) { setPickerStep('chapters'); setSelectedChapter(null); } }}
                  disabled={!selectedBook}
                  className={`px-3 py-1 rounded-lg transition-colors ${pickerStep === 'chapters' ? 'bg-[var(--accent-color)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50'}`}
                >
                  {selectedBook ? selectedBook.name : 'Capítulo'}
                </button>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] -rotate-90" />
                <button
                  disabled={!selectedChapter}
                  className={`px-3 py-1 rounded-lg transition-colors ${pickerStep === 'verses' ? 'bg-[var(--accent-color)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50'}`}
                >
                  {selectedChapter ? `Cap. ${selectedChapter}` : 'Versículos'}
                </button>
              </div>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm flex-1 overflow-y-auto">
                {pickerStep === 'books' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {['AT', 'NT'].map(testament => (
                      <div key={testament}>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-4 border-b border-[var(--border-color)] pb-2">
                          {testament === 'AT' ? 'Antiguo Testamento' : 'Nuevo Testamento'}
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {BIBLE_BOOKS.filter(b => b.test === testament).map(book => (
                            <button
                              key={book.id}
                              onClick={() => handleBookClick(book)}
                              className="h-auto min-h-[40px] text-[11px] p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-center whitespace-normal leading-tight transition-colors flex items-center justify-center font-medium"
                            >
                              {book.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pickerStep === 'chapters' && selectedBook && (
                  <div>
                    <h3 className="text-center font-bold text-lg text-[var(--text-primary)] mb-6">
                      {selectedBook.name}
                    </h3>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                      {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(c => (
                        <button
                          key={c}
                          onClick={() => handleChapterClick(c)}
                          className="aspect-square flex items-center justify-center text-sm font-bold bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] hover:bg-[var(--accent-color)] hover:text-white transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pickerStep === 'verses' && selectedBook && selectedChapter && (
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-[var(--text-primary)]">
                        {selectedBook.name} {selectedChapter}
                      </h3>
                      <Button onClick={() => loadReading()} disabled={selectedVerses.length === 0} className="animate-bounce shadow-lg">
                        Leer Selección ({selectedVerses.length}) <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3 overflow-y-auto pb-10">
                      {Array.from({ length: 150 }, (_, i) => i + 1).map(v => (
                        <button
                          key={v}
                          onClick={() => handleVerseToggle(v)}
                          className={`aspect-square flex items-center justify-center text-sm font-bold rounded-lg border transition-all ${selectedVerses.includes(v) ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] scale-105 shadow-md' : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--accent-color)]'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- READING MODE --- */}
          {pickerStep === 'reading' && (
            <div className="flex flex-col h-full space-y-4 animate-fade-in pb-10">

              {/* Header Reference */}
              <div className="flex items-center justify-center py-4 relative">
                <Button variant="ghost" size="icon" className="absolute left-0" onClick={() => setPickerStep('verses')}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-2xl font-serif font-bold text-[var(--text-primary)] text-center">{currentReference}</h2>
              </div>

              {/* Main Text Card */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-8 shadow-sm relative">
                <div className="absolute top-4 right-4 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded border border-[var(--border-color)]">
                  {primaryVersion}
                </div>

                {isLoading && !primaryText ? (
                  <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div></div>
                ) : (
                  <p
                    className="font-reading text-lg md:text-xl leading-relaxed text-[var(--text-primary)] text-justify"
                    style={{ fontSize: textSettings ? `${textSettings.fontSize}px` : undefined, lineHeight: textSettings?.lineHeight }}
                  >
                    {primaryText}
                  </p>
                )}
              </div>

              {/* Comparison Section (Expandable) */}
              <div className="space-y-2">
                <button
                  onClick={toggleComparison}
                  className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors py-2"
                >
                  {isComparing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isComparing ? 'Ocultar Comparación' : 'Comparar Versión'}
                </button>

                {isComparing && (
                  <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl p-6 shadow-inner animate-fade-in relative border-l-4 border-l-[var(--accent-color)]">
                    <div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-2">
                      <span className="text-xs font-bold text-[var(--text-secondary)]">VERSIÓN COMPARATIVA</span>
                      <div className="relative">
                        <select
                          value={comparisonVersion}
                          onChange={handleComparisonVersionChange}
                          className="appearance-none bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-primary)] px-3 py-1 pr-7 rounded-md border border-[var(--border-color)] focus:outline-none"
                        >
                          {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                      </div>
                    </div>

                    {isLoading && !comparisonText ? (
                      <div className="py-8 flex justify-center opacity-50"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--text-primary)]"></div></div>
                    ) : (
                      <p
                        className="font-reading text-base md:text-lg leading-relaxed text-[var(--text-primary)] opacity-90 text-justify italic"
                        style={{ fontSize: textSettings ? `${textSettings.fontSize * 0.9}px` : undefined, lineHeight: textSettings?.lineHeight }}
                      >
                        {comparisonText || "Selecciona una versión diferente para comparar..."}
                      </p>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* --- BROWSE/READING MODE --- */}
          {pickerStep === 'browse' && (
            <div className="flex h-full animate-fade-in gap-4">

              {/* Sidebar - Book Index */}
              <div className={`${browseSidebarOpen ? 'w-64' : 'w-12'} shrink-0 transition-all duration-300 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col`}>
                <button
                  onClick={() => setBrowseSidebarOpen(!browseSidebarOpen)}
                  className="w-full p-3 flex items-center justify-between bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] hover:bg-[var(--accent-color)] hover:text-white transition-colors"
                >
                  <span className={`font-bold text-sm ${browseSidebarOpen ? '' : 'hidden'}`}>📚 Índice</span>
                  {browseSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {browseSidebarOpen && (
                  <>
                    {/* Book Filter */}
                    <div className="p-2 border-b border-[var(--border-color)]">
                      <input
                        type="text"
                        value={browseBookFilter}
                        onChange={(e) => setBrowseBookFilter(e.target.value)}
                        placeholder="Filtrar libros..."
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none"
                      />
                    </div>

                    {/* Book List */}
                    <div className="flex-1 overflow-y-auto">
                      {['AT', 'NT'].map(testament => (
                        <div key={testament} className="p-2">
                          <h4 className="text-[10px] font-bold uppercase text-[var(--text-secondary)] px-2 py-1 bg-[var(--bg-tertiary)] rounded mb-1">
                            {testament === 'AT' ? 'Antiguo Test.' : 'Nuevo Test.'}
                          </h4>
                          {BIBLE_BOOKS
                            .filter(b => b.test === testament)
                            .filter(b => b.name.toLowerCase().includes(browseBookFilter.toLowerCase()))
                            .map(book => (
                              <div key={book.id} className="mb-1">
                                <button
                                  onClick={() => {
                                    if (selectedBook?.id === book.id) {
                                      setSelectedBook(null);
                                    } else {
                                      setSelectedBook(book);
                                    }
                                  }}
                                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${selectedBook?.id === book.id
                                    ? 'bg-[var(--accent-color)] text-white font-bold'
                                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                    }`}
                                >
                                  <span className="truncate">{book.name}</span>
                                  {selectedBook?.id === book.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
                                </button>

                                {/* Chapter List (expanded) */}
                                {selectedBook?.id === book.id && (
                                  <div className="pl-2 mt-1 grid grid-cols-5 gap-1">
                                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map(ch => (
                                      <button
                                        key={ch}
                                        onClick={() => loadBrowseChapter(book, ch)}
                                        className={`text-[10px] py-1 rounded transition-colors ${selectedChapter === ch
                                          ? 'bg-blue-500 text-white font-bold'
                                          : 'bg-[var(--bg-primary)] hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                          }`}
                                      >
                                        {ch}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Main Reading Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chapter Header */}
                {currentReference && (
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      {selectedBook && selectedChapter && selectedChapter > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => loadBrowseChapter(selectedBook, selectedChapter - 1)}>
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </Button>
                      )}
                    </div>
                    <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">{currentReference}</h2>
                    <div className="flex items-center gap-3">
                      {selectedBook && selectedChapter && selectedChapter < selectedBook.chapters && (
                        <Button variant="ghost" size="sm" onClick={() => loadBrowseChapter(selectedBook, selectedChapter + 1)}>
                          Siguiente <ChevronRight className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Reading Content */}
                <div className={`flex-1 overflow-y-auto ${isSplitView ? 'grid grid-cols-2 gap-4' : ''}`}>
                  {/* Primary Text */}
                  <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 h-fit">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-color)]">
                      <span className="text-xs font-bold text-[var(--accent-color)] uppercase">{primaryVersion}</span>
                      {browseChapterText && (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(browseChapterText)} title="Copiar texto">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openCardGenerator(browseChapterText.slice(0, 500), currentReference)}
                            title="Crear imagen para redes sociales"
                            className="bg-pink-500 hover:bg-pink-600 text-white animate-pulse"
                          >
                            <Image className="w-4 h-4" />
                            <span className="ml-1 text-xs font-bold">Redes</span>
                          </Button>
                        </div>
                      )}
                    </div>
                    {isLoading ? (
                      <div className="py-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]" />
                      </div>
                    ) : browseChapterText ? (
                      <p
                        className="font-reading text-base leading-relaxed text-[var(--text-primary)] text-justify whitespace-pre-line"
                        style={{ fontSize: textSettings ? `${textSettings.fontSize}px` : undefined, lineHeight: textSettings?.lineHeight }}
                      >
                        {browseChapterText}
                      </p>
                    ) : (
                      <div className="py-12 text-center text-[var(--text-secondary)]">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">Selecciona un capítulo</p>
                        <p className="text-sm mt-2">Usa el índice de la izquierda para navegar</p>
                      </div>
                    )}
                  </div>

                  {/* Secondary Text (Split View) */}
                  {isSplitView && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6 h-fit">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-200 dark:border-purple-700">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">{comparisonVersion}</span>
                        {browseChapterTextSecondary && (
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(browseChapterTextSecondary)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {isLoading ? (
                        <div className="py-12 flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                        </div>
                      ) : browseChapterTextSecondary ? (
                        <p
                          className="font-reading text-base leading-relaxed text-[var(--text-primary)] text-justify whitespace-pre-line"
                          style={{ fontSize: textSettings ? `${textSettings.fontSize}px` : undefined, lineHeight: textSettings?.lineHeight }}
                        >
                          {browseChapterTextSecondary}
                        </p>
                      ) : (
                        <div className="py-12 text-center text-purple-400">
                          <SplitSquareHorizontal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Selecciona un capítulo para ver la comparación</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Concordance Notes Hint */}
                {browseChapterText && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>💡 Tip:</strong> Usa la sección "Estudio" para obtener concordancias y referencias cruzadas sobre palabras específicas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* VERSE CARD GENERATOR MODAL */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-3">
                <Image className="w-6 h-6 text-pink-500" />
                <h2 className="font-bold text-lg text-[var(--text-primary)]">Crear Imagen para Redes Sociales</h2>
              </div>
              <button onClick={() => setShowCardModal(false)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-6 flex gap-6">
              {/* Left Panel - Options with scroll */}
              <div className="w-72 shrink-0 space-y-4 overflow-y-auto max-h-[70vh] pr-2">
                {/* Size Selector */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Tamaño</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CARD_SIZES) as Array<keyof typeof CARD_SIZES>).map(size => (
                      <button
                        key={size}
                        onClick={() => setCardSize(size)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all ${cardSize === size
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                          : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'
                          }`}
                      >
                        <span className="block font-bold">{CARD_SIZES[size].label}</span>
                        <span className="text-[10px] opacity-70">{CARD_SIZES[size].ratio}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Tema Visual</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(CARD_THEMES) as Array<keyof typeof CARD_THEMES>).map(theme => (
                      <button
                        key={theme}
                        onClick={() => setCardTheme(theme)}
                        className={`p-2 rounded-lg border transition-all ${cardTheme === theme
                          ? 'ring-2 ring-[var(--accent-color)] ring-offset-2'
                          : 'hover:scale-105'
                          }`}
                      >
                        <div className={`w-full h-8 rounded ${CARD_THEMES[theme].bg}`} />
                        <span className="text-[9px] mt-1 block">{CARD_THEMES[theme].name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Brightness Slider */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1">
                      <span>🌙 Oscuro</span>
                      <span>Brillo: {cardBrightness}%</span>
                      <span>☀️ Claro</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={cardBrightness}
                      onChange={(e) => setCardBrightness(Number(e.target.value))}
                      className="w-full h-2 bg-gradient-to-r from-gray-800 via-gray-500 to-white rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Text Editor */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Texto del Versículo</label>
                  <textarea
                    value={cardText}
                    onChange={(e) => setCardText(e.target.value)}
                    className="w-full h-24 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm resize-none focus:border-[var(--accent-color)] outline-none"
                    placeholder="Escribe o pega el versículo aquí..."
                  />

                  {/* Text Position & Size */}
                  <div className="mt-2 space-y-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-8">↔️</span>
                      <input type="range" min="10" max="90" value={textPosition.x} onChange={(e) => setTextPosition(p => ({ ...p, x: Number(e.target.value) }))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-8">↕️</span>
                      <input type="range" min="15" max="85" value={textPosition.y} onChange={(e) => setTextPosition(p => ({ ...p, y: Number(e.target.value) }))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-8">📏</span>
                      <input type="range" min="50" max="150" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                      <span className="text-[9px]">{textSize}%</span>
                    </div>

                    {/* Text Color */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                      <span className="text-[9px] w-8">🎨</span>
                      <div className="flex gap-1 flex-wrap flex-1">
                        {['#ffffff', '#000000', '#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6'].map(color => (
                          <button
                            key={color}
                            onClick={() => setTextColor(color)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${textColor === color ? 'ring-2 ring-offset-1 ring-[var(--accent-color)]' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
                          title="Color personalizado"
                        />
                      </div>
                    </div>

                    {/* Text Background Opacity */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-8" title="Fondo del texto">🔲</span>
                      <input type="range" min="0" max="100" value={textBgOpacity} onChange={(e) => setTextBgOpacity(Number(e.target.value))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                      <span className="text-[9px]">{textBgOpacity}%</span>
                    </div>

                    {/* Text Alignment & Bullets */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                      <span className="text-[9px] w-8">📐</span>
                      <div className="flex gap-1 flex-1">
                        {[
                          { value: 'left', icon: '⬅️', title: 'Izquierda' },
                          { value: 'center', icon: '↔️', title: 'Centro' },
                          { value: 'right', icon: '➡️', title: 'Derecha' },
                          { value: 'justify', icon: '☰', title: 'Justificado' }
                        ].map(align => (
                          <button
                            key={align.value}
                            onClick={() => setTextAlign(align.value as typeof textAlign)}
                            className={`flex-1 py-1 text-xs rounded transition-all ${textAlign === align.value ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-primary)] hover:bg-[var(--accent-color)]/20'}`}
                            title={align.title}
                          >
                            {align.icon}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowBullets(!showBullets)}
                        className={`px-2 py-1 text-xs rounded transition-all ${showBullets ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-primary)] hover:bg-[var(--accent-color)]/20'}`}
                        title="Agregar viñetas"
                      >
                        •••
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reference Editor */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Referencia</label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    className="w-full p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm focus:border-[var(--accent-color)] outline-none"
                    placeholder="Ej: Juan 3:16"
                  />
                </div>

                {/* Background Image Upload */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Imagen de Fondo</label>
                  <input
                    type="file"
                    ref={bgImageInputRef}
                    accept="image/*"
                    onChange={handleBgImageUpload}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bgImageInputRef.current?.click()}
                      className="flex-1 text-xs"
                    >
                      📷 Subir Imagen
                    </Button>
                    {cardBgImage && (
                      <Button variant="ghost" size="sm" onClick={clearCardBg} className="text-red-500">
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {cardBgImage && (
                    <div className="mt-2 relative rounded-lg overflow-hidden h-16">
                      <img src={cardBgImage} alt="Fondo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                        ✓ Imagen cargada
                      </div>
                    </div>
                  )}
                </div>

                {/* Christian Icons */}
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2 block">Icono Decorativo</label>
                  <div className="grid grid-cols-6 gap-1 max-h-20 overflow-y-auto p-1 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                    <button
                      onClick={() => setSelectedIcon(null)}
                      className={`p-1 rounded text-lg transition-all ${!selectedIcon ? 'bg-[var(--accent-color)] ring-2 ring-[var(--accent-color)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
                      title="Sin icono"
                    >
                      ∅
                    </button>
                    {CHRISTIAN_ICONS.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedIcon(item.icon)}
                        className={`p-1 rounded text-lg transition-all ${selectedIcon === item.icon ? 'bg-[var(--accent-color)] ring-2 ring-[var(--accent-color)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
                        title={item.name}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>

                  {/* Icon Position & Size Sliders */}
                  {selectedIcon && (
                    <div className="mt-2 space-y-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] w-8">↔️</span>
                        <input type="range" min="5" max="95" value={iconPos.x} onChange={(e) => setIconPos(p => ({ ...p, x: Number(e.target.value) }))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] w-8">↕️</span>
                        <input type="range" min="5" max="95" value={iconPos.y} onChange={(e) => setIconPos(p => ({ ...p, y: Number(e.target.value) }))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] w-8">📏</span>
                        <input type="range" min="30" max="200" value={iconSize} onChange={(e) => setIconSize(Number(e.target.value))} className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-color)]" />
                        <span className="text-[9px]">{iconSize}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Download Button */}
                <Button onClick={downloadCard} className="w-full" disabled={!cardText.trim()}>
                  <Download className="w-4 h-4 mr-2" /> Descargar Imagen
                </Button>
              </div>

              {/* Right Panel - Preview */}
              <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] rounded-xl p-4 overflow-auto">
                <div
                  ref={cardCanvasRef}
                  className={`${!cardBgImage ? CARD_THEMES[cardTheme].bg : ''} shadow-2xl relative overflow-hidden`}
                  style={{
                    width: cardSize === 'story' ? '270px' : cardSize === 'presentation' || cardSize === 'twitter' ? '400px' : '300px',
                    height: cardSize === 'story' ? '480px' : cardSize === 'facebook' ? '158px' : cardSize === 'twitter' ? '225px' : cardSize === 'presentation' ? '225px' : '300px',
                    aspectRatio: `${CARD_SIZES[cardSize].width} / ${CARD_SIZES[cardSize].height}`
                  }}
                >
                  {/* Background Image */}
                  {cardBgImage && (
                    <img
                      src={cardBgImage}
                      alt="Background"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Brightness Overlay */}
                  <div
                    className="absolute inset-0 z-[1]"
                    style={{
                      backgroundColor: cardBrightness < 50
                        ? `rgba(0,0,0,${(50 - cardBrightness) / 50 * 0.7})`
                        : `rgba(255,255,255,${(cardBrightness - 50) / 50 * 0.5})`
                    }}
                  />

                  {/* Visual Positioning Grid - helps see where elements will be placed (hidden in export) */}
                  <div className="absolute inset-0 z-[2] pointer-events-none" data-html2canvas-ignore="true">
                    {/* Center crosshair */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                    {/* Thirds grid */}
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
                    {/* Safe area corners */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-white/30" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-white/30" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-white/30" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-white/30" />
                  </div>

                  {/* Movable Icon */}
                  {selectedIcon && (
                    <div
                      className="absolute z-20 transition-all"
                      style={{
                        left: `${iconPos.x}%`,
                        top: `${iconPos.y}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${iconSize / 100 * 3}rem`
                      }}
                    >
                      {selectedIcon}
                    </div>
                  )}

                  {/* Movable Text Container */}
                  <div
                    className="absolute z-10 px-2"
                    style={{
                      left: `${textPosition.x}%`,
                      top: `${textPosition.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '85%',
                      maxWidth: '85%',
                      backgroundColor: textBgOpacity > 0 ? `rgba(0,0,0,${textBgOpacity / 100})` : undefined,
                      padding: textBgOpacity > 0 ? '0.75rem 1rem' : '0.5rem',
                      borderRadius: textBgOpacity > 0 ? '0.5rem' : undefined,
                      textAlign: textAlign
                    }}
                  >
                    {/* Decorative Quote */}
                    {!showBullets && (
                      <div
                        style={{ fontSize: `${textSize / 100 * 2}rem`, opacity: 0.15, color: textColor, textAlign: 'center', lineHeight: 1 }}
                      >
                        "
                      </div>
                    )}

                    {/* Verse Text */}
                    <div
                      className="font-serif"
                      style={{
                        fontSize: `${textSize / 100 * (cardText.length > 300 ? 0.8 : cardText.length > 150 ? 1 : 1.2)}rem`,
                        lineHeight: 1.4,
                        color: textColor,
                        textShadow: cardBgImage || cardBrightness < 50 || textBgOpacity > 0 ? '0 1px 3px rgba(0,0,0,0.6)' : undefined
                      }}
                    >
                      {showBullets ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {(cardText || 'Tu versículo aparecerá aquí...').split('\n').filter(line => line.trim()).map((line, i) => (
                            <li key={i} style={{ marginBottom: '0.25rem' }}>
                              <span style={{ marginRight: '0.5rem' }}>•</span>
                              {line.trim()}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        cardText || 'Tu versículo aparecerá aquí...'
                      )}
                    </div>

                    {/* Reference */}
                    <p
                      className="mt-2 font-bold uppercase tracking-wider"
                      style={{
                        fontSize: `${textSize / 100 * 0.75}rem`,
                        color: textColor,
                        textShadow: cardBgImage || cardBrightness < 50 || textBgOpacity > 0 ? '0 2px 4px rgba(0,0,0,0.5)' : undefined,
                        textAlign: 'center'
                      }}
                    >
                      — {cardRef || 'Referencia'} —
                    </p>
                  </div>

                  {/* Watermark */}
                  <p className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] opacity-40 z-10 ${cardBgImage || cardBrightness < 50 ? 'text-white' : CARD_THEMES[cardTheme].text}`}>
                    Púlpito Dinámico
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
