import React, { useState, useEffect, useRef } from 'react';
import { MessageSquarePlus, Search, Copy, X, Check, Loader2, BookOpen, ArrowRight } from 'lucide-react';
import { generateUnifiedContent } from '../services/geminiService';
import { MarginNote } from '../types';

interface ContextMenuProps {
    selectedText: string;
    position: { x: number; y: number };
    onClose: () => void;
    onAddNote: (note: Omit<MarginNote, 'id' | 'createdAt'>) => void;
    onInsertToSermon?: (content: string) => void;
    sectionId: string;
}

interface SearchResult {
    verses: Array<{ ref: string; text: string }>;
    definition?: string;
    theological?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    selectedText,
    position,
    onClose,
    onAddNote,
    onInsertToSermon,
    sectionId
}) => {
    const [mode, setMode] = useState<'menu' | 'note' | 'search'>('menu');
    const [noteText, setNoteText] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [copied, setCopied] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Position adjustment to keep menu in viewport
    const getAdjustedPosition = () => {
        const menuWidth = 320;
        const menuHeight = mode === 'menu' ? 180 : 400;
        let x = position.x;
        let y = position.y + 10;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 20;
        }
        if (y + menuHeight > window.innerHeight) {
            y = position.y - menuHeight - 10;
        }
        return { left: Math.max(10, x), top: Math.max(10, y) };
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(selectedText);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            onClose();
        }, 1000);
    };

    const handleSaveNote = () => {
        if (!noteText.trim()) return;
        onAddNote({
            sectionId,
            selectedText,
            noteText: noteText.trim()
        });
        onClose();
    };

    const handleSearch = async () => {
        setMode('search');
        setIsSearching(true);
        setSearchResult(null);

        try {
            const prompt = `Busca información bíblica y teológica sobre: "${selectedText}".
      
      Devuelve un JSON con:
      - "verses": array de máximo 4 versículos relevantes, cada uno con "ref" (referencia) y "text" (texto en español RVR1960)
      - "definition": si es una palabra teológica, su definición breve (1-2 oraciones)
      - "theological": significado teológico o aplicación práctica (2-3 oraciones)
      
      Solo devuelve el JSON.`;

            const response = await generateUnifiedContent(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                setSearchResult(result);
            }
        } catch (e) {
            console.error('Search error:', e);
            setSearchResult({ verses: [], definition: 'Error al buscar. Intenta de nuevo.' });
        } finally {
            setIsSearching(false);
        }
    };

    const handleInsertVerse = (ref: string, text: string) => {
        if (onInsertToSermon) {
            onInsertToSermon(`<p><strong>${ref}</strong>: <em>"${text}"</em></p>`);
        }
    };

    const adjustedPos = getAdjustedPosition();

    return (
        <div
            ref={menuRef}
            className="fixed z-[200] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden animate-fade-in"
            style={{ left: adjustedPos.left, top: adjustedPos.top, minWidth: 280, maxWidth: 360 }}
        >
            {/* Header */}
            <div className="bg-[var(--bg-tertiary)] px-3 py-2 flex items-center justify-between border-b border-[var(--border-color)]">
                <span className="text-xs font-bold text-[var(--text-secondary)] truncate max-w-[200px]">
                    "{selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}"
                </span>
                <button onClick={onClose} className="p-1 hover:bg-[var(--bg-secondary)] rounded">
                    <X className="w-3 h-3 text-[var(--text-secondary)]" />
                </button>
            </div>

            {/* Menu Options */}
            {mode === 'menu' && (
                <div className="p-2 space-y-1">
                    <button
                        onClick={() => setMode('note')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-left"
                    >
                        <MessageSquarePlus className="w-4 h-4 text-blue-500" />
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">Agregar Nota</div>
                            <div className="text-xs text-[var(--text-secondary)]">Nota al margen para impresión</div>
                        </div>
                    </button>

                    <button
                        onClick={handleSearch}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-left"
                    >
                        <Search className="w-4 h-4 text-purple-500" />
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">Buscar en Biblia</div>
                            <div className="text-xs text-[var(--text-secondary)]">Versículos y definición teológica</div>
                        </div>
                    </button>

                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-left"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{copied ? 'Copiado!' : 'Copiar'}</div>
                            <div className="text-xs text-[var(--text-secondary)]">Copiar al portapapeles</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Note Input */}
            {mode === 'note' && (
                <div className="p-3 space-y-3">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Texto seleccionado:</label>
                        <p className="text-sm italic text-[var(--text-primary)] bg-[var(--bg-tertiary)] p-2 rounded truncate">
                            "{selectedText}"
                        </p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Tu nota:</label>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Escribe tu nota referencial aquí..."
                            className="w-full p-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                            rows={3}
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('menu')}
                            className="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)]"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveNote}
                            disabled={!noteText.trim()}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Guardar Nota
                        </button>
                    </div>
                </div>
            )}

            {/* Search Results */}
            {mode === 'search' && (
                <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
                    {isSearching ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-color)]" />
                            <span className="text-sm text-[var(--text-secondary)]">Buscando...</span>
                        </div>
                    ) : searchResult ? (
                        <>
                            {searchResult.definition && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">📖 Definición</div>
                                    <p className="text-sm text-[var(--text-primary)]">{searchResult.definition}</p>
                                </div>
                            )}

                            {searchResult.theological && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">✝️ Significado Teológico</div>
                                    <p className="text-sm text-[var(--text-primary)]">{searchResult.theological}</p>
                                </div>
                            )}

                            {searchResult.verses && searchResult.verses.length > 0 && (
                                <div>
                                    <div className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                                        <BookOpen className="w-3 h-3" /> Versículos Relacionados
                                    </div>
                                    <div className="space-y-2">
                                        {searchResult.verses.map((verse, idx) => (
                                            <div key={idx} className="bg-[var(--bg-tertiary)] p-2 rounded-lg group">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <span className="text-xs font-bold text-[var(--accent-color)]">{verse.ref}</span>
                                                        <p className="text-xs text-[var(--text-primary)] mt-0.5 italic">"{verse.text}"</p>
                                                    </div>
                                                    {onInsertToSermon && (
                                                        <button
                                                            onClick={() => handleInsertVerse(verse.ref, verse.text)}
                                                            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-secondary)] rounded"
                                                            title="Insertar en sermón"
                                                        >
                                                            <ArrowRight className="w-3 h-3 text-green-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setMode('menu')}
                                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] mt-2"
                            >
                                ← Volver al menú
                            </button>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default ContextMenu;
