
import React, { useEffect, useState, useRef } from 'react';
import { Theme, ViewState, AIConfig, AIProvider, TextSettings, Language } from '../types';
import { Home, Search, PenTool, Settings, X, Globe, Cpu, Zap, Box, Palette, Book, Type, LogOut, Highlighter, Underline, Smile, Star, MoreHorizontal, RotateCcw, Check, AlignLeft, AlignCenter, AlignRight, AlignJustify, CaseUpper, CaseLower, CaseSensitive, Type as TypeIcon, Ban, Bold, Italic, Strikethrough, List, ListOrdered, Table, LayoutTemplate, Trash2, User, Camera, WifiOff, Wifi, Library, Minus, Plus, Scaling, Undo, Redo, Calendar, LayoutGrid } from 'lucide-react';
import { Button } from './Button';
import { validateAIConfig } from '../services/geminiService';
import { useTranslation } from '../context/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  textSettings: TextSettings;
  onUpdateTextSettings: (settings: TextSettings) => void;
  onLogout: () => void;
  userAvatar?: string;
  onUpdateAvatar: (url: string) => void;
}

const AI_PRESETS: Record<string, { label: string; provider: AIProvider; baseUrl: string; modelId: string; icon: any }> = {
  gemini: { label: 'Google Gemini', provider: 'gemini', baseUrl: '', modelId: 'gemini-2.5-flash', icon: Cpu },
  deepseek: { label: 'DeepSeek V3', provider: 'external', baseUrl: 'https://api.deepseek.com', modelId: 'deepseek-chat', icon: Zap },
  openai: { label: 'OpenAI', provider: 'external', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o', icon: Box },
  groq: { label: 'Groq', provider: 'external', baseUrl: 'https://api.groq.com/openai/v1', modelId: 'llama-3.3-70b-versatile', icon: Zap },
  custom: { label: 'Custom', provider: 'external', baseUrl: '', modelId: '', icon: Globe }
};

// --- RICH TEXT ASSETS ---
const HIGHLIGHT_COLORS = [
  '#fef08a', // Yellow
  '#fde047', // Yellow Dark
  '#bef264', // Lime
  '#86efac', // Light Green
  '#67e8f9', // Cyan
  '#7dd3fc', // Sky
  '#f9a8d4', // Pink
  '#f472b6', // Pink Dark
  '#d8b4fe', // Purple
  '#c4b5fd', // Violet
  '#fdba74', // Orange
  '#fb923c', // Orange Dark
  '#fca5a5', // Red
  '#f87171', // Red Dark
  '#cbd5e1', // Gray
  '#a5f3fc', // Aqua
];

const TEXT_COLORS = [
  '#000000', // Black
  '#1e293b', // Slate Dark
  '#475569', // Slate
  '#6b7280', // Gray
  '#dc2626', // Red
  '#b91c1c', // Red Dark
  '#ea580c', // Orange
  '#d97706', // Amber
  '#ca8a04', // Yellow Dark
  '#16a34a', // Green
  '#15803d', // Green Dark
  '#0d9488', // Teal
  '#0891b2', // Cyan
  '#2563eb', // Blue
  '#1d4ed8', // Blue Dark
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#9333ea', // Purple
  '#c026d3', // Fuchsia
  '#db2777', // Pink
  '#ffffff'  // White (useful for dark mode)
];

const FONTS = [
  { name: 'Sans', value: 'Inter, sans-serif' },
  { name: 'Serif', value: 'Merriweather, serif' },
  { name: 'Mono', value: 'monospace' },
  { name: 'Hand', value: 'cursive' }
];

const SELECTION_FONT_SIZES = [
  { label: 'XS', value: '12px' },
  { label: 'S', value: '14px' },
  { label: 'M', value: '16px' },
  { label: 'L', value: '20px' },
  { label: 'XL', value: '24px' },
  { label: '2XL', value: '30px' },
];

export const Layout: React.FC<LayoutProps> = ({ children, theme, onToggleTheme, currentView, onNavigate, textSettings, onUpdateTextSettings, onLogout, userAvatar, onUpdateAvatar }) => {
  const { t, language } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [textSettingsTab, setTextSettingsTab] = useState<'view' | 'format'>('view');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Format State
  const [underlineColor, setUnderlineColor] = useState('#2563eb');
  const [customTextColor, setCustomTextColor] = useState('#000000');
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a');

  const [selectedPreset, setSelectedPreset] = useState<string>('gemini');
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', apiKey: '', baseUrl: '', modelId: '', friendlyName: '', useCorsProxy: false });
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Check if custom config exists in storage
  const [hasCustomConfig, setHasCustomConfig] = useState(!!localStorage.getItem('app_ai_config'));

  // Offline Detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('app_ai_config');
    if (saved) {
      setHasCustomConfig(true);
      const config = JSON.parse(saved);
      setAiConfig(config);
      if (config.provider === 'gemini') setSelectedPreset('gemini');
      else if (config.baseUrl === AI_PRESETS.deepseek.baseUrl) setSelectedPreset('deepseek');
      else if (config.baseUrl === AI_PRESETS.openai.baseUrl) setSelectedPreset('openai');
      else if (config.baseUrl === AI_PRESETS.groq.baseUrl) setSelectedPreset('groq');
      else setSelectedPreset('custom');
    } else {
      setHasCustomConfig(false);
    }
  }, [showSettings]); // Reload when settings modal opens

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = AI_PRESETS[presetKey];
    setAiConfig(prev => ({
      ...prev, provider: preset.provider, baseUrl: preset.baseUrl, modelId: preset.modelId, friendlyName: preset.label,
      useCorsProxy: presetKey === 'deepseek' || presetKey === 'groq' ? true : prev.useCorsProxy
    }));
  };

  const handleSaveSettings = async () => {
    setIsValidating(true);
    setValidationStatus('idle');
    const result = await validateAIConfig(aiConfig);
    setIsValidating(false);
    if (result.isValid) {
      localStorage.setItem('app_ai_config', JSON.stringify(aiConfig));
      setHasCustomConfig(true);
      setValidationStatus('success');
      setTimeout(() => { setShowSettings(false); }, 500);
    } else {
      setValidationStatus('error');
      setErrorMessage(result.error || t('settings.error'));
    }
  };

  const handleClearSettings = () => {
    if (window.confirm(t('settings.confirm_clear'))) {
      localStorage.removeItem('app_ai_config');
      setAiConfig({ provider: 'gemini', apiKey: '', baseUrl: '', modelId: '', friendlyName: '', useCorsProxy: false });
      setSelectedPreset('gemini');
      setValidationStatus('idle');
      setHasCustomConfig(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          onUpdateAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-night', 'theme-day', 'theme-sepia', 'theme-forest', 'theme-ocean');
    root.classList.add(`theme-${theme}`);
    const themes = {
      night: { '--bg-primary': '#0f111a', '--bg-secondary': '#1a1e2e', '--bg-tertiary': '#252a3a', '--text-primary': '#f1f5f9', '--text-secondary': '#a8b3c7', '--border-color': '#334155', '--accent-color': '#3b82f6' },
      day: { '--bg-primary': '#f8fafc', '--bg-secondary': '#ffffff', '--bg-tertiary': '#f1f5f9', '--text-primary': '#0a0f1a', '--text-secondary': '#475569', '--border-color': '#e2e8f0', '--accent-color': '#2563eb' },
      sepia: { '--bg-primary': '#fdf6e3', '--bg-secondary': '#eee8d5', '--bg-tertiary': '#e6dfc8', '--text-primary': '#3d3a32', '--text-secondary': '#5c5848', '--border-color': '#d3cbb7', '--accent-color': '#b58900' },
      forest: { '--bg-primary': '#051d10', '--bg-secondary': '#0a2f1c', '--bg-tertiary': '#12422b', '--text-primary': '#f0f9f4', '--text-secondary': '#a8d5be', '--border-color': '#1b5e3e', '--accent-color': '#10b981' },
      ocean: { '--bg-primary': '#0b1121', '--bg-secondary': '#15203b', '--bg-tertiary': '#1e2d52', '--text-primary': '#f1f5f9', '--text-secondary': '#a8b3c7', '--border-color': '#2d4070', '--accent-color': '#38bdf8' }
    };
    const vars = themes[theme];
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value as string));
  }, [theme]);

  // --- FORMATTING LOGIC ---
  const applyFormat = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault(); // Prevent losing focus from editor
    document.execCommand(command, false, value);
  };

  const undo = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('undo');
  };

  const redo = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('redo');
  };

  const changeCase = (e: React.MouseEvent, mode: 'upper' | 'lower' | 'capitalize') => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString();
    if (!text) return;

    let newText = text;
    if (mode === 'upper') newText = text.toUpperCase();
    if (mode === 'lower') newText = text.toLowerCase();
    if (mode === 'capitalize') {
      newText = text.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
    }

    document.execCommand('insertText', false, newText);
  };

  const insertDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('insertHorizontalRule', false);
  };

  const insertCard = (e: React.MouseEvent) => {
    e.preventDefault();
    const html = `
      <div style="background-color: var(--bg-tertiary); padding: 1rem; border-radius: 0.5rem; border-left: 4px solid var(--accent-color); margin: 1em 0;">
        <strong>Nota:</strong> Escribe aquí...
      </div>
      <p><br/></p>
    `;
    document.execCommand('insertHTML', false, html);
  };

  const applyCustomStyle = (e: React.MouseEvent, style: Record<string, string>) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    // IMPORTANT: Enable CSS style mode first for better compatibility
    document.execCommand('styleWithCSS', false, 'true');

    // 1. Color de texto
    if (style.color) {
      document.execCommand('foreColor', false, style.color);
    }

    // 2. Color de fondo (Resaltado)
    if (style.backgroundColor) {
      // Intentamos 'hiliteColor' primero (estándar para resaltado)
      const success = document.execCommand('hiliteColor', false, style.backgroundColor);
      if (!success) {
        // Fallback para algunos navegadores
        document.execCommand('backColor', false, style.backgroundColor);
      }
    }

    // 3. Fuente y Tamaño (Requieren envoltorio manual si execCommand falla o no es preciso)
    if (style.fontFamily || style.fontSize) {
      try {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        if (style.fontFamily) span.style.fontFamily = style.fontFamily;
        if (style.fontSize) span.style.fontSize = style.fontSize;

        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);

        // Restaurar selección
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } catch (e) {
        console.error("Style wrapper error", e);
      }
    }
  };

  const applyUnderlineStyle = (e: React.MouseEvent, style: string) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return;

    try {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.textDecoration = 'underline';
      span.style.textDecorationStyle = style;
      span.style.textDecorationColor = underlineColor;
      span.style.textUnderlineOffset = '3px';

      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);

      // Restore selection
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    } catch (err) {
      console.error('Underline error:', err);
      // Fallback to basic underline
      document.execCommand('underline', false);
    }
  };

  const clearFormat = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
  };

  // Helper for text size buttons
  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(14, Math.min(32, textSettings.fontSize + delta));
    onUpdateTextSettings({ ...textSettings, fontSize: newSize });
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button onClick={() => onNavigate(view)} className={`w-full p-2 flex flex-col items-center gap-0.5 rounded-lg transition-all ${currentView === view ? 'bg-[var(--accent-color)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
      <Icon className="w-5 h-5" />
      <span className="text-[8px] font-medium uppercase tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 overflow-hidden relative">

      {/* Offline Banner */}
      {!isOnline && (
        <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-xs font-bold py-1 px-4 text-center z-[100] animate-fade-in flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3" />
          Sin conexión a internet. Funcionando en modo offline.
        </div>
      )}

      <nav className={`w-20 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col items-center py-3 shrink-0 z-50 ${!isOnline ? 'pt-10' : ''}`}>
        <div className="mb-3 relative group cursor-pointer shrink-0" onClick={() => avatarInputRef.current?.click()} title="Cambiar Foto">
          {userAvatar ? (
            <img src={userAvatar} className="w-9 h-9 rounded-full object-cover border-2 border-[var(--accent-color)] shadow-lg" alt="Avatar" />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
              <User className="w-4 h-4" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-3 h-3 text-white" />
          </div>
          <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
        </div>

        {/* Main Nav Items - Scrollable */}
        <div className="flex-1 space-y-1 w-full px-2 overflow-y-auto">
          <NavItem view="dashboard" icon={Home} label={t('nav.dashboard')} />
          <NavItem view="search" icon={Search} label={t('nav.study')} />
          <NavItem view="bible" icon={Book} label={t('nav.bible')} />
          <NavItem view="library" icon={Library} label={t('nav.library')} />
          <NavItem view="calendar" icon={Calendar} label="Agenda" />
          <NavItem view="editor" icon={PenTool} label={t('nav.editor')} />
          <NavItem view="infografia" icon={LayoutGrid} label="Infografía" />
        </div>

        {/* Bottom Buttons - Always Visible */}
        <div className="shrink-0 space-y-0.5 w-full px-2 pt-2 border-t border-[var(--border-color)]">
          <button onClick={() => { setShowTextSettings(!showTextSettings); setTextSettingsTab('view'); }} className={`w-full p-1.5 flex flex-col items-center gap-0 rounded-md transition-colors ${showTextSettings ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`} title={t('nav.reading')}>
            <Type className="w-4 h-4" />
            <span className="text-[7px] font-medium">Texto</span>
          </button>
          <button onClick={onToggleTheme} className="w-full p-1.5 flex flex-col items-center gap-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors" title={t('nav.theme')}>
            <Palette className="w-4 h-4" />
            <span className="text-[7px] font-medium">Tema</span>
          </button>
          <button onClick={() => setShowSettings(true)} className="w-full p-1.5 flex flex-col items-center gap-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors" title={t('nav.settings')}>
            <Settings className="w-4 h-4" />
            <span className="text-[7px] font-medium">Config</span>
          </button>
          <button onClick={onLogout} className="w-full p-1.5 flex flex-col items-center gap-0 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title={t('nav.logout')}>
            <LogOut className="w-4 h-4" />
            <span className="text-[7px] font-medium">Salir</span>
          </button>
        </div>
      </nav>

      <div className={`flex-1 flex flex-col min-w-0 h-full relative ${!isOnline ? 'pt-6' : ''}`}>
        {children}
      </div>

      {/* TEXT SETTINGS & FORMATTING POPOVER */}
      {showTextSettings && (
        <div className="absolute bottom-24 left-24 z-[90] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-72 animate-fade-in flex flex-col overflow-hidden max-h-[500px]">
          {/* Tab Header */}
          <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
            <button onClick={() => setTextSettingsTab('view')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${textSettingsTab === 'view' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('text_settings.view_tab')}</button>
            <button onClick={() => setTextSettingsTab('format')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${textSettingsTab === 'format' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{t('text_settings.style_tab')}</button>
          </div>

          {/* View Settings Tab */}
          {textSettingsTab === 'view' && (
            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs text-[var(--text-primary)] flex justify-between mb-2 font-medium">
                  {t('text_settings.size')} (Global) <span className="text-[var(--text-secondary)]">{textSettings.fontSize}px</span>
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjustFontSize(-1)} className="p-1 rounded hover:bg-[var(--bg-primary)] border border-[var(--border-color)]"><Minus className="w-3 h-3" /></button>
                  <input type="range" min="14" max="32" step="1" value={textSettings.fontSize} onChange={(e) => onUpdateTextSettings({ ...textSettings, fontSize: parseInt(e.target.value) })} className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]" />
                  <button onClick={() => adjustFontSize(1)} className="p-1 rounded hover:bg-[var(--bg-primary)] border border-[var(--border-color)]"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
              <div><label className="text-xs text-[var(--text-primary)] flex justify-between mb-2 font-medium">{t('text_settings.height')} <span className="text-[var(--text-secondary)]">{textSettings.lineHeight}</span></label><input type="range" min="1.2" max="2.4" step="0.1" value={textSettings.lineHeight} onChange={(e) => onUpdateTextSettings({ ...textSettings, lineHeight: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]" /></div>
            </div>
          )}

          {/* Formatting Tab */}
          {textSettingsTab === 'format' && (
            <div className="p-4 space-y-4 overflow-y-auto h-[400px] scrollbar-hide">
              {/* History / Undo-Redo */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Historial</label>
                <div className="flex gap-2">
                  <button onMouseDown={undo} className="flex-1 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] flex items-center justify-center gap-2 text-xs">
                    <Undo className="w-4 h-4" /> Deshacer
                  </button>
                  <button onMouseDown={redo} className="flex-1 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] flex items-center justify-center gap-2 text-xs">
                    <Redo className="w-4 h-4" /> Rehacer
                  </button>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Fuente</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map(font => (
                    <button
                      key={font.name}
                      onClick={(e) => applyCustomStyle(e, { fontFamily: font.value })}
                      className="px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)]"
                      style={{ fontFamily: font.value }}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Selection Size */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-2"><Scaling className="w-3 h-3" /> Tamaño Selección</label>
                <div className="grid grid-cols-3 gap-2">
                  {SELECTION_FONT_SIZES.map(size => (
                    <button
                      key={size.value}
                      onMouseDown={(e) => applyCustomStyle(e, { fontSize: size.value })}
                      className="px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-center font-medium"
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-2">Color Texto</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={customTextColor}
                    onChange={(e) => setCustomTextColor(e.target.value)}
                    className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer rounded"
                    title="Selector de color"
                  />
                  <button
                    onMouseDown={(e) => applyCustomStyle(e, { color: customTextColor })}
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] font-medium"
                    style={{ color: customTextColor }}
                  >
                    Aplicar Color
                  </button>
                  <button
                    onMouseDown={(e) => applyCustomStyle(e, { color: 'inherit' })}
                    className="px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)]"
                    title="Quitar color"
                  >
                    <Ban className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_COLORS.slice(0, 12).map(color => (
                    <button
                      key={color}
                      onMouseDown={(e) => { setCustomTextColor(color); applyCustomStyle(e, { color: color }); }}
                      className="w-5 h-5 rounded border border-[var(--border-color)] hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-2">Resaltar</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={customHighlightColor}
                    onChange={(e) => setCustomHighlightColor(e.target.value)}
                    className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer rounded"
                    title="Selector de color"
                  />
                  <button
                    onMouseDown={(e) => applyCustomStyle(e, { backgroundColor: customHighlightColor })}
                    className="flex-1 px-3 py-1.5 text-xs border border-[var(--border-color)] rounded hover:brightness-95 font-medium"
                    style={{ backgroundColor: customHighlightColor, color: '#000' }}
                  >
                    Aplicar Resaltado
                  </button>
                  <button
                    onMouseDown={(e) => applyCustomStyle(e, { backgroundColor: 'transparent' })}
                    className="px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)]"
                    title="Quitar resaltado"
                  >
                    <Ban className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {HIGHLIGHT_COLORS.slice(0, 12).map(color => (
                    <button
                      key={color}
                      onMouseDown={(e) => { setCustomHighlightColor(color); applyCustomStyle(e, { backgroundColor: color }); }}
                      className="w-5 h-5 rounded border border-[var(--border-color)] hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Basic Formatting */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Formato</label>
                <div className="flex flex-wrap gap-1 bg-[var(--bg-tertiary)] p-2 rounded-lg border border-[var(--border-color)]">
                  <button onMouseDown={(e) => applyFormat(e, 'bold')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><Bold className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'italic')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><Italic className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'strikethrough')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><Strikethrough className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyUnderlineStyle(e, 'solid')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded underline decoration-2">U</button>
                  <button onMouseDown={(e) => applyUnderlineStyle(e, 'wavy')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded underline decoration-wavy">~</button>
                  <input type="color" value={underlineColor} onChange={(e) => setUnderlineColor(e.target.value)} className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer ml-1" title="Color Subrayado" />
                </div>
              </div>

              {/* Alignment & Lists */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Párrafo</label>
                <div className="flex flex-wrap gap-1 bg-[var(--bg-tertiary)] p-2 rounded-lg border border-[var(--border-color)]">
                  <button onMouseDown={(e) => applyFormat(e, 'justifyLeft')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><AlignLeft className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'justifyCenter')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><AlignCenter className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'justifyRight')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><AlignRight className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'justifyFull')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><AlignJustify className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'insertUnorderedList')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><List className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => applyFormat(e, 'insertOrderedList')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded"><ListOrdered className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Case */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Mayúsculas</label>
                <div className="flex gap-1">
                  <button onMouseDown={(e) => changeCase(e, 'upper')} className="flex-1 p-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] flex justify-center"><CaseUpper className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => changeCase(e, 'lower')} className="flex-1 p-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] flex justify-center"><CaseLower className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => changeCase(e, 'capitalize')} className="flex-1 p-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] flex justify-center"><CaseSensitive className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Insert */}
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] mb-2 block">Insertar</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onMouseDown={insertDivider} className="flex items-center justify-center gap-2 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] text-xs"><Minus className="w-3 h-3" /> Separador</button>
                  <button onMouseDown={insertCard} className="flex items-center justify-center gap-2 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-secondary)] text-xs"><LayoutTemplate className="w-3 h-3" /> Nota</button>
                </div>
              </div>

              {/* Clean */}
              <button onMouseDown={clearFormat} className="w-full p-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 flex items-center justify-center gap-2 text-xs font-bold">
                <Trash2 className="w-3 h-3" /> Limpiar Formato
              </button>
            </div>
          )}

          <button onClick={() => setShowTextSettings(false)} className="w-full py-2 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] hover:bg-[var(--bg-primary)]">{t('text_settings.close')}</button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] w-full max-w-lg rounded-xl shadow-2xl border border-[var(--border-color)] p-6 animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-[var(--border-color)] pb-4 shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]"><Settings className="w-5 h-5" /> {t('settings.title')}</h2>
              <button onClick={() => setShowSettings(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-6 overflow-y-auto flex-1 p-1">
              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">{t('settings.provider')}</label>
                <select value={selectedPreset} onChange={(e) => handlePresetChange(e.target.value)} className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">
                  {Object.entries(AI_PRESETS).map(([key, preset]) => (<option key={key} value={key}>{preset.label}</option>))}
                </select>
              </div>
              <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-color)]">
                <div className="mb-4"><label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">{t('settings.apikey')}</label><input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })} className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" placeholder="sk-..." /></div>
                {selectedPreset !== 'gemini' && (<div className="flex items-center gap-2"><input type="checkbox" checked={aiConfig.useCorsProxy || false} onChange={(e) => setAiConfig({ ...aiConfig, useCorsProxy: e.target.checked })} /><label className="text-sm font-bold text-[var(--text-primary)]">{t('settings.proxy')}</label></div>)}
              </div>
              {validationStatus === 'error' && <div className="text-red-500 text-xs mt-2">{errorMessage}</div>}
              {validationStatus === 'success' && <div className="text-green-500 text-xs mt-2">{t('settings.success')}</div>}
            </div>
            <div className="mt-6 flex justify-between gap-2 pt-4 border-t border-[var(--border-color)]">
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearSettings}
                disabled={!hasCustomConfig}
                title={t('settings.clear_desc')}
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t('settings.clear')}
              </Button>
              <Button onClick={handleSaveSettings} loading={isValidating}>{isValidating ? t('settings.testing') : t('settings.save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
