import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SearchResult, DictionaryResult } from '../types';
import { searchSemanticInsights, lookupDictionaryTerm } from '../services/geminiService';
import { fetchVerseText, BIBLE_BOOKS } from '../services/bibleService';

interface BibleReaderState {
    selectedBook: typeof BIBLE_BOOKS[0] | null;
    selectedChapter: number | null;
    primaryVersion: string;
    primaryText: string; // The full chapter text
    isLoading: boolean;
    pickerStep: 'books' | 'chapters' | 'verses' | 'reading' | 'search' | 'browse'; // Sync UI step
}
interface BibleSearchState {
    query: string;
    activeTab: 'search' | 'dictionary';
    result: SearchResult | null;
    dictResult: DictionaryResult | null;
    isLoading: boolean;
    selectedDictVerse: { ref: string; text: string } | null;
    isLoadingDictVerse: boolean;
}

interface PersistenceContextType {
    // Bible Search State
    bibleSearchState: BibleSearchState;
    setBibleSearchState: React.Dispatch<React.SetStateAction<BibleSearchState>>;
    performBibleSearch: (query: string, type: 'search' | 'dictionary') => Promise<void>;

    // Bible Reader State (Deep Persistence)
    bibleReaderState: BibleReaderState;
    setBibleReaderState: React.Dispatch<React.SetStateAction<BibleReaderState>>;
    loadBibleChapter: (book: typeof BIBLE_BOOKS[0], chapter: number, version: string) => Promise<void>;
}

const PersistenceContext = createContext<PersistenceContextType | undefined>(undefined);

export const PersistenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- BIBLE SEARCH STATE ---
    const [bibleSearchState, setBibleSearchState] = useState<BibleSearchState>(() => {
        // Attempt to hydrate from localStorage on init
        const saved = localStorage.getItem('last_study_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    query: parsed.savedQuery || '',
                    activeTab: parsed.savedTab || 'search',
                    result: parsed.savedResult || null,
                    dictResult: parsed.savedDictResult || null,
                    isLoading: false, // Always reset loading on reload
                    selectedDictVerse: null,
                    isLoadingDictVerse: false
                };
            } catch (e) { console.error("Hydration error", e); }
        }
        return {
            query: '',
            activeTab: 'search',
            result: null,
            dictResult: null,
            isLoading: false,
            selectedDictVerse: null,
            isLoadingDictVerse: false
        };
    });

    // --- BIBLE READER STATE ---
    const [bibleReaderState, setBibleReaderState] = useState<BibleReaderState>(() => {
        const saved = localStorage.getItem('pulpito_reader_deep_state');
        // If deep state exists, use it. Otherwise fall back to basic 'pulpito_reader_state' if available?
        // Let's prioritize deep state.
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...parsed, isLoading: false }; // Always reset loading on reload to prevent stuck spinners
            } catch (e) { }
        }
        return {
            selectedBook: null,
            selectedChapter: null,
            primaryVersion: 'RVR1960',
            primaryText: '',
            isLoading: false,
            pickerStep: 'books'
        };
    });

    // Persist Reader State
    // Persist Reader State (Always save, even if loading, so we capture the intent/book selection)
    useEffect(() => {
        localStorage.setItem('pulpito_reader_deep_state', JSON.stringify(bibleReaderState));
    }, [bibleReaderState]);

    const loadBibleChapter = async (book: typeof BIBLE_BOOKS[0], chapter: number, version: string) => {
        setBibleReaderState(prev => ({
            ...prev,
            selectedBook: book,
            selectedChapter: chapter,
            primaryVersion: version,
            isLoading: true,
            pickerStep: 'reading' // Force switch to reading mode
        }));

        try {
            // Fetch the FULL chapter text (assuming fetchVerseText handles verses range or we simulate it)
            // Implementation detail: we need to fetch all verses. For now, fetchVerseText supports chapters?
            // In 'bibleService.ts', fetchVerseText takes a reference string.
            // e.g. "Génesis 1" should return the whole chapter.
            const ref = `${book.name} ${chapter}`;
            const text = await fetchVerseText(ref, version);

            setBibleReaderState(prev => ({
                ...prev,
                isLoading: false,
                primaryText: text,
                // Ensure internal consistency if user clicked too fast
                selectedBook: book,
                selectedChapter: chapter
            }));
        } catch (error) {
            console.error("Reader Background Fetch Error", error);
            setBibleReaderState(prev => ({ ...prev, isLoading: false }));
        }
    };

    // --- BIBLE SEARCH PERSISTENCE (Existing) ---
    // Persist to localStorage whenever state changes (except loading)
    useEffect(() => {
        if (!bibleSearchState.isLoading) {
            localStorage.setItem('last_study_session', JSON.stringify({
                savedQuery: bibleSearchState.query,
                savedResult: bibleSearchState.result,
                savedTab: bibleSearchState.activeTab,
                savedDictResult: bibleSearchState.dictResult
            }));
        }
    }, [bibleSearchState.query, bibleSearchState.result, bibleSearchState.activeTab, bibleSearchState.dictResult, bibleSearchState.isLoading]);

    const performBibleSearch = async (query: string, type: 'search' | 'dictionary') => {
        if (!query.trim()) return;

        setBibleSearchState(prev => ({
            ...prev,
            query,
            activeTab: type,
            isLoading: true,
            // Reset results for the active tab to show freshness, or keep?
            // User said "seguir buscando" implies we wait.
            result: type === 'search' ? null : prev.result,
            dictResult: type === 'dictionary' ? null : prev.dictResult
        }));

        try {
            if (type === 'search') {
                const data = await searchSemanticInsights(query);
                setBibleSearchState(prev => ({ ...prev, isLoading: false, result: data }));
            } else {
                const data = await lookupDictionaryTerm(query);
                setBibleSearchState(prev => ({ ...prev, isLoading: false, dictResult: data }));
            }
        } catch (error: any) {
            console.error("Background Search Error", error);
            alert(error.message || "Error en búsqueda de fondo");
            setBibleSearchState(prev => ({ ...prev, isLoading: false }));
        }
    };

    return (
        <PersistenceContext.Provider value={{
            bibleSearchState,
            setBibleSearchState,
            performBibleSearch,
            bibleReaderState,
            setBibleReaderState,
            loadBibleChapter
        }}>
            {children}
        </PersistenceContext.Provider>
    );
};

export const usePersistence = () => {
    const context = useContext(PersistenceContext);
    if (context === undefined) {
        throw new Error('usePersistence must be used within a PersistenceProvider');
    }
    return context;
};
