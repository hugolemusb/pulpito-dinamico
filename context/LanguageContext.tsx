
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LanguageContextType } from '../types';
import { RESOURCES } from '../services/i18n';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Priority: Session (Locked) > Local (Remembered) > Default
    return (sessionStorage.getItem('LOCKED_LANGUAGE') as Language) || 
           (localStorage.getItem('app_language') as Language) || 
           'es';
  });

  const isLocked = !!sessionStorage.getItem('LOCKED_LANGUAGE');

  useEffect(() => {
    // Sync if locked
    const locked = sessionStorage.getItem('LOCKED_LANGUAGE');
    if (locked && locked !== language) {
      setLanguage(locked as Language);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    // Only allow changing if NOT locked in session (i.e. at Login screen)
    if (sessionStorage.getItem('LOCKED_LANGUAGE')) {
        console.warn("Language is locked for this session.");
        return;
    }
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const getNestedValue = (obj: any, path: string[]) => {
    return path.reduce((prev, curr) => (prev && prev[curr] !== undefined) ? prev[curr] : undefined, obj);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    
    // 1. Try current language
    let value = getNestedValue(RESOURCES[language], keys);
    
    // 2. Fallback to Spanish (Default)
    if (value === undefined) {
      value = getNestedValue(RESOURCES['es'], keys);
    }
    
    // 3. Fallback to key itself if still not found
    if (value === undefined) {
      return `[${key}]`;
    }

    if (typeof value !== 'string') {
        return key; // Should point to a string leaf, not an object
    }
    
    // 4. Param replacement
    let text = value;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t, isLocked }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
