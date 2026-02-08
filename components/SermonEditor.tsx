
import React, { useState, useEffect, useRef } from 'react';
import { Sermon, SermonSection, SectionType, ChatMessage, Theme, TimerState, TextSettings, Language } from '../types';
import { Button } from './Button';
import { chatWithAdvisor, getSectionHelper, getCrossReferences, generateFullSermonStructure, translateForImageSearch, extractVisualKeywords, searchVersesByTheme } from '../services/geminiService';
import { fetchVerseText, getBibleVersions, BIBLE_BOOKS } from '../services/bibleService';
import { speakText, stopAudio, stripHtmlForAudio, splitTextIntoChunks, isSpeaking } from '../services/audioService';
import { useTranslation } from '../context/LanguageContext';
import {
  Church, Clock, RotateCcw, Play, Pause, PanelRight,
  ChevronLeft, ChevronRight, Plus, Trash2, GripVertical, Search,
  Sparkles, BookOpen, MessageCircle, Image as ImageIcon, Send, X, Settings, FileText, Presentation,
  Loader2, FileType, Printer, Calendar as CalendarIcon, MapPin, Download, Wand2, Smile, Move,
  Save, FolderOpen, AlertTriangle, Bell, Cloud, Upload, HardDrive, RefreshCw, Type as TypeIcon, Palette, Copy, Quote,
  Bold, Italic, Underline, List, ListOrdered, Volume2, StopCircle, Headphones, SkipBack, SkipForward, FileJson, Eraser, FilePlus, RefreshCcw, Check, MousePointerClick, ChevronDown, User, MonitorPlay, HeartHandshake, Info
} from 'lucide-react';

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

const CHRISTIAN_EMOJIS = ["✝️", "🙏", "🕊️", "🔥", "❤️", "📖", "👑", "🌿", "⭐", "☁️", "🩸", "🥖", "🦁", "🐑"];
const SPEAKER_PREFIXES = ['Sr.', 'Sra.', 'Ps.', 'Psra.', 'Hno.', 'Hna.', 'Guía', 'Líder', 'Diácono', 'Rev.', 'Ob.'];

const IMAGE_FILTERS = {
  normal: { label: 'Normal', style: '' },
  bw: { label: 'B/N', style: 'grayscale(100%)' },
  sepia: { label: 'Antiguo', style: 'sepia(80%)' },
  vivid: { label: 'Vívido', style: 'saturate(160%) contrast(110%)' },
  dramatic: { label: 'Dramático', style: 'contrast(130%) brightness(90%)' },
};

interface DraggableIconProps {
  emoji: string;
  id: string;
  onRemove: (id: string) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
  tooltip: string;
}

const DraggableIcon: React.FC<DraggableIconProps> = ({
  emoji,
  id,
  onRemove,
  parentRef,
  tooltip
}) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [fontSize, setFontSize] = useState(40); // Default size in px
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDragging.current = true;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 2 : -2;
    setFontSize(prev => Math.min(200, Math.max(10, prev + delta)));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="absolute hover:brightness-110 transition-filter select-none z-10 flex items-center justify-center leading-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${fontSize}px`,
        cursor: 'grab'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onRemove(id)}
      onWheel={handleWheel}
      title={`${tooltip} • Rueda mouse: Tamaño`}
    >
      {emoji}
    </div>
  );
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

  // --- ESTADO PRINCIPAL ---
  const [sermon, setSermon] = useState<Sermon>(() => {
    if (initialSermonData) return initialSermonData;
    const saved = localStorage.getItem('current_sermon');
    return saved ? JSON.parse(saved) : createFreshSermon(t);
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
  const [visualQuery, setVisualQuery] = useState('');
  const [searchImages, setSearchImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
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
  // THEME SEARCH STATE
  const [themeSearchMode, setThemeSearchMode] = useState(false);
  const [themeQuery, setThemeQuery] = useState('');
  const [themeResults, setThemeResults] = useState<any[]>([]);
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

  // Pexels API Key State
  const [pexelsApiKey, setPexelsApiKey] = useState(() => localStorage.getItem('pexels_api_key') || '');
  const [visualSource, setVisualSource] = useState<'ai' | 'pexels'>('ai'); // Source selector
  const [hasAutoSuggested, setHasAutoSuggested] = useState(false); // Validates if auto-suggest ran

  // Save Pexels Key when changed
  useEffect(() => {
    if (pexelsApiKey) {
      localStorage.setItem('pexels_api_key', pexelsApiKey);
      setVisualSource('pexels'); // Auto-switch if key is added
    } else {
      localStorage.removeItem('pexels_api_key');
    }
  }, [pexelsApiKey]);

  // AUTO-SUGGEST IMAGES ON CONTEXT
  useEffect(() => {
    if (!hasAutoSuggested && (sermon.title || sermon.mainVerseText) && !searchImages.length && !isVisualLoading) {
      const timeoutId = setTimeout(() => {
        if (sermon.title.length > 5 || sermon.mainVerseText.length > 20) {
          console.log("Auto-suggesting images based on context...");
          handleSuggestImages();
          setHasAutoSuggested(true);
        }
      }, 2000); // 2s delay to allow typing
      return () => clearTimeout(timeoutId);
    }
  }, [sermon.title, sermon.mainVerseText, hasAutoSuggested]);

  const sermonRef = useRef(sermon);
  const contentEditableRef = useRef<HTMLDivElement>(null);
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

  // FIX: Sincronización segura del editor de Avisos para evitar saltos de cursor
  useEffect(() => {
    if (announcementsRef.current) {
      // Solo actualizar si el contenido es diferente Y el elemento NO tiene el foco
      // Esto evita que React sobrescriba el DOM mientras el usuario escribe
      if (announcementsRef.current.innerHTML !== (sermon.announcements || '') &&
        document.activeElement !== announcementsRef.current) {
        announcementsRef.current.innerHTML = sermon.announcements || '';
      }
    }
  }, [sermon.announcements]);

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
        if (history.length > 10) history = history.slice(0, 10);
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
    if (!timerState.isRunning && timerState.timeLeft === 0 && totalSeconds > 0) {
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

  const handleAddDailyLifeSection = () => {
    const newSection: SermonSection = {
      id: Date.now().toString(),
      type: SectionType.VIDA_DIARIA,
      title: 'Vida Diaria',
      durationMin: 5,
      content: ''
    };
    setSermon(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setActiveSectionId(newSection.id);
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
    const bookName = tempSelectedBook.name || t('bible.' + tempSelectedBook.id);
    const finalRef = `${bookName} ${tempSelectedChapter}:${verseString}`;
    setSermon(prev => ({ ...prev, mainVerse: finalRef }));
    setVersePickerStep('none');
    setIsVerseLoading(true);
    try {
      const text = await fetchVerseText(finalRef, sermon.mainVerseVersion || bibleVersions[0].id);
      setSermon(prev => ({ ...prev, mainVerseText: text }));
    } catch (e: any) { alert(e.message); } finally { setIsVerseLoading(false); }
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
        alert(err.message || "Error al cambiar versión");
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
    setSermon(prev => ({ ...prev, mainVerse: '', mainVerseText: '' }));
    setVersePickerStep('books');
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

  const handleVisualSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || visualQuery;
    if (!q) return;
    if (overrideQuery) setVisualQuery(overrideQuery);
    setIsVisualLoading(true);
    setSearchImages([]);

    try {
      // 1. Mejora: SIEMPRE intentar usar traducción a Inglés para mejorar relevancia en Pexels y AI
      let description = q;
      try {
        // Forzamos traducción siempre, ya que Pexels y los modelos de IA funcionan mucho mejor en inglés
        // Esto soluciona problemas de relevancia cuando se busca en español/portugués
        const translated = await translateForImageSearch(q);
        if (translated && translated.length > 2) {
          description = translated.replace(/[^ \w\s,]/gi, '');
        }
      } catch (e) {
        console.warn("Translation failed, using original query", e);
      }

      const images: string[] = [];

      // 1. PEXELS SEARCH (Strict)
      if (visualSource === 'pexels') {
        if (!pexelsApiKey) {
          alert("Para buscar en Pexels, por favor configura tu API Key en el menú de Configuración.");
          setIsVisualLoading(false);
          return;
        }
        try {
          // Usamos la query original 'q' para Pexels si 'description' falló o si preferimos español
          const queryToUse = visualSource === 'pexels' ? q : description;
          const pexelsResp = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(queryToUse)}&per_page=4&orientation=landscape&locale=es-ES`, {
            headers: { Authorization: pexelsApiKey }
          });
          if (pexelsResp.ok) {
            const data = await pexelsResp.json();
            const photos = data.photos.map((p: any) => p.src.medium);
            if (photos.length === 0) alert("No se encontraron imágenes en Pexels para esta búsqueda.");
            else images.push(...photos);
          } else {
            console.error("Pexels Error:", pexelsResp.status);
            alert("Error al conectar con Pexels. Verifica tu API Key.");
          }
        } catch (err) {
          console.error("Error fetching Pexels:", err);
          alert("Error de red al conectar con Pexels.");
        }
      }

      // 2. AI GENERATION (Strict)
      else {
        // Generamos 4 variantes
        const aiStyles = [
          { prompt: "cinematic lighting, biblical art, photorealistic, 8k", model: "flux-realism" },
          { prompt: "oil painting, dramatic light, masterpiece, detailed", model: "turbo" },
          { prompt: "digital art, soft colors, serene, atmosphere", model: "flux" },
          { prompt: "epical scene, movie still, high quality", model: "turbo" }
        ];

        aiStyles.forEach((style, index) => {
          const finalPrompt = `${description}, ${style.prompt}`;
          const encoded = encodeURIComponent(finalPrompt);
          const seed = Math.floor(Math.random() * 10000) + index;
          images.push(`https://image.pollinations.ai/prompt/${encoded}?width=800&height=450&model=${style.model}&nologo=true&seed=${seed}`);
        });
      }

      setSearchImages(images);
    } catch (error: any) {
      alert(`Error al buscar imágenes: ${error.message}`);
    } finally {
      setIsVisualLoading(false);
    }
  };

  const handleSuggestImages = async () => {
    setIsVisualLoading(true);
    let textToAnalyze = activeSection.content || sermon.sections.map(s => s.content).join(' ');

    // Fallback: Si no hay contenido en secciones, usar Título y Versículo (ideal para auto-sugerencias al inicio)
    if ((!textToAnalyze || textToAnalyze.length < 10) && (sermon.title || sermon.mainVerseText)) {
      textToAnalyze = `${sermon.title} ${sermon.mainVerseText}`;
    }

    if (!textToAnalyze || textToAnalyze.length < 5) {
      // Si aún así no hay texto suficiente
      alert("Escribe contenido o un título para sugerir imágenes.");
      setIsVisualLoading(false);
      return;
    }

    try {
      const keywords = await extractVisualKeywords(textToAnalyze);
      handleVisualSearch(keywords);
    } catch (error: any) { alert(error.message); setIsVisualLoading(false); }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') { setSelectedImage(event.target.result); }
      };
      reader.readAsDataURL(file);
    }
  };

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
    });

    if (sermon.bibleNotes) {
      contentHtml += `<hr/><h3>Notas Exegéticas</h3><p>${sermon.bibleNotes}</p>`;
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

  // --- THEME SEARCH HANDLERS ---
  const handleSearchTheme = async () => {
    if (!themeQuery.trim()) return;
    setIsSearchingTheme(true);
    setThemeResults([]);
    try {
      const results = await searchVersesByTheme(themeQuery);
      setThemeResults(results);
    } catch (error) {
      console.error(error);
      alert("Error buscando versículos por tema");
    } finally {
      setIsSearchingTheme(false);
    }
  };

  const handleSelectSuggestedVerse = (verse: any) => {
    setSermon(prev => ({
      ...prev,
      mainVerse: verse.ref,
      mainVerseText: verse.text,
      mainVerseVersion: 'RVR1960' // Default or make selectable
    }));
    // Clear picker state
    setVersePickerStep('none');
    setTempSelectedBook(null);
    setTempSelectedChapter(null);
    setTempSelectedVerses([]);
    setThemeSearchMode(false); // Reset mode
  };

  const handleSaveOnlyMetadata = () => {
    setShowConfigModal(false);

    // Trigger auto-save logic manually to ensure persistence
    const current = sermonRef.current;
    localStorage.setItem('current_sermon', JSON.stringify(current));
    setLastSaved(new Date());

    // Optional: Add to history
    const historyJson = localStorage.getItem('sermon_history');
    let history: Sermon[] = historyJson ? JSON.parse(historyJson) : [];
    const existingIndex = history.findIndex(s => s.id === current.id);
    if (existingIndex >= 0) {
      history[existingIndex] = { ...current, updatedAt: Date.now() };
    } else {
      history.unshift({ ...current, updatedAt: Date.now() });
    }
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('sermon_history', JSON.stringify(history));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
        {sermon.sections.map(s => (
          <div key={s.id}>
            <h3>{s.title} ({s.durationMin} min)</h3>
            <div dangerouslySetInnerHTML={{ __html: s.content }} />
          </div>
        ))}
        {sermon.bibleNotes && <div><h3>NOTAS</h3><p>{sermon.bibleNotes}</p></div>}
        {sermon.announcements && <div><h3>AVISOS</h3><div dangerouslySetInnerHTML={{ __html: sermon.announcements || '' }} /></div>}
      </div>

      <div className="no-print h-full flex flex-col overflow-hidden">
        <header className="h-[72px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="icon" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}><PanelRight className="w-6 h-6" /></Button>
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
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-tertiary)]" onClick={() => setLeftSidebarOpen(false)} title="Ocultar Estructura">
                <ChevronLeft className="w-5 h-5" />
              </Button>
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

              {!timerState.isRunning && (
                <button
                  onClick={handleAddDailyLifeSection}
                  className="w-full mt-2 py-2 border border-blue-200 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-100 flex items-center justify-center gap-2 text-xs transition-colors font-semibold shadow-sm"
                  title="Conecta una situación real con el versículo"
                >
                  <HeartHandshake className="w-3 h-3" /> Añadir "Vida Diaria"
                </button>
              )}
            </div>
          </aside>

          {!leftSidebarOpen && (
            <div className="absolute left-0 top-4 z-10 animate-fade-in-right">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setLeftSidebarOpen(true)}
                className="h-10 w-8 rounded-l-none shadow-lg border-l-0 bg-[var(--bg-secondary)] hover:w-10 transition-all hover:text-[var(--accent-color)]"
                title="Mostrar Estructura"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
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

                  {/* INSTRUCCIONES ESTADO VIDA DIARIA */}
                  {activeSection.type === SectionType.VIDA_DIARIA && !activeSection.content && (
                    <div className="mb-4 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200 flex gap-3 shadow-sm animate-fade-in">
                      <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <strong className="block mb-1 text-blue-900">Sección: Aplicación a la Vida Diaria</strong>
                        Escribe abajo una <strong>situación real</strong> (ej: "Pérdida de un familiar", "Desempleo", "Ansiedad por el futuro").
                        <br />Luego presiona el botón <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"><Sparkles className="w-3 h-3 mr-0.5" /> IA</span> arriba para que el sistema redacte una <strong>reflexión pastoral</strong> conectando esa situación con tu versículo.
                      </div>
                    </div>
                  )}
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
                    className="w-full h-full min-h-[600px] outline-none font-reading leading-loose text-[var(--text-primary)] empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--text-secondary)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 text-justify [&_p]:mb-4"
                    data-placeholder={t('editor.placeholder')}
                    style={{
                      fontSize: `${textSettings.fontSize}px`,
                      lineHeight: textSettings.lineHeight
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="h-14 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between px-6 shrink-0">
              <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300" onClick={() => { const idx = sermon.sections.findIndex(s => s.id === activeSectionId); if (idx > 0) setActiveSectionId(sermon.sections[idx - 1].id); }} disabled={sermon.sections.findIndex(s => s.id === activeSectionId) === 0}><ChevronLeft className="w-4 h-4 mr-2" /> {t('editor.prev')}</Button>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{sermon.sections.findIndex(s => s.id === activeSectionId) + 1} de {sermon.sections.length}</span>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all" onClick={() => { const idx = sermon.sections.findIndex(s => s.id === activeSectionId); if (idx < sermon.sections.length - 1) setActiveSectionId(sermon.sections[idx + 1].id); }} disabled={sermon.sections.findIndex(s => s.id === activeSectionId) === sermon.sections.length - 1}>{t('editor.next')} <ChevronRight className="w-4 h-4 ml-2" /></Button>
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
                  <div className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white shadow-lg text-center">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-80" />
                      <h3 className="font-bold text-sm">Estudio Creativo</h3>
                      <p className="text-xs opacity-80 mt-1">Genera visuales para tu sermón</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex rounded-lg bg-[var(--bg-primary)] p-1 border border-[var(--border-color)] shrink-0">
                          <button
                            onClick={() => setVisualSource('ai')}
                            className={`px-3 py-1 text-xs font-bold rounded ${visualSource === 'ai' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                            title="Generar imágenes únicas con IA"
                          >
                            ✨ IA
                          </button>
                          <button
                            onClick={() => setVisualSource('pexels')}
                            className={`px-3 py-1 text-xs font-bold rounded ${visualSource === 'pexels' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                            title="Buscar fotos de stock en Pexels"
                          >
                            📸 Pexels
                          </button>
                        </div>
                        <input
                          type="text"
                          value={visualQuery}
                          onChange={(e) => setVisualQuery(e.target.value)}
                          placeholder={visualSource === 'ai' ? t('editor.visual.search') : "Buscar en Pexels..."}
                          className="flex-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                          onKeyDown={(e) => e.key === 'Enter' && handleVisualSearch()}
                        />
                        <Button size="icon" onClick={() => handleVisualSearch()} disabled={isVisualLoading}><Search className="w-4 h-4" /></Button>
                      </div>
                      <div className="flex justify-between items-center">
                        <Button variant="secondary" size="sm" className="text-xs" onClick={handleSuggestImages} disabled={isVisualLoading} icon={<Wand2 className="w-3 h-3" />}>
                          {t('editor.visual.suggest')}
                        </Button>
                        {!searchImages.length && !isVisualLoading && (
                          <span className="text-[10px] text-[var(--text-secondary)] animate-pulse">
                            {hasAutoSuggested ? "Sugerencias cargadas" : "Esperando contexto para sugerir..."}
                          </span>
                        )}
                      </div>
                    </div>

                    {searchImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {searchImages.map((img, i) => (
                          <div key={i} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[var(--accent-color)]" onClick={() => setSelectedImage(img)}>
                            <img
                              src={img}
                              alt="Result"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.includes('placeholder')) {
                                  target.style.display = 'none';
                                  target.parentElement!.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-400 text-[10px] p-1 text-center font-bold border border-red-200"><span class="text-xs">⚠️</span><span class="leading-tight">Error Red</span></div>`;
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-center text-gray-400 mt-1 italic">
                      Nota: Si ves ⚠️, es posible que tu red (WiFi) bloquee las imágenes.
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-4">
                      <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-2">Editor de Slide</label>
                      <div ref={previewRef} className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-md group">
                        {selectedImage ? (
                          <>
                            <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" style={{ filter: IMAGE_FILTERS[imageFilter as keyof typeof IMAGE_FILTERS]?.style }} />
                            <button
                              onClick={() => setSelectedImage(null)}
                              className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                              title="Eliminar imagen y usar solo color de fondo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/50 text-xs" style={{ backgroundColor: visualBgColor }}>
                            {overlayText ? '' : 'Click para agregar texto'}
                          </div>
                        )}
                        {overlayText && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                            <div className="bg-black text-white p-4 rounded text-center font-bold" style={{ backgroundColor: selectedImage ? `${visualBgColor}${Math.round(overlayOpacity * 2.55).toString(16).padStart(2, '0')}` : 'transparent', fontSize: `${visualTextSize}px` }}>
                              {overlayText}
                            </div>
                          </div>
                        )}
                        {placedIcons.map(icon => (
                          <DraggableIcon key={icon.id} {...icon} onRemove={removeIcon} parentRef={previewRef} tooltip={t('ui.drag_remove')} />
                        ))}
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
                          <div className="flex gap-1 items-center flex-wrap justify-end">
                            <span className="text-[10px] text-[var(--text-secondary)] mr-1 whitespace-nowrap">Fondo:</span>
                            {['#000000', '#1A1A1A', '#333333', '#555555', // Grayscale
                              '#1e3a5f', '#102a43', '#243b53', '#334E68', // Blues
                              '#2d4a3e', '#143026', '#264e32', '#3e6b52', // Greens
                              '#4a1a2d', '#38101e', '#5e2139', '#822d4f', // Reds/Maroons
                              '#3d2d1a', '#291d10', '#4d3920', '#6b5030', // Browns
                              '#1a1a3d', '#101026', '#25255e', '#393982'  // Purples
                            ].map(color => (
                              <button
                                key={color}
                                onClick={() => setVisualBgColor(color)}
                                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${visualBgColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                            <input type="color" value={visualBgColor} onChange={(e) => setVisualBgColor(e.target.value)} className="w-5 h-5 p-0 border-0 rounded cursor-pointer shrink-0" title="Color personalizado" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[10px] text-[var(--text-secondary)]">{t('editor.visual.opacity')}</label><input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer" /></div>
                          <div><label className="text-[10px] text-[var(--text-secondary)]">{t('editor.visual.text_size')}</label><input type="range" min="12" max="72" value={visualTextSize} onChange={(e) => setVisualTextSize(parseInt(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer" /></div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {Object.entries(IMAGE_FILTERS).map(([key, filter]) => (
                            <button key={key} onClick={() => setImageFilter(key)} className={`px-2 py-1 text-[10px] rounded border ${imageFilter === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>{filter.label}</button>
                          ))}
                        </div>

                        <div>
                          <label className="text-[10px] text-[var(--text-secondary)] uppercase font-bold mb-1 block">Stickers</label>
                          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                            {CHRISTIAN_EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => addIconToCanvas(emoji)} className="text-xl hover:scale-125 transition-transform">{emoji}</button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleLocalImageUpload} />
                            <Button variant="secondary" size="sm" className="w-full text-xs">Subir Foto</Button>
                          </div>
                          <Button size="sm" className="flex-1 text-xs" onClick={downloadImage} disabled={!selectedImage}>{t('ui.download_image')}</Button>
                        </div>
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
                        suppressContentEditableWarning={true}
                        dir="ltr"
                        className="flex-1 p-3 outline-none overflow-y-auto text-sm [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:mb-1"
                        onInput={handleAnnouncementsChange}
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
      {showConfigModal && (
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
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Evento / Servicio</label>
                  <input type="text" value={sermon.eventName || ''} onChange={(e) => setSermon(prev => ({ ...prev, eventName: e.target.value }))} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" placeholder="Ej. Culto Dominical" />
                </div>
              </div>

              {/* INTEGRACIONES EXTERNAS (PEXELS) */}
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-500" /> Integraciones Visuales
                </h3>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Pexels API Key (Opcional)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={pexelsApiKey}
                      onChange={(e) => setPexelsApiKey(e.target.value)}
                      className="flex-1 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm"
                      placeholder="Pega tu API Key de Pexels aquí..."
                    />
                    <Button variant="secondary" size="sm" onClick={() => window.open('https://www.pexels.com/api/', '_blank')}>Conseguir Key</Button>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Si configuras esto, recibirás fotos reales de stock además de las generadas por IA.</p>
                </div>
              </div>

              {/* Verse Picker Section */}
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center justify-between">
                  <span>{t('config.verse_base')}</span>
                  {versePickerStep !== 'none' && <button onClick={() => setVersePickerStep('none')} className="text-xs text-red-500 hover:underline">Cancelar Selección</button>}
                </label>

                {versePickerStep === 'none' ? (
                  <div
                    onClick={!sermon.mainVerse ? handleOpenVersePicker : undefined}
                    className={`group p-0 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm transition-all relative flex flex-col min-h-[160px] ${!sermon.mainVerse ? 'cursor-pointer hover:border-[var(--accent-color)] hover:shadow-lg' : ''}`}
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
                      <div className="flex-1 flex flex-col items-center justify-center p-6 hover:bg-[var(--bg-tertiary)] transition-colors">
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-full mb-3 shadow-md group-hover:scale-110 transition-transform">
                          <Plus className="w-8 h-8 text-[var(--accent-color)]" />
                        </div>
                        <span className="font-bold text-[var(--text-primary)]">Seleccionar Versículo Base</span>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Haz clic para abrir la Biblia</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] h-[350px] flex flex-col">
                    {/* TABS SELECTOR */}
                    <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-lg shrink-0">
                      <button
                        onClick={() => setThemeSearchMode(false)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!themeSearchMode ? 'bg-white shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                      >
                        📖 Libros
                      </button>
                      <button
                        onClick={() => setThemeSearchMode(true)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${themeSearchMode ? 'bg-white shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                      >
                        🔍 Por Tema
                      </button>
                    </div>

                    {themeSearchMode ? (
                      // THEME SEARCH UI
                      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                        <div className="flex gap-2 shrink-0">
                          <input
                            type="text"
                            placeholder="Ej: Esperanza, Fe en tiempos difíciles..."
                            className="flex-1 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                            value={themeQuery}
                            onChange={(e) => setThemeQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchTheme()}
                          />
                          <Button onClick={handleSearchTheme} disabled={isSearchingTheme || !themeQuery.trim()} size="sm">
                            {isSearchingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                          {themeResults.length === 0 && !isSearchingTheme ? (
                            <div className="text-center text-[var(--text-secondary)] py-8 text-xs">
                              Escribe un tema para buscar versículos sugeridos por IA.
                            </div>
                          ) : (
                            themeResults.map((verse, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleSelectSuggestedVerse(verse)}
                                className="p-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)] border border-[var(--border-color)] rounded-lg cursor-pointer transition-all group"
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-bold text-xs text-[var(--accent-color)]">{verse.ref}</span>
                                  <span className="text-[10px] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">RVR1960</span>
                                </div>
                                <p className="text-xs text-[var(--text-primary)] italic mb-1">"{verse.text}"</p>
                                <p className="text-[10px] text-[var(--text-secondary)]">{verse.relevance}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full overflow-hidden">
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
                          <div className="flex flex-col h-full overflow-hidden">
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
                )}
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 shrink-0 bg-[var(--bg-secondary)]">
              <Button variant="ghost" onClick={() => setShowConfigModal(false)}>{t('config.cancel')}</Button>
              <Button variant="secondary" onClick={handleSaveOnlyMetadata} disabled={isGeneratingStructure}>Guardar Solo Datos</Button>
              <Button onClick={handleSaveConfig} loading={isGeneratingStructure}>{t('config.save_generate')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Selection Dialog */}
      {showStorageDialog && (
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
      )}
    </div>
  );
};
