import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Rewind, Settings, Type, X, ArrowLeft, FlipHorizontal, RefreshCcw, Minus, Plus, Maximize2, Minimize2, Clock, List, AlignJustify, Hash } from 'lucide-react';
import { Sermon, SectionType } from '../types';
import { Button } from './Button';

export type TeleprompterContentType = 'sermon' | 'study' | 'dictionary';

interface TeleprompterProps {
  onBack: () => void;
  contentType?: TeleprompterContentType;
  customContent?: { title: string; content: string }; // For study/dictionary
}

export const Teleprompter: React.FC<TeleprompterProps> = ({ onBack, contentType = 'sermon', customContent }) => {
  // --- STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // 1-10 scale
  const [fontSize, setFontSize] = useState(60); // px
  const [isMirrored, setIsMirrored] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [studyContent, setStudyContent] = useState<{ title: string; content: string } | null>(null);
  const [dictContent, setDictContent] = useState<{ title: string; content: string } | null>(null);
  const [margin, setMargin] = useState(20); // % width
  const [theme, setTheme] = useState<'dark' | 'light' | 'yellow' | 'beige'>('dark');

  // New Features State
  const [elapsedTime, setElapsedTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [showOutline, setShowOutline] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeContentType, setActiveContentType] = useState<TeleprompterContentType>(contentType);

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number>();
  const lastScrollTime = useRef<number>(0);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Always try to load sermon
    const savedSermon = localStorage.getItem('current_sermon');
    if (savedSermon) {
      try {
        setSermon(JSON.parse(savedSermon));
      } catch { setSermon(null); }
    }

    // Load study/dictionary from the actual session where BibleSearch saves data
    const savedSession = localStorage.getItem('last_study_session');
    if (savedSession) {
      try {
        const { savedQuery, savedResult, savedDictResult } = JSON.parse(savedSession);

        // Format study content (Tema)
        if (savedResult) {
          let html = `<h2>Estudio: ${savedQuery || 'Búsqueda'}</h2>`;
          html += `<h3>Fundamento Bíblico</h3>`;
          if (savedResult.verses) {
            savedResult.verses.forEach((v: any) => {
              html += `<p><strong>${v.ref}</strong> (${v.version})<br/><em>"${v.text}"</em></p>`;
            });
          }
          if (savedResult.insight) {
            html += `<hr/><h3>${savedResult.insight.title}</h3>`;
            html += `<p>${savedResult.insight.content}</p>`;
          }
          setStudyContent({ title: `Estudio: ${savedQuery || 'Búsqueda'}`, content: html });
        }

        // Format dictionary content
        if (savedDictResult) {
          let html = `<h2>${savedDictResult.originalWord}</h2>`;
          html += `<p><strong>Idioma:</strong> ${savedDictResult.language} | <strong>Fonética:</strong> /${savedDictResult.phonetic}/</p>`;
          html += `<h3>Definición</h3><p>${savedDictResult.definition}</p>`;
          html += `<h3>Significado Teológico</h3><p>${savedDictResult.theologicalSignificance}</p>`;
          if (savedDictResult.biblicalReferences) {
            html += `<h3>Referencias</h3><ul>${savedDictResult.biblicalReferences.map((r: string) => `<li>${r}</li>`).join('')}</ul>`;
          }
          setDictContent({ title: `Diccionario: ${savedDictResult.term}`, content: html });
        }
      } catch (e) {
        console.error('Error loading study session:', e);
      }
    }

    // Also check for custom content passed as prop
    if (customContent) {
      if (contentType === 'study') {
        setStudyContent(customContent);
      } else if (contentType === 'dictionary') {
        setDictContent(customContent);
      }
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSpeed(prev => Math.min(prev + 1, 10));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSpeed(prev => Math.max(prev - 1, 0));
      } else if (e.code === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
          setIsFullScreen(false);
        } else {
          onBack();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contentType, customContent, onBack]);

  // --- CALCULATIONS & LOGIC ---

  // Calculate Remaining Time based on current Speed and Scroll Position
  const updateMetrics = () => {
    if (!scrollRef.current) return;

    const element = scrollRef.current;
    const totalHeight = element.scrollHeight;
    const currentScroll = element.scrollTop;
    const viewHeight = element.clientHeight;

    // Calculate Remaining Px
    const remainingPx = totalHeight - currentScroll - viewHeight;

    if (remainingPx <= 0) {
      setRemainingTime(0);
    } else if (speed === 0) {
      setRemainingTime(Infinity); // Paused
    } else {
      // Logic: 
      // Speed logic from scroll loop: pixelSpeed = (speed * 0.5) + 0.2 per frame
      // Assume ~60 frames per second
      const pixelsPerFrame = (speed * 0.5) + 0.2;
      const pixelsPerSecond = pixelsPerFrame * 60;
      const secondsLeft = remainingPx / pixelsPerSecond;
      setRemainingTime(secondsLeft);
    }

    // Determine Active Section
    if (sermon) {
      let activeIdx = 0;
      // Find the section that is closest to the top of the viewport (with a small offset)
      const offset = currentScroll + (viewHeight * 0.3); // Focus point is 30% down screen

      for (let i = 0; i < sermon.sections.length; i++) {
        const secRef = sectionRefs.current[i];
        if (secRef && secRef.offsetTop <= offset) {
          activeIdx = i;
        }
      }
      setActiveSectionIndex(activeIdx);
    }
  };

  // --- SCROLL ENGINE ---
  useEffect(() => {
    const scroll = (timestamp: number) => {
      if (!isPlaying || !scrollRef.current) return;

      if (timestamp - lastScrollTime.current > 16) { // ~60fps cap
        const pixelSpeed = (speed * 0.5) + 0.2; // Base speed calculation
        scrollRef.current.scrollTop += pixelSpeed;
        lastScrollTime.current = timestamp;

        // Update metrics less frequently or every frame? Every frame is fine for simple math
        updateMetrics();
      }

      // Stop if reached bottom
      if (scrollRef.current.scrollTop + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight - 2) {
        setIsPlaying(false);
      } else {
        animationRef.current = requestAnimationFrame(scroll);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(scroll);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // Update once when pausing to ensure accuracy
      updateMetrics();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, speed]);

  // Recalculate metrics when manual scroll or resize happens
  useEffect(() => {
    const handleScroll = () => {
      if (!isPlaying) updateMetrics();
    };
    const el = scrollRef.current;
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, [isPlaying, speed, sermon]);

  // --- TIMER ---
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // --- HANDLERS ---
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const resetTeleprompter = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setIsPlaying(false);
    setElapsedTime(0);
    setRemainingTime(0);
    updateMetrics();
  };

  const scrollToSection = (index: number) => {
    const secRef = sectionRefs.current[index];
    if (secRef && scrollRef.current) {
      // Scroll to section with a bit of padding at top
      scrollRef.current.scrollTo({ top: secRef.offsetTop - 50, behavior: 'smooth' });
      setIsPlaying(false); // Pause when jumping
      setTimeout(updateMetrics, 500); // Update after scroll
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cycleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'yellow';
      if (prev === 'yellow') return 'beige';
      return 'dark';
    });
  };

  // --- THEME STYLES ---
  const getThemeColors = () => {
    switch (theme) {
      case 'light': return 'bg-white text-black selection:bg-blue-200';
      case 'yellow': return 'bg-black text-yellow-400 selection:bg-yellow-900';
      case 'beige': return 'bg-[#fdfbf7] text-[#4b5563] selection:bg-[#e5e7eb]'; // Soft Beige & Gray
      default: return 'bg-black text-white selection:bg-gray-700'; // Dark
    }
  };

  // --- CHECK CONTENT ---
  const hasContent = activeContentType === 'sermon'
    ? sermon !== null
    : activeContentType === 'study'
      ? studyContent !== null
      : dictContent !== null;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white bg-black gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        <p className="text-gray-400">
          {activeContentType === 'sermon' ? 'Cargando sermón...' :
            activeContentType === 'study' ? 'Cargando estudio bíblico...' :
              'Cargando contenido...'}
        </p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[100] flex flex-col overflow-hidden transition-colors duration-300 ${getThemeColors()}`}>

      {/* HEADER OVERLAY (Auto-hides on play, visible on hover) */}
      <div className={`absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center transition-opacity duration-300 hover:opacity-100 ${isPlaying ? 'opacity-0' : 'opacity-100 bg-gradient-to-b from-black/80 to-transparent'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full backdrop-blur-sm transition-all text-sm font-bold border border-gray-600">
            <ArrowLeft className="w-4 h-4" /> Salir
          </button>

          {/* Enhanced Time Display */}
          <div className="bg-gray-800/80 text-white px-4 py-2 rounded-full font-mono text-sm border border-gray-600 flex items-center gap-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2" title="Tiempo Transcurrido">
              <Clock className="w-4 h-4 text-green-400" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex items-center gap-2" title={`Tiempo Restante (Velocidad ${speed})`}>
              <RefreshCcw className={`w-3 h-3 text-yellow-400 ${speed === 0 ? '' : 'animate-spin-slow'}`} style={{ animationDuration: '3s' }} />
              <span className={`${speed === 0 ? 'opacity-50' : ''}`}>
                {speed === 0 ? 'Pausado' : `Restan ${formatTime(remainingTime)}`}
              </span>
            </div>
          </div>

          {/* Content Type Toggle */}
          <div className="flex bg-gray-900/80 rounded-full border border-gray-600 backdrop-blur-md overflow-hidden">
            <button
              onClick={() => setActiveContentType('sermon')}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${activeContentType === 'sermon' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Modo Púlpito"
            >
              📜 Púlpito
            </button>
            <button
              onClick={() => setActiveContentType('study')}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${activeContentType === 'study' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Modo Estudio"
            >
              📖 Estudio
            </button>
            <button
              onClick={() => setActiveContentType('dictionary')}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${activeContentType === 'dictionary' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Modo Diccionario"
            >
              📚 Diccionario
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={cycleTheme} className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full border border-gray-600" title="Cambiar Tema">
            {theme === 'dark' && <div className="w-4 h-4 bg-white rounded-full" />}
            {theme === 'light' && <div className="w-4 h-4 bg-black rounded-full" />}
            {theme === 'yellow' && <div className="w-4 h-4 bg-yellow-400 rounded-full" />}
            {theme === 'beige' && <div className="w-4 h-4 bg-[#fdfbf7] rounded-full border border-gray-400" />}
          </button>
          <button onClick={() => setIsMirrored(!isMirrored)} className={`p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full border border-gray-600 ${isMirrored ? 'text-green-400 border-green-500' : ''}`} title="Modo Espejo">
            <FlipHorizontal className="w-5 h-5" />
          </button>
          <button onClick={toggleFullScreen} className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full border border-gray-600">
            {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* READING AREA */}
      <div className="relative flex-1 overflow-hidden flex">
        {/* Visual Guide (Center Line) */}
        <div className="absolute top-1/2 left-0 right-0 h-24 -translate-y-1/2 border-y-2 border-red-500/30 bg-red-500/5 pointer-events-none z-20 flex items-center">
          <div className="w-4 h-4 bg-red-500 absolute left-2 rounded-full opacity-50"></div>
          <div className="w-4 h-4 bg-red-500 absolute right-2 rounded-full opacity-50"></div>
        </div>

        {/* Scrolling Content */}
        <div
          ref={scrollRef}
          className={`flex-1 h-full overflow-y-auto no-scrollbar scroll-smooth outline-none ${isMirrored ? 'scale-x-[-1]' : ''}`}
          style={{ paddingLeft: `${margin}%`, paddingRight: `${margin}%` }}
        >
          {/* Top Padding for initial start */}
          <div className="h-[50vh]"></div>

          <div className="max-w-5xl mx-auto pb-[50vh]" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>

            {/* Sermon Mode */}
            {activeContentType === 'sermon' && sermon && (
              <>
                <h1 className="font-bold text-center mb-12 uppercase tracking-widest border-b-4 border-current pb-4">{sermon.title}</h1>

                {sermon.mainVerse && (
                  <div className="mb-16 text-center italic opacity-90 px-8 border-l-8 border-[var(--accent-color)]">
                    "{sermon.mainVerseText || sermon.mainVerse}"
                    <div className="text-[0.6em] font-bold mt-4 not-italic opacity-70">— {sermon.mainVerse}</div>
                  </div>
                )}

                {sermon.sections.map((section, idx) => (
                  <div
                    key={section.id}
                    ref={el => sectionRefs.current[idx] = el}
                    className={`mb-24 transition-opacity duration-500 ${activeSectionIndex === idx ? 'opacity-100' : 'opacity-60'}`}
                  >
                    <h2 className="font-bold text-[0.8em] uppercase tracking-wide opacity-50 mb-6 border-b border-gray-700 pb-2 flex justify-between">
                      <span>{section.title}</span>
                      <span>{idx + 1}/{sermon.sections.length}</span>
                    </h2>
                    <div
                      className="font-sans font-medium"
                      dangerouslySetInnerHTML={{
                        __html: section.content
                          .replace(/style="[^"]*"/g, "")
                          .replace(/<span[^>]*>/g, "<span>")
                          .replace(/<b>/g, '<b style="color: #3b82f6;">')
                          .replace(/<strong>/g, '<strong style="color: #3b82f6;">')
                      }}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Study Mode */}
            {activeContentType === 'study' && studyContent && (
              <>
                <h1 className="font-bold text-center mb-12 uppercase tracking-widest border-b-4 border-current pb-4">
                  📖 Estudio Bíblico
                </h1>
                <h2 className="text-center text-[0.7em] mb-12 opacity-80">{studyContent.title}</h2>
                <div
                  className="font-sans font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: studyContent.content
                      .replace(/style="[^"]*"/g, "")
                      .replace(/<b>/g, '<b style="color: #3b82f6;">')
                      .replace(/<strong>/g, '<strong style="color: #3b82f6;">')
                  }}
                />
              </>
            )}

            {/* Dictionary Mode */}
            {activeContentType === 'dictionary' && dictContent && (
              <>
                <h1 className="font-bold text-center mb-12 uppercase tracking-widest border-b-4 border-current pb-4">
                  📚 Diccionario
                </h1>
                <h2 className="text-center text-[0.7em] mb-12 opacity-80">{dictContent.title}</h2>
                <div
                  className="font-sans font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: dictContent.content
                      .replace(/style="[^"]*"/g, "")
                      .replace(/<b>/g, '<b style="color: #a855f7;">')
                      .replace(/<strong>/g, '<strong style="color: #a855f7;">')
                  }}
                />
              </>
            )}

            <div className="text-center opacity-50 py-12 text-[0.5em] font-mono">
              *** FIN DEL {activeContentType === 'sermon' ? 'MENSAJE' : activeContentType === 'study' ? 'ESTUDIO' : 'CONTENIDO'} ***
            </div>
          </div>
        </div>

        {/* STRUCTURE SIDEBAR (Right) - Only for sermon mode */}
        {showOutline && activeContentType === 'sermon' && sermon && (
          <div className="w-80 bg-[#111] border-l border-gray-800 z-30 flex flex-col animate-slide-in-right shadow-2xl relative">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Estructura</h3>
              <button onClick={() => setShowOutline(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {sermon.sections.map((section, idx) => {
                const isActive = activeSectionIndex === idx;
                // Strip html tags for preview
                const preview = section.content.replace(/<[^>]+>/g, '').substring(0, 60) + '...';
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all group ${isActive ? 'bg-blue-900/30 border-blue-500/50' : 'bg-[#1a1a1a] border-gray-800 hover:border-gray-600'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold uppercase ${isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        {idx + 1}. {section.title}
                      </span>
                      {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                      {preview}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Study/Dictionary outline placeholder */}
        {showOutline && activeContentType !== 'sermon' && (
          <div className="w-80 bg-[#111] border-l border-gray-800 z-30 flex flex-col shadow-2xl relative">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contenido</h3>
              <button onClick={() => setShowOutline(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-4 text-gray-400 text-sm">
              <p>Modo: {activeContentType === 'study' ? 'Estudio Bíblico' : 'Diccionario'}</p>
              {studyContent && <p className="mt-2 text-white">{studyContent.title}</p>}
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS BAR (Bottom) - ALWAYS VISIBLE */}
      <div className="h-24 bg-[#1a1a1a] border-t border-gray-800 flex items-center justify-between px-8 shrink-0 z-50">

        {/* Speed Control */}
        <div className="flex flex-col items-center w-32">
          <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">Velocidad: {speed}</span>
          <div className="flex items-center gap-2 w-full">
            <button onClick={() => setSpeed(s => Math.max(0, s - 1))} className="text-gray-400 hover:text-white"><Rewind className="w-5 h-5" /></button>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <button onClick={() => setSpeed(s => Math.min(10, s + 1))} className="text-gray-400 hover:text-white"><FastForward className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Main Playback */}
        <div className="flex items-center gap-6">
          <button onClick={resetTeleprompter} className="p-3 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Reiniciar">
            <RefreshCcw className="w-6 h-6" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-4 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center ${isPlaying ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>

          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`p-3 rounded-full transition-colors ${showOutline ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Ver Estructura / Próximos"
          >
            <List className="w-6 h-6" />
          </button>
        </div>

        {/* Font & Margin */}
        <div className="flex items-center gap-6 border-l border-gray-700 pl-6">
          {/* Font Size */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">Fuente</span>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              <button onClick={() => setFontSize(s => Math.max(20, s - 5))} className="p-1 hover:bg-gray-700 rounded text-white"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center text-sm font-mono text-white">{fontSize}</span>
              <button onClick={() => setFontSize(s => Math.min(150, s + 5))} className="p-1 hover:bg-gray-700 rounded text-white"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Margin */}
          <div className="flex flex-col items-center w-24">
            <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">Margen</span>
            <input
              type="range"
              min="0"
              max="35"
              value={margin}
              onChange={(e) => setMargin(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
