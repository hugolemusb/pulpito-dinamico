
import React, { useState, useEffect, useRef } from 'react';
import { Sermon, SermonSection, SectionType, ChatMessage, Theme, TimerState, TextSettings, Language, MarginNote } from '../types';
import { Button } from './Button';
import { ContextMenu } from './ContextMenu';
import { chatWithAdvisor, getSectionHelper, getCrossReferences, generateFullSermonStructure, translateForImageSearch, extractVisualKeywords, searchVersesByTheme } from '../services/geminiService';
import { fetchVerseText, getBibleVersions, BIBLE_BOOKS } from '../services/bibleService';
import { speakText, stopAudio, stripHtmlForAudio, splitTextIntoChunks, isSpeaking } from '../services/audioService';
import { useTranslation } from '../context/LanguageContext';
import { ArrowRight, ChevronLeft, ChevronRight, Save, Download, FileText, FileType, MonitorPlay, Mic, Play, Pause, SkipBack, SkipForward, Square, RotateCcw, Plus, Trash2, X, Settings, Image as ImageIcon, Wand2, Sparkles, AlertTriangle, Info, Check, Cloud, Upload, LayoutTemplate, Printer, Share2, Calendar as CalendarIcon, FolderOpen, PanelLeft, PanelRight, Headphones, Circle, Triangle, Star, Church, Loader2, Send, Search, Presentation, BookOpen, MessageCircle, GripVertical, Clock, FilePlus, RefreshCw, Bold, Italic, Underline, List, ListOrdered, HardDrive, ChevronDown } from 'lucide-react';

interface SermonEditorProps {
  theme: Theme;
  timerState: TimerState;
  onToggleTimer: () => void;
  onResetTimer: (duration: number) => void;
  onResetTimerOnly: () => void;
  initialSermonData?: Sermon | null;
  textSettings: TextSettings;
  onOpenTeleprompter?: () => void;
}

const SPEAKER_PREFIXES = ['Sr.', 'Sra.', 'Ps.', 'Psra.', 'Hno.', 'Hna.', 'Guía', 'Líder', 'Diácono', 'Rev.', 'Ob.'];

const IMAGE_FILTERS = {
  normal: { label: 'Normal', style: '' },
  bw: { label: 'B/N', style: 'grayscale(100%)' },
  sepia: { label: 'Antiguo', style: 'sepia(80%)' },
  vivid: { label: 'Vívido', style: 'saturate(160%) contrast(110%)' },
  dramatic: { label: 'Dramático', style: 'contrast(130%) brightness(90%)' },
};




const createFreshSermon = (t: (key: string) => string): Sermon => {
  const timestamp = Date.now();
  return {
    id: timestamp.toString(),
    title: 'Nuevo Sermón',
    speaker: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    eventName: '',
    mainVerse: '',
    mainVerseVersion: 'RVR1960',
    mainVerseText: '',
    bibleNotes: '',
    announcements: '',
    sections: [
      { id: `${timestamp}-1`, type: SectionType.LECTURA, title: t('structure.reading'), durationMin: 5, content: '', baseVerse: '' },
      { id: `${timestamp}-2`, type: SectionType.DESARROLLO, title: t('structure.development'), durationMin: 30, content: '' },
      { id: `${timestamp}-3`, type: SectionType.LLAMADO, title: t('structure.call'), durationMin: 10, content: '' },
      { id: `${timestamp}-4`, type: SectionType.CIERRE, title: t('structure.conclusion'), durationMin: 5, content: '' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const SermonEditor: React.FC<SermonEditorProps> = ({
  theme,
  timerState,
  onToggleTimer,
  onResetTimer,
  onResetTimerOnly,
  initialSermonData,
  textSettings,
  onOpenTeleprompter
}) => {
  const { t, language } = useTranslation();
  console.log("DEBUG: SermonEditor Mounting/Rendering...");

  // --- ESTADO PRINCIPAL ---
  const [sermon, setSermon] = useState<Sermon>(() => {
    if (initialSermonData) return initialSermonData;
    try {
      const saved = localStorage.getItem('current_sermon');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validar integridad básica para evitar crash
        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error loading saved sermon, resetting:", e);
    }
    return createFreshSermon(t);
  });

  const [activeSectionId, setActiveSectionId] = useState<string>(() => {
    return sermon.sections.length > 0 ? sermon.sections[0].id : '';
  });

  const [editorVersion, setEditorVersion] = useState(0);

  const [lastGeneratedVerse, setLastGeneratedVerse] = useState<string>(sermon.mainVerse || '');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false); // RESTORED: Estado para la tarjeta de bienvenida
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'bible' | 'advisor' | 'visual' | 'avisos'>('bible');
  const [currentTotalDuration, setCurrentTotalDuration] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [crossRefs, setCrossRefs] = useState<{ ref: string, text: string }[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);

  const [overlayText, setOverlayText] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(60);
  const [visualTextSize, setVisualTextSize] = useState(24);
  const [visualBgColor, setVisualBgColor] = useState<string>('#000000');
  const [imageFilter, setImageFilter] = useState<string>('');
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  const [placedIcons, setPlacedIcons] = useState<{ id: string, emoji: string }[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isVerseLoading, setIsVerseLoading] = useState(false);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [isRegeneratingSection, setIsRegeneratingSection] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewingVerse, setViewingVerse] = useState<{ ref: string, text: string } | null>(null);
  const [isLoadingVerseText, setIsLoadingVerseText] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showStorageDialog, setShowStorageDialog] = useState(false);

  // VERSE PICKER STATE
  const [versePickerStep, setVersePickerStep] = useState<'none' | 'books' | 'chapters' | 'verses'>('none');
  const [tempSelectedBook, setTempSelectedBook] = useState<typeof BIBLE_BOOKS[0] | null>(null);
  const [tempSelectedChapter, setTempSelectedChapter] = useState<number | null>(null);
  const [tempSelectedVerses, setTempSelectedVerses] = useState<number[]>([]);

  // THEME-BASED VERSE SEARCH STATE
  const [themeSearch, setThemeSearch] = useState('');
  const [suggestedVerses, setSuggestedVerses] = useState<{ ref: string; text: string; relevance: string }[]>([]);
  const [isSearchingTheme, setIsSearchingTheme] = useState(false);

  const [audioPlayer, setAudioPlayer] = useState<{
    isPlaying: boolean;
    chunks: string[];
    currentIndex: number;
    showControls: boolean;
  }>({
    isPlaying: false,
    chunks: [],
    currentIndex: 0,
    showControls: false
  });

  // CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    selectedText: string;
    position: { x: number; y: number };
  }>({ show: false, selectedText: '', position: { x: 0, y: 0 } });

  const sermonRef = useRef(sermon);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const announcementsRef = useRef<HTMLDivElement>(null);

  // Safe Active Section Retrieval with fallback
  const activeSection = sermon.sections.find(s => s.id === activeSectionId) || sermon.sections[0] || {
    id: 'fallback', type: SectionType.EXTRA, title: 'Sección', durationMin: 5, content: ''
  };

  const bibleVersions = getBibleVersions(language);

  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null);
  const minSwipeDistance = 100;

  useEffect(() => { sermonRef.current = sermon; }, [sermon]);

  // RESTORED: Manejo inicial del Onboarding (Banner de configuración)
  useEffect(() => {
    // Mostrar si no hay versículo base, independientemente del título
    if (!sermon.mainVerse) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [sermon.mainVerse]);

  // --- AUDIO & TIMER ---
  const playTimerSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) { console.error("Audio playback failed", e); }
  };

  useEffect(() => {
    if (timerState.timeLeft === 0 && timerState.isRunning) { playTimerSound(); }
  }, [timerState.timeLeft, timerState.isRunning]);

  useEffect(() => {
    if (audioPlayer.isPlaying && audioPlayer.chunks.length > 0 && audioPlayer.currentIndex < audioPlayer.chunks.length) {
      const textToSpeak = audioPlayer.chunks[audioPlayer.currentIndex];
      speakText(
        textToSpeak,
        language,
        () => {
          setAudioPlayer(prev => {
            if (prev.currentIndex < prev.chunks.length - 1) {
              return { ...prev, currentIndex: prev.currentIndex + 1 };
            } else {
              return { ...prev, isPlaying: false, currentIndex: 0 };
            }
          });
        },
        () => { setAudioPlayer(prev => ({ ...prev, isPlaying: false })); }
      );
    } else if (!audioPlayer.isPlaying) { stopAudio(); }
  }, [audioPlayer.currentIndex, audioPlayer.isPlaying, audioPlayer.chunks]);

  // --- PERSISTENCIA ---
  useEffect(() => {
    const saveToStorage = () => {
      const current = sermonRef.current;
      localStorage.setItem('current_sermon', JSON.stringify(current));

      const isWorthyOfHistory = current.title !== 'Nuevo Sermón' || current.sections.some(s => s.content.length > 20);
      if (isWorthyOfHistory) {
        const historyJson = localStorage.getItem('sermon_history');
        let history: Sermon[] = historyJson ? JSON.parse(historyJson) : [];
        history = history.filter(s => s.id !== current.id);
        history.unshift({ ...current, updatedAt: Date.now() });
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem('sermon_history', JSON.stringify(history));
      }
      setLastSaved(new Date());
    };
    const intervalId = setInterval(saveToStorage, 30000);
    const handleBeforeUnload = () => saveToStorage();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { clearInterval(intervalId); window.removeEventListener('beforeunload', handleBeforeUnload); saveToStorage(); };
  }, []);

  useEffect(() => {
    if (initialSermonData) {
      setSermon(initialSermonData);
      setLastGeneratedVerse(initialSermonData.mainVerse);
      setActiveSectionId(initialSermonData.sections[0].id);
      setEditorVersion(prev => prev + 1);
    }
  }, [initialSermonData]);

  useEffect(() => {
    const total = sermon.sections.reduce((acc, curr) => acc + curr.durationMin, 0);
    const totalSeconds = total * 60;
    setCurrentTotalDuration(totalSeconds);
    // Siempre sincronizar el timer con la duración total cuando no está corriendo
    if (!timerState.isRunning && totalSeconds > 0) {
      onResetTimer(totalSeconds);
    }
  }, [sermon.sections]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, rightSidebarOpen]);

  useEffect(() => {
    if (sermon.mainVerse && rightTab === 'bible' && crossRefs.length === 0) { loadCrossRefs(); }
  }, [sermon.mainVerse, rightTab]);

  useEffect(() => {
    if (contentEditableRef.current) {
      if (contentEditableRef.current.innerHTML !== activeSection.content) {
        contentEditableRef.current.innerHTML = activeSection.content || '';
      }
    }
  }, [activeSectionId, editorVersion]);

  useEffect(() => {
    if (announcementsRef.current && rightTab === 'avisos') {
      if (announcementsRef.current.innerHTML !== (sermon.announcements || '')) {
        announcementsRef.current.innerHTML = sermon.announcements || '';
      }
    }
  }, [rightTab, sermon.id]);

  useEffect(() => {
    setAudioPlayer({ isPlaying: false, chunks: [], currentIndex: 0, showControls: false });
    stopAudio();
  }, [activeSectionId]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    const xDistance = touchStart.x - touchEnd.x;
    const yDistance = touchStart.y - touchEnd.y;
    if (Math.abs(yDistance) > 30) return;
    const isLeftSwipe = xDistance > minSwipeDistance;
    const isRightSwipe = xDistance < -minSwipeDistance;
    const currentIndex = sermon.sections.findIndex(s => s.id === activeSectionId);
    if (isLeftSwipe && currentIndex < sermon.sections.length - 1) setActiveSectionId(sermon.sections[currentIndex + 1].id);
    else if (isRightSwipe && currentIndex > 0) setActiveSectionId(sermon.sections[currentIndex - 1].id);
  };

  const handleUpdateSection = (id: string, updates: Partial<SermonSection>) => {
    setSermon(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, ...updates } : s) }));
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    if (html === '<br>') return;
    handleUpdateSection(activeSectionId, { content: html });
  };

  // CONTEXT MENU HANDLERS
  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 1) {
      setTimeout(() => {
        const text = window.getSelection()?.toString().trim();
        if (text && text.length > 1) {
          setContextMenu({
            show: true,
            selectedText: text,
            position: { x: e.clientX, y: e.clientY }
          });
        }
      }, 100);
    }
  };

  const handleAddMarginNote = (note: Omit<MarginNote, 'id' | 'createdAt'>) => {
    const newNote: MarginNote = {
      ...note,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    setSermon(prev => ({
      ...prev,
      marginNotes: [...(prev.marginNotes || []), newNote]
    }));
    alert(`✓ Nota agregada: "${note.noteText.substring(0, 50)}..."`);
  };

  const handleInsertFromContextMenu = (content: string) => {
    const current = activeSection.content || '';
    handleUpdateSection(activeSectionId, { content: current + '<br/>' + content });
    setEditorVersion(prev => prev + 1);
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  // MARGIN NOTES MANAGEMENT
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const handleEditNote = (noteId: string) => {
    const note = (sermon.marginNotes || []).find(n => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditingNoteText(note.noteText);
    }
  };

  const handleSaveEditNote = () => {
    if (!editingNoteId) return;
    setSermon(prev => ({
      ...prev,
      marginNotes: (prev.marginNotes || []).map(n =>
        n.id === editingNoteId ? { ...n, noteText: editingNoteText } : n
      )
    }));
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = (noteId: string) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    setSermon(prev => ({
      ...prev,
      marginNotes: (prev.marginNotes || []).filter(n => n.id !== noteId)
    }));
  };

  // Get notes for current section
  const currentSectionNotes = (sermon.marginNotes || []).filter(n => n.sectionId === activeSectionId);

  const handleRegenerateSection = async () => {
    if (activeSection.content && activeSection.content.length > 50) {
      if (!window.confirm("¿Deseas que la IA reescriba esta sección? Se reemplazará el texto actual.")) return;
    }

    setIsRegeneratingSection(true);
    try {
      let context = `Título del Sermón: "${sermon.title || 'Tema General Cristiano'}". `;
      if (sermon.mainVerse) context += `Versículo Base: ${sermon.mainVerse}. `;
      if (sermon.mainVerseText) context += `Texto Bíblico: "${sermon.mainVerseText.substring(0, 200)}...". `;
      else context += `Nota: Genera contenido bíblico relevante aunque no haya un versículo explícito configurado. `;
      context += `Sección Actual: "${activeSection.title}" (${t('structure.type.' + activeSection.type)}). `;
      if (activeSection.content.length > 20) context += `\n[NOTA IMPORTANTE]: Esta es una sección de un sermón GUARDADO/EXISTENTE. El usuario quiere MEJORARLO o REESCRIBIRLO con nuevas ideas, no inventar algo desconectado. Usa el contenido actual como borrador base pero sé creativo.`;

      const newContent = await getSectionHelper(activeSection.type, activeSection.content, context, true);

      if (newContent) {
        handleUpdateSection(activeSectionId, { content: newContent });
        setEditorVersion(prev => prev + 1);
      } else {
        throw new Error("La IA no devolvió contenido válido.");
      }
    } catch (e: any) {
      alert("Error al regenerar: " + (e.message || "Error desconocido"));
    } finally {
      setIsRegeneratingSection(false);
    }
  };

  const handleAnnouncementsChange = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    setSermon(prev => ({ ...prev, announcements: html }));
  };

  const execAnnouncementsCmd = (command: string, value?: string) => {
    if (announcementsRef.current) {
      announcementsRef.current.focus();
      document.execCommand(command, false, value);
    }
  };

  const handleAddSection = () => {
    const newSection: SermonSection = { id: Date.now().toString(), type: SectionType.EXTRA, title: t('editor.add_section'), durationMin: 5, content: '' };
    setSermon(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
  };

  const handleDeleteSection = (id: string) => {
    if (sermon.sections.length <= 1) return;
    const newSections = sermon.sections.filter(s => s.id !== id);
    setSermon(prev => ({ ...prev, sections: newSections }));
    if (activeSectionId === id) setActiveSectionId(newSections[0].id);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    setIsChatLoading(true);
    const response = await chatWithAdvisor(chatHistory.map(m => ({ role: m.role, content: m.content })), chatInput);
    const newAiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', content: response, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newAiMsg]);
    setIsChatLoading(false);
  };

  const handleInsertAdvisorContent = (content: string) => {
    // Strip HTML tags from AI response
    const temp = document.createElement('div');
    temp.innerHTML = content;
    const strippedContent = temp.textContent || temp.innerText || '';

    // Create new EXTRA section with advisor content
    const newSection: SermonSection = {
      id: Date.now().toString(),
      type: SectionType.EXTRA,
      title: 'Sección del Asistente',
      durationMin: 5,
      content: strippedContent
    };

    setSermon(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));

    // Switch to the new section
    setActiveSectionId(newSection.id);

    // Recalculate timer
    const total = [...sermon.sections, newSection].reduce((acc, s) => acc + s.durationMin, 0);
    onResetTimer(total * 60);

    // Notify user
    alert('Contenido insertado como nueva sección');
  };

  // ... (REST OF THE LOGIC REMAINS THE SAME - VERSE PICKER, ETC) ...
  // --- VERSE PICKER LOGIC ---
  const handleOpenVersePicker = () => {
    setVersePickerStep('books');
    setTempSelectedBook(null);
    setTempSelectedChapter(null);
    setTempSelectedVerses([]);
  };

  const handleVersePickerBookClick = (book: typeof BIBLE_BOOKS[0]) => {
    setTempSelectedBook(book);
    setVersePickerStep('chapters');
  };

  const handleVersePickerChapterClick = (chapter: number) => {
    setTempSelectedChapter(chapter);
    setVersePickerStep('verses');
  };

  const handleVersePickerVerseToggle = (verse: number) => {
    setTempSelectedVerses(prev => {
      if (prev.includes(verse)) {
        return prev.filter(v => v !== verse);
      } else {
        return [...prev, verse].sort((a, b) => a - b);
      }
    });
  };

  const handleConfirmVerseSelection = async () => {
    if (!tempSelectedBook || !tempSelectedChapter || tempSelectedVerses.length === 0) return;
    let verseString = "";
    if (tempSelectedVerses.length === 1) {
      verseString = tempSelectedVerses[0].toString();
    } else {
      const min = Math.min(...tempSelectedVerses);
      const max = Math.max(...tempSelectedVerses);
      const isContinuous = (max - min + 1) === tempSelectedVerses.length;
      if (isContinuous) verseString = `${min}-${max}`;
      else verseString = tempSelectedVerses.join(',');
    }
    // Priorizar nombre directo, fallback a traducción
    const bookName = tempSelectedBook.name || t(`bible.${tempSelectedBook.id}`);
    const finalRef = `${bookName} ${tempSelectedChapter}:${verseString}`;

    // Default version safely
    const currentVersion = sermon.mainVerseVersion || bibleVersions?.[0]?.id || 'RVR1960';

    setSermon(prev => ({ ...prev, mainVerse: finalRef, mainVerseVersion: currentVersion }));
    setVersePickerStep('none');

    // Iniciar carga
    setIsVerseLoading(true);
    try {
      // Force fetch to ensure we get text
      const text = await fetchVerseText(finalRef, currentVersion);
      if (text) {
        setSermon(prev => ({ ...prev, mainVerseText: text }));
      } else {
        // Fallback simple si falla
        setSermon(prev => ({ ...prev, mainVerseText: "No se pudo cargar el texto. Por favor intente refrescar." }));
      }
    } catch (e: any) {
      console.error("Error fetching verse:", e);
      // Fallback al editor manual si falla
      setSermon(prev => ({ ...prev, mainVerseText: "Error al cargar texto. Puedes escribirlo manualmente." }));
      alert("Error al cargar texto: " + (e.message || "Desconocido"));
    } finally {
      setIsVerseLoading(false);
    }
  };

  const handleVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVersion = e.target.value;
    setSermon(prev => ({ ...prev, mainVerseVersion: newVersion }));

    if (sermon.mainVerse) {
      setIsVerseLoading(true);
      try {
        const text = await fetchVerseText(sermon.mainVerse, newVersion, true);
        setSermon(prev => ({ ...prev, mainVerseText: text }));
      } catch (err: any) {
        console.error("Error changing version:", err);
        alert(err.message || "Error al cambiar versión");
        // No borramos el texto anterior si falla, para que el usuario no pierda contexto
      } finally {
        setIsVerseLoading(false);
      }
    }
  };

  const handleRegenerateVerseText = async () => {
    if (!sermon.mainVerse) return;
    setIsVerseLoading(true);
    try {
      const text = await fetchVerseText(sermon.mainVerse, sermon.mainVerseVersion || bibleVersions[0].id, true);
      setSermon(prev => ({ ...prev, mainVerseText: text }));
    } catch (e: any) { alert(e.message || "Error al refrescar"); } finally { setIsVerseLoading(false); }
  };

  const handleDeleteVerse = () => {
    setSermon(prev => ({ ...prev, mainVerse: '', mainVerseText: '', theme: '' }));
    setVersePickerStep('books');
    setThemeSearch('');
    setSuggestedVerses([]);
  };

  // THEME-BASED VERSE SEARCH HANDLERS
  const handleSearchByTheme = async () => {
    if (!themeSearch.trim()) return;
    setIsSearchingTheme(true);
    setSuggestedVerses([]);
    try {
      const results = await searchVersesByTheme(themeSearch.trim());
      setSuggestedVerses(results);
    } catch (e: any) {
      alert(e.message || 'Error al buscar versículos');
    } finally {
      setIsSearchingTheme(false);
    }
  };

  const handleSelectSuggestedVerse = async (verse: { ref: string; text: string }) => {
    setSermon(prev => ({ ...prev, mainVerse: verse.ref, theme: themeSearch.trim() }));
    setIsVerseLoading(true);
    try {
      const fullText = await fetchVerseText(verse.ref, sermon.mainVerseVersion || bibleVersions[0].id);
      setSermon(prev => ({ ...prev, mainVerseText: fullText }));
    } catch (e: any) {
      console.warn("Could not fetch full text, using preview snippet:", e);
      // Si falla usar el texto sugerido (snippet)
      setSermon(prev => ({ ...prev, mainVerseText: verse.text }));
    } finally {
      setIsVerseLoading(false);
      setSuggestedVerses([]);
      setThemeSearch('');
    }
  };

  const handleViewReference = async (ref: string) => {
    setIsLoadingVerseText(true);
    try {
      const text = await fetchVerseText(ref, sermon.mainVerseVersion || 'RVR1960');
      setViewingVerse({ ref, text });
    } catch (e) { alert("Error al cargar versículo"); } finally { setIsLoadingVerseText(false); }
  };

  const handleSaveConfig = async () => {
    let aiSuccess = true;
    if (sermon.mainVerse && sermon.mainVerseText) {
      setIsGeneratingStructure(true);
      try {
        const structure = await generateFullSermonStructure(sermon.mainVerse, sermon.mainVerseText, true);
        if (structure) {
          const ts = Date.now();
          // RECONSTRUCCIÓN COMPLETA DE LA ESTRUCTURA BASE
          // Esto garantiza que si el usuario borró secciones, vuelvan a aparecer al generar nuevo sermón.
          const newBaseSections: SermonSection[] = [
            {
              id: `${ts}-1`,
              type: SectionType.LECTURA,
              title: t('structure.reading'),
              durationMin: 5,
              content: structure.reading || '',
              baseVerse: sermon.mainVerse
            },
            {
              id: `${ts}-2`,
              type: SectionType.DESARROLLO,
              title: t('structure.development'),
              durationMin: 30,
              content: structure.development || ''
            },
            {
              id: `${ts}-3`,
              type: SectionType.LLAMADO,
              title: t('structure.call'),
              durationMin: 10,
              content: structure.call || ''
            },
            {
              id: `${ts}-4`,
              type: SectionType.CIERRE,
              title: t('structure.conclusion'),
              durationMin: 5,
              content: structure.conclusion || ''
            }
          ];

          // Preservar secciones EXTRA si existen
          const existingExtras = sermon.sections.filter(s => s.type === SectionType.EXTRA);

          setSermon(prev => ({
            ...prev,
            sections: [...newBaseSections, ...existingExtras]
          }));

          setLastGeneratedVerse(sermon.mainVerse);
          setEditorVersion(prev => prev + 1);

          // Resetear sección activa a la primera para evitar errores de referencia
          setActiveSectionId(`${ts}-1`);
        }
      } catch (error: any) { aiSuccess = false; alert(error.message); } finally { setIsGeneratingStructure(false); }
    }
    if (aiSuccess) {
      setShowConfigModal(false);
      setShowOnboarding(false); // Hide onboarding after successful save
    }
  };

  const loadCrossRefs = async (force: boolean = false) => {
    if (!sermon.mainVerse) return;
    setIsLoadingRefs(true);
    try {
      const refs = await getCrossReferences(sermon.mainVerse, force);
      setCrossRefs(refs);
    } catch (e: any) {
      if (e.message && e.message.includes("Cuota")) { setCrossRefs([{ ref: "Error", text: e.message }]); } else { setCrossRefs([]); }
    } finally { setIsLoadingRefs(false); }
  };

  /* REMOVED: Visual Search Logic */
  const handleVisualSearch = async (overrideQuery?: string) => { console.log("Feature disabled"); };

  const handleSuggestImages = async () => { console.log("Feature disabled"); };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { console.log("Feature disabled"); };

  const handlePasteVerse = () => {
    if (sermon.mainVerseText) {
      setOverlayText(`"${sermon.mainVerseText}"\n${sermon.mainVerse}`);
    } else if (sermon.mainVerse) {
      setOverlayText(sermon.mainVerse);
    }
  };

  const addIconToCanvas = (emoji: string) => { setPlacedIcons(prev => [...prev, { id: Date.now().toString(), emoji }]); };
  const removeIcon = (id: string) => { setPlacedIcons(prev => prev.filter(i => i.id !== id)); };

  const downloadImage = async () => {
    const element = previewRef.current;
    if (!element) return;
    try {
      if (!(window as any).html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const html2canvas = (window as any).html2canvas;
      const canvas = await html2canvas(element, { useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
      const link = document.createElement('a');
      link.download = `pulpito-imagen-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { console.error(e); alert("Error"); }
  };

  const formatTime = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60);
    const s = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!timerState.isRunning) return 'text-[var(--text-secondary)] opacity-40 font-normal';
    if (timerState.timeLeft < 0) return 'text-red-500 animate-pulse font-bold';
    if (timerState.timeLeft <= 180) return 'text-yellow-500 font-bold';
    return 'text-[var(--text-primary)] font-bold';
  };

  const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    temp.querySelectorAll('p').forEach(p => p.after('\n\n'));
    return temp.textContent || temp.innerText || "";
  };

  const toggleAudioPlayer = () => {
    if (audioPlayer.showControls) {
      stopAudio();
      setAudioPlayer(prev => ({ ...prev, isPlaying: false, showControls: false }));
    } else {
      const fullText = stripHtmlForAudio(activeSection.content);
      const chunks = splitTextIntoChunks(fullText);
      const title = `Sección: ${activeSection.title}.`;
      setAudioPlayer({
        isPlaying: true,
        chunks: [title, ...chunks],
        currentIndex: 0,
        showControls: true
      });
    }
  };

  const handleAudioPlayPause = () => {
    if (audioPlayer.isPlaying) {
      stopAudio();
      setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
    } else {
      setAudioPlayer(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const handleAudioNext = () => {
    if (audioPlayer.currentIndex < audioPlayer.chunks.length - 1) {
      stopAudio();
      setAudioPlayer(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, isPlaying: true }));
    }
  };

  const handleAudioPrev = () => {
    if (audioPlayer.currentIndex > 0) {
      stopAudio();
      setAudioPlayer(prev => ({ ...prev, currentIndex: prev.currentIndex - 1, isPlaying: true }));
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);
    stopAudio();
    setAudioPlayer(prev => ({ ...prev, currentIndex: newIndex, isPlaying: true }));
  };

  const handleSaveToLibrary = () => {
    const current = sermonRef.current;
    const historyJson = localStorage.getItem('sermon_history');
    let history: Sermon[] = historyJson ? JSON.parse(historyJson) : [];
    history = history.filter(s => s.id !== current.id);
    history.unshift({ ...current, updatedAt: Date.now() });
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('sermon_history', JSON.stringify(history));
    setLastSaved(new Date());
    alert("Sermón guardado en biblioteca local.");
  };

  const handleSaveToCalendar = () => {
    const current = sermonRef.current;
    // Create calendar event from sermon data
    const calendarEvent = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      endTime: '11:30',
      title: current.title || 'Sermón Sin Título',
      type: 'sermon' as const,
      speaker: current.speaker || '',
      location: current.location || '',
      mainVerse: current.mainVerse || '',
      notes: current.sections.map(s => s.title).join(', '),
      sermonId: current.id,
      sermonFile: JSON.stringify(current), // Store sermon data
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Get existing events and add new one
    const eventsJson = localStorage.getItem('calendar_events');
    let events = eventsJson ? JSON.parse(eventsJson) : [];
    events.push(calendarEvent);
    localStorage.setItem('calendar_events', JSON.stringify(events));

    alert('¡Sermón agregado al calendario! Puedes editarlo desde la vista de Calendario.');
  };

  const handleShowStorageDialog = () => {
    setShowStorageDialog(true);
  };

  const handleSaveToCloud = async (cloudType: 'onedrive' | 'gdrive' | 'icloud') => {
    alert(`La integración con ${cloudType === 'gdrive' ? 'Google Drive' : cloudType === 'onedrive' ? 'OneDrive' : 'iCloud'} estará disponible próximamente. Por ahora, usa la opción de guardar local.`);
    setShowStorageDialog(false);
  };

  const handleSaveToLocalFile = () => {
    const current = sermonRef.current;
    const projectData = {
      meta: { type: 'pulpito_project', version: '7.0', createdAt: Date.now() },
      data: current
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${current.title || 'sermon'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setShowStorageDialog(false);
  };

  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let loadedSermon: Sermon | null = null;
        if (json.meta && json.meta.type === "pulpito_project" && json.data) { loadedSermon = json.data; }
        else if (json.sections && Array.isArray(json.sections)) { loadedSermon = json; }

        if (loadedSermon && Array.isArray(loadedSermon.sections)) {
          // Basic validation to prevent crashes
          if (loadedSermon.sections.length === 0) {
            loadedSermon.sections = [{ id: 'default', type: SectionType.EXTRA, title: 'Sección 1', durationMin: 5, content: '' }];
          }

          setSermon(loadedSermon);
          setLastGeneratedVerse(loadedSermon.mainVerse || '');
          setCrossRefs([]);

          if (json.editorState) {
            if (json.editorState.crossRefs && Array.isArray(json.editorState.crossRefs)) { setCrossRefs(json.editorState.crossRefs); }
            const vis = json.editorState.visual;
            if (vis) {
              if (vis.selectedImage) setSelectedImage(vis.selectedImage);
              if (vis.overlayText !== undefined) setOverlayText(vis.overlayText);
              if (vis.overlayOpacity !== undefined) setOverlayOpacity(vis.overlayOpacity);
              if (vis.imageFilter) setImageFilter(vis.imageFilter);
              if (vis.placedIcons) setPlacedIcons(vis.placedIcons);
              if (vis.visualTextSize) setVisualTextSize(vis.visualTextSize);
              if (vis.visualBgColor) setVisualBgColor(vis.visualBgColor);
            }
          }

          setActiveSectionId(loadedSermon.sections[0]?.id || '1');
          setEditorVersion(prev => prev + 1);

          const total = loadedSermon.sections.reduce((acc: number, curr: any) => acc + (curr.durationMin || 0), 0);
          onResetTimer(total * 60);
          alert("Proyecto cargado exitosamente.");
        } else { alert("Formato de archivo inválido."); }
      } catch (err) { console.error(err); alert("Error al leer archivo."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = () => {
    const contentElement = document.getElementById('sermon-print-area');
    if (!contentElement) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert("Popups bloqueados"); return; }
    const contentHtml = contentElement.innerHTML;
    const refsHtml = crossRefs.length > 0
      ? `<div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px;"><h3>REFERENCIAS DE APOYO</h3><p><em>${crossRefs.map(r => r.ref).join(', ')}</em></p></div>`
      : '';

    printWindow.document.write(`<html><head><title>${sermon.title}</title><style>body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; background: #fff; } h1 { text-align: center; font-size: 24pt; margin-bottom: 20px; text-transform: uppercase; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; } td { padding: 5px; border-bottom: 1px solid #ccc; vertical-align: top; } h3 { border-bottom: 1px solid #000; margin-top: 20px; padding-bottom: 5px; font-size: 14pt; font-weight: bold; } p { line-height: 1.5; margin-bottom: 10px; font-size: 12pt; }</style></head><body>${contentHtml}${refsHtml}<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`);
    printWindow.document.close();
  };

  const downloadTXT = () => {
    let content = `TÍTULO: ${sermon.title.toUpperCase()}\n`;
    content += `PREDICADOR: ${sermon.speaker}\n`;
    content += `FECHA: ${sermon.date}\n`;
    content += `LUGAR: ${sermon.location} (${sermon.eventName})\n`;
    content += `CITA BASE: ${sermon.mainVerse} (${sermon.mainVerseVersion})\n`;
    content += `"${sermon.mainVerseText}"\n\n`;
    content += `==========================================\n\n`;

    sermon.sections.forEach(s => {
      content += `[${s.title.toUpperCase()}] (${s.durationMin} min)\n`;
      content += `${stripHtml(s.content)}\n\n`;

      // Include margin notes for this section
      const sectionNotes = (sermon.marginNotes || []).filter(n => n.sectionId === s.id);
      if (sectionNotes.length > 0) {
        content += `  📌 NOTAS AL MARGEN:\n`;
        sectionNotes.forEach(note => {
          content += `    • "${note.selectedText}" → ${note.noteText}\n`;
        });
        content += `\n`;
      }

      content += `------------------------------------------\n\n`;
    });

    if (sermon.bibleNotes) {
      content += `NOTAS:\n${sermon.bibleNotes}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sermon_${sermon.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadWord = () => {
    let contentHtml = `
      <h1 style="text-align: center; color: #2563EB;">${sermon.title}</h1>
      <p style="text-align: center;"><strong>${sermon.speaker}</strong> | ${sermon.date}</p>
      <p style="text-align: center;">${sermon.location} - ${sermon.eventName}</p>
      <hr/>
      <h2 style="text-align: center;">${sermon.mainVerse} <span style="font-size: 0.8em; color: #666;">(${sermon.mainVerseVersion})</span></h2>
      <p style="font-style: italic; text-align: center;">"${sermon.mainVerseText}"</p>
      <hr/>
    `;

    sermon.sections.forEach(s => {
      contentHtml += `<h3>${s.title} <span style="font-size: 0.8em; font-weight: normal; color: #666;">(${s.durationMin} min)</span></h3>`;
      contentHtml += `<div>${s.content}</div>`;

      // Include margin notes for this section
      const sectionNotes = (sermon.marginNotes || []).filter(n => n.sectionId === s.id);
      if (sectionNotes.length > 0) {
        contentHtml += `<div style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-left: 3px solid #2563EB;">`;
        contentHtml += `<p style="font-weight: bold; color: #2563EB; margin-bottom: 8px;">📌 Notas al Margen:</p>`;
        sectionNotes.forEach(note => {
          contentHtml += `<p style="margin: 5px 0; font-size: 11pt;"><em>"${note.selectedText}"</em> → ${note.noteText}</p>`;
        });
        contentHtml += `</div>`;
      }
    });

    if (sermon.bibleNotes) {
      contentHtml += `<hr/><h3>Notas Exegéticas</h3><p>${sermon.bibleNotes}</p>`;
    }

    // Include Global Notes
    const globalNotes = localStorage.getItem('pulpito_global_notes');
    if (globalNotes) {
      contentHtml += `<hr/><h3>📝 Notas y Apuntes Adicionales</h3><div style="white-space: pre-wrap; font-family: monospace; background: #eee; padding: 10px;">${globalNotes}</div>`;
    }

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${sermon.title}</title><style>body { font-family: 'Times New Roman', serif; color: #000000; } h1 { font-size: 24pt; font-weight: bold; } h2 { font-size: 18pt; color: #444; } h3 { font-size: 14pt; font-weight: bold; margin-top: 20px; color: #2563EB; } p { font-size: 12pt; line-height: 1.5; }</style></head><body>`;
    const footer = "</body></html>";
    const sourceHTML = header + contentHtml + footer;

    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sermon_${sermon.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPPT = async () => {
    setIsExporting(true);
    try {
      if (!(window as any).PptxGenJS) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const PptxGenJS = (window as any).PptxGenJS;
      const pres = new PptxGenJS();
      pres.layout = 'LAYOUT_16x9';
      pres.company = 'Púlpito Dinámico';
      pres.subject = sermon.title;

      // Title Slide
      let slide = pres.addSlide();
      slide.addText(sermon.title, { x: 0.5, y: 1.5, w: '90%', fontSize: 44, bold: true, color: '2563EB', align: 'center' });
      slide.addText(`${sermon.speaker} | ${sermon.date}`, { x: 0.5, y: 3.5, w: '90%', fontSize: 24, color: '666666', align: 'center' });

      // Main Verse Slide
      if (sermon.mainVerse) {
        let slide2 = pres.addSlide();
        slide2.addText(sermon.mainVerse, { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: '1E293B' });
        slide2.addText(`"${sermon.mainVerseText}"`, { x: 0.5, y: 1.5, w: '90%', h: 4, fontSize: 24, color: '333333', italic: true, valign: 'top' });
      }

      // Sections Slides
      sermon.sections.forEach(s => {
        let sectionSlide = pres.addSlide();
        sectionSlide.addText(s.title, { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: '2563EB' });
        const textContent = stripHtml(s.content).substring(0, 500);
        sectionSlide.addText(textContent, { x: 0.5, y: 1.2, w: '90%', h: 4.5, fontSize: 18, color: '333333', valign: 'top' });
      });

      // Global Notes Slide
      const globalNotes = localStorage.getItem('pulpito_global_notes');
      if (globalNotes) {
        let noteSlide = pres.addSlide();
        noteSlide.addText("Notas y Apuntes", { x: 0.5, y: 0.3, fontSize: 28, bold: true, color: 'EA580C' });
        noteSlide.addText(globalNotes, { x: 0.5, y: 1.2, w: '90%', h: 4.5, fontSize: 16, color: '333333', fontFace: 'Courier New', valign: 'top' });
      }

      await pres.writeFile({ fileName: `Sermon_${sermon.title.replace(/\s+/g, '_')}.pptx` });
    } catch (error) {
      console.error(error);
      alert("Error generando presentación.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderSectionIcon = (type: SectionType) => {
    switch (type) {
      case SectionType.LECTURA: return <BookOpen className="w-4 h-4 text-purple-500" />;
      case SectionType.DESARROLLO: return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case SectionType.LLAMADO: return <Sparkles className="w-4 h-4 text-yellow-500" />;
      default: return <GripVertical className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBorderColor = (type: SectionType) => {
    switch (type) {
      case SectionType.LECTURA: return 'border-l-purple-500';
      case SectionType.DESARROLLO: return 'border-l-blue-500';
      case SectionType.LLAMADO: return 'border-l-yellow-500';
      case SectionType.CIERRE: return 'border-l-green-500';
      default: return 'border-l-gray-400';
    }
  };

  const handleReset = (duration: number) => {
    if (window.confirm("¿Reiniciar todo el sermón? Se borrará el contenido actual.")) {
      const fresh = createFreshSermon(t);
      setSermon(fresh);
      setActiveSectionId(fresh.sections[0].id);
      setEditorVersion(prev => prev + 1);
      onResetTimer(duration);
      setShowOnboarding(true); // Restaurar el banner de bienvenida al reiniciar
    }
  };

  const handleNewSermon = () => {
    if (window.confirm("¿Crear un nuevo sermón? Se perderán los cambios no guardados en la biblioteca.")) {
      const fresh = createFreshSermon(t);
      setSermon(fresh);
      setActiveSectionId(fresh.sections[0].id);
      setEditorVersion(prev => prev + 1);
      setShowOnboarding(true);
      // Reset local storage
      localStorage.setItem('current_sermon', JSON.stringify(fresh));
      setCrossRefs([]);
    }
  };
  // --- IMAGE HANDLING ---
  const insertImage = (base64: string) => {
    const img = document.createElement('img');
    img.src = base64;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.marginTop = '10px';
    img.style.marginBottom = '10px';
    img.style.cursor = 'pointer'; // Hint interactivity

    // Try to insert at cursor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.collapse(false);
    } else {
      // Fallback: append
      contentEditableRef.current?.appendChild(img);
    }

    // Trigger input event to save
    if (contentEditableRef.current) {
      const event = new Event('input', { bubbles: true });
      contentEditableRef.current.dispatchEvent(event);
    }
  };







  useEffect(() => {
    if (timerState.isRunning) {
      document.body.classList.add('pulpito-focus-mode');
    } else {
      document.body.classList.remove('pulpito-focus-mode');
    }
    // Cleanup on unmount or when timer stops
    return () => document.body.classList.remove('pulpito-focus-mode');
  }, [timerState.isRunning]);

  // Double assurance: Cleanup on component unmount regardless of timer dependency, just in case
  useEffect(() => {
    return () => document.body.classList.remove('pulpito-focus-mode');
  }, []);

  console.log("DEBUG: SermonEditor Returning JSX");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`
        body.pulpito-focus-mode #main-sidebar {
          filter: blur(5px);
          opacity: 0.3;
          pointer-events: none;
          transition: all 0.5s ease;
        }
      `}</style>
      <div id="sermon-print-area" className="hidden print-only">
        <h1>{sermon.title}</h1>
        <table>
          <tbody>
            <tr><td><strong>Predicador:</strong> {sermon.speaker}</td><td><strong>Fecha:</strong> {sermon.date}</td></tr>
            <tr><td><strong>Lugar:</strong> {sermon.location}</td><td><strong>Evento:</strong> {sermon.eventName}</td></tr>
            <tr><td colSpan={2}><strong>Cita Base:</strong> {sermon.mainVerse} ({sermon.mainVerseVersion})</td></tr>
            {sermon.mainVerseText && <tr><td colSpan={2}><em>"{sermon.mainVerseText}"</em></td></tr>}
          </tbody>
        </table>
        {sermon.sections.map(s => {
          const sectionNotes = (sermon.marginNotes || []).filter(n => n.sectionId === s.id);
          return (
            <div key={s.id}>
              <h3>{s.title} ({s.durationMin} min)</h3>
              <div dangerouslySetInnerHTML={{ __html: s.content }} />
              {sectionNotes.length > 0 && (
                <div style={{ margin: '10px 0', padding: '10px', backgroundColor: '#f5f5f5', borderLeft: '3px solid #2563EB' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>📌 Notas al Margen:</p>
                  {sectionNotes.map(note => (
                    <p key={note.id} style={{ fontSize: '11px', margin: '3px 0' }}>
                      <em>"{note.selectedText}"</em> → {note.noteText}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {sermon.bibleNotes && <div><h3>NOTAS</h3><p>{sermon.bibleNotes}</p></div>}
        {localStorage.getItem('pulpito_global_notes') && (
          <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300">
            <h3>📝 Notas y Apuntes</h3>
            <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4">{localStorage.getItem('pulpito_global_notes')}</pre>
          </div>
        )}
        {sermon.announcements && <div><h3>AVISOS</h3><div dangerouslySetInnerHTML={{ __html: sermon.announcements || '' }} /></div>}
      </div>

      <div className="no-print h-full flex flex-col overflow-hidden">
        <header className="h-[72px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 z-20">
          <div className={`flex items-center gap-3 transition-all duration-500 ${timerState.isRunning ? 'opacity-20 blur-[2px] pointer-events-none' : ''}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              title={leftSidebarOpen ? "Ocultar Estructura" : "Mostrar Estructura"}
              className="hidden md:flex"
            >
              <PanelLeft className={`w-6 h-6 ${leftSidebarOpen ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`} />
            </Button>
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Church className="w-6 h-6" />
            </div>
            <div className="hidden md:block">
              <h1 className="font-bold text-base leading-none">{t('editor.title')}</h1>
              <button
                onClick={() => setShowConfigModal(true)}
                className="mt-1 px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-xs font-bold text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-colors flex items-center gap-1 shadow-sm"
              >
                <Settings className="w-3 h-3" />
                {t('editor.config')}
              </button>
            </div>
          </div>

          <div className="flex items-center bg-black/20 dark:bg-black/40 rounded-xl px-4 py-1.5 gap-4 shadow-inner border border-[var(--border-color)] mx-auto transition-transform hover:scale-105 backdrop-blur-sm">
            <button onClick={onResetTimerOnly} className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)] transition-colors" title="Resetear Timer"><RotateCcw className="w-5 h-5" /></button>
            <div className={`font-mono text-4xl w-[160px] text-center tracking-widest transition-all duration-500 drop-shadow-md ${getTimerColor()}`}>{formatTime(timerState.timeLeft)}</div>
            <button onClick={onToggleTimer} className={`p-2 rounded-full text-white transition-colors shadow-lg active:scale-95 ${timerState.isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}>
              {timerState.isRunning ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
          </div>

          <div className={`flex items-center gap-2 transition-all duration-500 ${timerState.isRunning ? 'opacity-20 blur-[2px] pointer-events-none' : ''}`}>
            {lastSaved && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] mr-2 animate-fade-in" title={`${t('editor.autosave')}: ${lastSaved.toLocaleTimeString()}`}>
                <Cloud className="w-3 h-3 text-[var(--accent-color)]" />
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                  {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}


            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleOpenProjectFile} />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title={t('editor.open')} className="hidden sm:inline-flex"><FolderOpen className="w-5 h-5 text-yellow-600" /></Button>

            <Button variant="ghost" size="icon" onClick={handleSaveToLibrary} title="Guardar en Biblioteca" className="hidden sm:inline-flex"><Save className="w-5 h-5 text-blue-600" /></Button>
            <Button variant="ghost" size="icon" onClick={handleSaveToCalendar} title="Guardar en Calendario" className="hidden sm:inline-flex"><CalendarIcon className="w-5 h-5 text-green-600" /></Button>
            <Button variant="ghost" size="icon" onClick={handleShowStorageDialog} title="Guardar como Archivo" className="hidden sm:inline-flex"><Cloud className="w-5 h-5 text-purple-600" /></Button>





            <div className="sm:hidden">
              <Button variant="ghost" size="icon" onClick={() => setShowConfigModal(true)}><Settings className="w-6 h-6" /></Button>
            </div>

            <div className="hidden lg:flex gap-1 ml-2 border-l border-[var(--border-color)] pl-2">
              {/* TELEPROMPTER BUTTON */}
              {onOpenTeleprompter && (
                <Button variant="outline" size="icon" onClick={onOpenTeleprompter} title="Teleprompter" className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300">
                  <MonitorPlay className="w-4 h-4" />
                </Button>
              )}

              <Button variant="outline" size="icon" onClick={downloadWord} title={t('export.word')}><FileText className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={downloadTXT} title={t('export.txt')}><FileType className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={downloadPPT} title={t('export.ppt')} loading={isExporting}><Presentation className="w-4 h-4" /></Button>
              <Button variant="primary" size="sm" onClick={handlePrint} title={t('export.print')}><Printer className="w-4 h-4 mr-2" /> {t('editor.print')}</Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              title={rightSidebarOpen ? "Ocultar Herramientas" : "Mostrar Herramientas"}
            >
              <PanelRight className={`w-6 h-6 ${rightSidebarOpen ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`} />
            </Button>
          </div>
        </header>

        {/* ... Rest of the component structure remains unchanged ... */}
        <div className="flex flex-1 overflow-hidden relative">
          {leftSidebarOpen && (
            <div className="absolute inset-0 bg-black/50 z-20 md:hidden animate-fade-in" onClick={() => setLeftSidebarOpen(false)} />
          )}

          <aside className={`${leftSidebarOpen ? 'w-[280px] translate-x-0' : 'w-[0px] -translate-x-full md:w-[0px] md:translate-x-0'} absolute md:relative z-30 h-full transition-all duration-300 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden shadow-2xl md:shadow-none`}>
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">{t('editor.structure')}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLeftSidebarOpen(false)}><ChevronLeft className="w-4 h-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {sermon.sections.map((section) => (
                <div
                  key={section.id}
                  role="button"
                  onClick={() => {
                    setActiveSectionId(section.id);
                    if (window.innerWidth < 1024) {
                      setLeftSidebarOpen(false);
                    }
                  }}
                  className={`group p-3 rounded-lg border-l-4 ${getBorderColor(section.type)} border border-transparent cursor-pointer transition-all ${activeSectionId === section.id ? 'bg-[var(--bg-tertiary)] shadow-sm' : 'hover:bg-[var(--bg-tertiary)] hover:border-transparent'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`text-sm font-semibold ${activeSectionId === section.id ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>{section.title}</h4>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">{t('structure.type.' + section.type)}</span>
                    </div>
                    {!timerState.isRunning && (
                      <div onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}>
                        <button className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-[var(--text-secondary)]" />
                    <input onClick={(e) => e.stopPropagation()} type="number" value={section.durationMin} onChange={(e) => handleUpdateSection(section.id, { durationMin: parseInt(e.target.value) || 0 })} className="w-12 bg-transparent text-xs border-b border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-center" disabled={timerState.isRunning} />
                    <span className="text-xs text-[var(--text-secondary)]">min</span>
                  </div>
                </div>
              ))}
              {!timerState.isRunning && (
                <button onClick={handleAddSection} className="w-full py-3 border-2 border-dashed border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)] flex items-center justify-center gap-2 text-sm transition-colors"><Plus className="w-4 h-4" /> {t('editor.add_section')}</button>
              )}
            </div>
          </aside>

          {!leftSidebarOpen && (
            <div className="absolute left-0 top-4 z-10">
              <Button variant="secondary" size="icon" onClick={() => setLeftSidebarOpen(true)} className="rounded-l-none shadow-md border-l-0"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}

          <main
            key={editorVersion}
            className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex-1 overflow-y-auto p-4 md:px-12 md:py-8 relative">

              {/* WELCOME SETUP CARD - VISIBLE IF NO MAIN VERSE IS SET (Controlled by showOnboarding) */}
              {showOnboarding && (
                <div className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-xl text-white flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in relative z-10 mx-auto max-w-3xl group">
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="absolute top-2 right-2 p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title="Ocultar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Sparkles className="w-6 h-6 text-yellow-300" /> ¡Comienza tu Sermón!</h2>
                    <p className="text-blue-100 opacity-90 text-sm md:text-base">
                      Configura el título, predicador y versículo base para que la IA pueda ayudarte a estructurar el mensaje.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="px-6 py-3 bg-white text-blue-700 font-bold rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                  >
                    <Settings className="w-5 h-5" /> Iniciar Configuración
                  </button>
                </div>
              )}

              <div
                className="max-w-4xl mx-auto space-y-6 transition-all"
                style={{ maxWidth: `${textSettings.maxWidth}%` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {renderSectionIcon(activeSection.type)}
                      <span className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">{t('structure.type.' + activeSection.type)} • {activeSection.durationMin} min</span>
                    </div>
                    <input type="text" value={activeSection.title} onChange={(e) => handleUpdateSection(activeSectionId, { title: e.target.value })} className="w-full bg-transparent text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] border-none focus:ring-0 placeholder-[var(--text-secondary)] p-0" placeholder="Título de la Sección" />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleAudioPlayer}
                      className={`p-2 rounded-full border transition-all ${audioPlayer.isPlaying ? 'bg-green-500 text-white border-green-600 animate-pulse' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-color)]'}`}
                      title="Audiolibro"
                    >
                      <Headphones className="w-6 h-6" />
                    </button>

                    {/* BOTÓN IA - Solo visible en secciones EXTRA o si no es una de las principales */}
                    {(activeSection.type === SectionType.EXTRA || ![SectionType.LECTURA, SectionType.DESARROLLO, SectionType.LLAMADO, SectionType.CIERRE].includes(activeSection.type)) && (
                      <Button
                        onClick={handleRegenerateSection}
                        variant="ai"
                        size="sm"
                        loading={isRegeneratingSection}
                        title="Mejorar con IA"
                        className="hidden md:inline-flex"
                      >
                        <Sparkles className="w-4 h-4 mr-1" /> IA
                      </Button>
                    )}
                  </div>
                </div>

                {audioPlayer.showControls && (
                  <div className="mb-4 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)] animate-fade-in flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--text-secondary)] w-12 text-right">
                        {audioPlayer.currentIndex + 1}/{audioPlayer.chunks.length}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, audioPlayer.chunks.length - 1)}
                        value={audioPlayer.currentIndex}
                        onChange={handleAudioSeek}
                        className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]"
                      />
                    </div>
                    <div className="flex justify-center items-center gap-4">
                      <button onClick={handleAudioPrev} disabled={audioPlayer.currentIndex <= 0} className="p-2 rounded-full hover:bg-[var(--bg-secondary)] disabled:opacity-30 transition-colors">
                        <SkipBack className="w-5 h-5 text-[var(--text-primary)]" />
                      </button>
                      <button onClick={handleAudioPlayPause} className="p-3 rounded-full bg-[var(--accent-color)] text-white hover:opacity-90 shadow-md transition-transform active:scale-95">
                        {audioPlayer.isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                      </button>
                      <button onClick={handleAudioNext} disabled={audioPlayer.currentIndex >= audioPlayer.chunks.length - 1} className="p-2 rounded-full hover:bg-[var(--bg-secondary)] disabled:opacity-30 transition-colors">
                        <SkipForward className="w-5 h-5 text-[var(--text-primary)]" />
                      </button>
                    </div>
                    <p className="text-center text-xs text-[var(--text-secondary)] italic truncate px-4">
                      {audioPlayer.chunks[audioPlayer.currentIndex]}
                    </p>
                  </div>
                )}

                <div className="min-h-[500px] border-b border-transparent">
                  <div
                    key={activeSection.id + editorVersion}
                    ref={contentEditableRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleContentChange}

                    onMouseUp={handleTextSelection}
                    className="w-full h-full min-h-[600px] outline-none font-reading leading-loose text-[var(--text-primary)] empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 text-justify [&_p]:mb-4"
                    data-placeholder={t('editor.placeholder')}
                    style={{
                      fontSize: `${textSettings.fontSize}px`,
                      lineHeight: textSettings.lineHeight
                    }}
                  />
                </div>

                {/* MARGIN NOTES PANEL */}
                {currentSectionNotes.length > 0 && (
                  <div className="mt-4 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center gap-2">
                        📌 Notas al Margen ({currentSectionNotes.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {currentSectionNotes.map(note => (
                        <div key={note.id} className="p-3 bg-[var(--bg-primary)] rounded-lg border-l-3 border-[var(--accent-color)] group">
                          {editingNoteId === note.id ? (
                            <div className="space-y-2">
                              <p className="text-xs text-[var(--text-secondary)] italic">"{note.selectedText}"</p>
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full p-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button onClick={handleSaveEditNote} className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Guardar</button>
                                <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-xs text-[var(--text-secondary)] italic mb-1">"{note.selectedText}"</p>
                                <p className="text-sm text-[var(--text-primary)]">{note.noteText}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => handleEditNote(note.id)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded text-blue-500" title="Editar">
                                  ✏️
                                </button>
                                <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded text-red-500" title="Eliminar">
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="h-14 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between px-6 shrink-0">
              <Button variant={activeSection?.type === SectionType.LECTURA ? 'ghost' : 'primary'} onClick={() => { const idx = sermon.sections.findIndex(s => s.id === activeSectionId); if (idx > 0) setActiveSectionId(sermon.sections[idx - 1].id); }} disabled={sermon.sections.findIndex(s => s.id === activeSectionId) === 0}><ChevronLeft className="w-4 h-4 mr-2" /> {t('editor.prev')}</Button>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{sermon.sections.findIndex(s => s.id === activeSectionId) + 1} de {sermon.sections.length}</span>
              <Button variant="primary" onClick={() => { const idx = sermon.sections.findIndex(s => s.id === activeSectionId); if (idx < sermon.sections.length - 1) setActiveSectionId(sermon.sections[idx + 1].id); }} disabled={sermon.sections.findIndex(s => s.id === activeSectionId) === sermon.sections.length - 1}>{t('editor.next')} <ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </main>

          {/* RIGHT SIDEBAR - RESTORED */}
          {rightSidebarOpen && (
            <aside className="w-[350px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col shrink-0 transition-all z-30 shadow-xl hidden lg:flex">
              <div className="flex border-b border-[var(--border-color)]">
                <button onClick={() => setRightTab('bible')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${rightTab === 'bible' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('editor.tab.bible')}</button>
                <button onClick={() => setRightTab('advisor')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${rightTab === 'advisor' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('editor.tab.advisor')}</button>
                <button onClick={() => setRightTab('visual')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${rightTab === 'visual' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('editor.tab.visual')}</button>
                <button onClick={() => setRightTab('avisos')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${rightTab === 'avisos' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('editor.tab.avisos')}</button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[var(--bg-tertiary)] p-4">

                {/* BIBLE TAB */}
                {rightTab === 'bible' && (
                  <div className="space-y-6">
                    {!sermon.mainVerse ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-[var(--text-secondary)] text-sm italic mb-4">{t('editor.bible_tab.no_verse')}</p>
                        <button
                          onClick={handleNewSermon}
                          className="text-xs text-[var(--accent-color)] font-bold hover:underline flex items-center gap-1"
                        >
                          <FilePlus className="w-3 h-3" /> Iniciar nuevo sermón
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-[var(--accent-color)] uppercase">{sermon.mainVerse}</span>
                            <Button variant="ghost" size="sm" onClick={() => loadCrossRefs(true)} loading={isLoadingRefs} title={t('ui.refresh_refs')}><RefreshCw className="w-3 h-3" /></Button>
                          </div>
                          <p className="text-base font-reading text-[var(--text-primary)] italic text-justify leading-relaxed">"{sermon.mainVerseText}"</p>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center gap-2"><BookOpen className="w-3 h-3" /> {t('editor.cross_refs')}</h3>
                          {crossRefs.length > 0 ? crossRefs.map((ref, idx) => (
                            <div key={idx} className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-colors group cursor-pointer" onClick={() => handleViewReference(ref.ref)}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold text-[var(--text-primary)]">{ref.ref}</span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 text-justify italic font-serif">"{ref.text}"</p>
                            </div>
                          )) : (
                            <p className="text-xs text-[var(--text-secondary)] italic text-center">{t('editor.bible_tab.load_hint')}</p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                      <h3 className="text-xs font-bold uppercase text-[var(--text-secondary)]">{t('editor.notes')}</h3>
                      <textarea
                        className="w-full h-32 p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-color)] outline-none resize-none"
                        placeholder={t('editor.notes_placeholder')}
                        value={sermon.bibleNotes}
                        onChange={(e) => setSermon(prev => ({ ...prev, bibleNotes: e.target.value }))}
                      />
                    </div>

                    {/* Reference Viewer Modal-like in Sidebar */}
                    {viewingVerse && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingVerse(null)}>
                        <div className="bg-[var(--bg-secondary)] p-6 rounded-xl max-w-md w-full shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                          <h3 className="font-bold text-lg mb-2">{viewingVerse.ref}</h3>
                          <p className="font-serif italic text-base mb-4 text-justify leading-relaxed">{isLoadingVerseText ? "Cargando..." : viewingVerse.text}</p>
                          <div className="flex justify-end"><Button size="sm" onClick={() => setViewingVerse(null)}>Cerrar</Button></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ADVISOR TAB */}
                {rightTab === 'advisor' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
                      {chatHistory.length === 0 && (
                        <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] shadow-sm italic text-center">
                          <span className="block mb-1 font-bold text-[var(--accent-color)] not-italic">Asistente Teológico</span>
                          {t('editor.advisor.welcome')}
                        </div>
                      )}
                      {chatHistory.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-[var(--accent-color)] text-white rounded-br-none' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-bl-none shadow-sm [&_strong]:text-[var(--accent-color)] [&_b]:text-[var(--accent-color)]'}`}>
                            {msg.role === 'ai' ? <div dangerouslySetInnerHTML={{ __html: msg.content }} /> : msg.content}
                          </div>
                          {msg.role === 'ai' && (
                            <button
                              onClick={() => handleInsertAdvisorContent(msg.content)}
                              className="mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors flex items-center gap-1 shadow-sm"
                              title="Insertar en Sermón"
                            >
                              <Plus className="w-3 h-3" /> Insertar
                            </button>
                          )}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Pregunta algo..."
                        className="flex-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                      />
                      <Button size="icon" onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()}>
                        {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* VISUAL TAB */}
                {rightTab === 'visual' && (
                  <div className="space-y-6 h-full overflow-y-auto">
                    <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white shadow-lg text-center">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-80" />
                      <h3 className="font-bold text-sm">Estudio Creativo</h3>
                      <p className="text-xs opacity-80 mt-1">Herramientas visuales deshabilitadas por configuración.</p>
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-4">
                      <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-2">Editor de Slide (Simplificado)</label>
                      <div ref={previewRef} className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-md group">
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-xs" style={{ backgroundColor: visualBgColor }}>
                          {overlayText ? '' : 'Texto sobre fondo sólido'}
                        </div>
                        {overlayText && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                            <div className="bg-black text-white p-4 rounded text-center font-bold" style={{ backgroundColor: 'transparent', fontSize: `${visualTextSize}px` }}>
                              {overlayText}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-3">
                      <textarea
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder={t('editor.visual.overlay_placeholder')}
                        className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] resize-none"
                        rows={2}
                      />
                      <div className="flex justify-between items-center">
                        <button onClick={handlePasteVerse} className="text-xs text-blue-500 hover:underline">{t('editor.visual.paste_verse')}</button>
                        <div className="flex gap-1 items-center">
                          <span className="text-[10px] text-[var(--text-secondary)] mr-1">Fondo:</span>
                          {['#000000', '#1e3a5f', '#2d4a3e', '#4a1a2d', '#3d2d1a', '#1a1a3d', '#3d1a1a'].map(color => (
                            <button
                              key={color}
                              onClick={() => setVisualBgColor(color)}
                              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${visualBgColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <input type="color" value={visualBgColor} onChange={(e) => setVisualBgColor(e.target.value)} className="w-5 h-5 p-0 border-0 rounded cursor-pointer" title="Color personalizado" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-[var(--text-secondary)]">{t('editor.visual.opacity')}</label><input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer" /></div>
                        <div><label className="text-[10px] text-[var(--text-secondary)]">{t('editor.visual.text_size')}</label><input type="range" min="12" max="72" value={visualTextSize} onChange={(e) => setVisualTextSize(parseInt(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer" /></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AVISOS TAB */}
                {rightTab === 'avisos' && (
                  <div className="h-full flex flex-col">
                    <div className="mb-4">
                      <h3 className="font-bold text-[var(--text-primary)]">{t('editor.avisos.title')}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{t('editor.avisos.desc')}</p>
                    </div>
                    <div className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-[var(--border-color)] flex gap-1 flex-wrap bg-[var(--bg-secondary)]">
                        <button onMouseDown={(e) => { e.preventDefault(); execAnnouncementsCmd('bold'); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Negrita"><Bold className="w-4 h-4" /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); execAnnouncementsCmd('italic'); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Cursiva"><Italic className="w-4 h-4" /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); execAnnouncementsCmd('underline'); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Subrayado"><Underline className="w-4 h-4" /></button>
                        <div className="w-px bg-[var(--border-color)] mx-1" />
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Lista con viñetas"><List className="w-4 h-4" /></button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList', false); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Lista numerada"><ListOrdered className="w-4 h-4" /></button>
                      </div>
                      <div
                        ref={announcementsRef}
                        contentEditable
                        className="flex-1 p-3 outline-none overflow-y-auto text-sm [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:mb-1"
                        onInput={handleAnnouncementsChange}
                        dangerouslySetInnerHTML={{ __html: sermon.announcements || '' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* CONFIG MODAL - RESTORED */}
      {
        showConfigModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-secondary)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Settings className="w-5 h-5 text-[var(--accent-color)]" /> {t('config.title')}</h2>
                <button onClick={() => setShowConfigModal(false)}><X className="w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('config.sermon_title')}</label>
                    <input type="text" value={sermon.title} onChange={(e) => setSermon(prev => ({ ...prev, title: e.target.value }))} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('config.speaker')}</label>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          const prefix = e.target.value;
                          if (prefix) {
                            setSermon(prev => ({ ...prev, speaker: `${prefix} ${prev.speaker}`.trim() }));
                            e.target.value = ''; // Reset select after insert
                          }
                        }}
                        className="w-16 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs cursor-pointer"
                      >
                        <option value="">...</option>
                        {SPEAKER_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input type="text" value={sermon.speaker} onChange={(e) => setSermon(prev => ({ ...prev, speaker: e.target.value }))} className="flex-1 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('config.date')}</label>
                    <input type="date" value={sermon.date} onChange={(e) => setSermon(prev => ({ ...prev, date: e.target.value }))} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('config.location')}</label>
                    <input type="text" value={sermon.location} onChange={(e) => setSermon(prev => ({ ...prev, location: e.target.value }))} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Evento / Servicio</label>
                    <input type="text" value={sermon.eventName || ''} onChange={(e) => setSermon(prev => ({ ...prev, eventName: e.target.value }))} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" placeholder="Ej. Culto Dominical" />
                  </div>
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('config.category')}</label>
                  <select
                    value={sermon.category || ''}
                    onChange={(e) => setSermon(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] appearance-none cursor-pointer"
                  >
                    <option value="">{t('config.category_placeholder')}</option>
                    <option value="Evangelismo">📢 Evangelismo</option>
                    <option value="Discipulado">📚 Discipulado</option>
                    <option value="Adoración">🙏 Adoración</option>
                    <option value="Oración">🕊️ Oración</option>
                    <option value="Familia">👨‍👩‍👧‍👦 Familia</option>
                    <option value="Jóvenes">🎯 Jóvenes</option>
                    <option value="Niños">🎈 Niños</option>
                    <option value="Adviento">✨ Adviento</option>
                    <option value="Navidad">🎄 Navidad</option>
                    <option value="Semana Santa">✝️ Semana Santa</option>
                    <option value="Pentecostés">🔥 Pentecostés</option>
                    <option value="Mayordomía">💰 Mayordomía</option>
                    <option value="Servicio">🤝 Servicio</option>
                    <option value="Misiones">🌍 Misiones</option>
                    <option value="Otro">📝 Otro</option>
                  </select>
                </div>

                {/* Verse Picker Section */}
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center justify-between">
                    <span>{t('config.verse_base')}</span>
                    {versePickerStep !== 'none' && <button onClick={() => setVersePickerStep('none')} className="text-xs text-red-500 hover:underline">Cancelar Selección</button>}
                  </label>

                  {versePickerStep === 'none' ? (
                    <div
                      className={`group p-0 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm transition-all relative flex flex-col min-h-[160px]`}
                    >
                      {sermon.mainVerse ? (
                        <div className="flex flex-col h-full">
                          {/* Header: Reference and Version */}
                          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-[var(--accent-color)]" />
                              <span className="font-bold text-lg text-[var(--text-primary)]">{sermon.mainVerse}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <select
                                  value={sermon.mainVerseVersion || 'RVR1960'}
                                  onChange={handleVersionChange}
                                  className="appearance-none bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--text-primary)] px-3 py-1.5 pr-8 rounded-lg border border-[var(--border-color)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer"
                                >
                                  {bibleVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRegenerateVerseText(); }}
                                className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors border border-[var(--border-color)]"
                                title="Refrescar cita (Buscar variación)"
                              >
                                <RefreshCw className={`w-4 h-4 ${isVerseLoading ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteVerse(); }}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 hover:text-white text-red-500 transition-colors border border-red-100"
                                title="Eliminar cita"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Content: The Verse Text */}
                          <div className="flex-1 p-6 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-tertiary)] flex items-center justify-center text-center">
                            {isVerseLoading ? (
                              <div className="flex flex-col items-center text-[var(--text-secondary)] gap-2">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="text-xs">Buscando...</span>
                              </div>
                            ) : (
                              <div className="space-y-2 w-full">
                                <h3 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] font-reading">{sermon.mainVerse}</h3>
                                <p className="font-reading text-lg md:text-xl text-[var(--text-primary)] italic leading-relaxed px-4 line-clamp-3 text-justify">
                                  "{sermon.mainVerseText || 'Texto no disponible'}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 p-4">
                          {/* Option 1: Manual Selection */}
                          <button
                            onClick={handleOpenVersePicker}
                            className="group p-4 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-xl hover:border-[var(--accent-color)] hover:shadow-lg transition-all flex items-center gap-4"
                          >
                            <div className="p-3 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
                              <BookOpen className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="text-left">
                              <span className="font-bold text-[var(--text-primary)]">{t('config.manual_select')}</span>
                              <p className="text-xs text-[var(--text-secondary)]">Seleccionar libro, capítulo y versículo</p>
                            </div>
                          </button>

                          {/* Divider */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-[var(--border-color)]"></div>
                            <span className="text-xs text-[var(--text-secondary)] uppercase">{t('config.or_search_theme')}</span>
                            <div className="flex-1 h-px bg-[var(--border-color)]"></div>
                          </div>

                          {/* Option 2: Theme Search */}
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <Search className="w-5 h-5 text-purple-600" />
                              <span className="font-bold text-purple-800 dark:text-purple-300">{t('config.theme_search')}</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={themeSearch}
                                onChange={(e) => setThemeSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchByTheme()}
                                placeholder={t('config.theme_placeholder')}
                                className="flex-1 p-3 rounded-lg bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm"
                              />
                              <Button onClick={handleSearchByTheme} loading={isSearchingTheme}>
                                <Search className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Suggested Verses */}
                            {suggestedVerses.length > 0 && (
                              <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
                                {suggestedVerses.map((verse, idx) => (
                                  <div key={idx} className="p-3 bg-white dark:bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] hover:border-purple-400 transition-all">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex-1">
                                        <span className="font-bold text-purple-700 dark:text-purple-400">{verse.ref}</span>
                                        <p className="text-sm text-[var(--text-primary)] mt-1 line-clamp-2">"{verse.text}"</p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1 italic">📌 {verse.relevance}</p>
                                      </div>
                                      <Button size="sm" onClick={() => handleSelectSuggestedVerse(verse)}>
                                        {t('config.select_verse')}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isSearchingTheme && (
                              <div className="mt-4 flex items-center justify-center gap-2 text-purple-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Buscando versículos relacionados...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] h-[300px] flex flex-col">
                      {/* Version Selector inside Picker */}
                      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2 mb-2 shrink-0">
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                          {versePickerStep === 'books'
                            ? 'Selecciona Libro'
                            : versePickerStep === 'chapters' && tempSelectedBook
                              ? tempSelectedBook.name
                              : versePickerStep === 'verses' && tempSelectedBook && tempSelectedChapter
                                ? `${tempSelectedBook.name} ${tempSelectedChapter}`
                                : 'Selección'}
                        </span>
                        <div className="relative">
                          <select
                            value={sermon.mainVerseVersion || 'RVR1960'}
                            onChange={(e) => setSermon(prev => ({ ...prev, mainVerseVersion: e.target.value }))}
                            className="appearance-none bg-[var(--bg-secondary)] text-[10px] font-bold text-[var(--text-primary)] px-2 py-1 pr-6 rounded border border-[var(--border-color)] focus:outline-none"
                          >
                            {bibleVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                        </div>
                      </div>

                      {versePickerStep === 'books' && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 flex-1 content-start">
                          {BIBLE_BOOKS.map(b => (
                            <button key={b.id} onClick={() => handleVersePickerBookClick(b)} className="h-auto min-h-[40px] text-[11px] p-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-center whitespace-normal leading-tight transition-colors flex items-center justify-center">
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {versePickerStep === 'chapters' && tempSelectedBook && (
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 overflow-y-auto pr-1 flex-1 content-start">
                          {Array.from({ length: tempSelectedBook.chapters }, (_, i) => i + 1).map(c => (
                            <button key={c} onClick={() => handleVersePickerChapterClick(c)} className="aspect-square flex items-center justify-center text-sm font-bold bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:bg-[var(--accent-color)] hover:text-white transition-colors">
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                      {versePickerStep === 'verses' && tempSelectedBook && tempSelectedChapter && (
                        <div className="flex flex-col h-full">
                          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 overflow-y-auto pr-1 flex-1 content-start mb-2">
                            {Array.from({ length: 50 }, (_, i) => i + 1).map(v => (
                              <button
                                key={v}
                                onClick={() => handleVersePickerVerseToggle(v)}
                                className={`aspect-square flex items-center justify-center text-sm font-bold rounded-lg border transition-all ${tempSelectedVerses.includes(v) ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] scale-105 shadow-sm' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]'}`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-[var(--border-color)] shrink-0">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {tempSelectedVerses.length > 0 ? `${tempSelectedVerses.length} seleccionados` : 'Selecciona versículos'}
                            </span>
                            <Button size="sm" onClick={handleConfirmVerseSelection} disabled={tempSelectedVerses.length === 0}>Confirmar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 shrink-0 bg-[var(--bg-secondary)]">
                <Button variant="ghost" onClick={() => setShowConfigModal(false)}>{t('config.cancel')}</Button>
                <Button onClick={handleSaveConfig} loading={isGeneratingStructure}>{t('config.save_generate')}</Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Storage Selection Dialog */}
      {
        showStorageDialog && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--bg-secondary)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden">
              <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Cloud className="w-6 h-6 text-purple-600" />
                  Guardar Sermón
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Elige dónde guardar tu sermón</p>
              </div>

              <div className="p-6 space-y-3">
                {/* Local File */}
                <button
                  onClick={handleSaveToLocalFile}
                  className="w-full p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent-color)] hover:shadow-md transition-all flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-[var(--text-primary)]">Archivo Local</div>
                    <div className="text-xs text-[var(--text-secondary)]">Descargar como archivo .json</div>
                  </div>
                </button>

                {/* Google Drive */}
                <button
                  onClick={() => handleSaveToCloud('gdrive')}
                  className="w-full p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4 opacity-70"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-[var(--text-primary)]">Google Drive</div>
                    <div className="text-xs text-[var(--text-secondary)]">Próximamente</div>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Beta</span>
                </button>

                {/* OneDrive */}
                <button
                  onClick={() => handleSaveToCloud('onedrive')}
                  className="w-full p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4 opacity-70"
                >
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-sky-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-[var(--text-primary)]">OneDrive</div>
                    <div className="text-xs text-[var(--text-secondary)]">Próximamente</div>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Beta</span>
                </button>

                {/* iCloud */}
                <button
                  onClick={() => handleSaveToCloud('icloud')}
                  className="w-full p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl hover:border-gray-400 hover:shadow-md transition-all flex items-center gap-4 opacity-70"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-[var(--text-primary)]">iCloud</div>
                    <div className="text-xs text-[var(--text-secondary)]">Próximamente</div>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Beta</span>
                </button>
              </div>

              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                <Button variant="ghost" onClick={() => setShowStorageDialog(false)} className="w-full">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* CONTEXT MENU */}
      {
        contextMenu.show && (
          <ContextMenu
            selectedText={contextMenu.selectedText}
            position={contextMenu.position}
            onClose={() => setContextMenu(prev => ({ ...prev, show: false }))}
            onAddNote={handleAddMarginNote}
            onInsertToSermon={handleInsertFromContextMenu}
            sectionId={activeSectionId}
          />
        )
      }
    </div >
  );
};
