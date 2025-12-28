
import React from 'react';

export type Theme = 'night' | 'day' | 'sepia' | 'forest' | 'ocean';

// --- I18N TYPES ---
export type Language = 'es' | 'en' | 'pt';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  isLocked: boolean;
}

export interface TextSettings {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
}

export enum SectionType {
  LECTURA = 'LECTURA',
  DESARROLLO = 'DESARROLLO',
  LLAMADO = 'LLAMADO',
  CIERRE = 'CIERRE',
  EXTRA = 'EXTRA'
}

export interface SermonSection {
  id: string;
  type: SectionType;
  title: string;
  durationMin: number;
  content: string;
  baseVerse?: string;
}

export interface MarginNote {
  id: string;
  sectionId: string;
  selectedText: string;
  noteText: string;
  searchQuery?: string;
  createdAt: number;
}

export interface Sermon {
  id: string;
  title: string;
  speaker: string;
  date: string;
  location: string;
  eventName?: string;
  theme?: string; // Tema/palabra clave para enfocar el sermón
  category?: string; // Categoría para organizar y filtrar sermones
  mainVerse: string;
  mainVerseVersion?: string;
  mainVerseText?: string;
  infographicData?: {
    sections: any;
    extractedInfo: any;
    powerPhrases: any; // PowerPhrasesResult
    isGenerated: boolean;
    lastExtractedContent: string;
  };
  sections: SermonSection[];
  marginNotes?: MarginNote[];
  bibleNotes?: string;
  announcements?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'wiki';
  content: string;
  timestamp: number;
}

export enum Emotion {
  JOY = 'Gozo',
  NEUTRAL = 'Calma',
  ANXIETY = 'Ansiedad',
  SADNESS = 'Tristeza',
  ANGER = 'Ira'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  nickname?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  lockedLanguage: Language | null;
}

export interface Project {
  id: number | string;
  title: string;
  date: string;
  status: string;
}

export interface SearchResult {
  verses: {
    ref: string;
    version: string;
    text: string;
    tags?: string[];
  }[];
  insight: {
    title: string;
    psychologicalConcept: string;
    content: string;
  };
}

export interface DictionaryResult {
  term: string;
  originalWord: string;
  language: 'Hebreo' | 'Griego' | 'Arameo' | 'Latín';
  phonetic: string;
  definition: string;
  theologicalSignificance: string;
  biblicalReferences: string[];
}

export interface CalendarEvent {
  id: string;
  date: string; // ISO date format YYYY-MM-DD
  time: string; // HH:MM format  
  endTime?: string; // Optional end time
  title: string;
  type: 'sermon' | 'study' | 'event' | 'charla' | 'exposicion' | 'tema' | 'reunion' | 'taller' | 'conferencia' | 'other';
  speaker?: string;
  location?: string;
  mainVerse?: string;
  notes?: string;
  sermonId?: string; // Reference to sermon in history
  sermonFile?: string; // Base64 or reference to saved sermon file
  googleCalendarEventId?: string; // For sync
  createdAt: number;
  updatedAt: number;
}

export type StorageType = 'local' | 'onedrive' | 'gdrive' | 'icloud';

export interface StorageConfig {
  type: StorageType;
  isConnected: boolean;
  email?: string;
  lastSync?: number;
}

export interface GoogleCalendarConfig {
  isConnected: boolean;
  email?: string;
  calendarId?: string;
  syncEnabled: boolean;
}

export interface TimerState {
  isRunning: boolean;
  timeLeft: number;
  totalDuration: number;
}

export type ViewState = 'dashboard' | 'search' | 'editor' | 'bible' | 'library' | 'teleprompter' | 'calendar' | 'infografia' | 'memory';

export type AIProvider = 'gemini' | 'external';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
  friendlyName?: string;
  useCorsProxy?: boolean;
}

export interface LayoutProps {
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

// --- LIBRARY TYPES ---
export type TheologicalTradition = 'Bautista' | 'Metodista' | 'Pentecostal' | 'Reformada' | 'Católica' | 'General';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string; // Can be a placeholder color or image
  tradition: TheologicalTradition;
  category: string; // e.g., "Sistemática", "Comentario"
  content: string; // The full OCR text
  addedAt: number;
  isFavorite: boolean;
  tags: string[];
  fileName?: string; // Original filename for display
}

export interface SavedQuote {
  id: string;
  text: string;
  bookId: string;
  bookTitle: string;
  author: string;
  page?: number;
  createdAt: number;
  tags: string[];
}
