

import React, { useState, useEffect } from 'react';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { Layout } from './components/Layout';
import { SermonEditor } from './components/SermonEditor';
import { Dashboard } from './components/Dashboard';
import { BibleSearch } from './components/BibleSearch';
import { BibleReader } from './components/BibleReader';
import { LibraryManager } from './components/LibraryManager';
import { CalendarView } from './components/CalendarView';
import { Login } from './components/Login';
import { Teleprompter } from './components/Teleprompter';
import { InfografiaSermon } from './components/InfografiaSermon';
import { BibleMemoryApp } from './components/BibleMemoryApp';
import { Theme, ViewState, UserProfile, TimerState, TextSettings, AuthState } from './types';

// Mock User Profile - Datos vacíos para permitir fallback al nombre del predicador del sermón
const USER_PROFILE: UserProfile = {
  id: '1',
  name: '',
  email: 'usuario@iglesia.com',
  nickname: ''
};

function AppContent() {
  const { setLanguage } = useTranslation();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    lockedLanguage: null
  });

  const [theme, setTheme] = useState<Theme>('day');
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [userAvatar, setUserAvatar] = useState<string>(() => localStorage.getItem('user_avatar') || '');

  // Text Settings State
  const [textSettings, setTextSettings] = useState<TextSettings>({
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 100
  });

  // Check session on mount
  useEffect(() => {
    const lockedLang = sessionStorage.getItem('LOCKED_LANGUAGE');
    if (lockedLang) {
      setAuthState({ isAuthenticated: true, lockedLanguage: lockedLang as any });
      setLanguage(lockedLang as any); // Sync context
    }
  }, []);

  const handleLogin = () => {
    const lockedLang = sessionStorage.getItem('LOCKED_LANGUAGE');
    if (lockedLang) {
      setAuthState({ isAuthenticated: true, lockedLanguage: lockedLang as any });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('LOCKED_LANGUAGE');
    setAuthState({ isAuthenticated: false, lockedLanguage: null });
    // Limpiar caché de búsquedas al salir del sistema
    localStorage.removeItem('last_study_session');
    localStorage.removeItem('bible_reader_state');
    // Reload page to clear any other potential memory states
    window.location.reload();
  };

  const handleUpdateAvatar = (url: string) => {
    setUserAvatar(url);
    localStorage.setItem('user_avatar', url);
  };

  // Global Timer State
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    timeLeft: 0,
    totalDuration: 0
  });

  useEffect(() => {
    let interval: any;
    if (timerState.isRunning) {
      interval = setInterval(() => {
        setTimerState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState.isRunning]);

  const toggleTimer = () => {
    setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const resetTimer = (newDuration: number) => {
    setTimerState({
      isRunning: false,
      timeLeft: newDuration,
      totalDuration: newDuration
    });
  };

  const resetTimerOnly = () => {
    setTimerState(prev => ({
      isRunning: false,
      timeLeft: prev.totalDuration,
      totalDuration: prev.totalDuration
    }));
  };

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'night') return 'day';
      if (prev === 'day') return 'sepia';
      if (prev === 'sepia') return 'forest';
      if (prev === 'forest') return 'ocean';
      return 'night';
    });
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard
          userProfile={{ ...USER_PROFILE, avatar: userAvatar }}
          username={USER_PROFILE.name}
          onNavigate={handleNavigate}
          textSettings={textSettings}
        />;
      case 'search':
        return <BibleSearch textSettings={textSettings} onNavigate={handleNavigate} />;
      case 'bible':
        return <BibleReader textSettings={textSettings} onNavigate={handleNavigate} />;
      case 'library':
        return <LibraryManager textSettings={textSettings} />;
      case 'calendar':
        return <CalendarView textSettings={textSettings} />;
      case 'editor':
        return <SermonEditor
          theme={theme}
          timerState={timerState}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
          onResetTimerOnly={resetTimerOnly}
          textSettings={textSettings}
          onOpenTeleprompter={() => handleNavigate('teleprompter')}
        />;
      case 'teleprompter':
        const teleprompterType = (localStorage.getItem('teleprompter_content_type') || 'sermon') as 'sermon' | 'study' | 'dictionary';
        return <Teleprompter onBack={() => handleNavigate('editor')} contentType={teleprompterType} />;
      case 'infografia':
        return <InfografiaSermon />;
      case 'memory':
        return <BibleMemoryApp />;
      default:
        return <Dashboard
          userProfile={{ ...USER_PROFILE, avatar: userAvatar }}
          username={USER_PROFILE.name}
          onNavigate={handleNavigate}
          textSettings={textSettings}
        />;
    }
  };

  if (!authState.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Teleprompter has its own layout (fullscreen/distraction free)
  if (currentView === 'teleprompter') {
    return renderView();
  }

  return (
    <Layout
      theme={theme}
      currentView={currentView}
      onNavigate={handleNavigate}
      onToggleTheme={toggleTheme}
      textSettings={textSettings}
      onUpdateTextSettings={setTextSettings}
      onLogout={handleLogout}
      userAvatar={userAvatar}
      onUpdateAvatar={handleUpdateAvatar}
    >
      <div className="h-full w-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {renderView()}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
