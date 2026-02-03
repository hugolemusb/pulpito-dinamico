import React, { useState, useEffect } from 'react';
import { MemoryVerse } from '../types';
import { Button } from './Button';
import { Eye, EyeOff, Check, RotateCcw, Pencil, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface VerseTrainerProps {
    verse: MemoryVerse;
    onComplete?: () => void;
    onClose: () => void;
}

type Mode = 'read' | 'fill' | 'write' | 'result';

export const VerseTrainer: React.FC<VerseTrainerProps> = ({ verse, onComplete, onClose }) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<Mode>('read');
    const [words, setWords] = useState<string[]>([]);
    const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());
    const [userInputs, setUserInputs] = useState<Record<number, string>>({});
    const [writeInput, setWriteInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

    useEffect(() => {
        // Split verse text into words, preserving punctuation
        const splitWords = verse.text.split(/(\s+)/).filter(w => w.trim().length > 0);
        setWords(splitWords);
    }, [verse.text]);

    const startFillMode = () => {
        const indices = new Set<number>();
        // Hide roughly 40% of words for medium difficulty, 60% for hard
        const ratio = verse.difficulty === 'hard' ? 0.6 : 0.4;
        const countToHide = Math.ceil(words.length * ratio);

        while (indices.size < countToHide) {
            const idx = Math.floor(Math.random() * words.length);
            // Don't hide short words or punctuation usually, but simple approach for now:
            if (words[idx].length > 2) {
                indices.add(idx);
            }
            if (indices.size >= countToHide && indices.size >= words.filter(w => w.length > 2).length) break; // Avoid infinite loop
        }
        setHiddenIndices(indices);
        setUserInputs({});
        setMode('fill');
        setFeedback(null);
    };

    const startWriteMode = () => {
        setWriteInput('');
        setMode('write');
        setFeedback(null);
    };

    const checkFill = () => {
        let allCorrect = true;
        const newInputs = { ...userInputs };

        hiddenIndices.forEach(idx => {
            const original = words[idx].replace(/[.,;:"'!?]/g, '').toLowerCase();
            const input = (newInputs[idx] || '').replace(/[.,;:"'!?]/g, '').toLowerCase();
            if (original !== input) {
                allCorrect = false;
            }
        });

        setFeedback(allCorrect ? 'correct' : 'incorrect');
        if (allCorrect) {
            setTimeout(() => setMode('result'), 1500);
        }
    };

    const checkWrite = () => {
        // Normalize both for comparison
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.,;:"'!?]/g, '');
        const original = normalize(verse.text);
        const input = normalize(writeInput);

        // Simple diff logic could be added here, currently just exact match loose
        if (original === input) {
            setFeedback('correct');
            setTimeout(() => setMode('result'), 1500);
        } else {
            setFeedback('incorrect');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-secondary)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                    <div>
                        <span className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">Ayuda Memoria</span>
                        <h2 className="text-xl font-bold text-[var(--accent-color)]">{verse.reference}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors">
                        <X className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[300px]">

                    {mode === 'read' && (
                        <div className="text-center animate-fade-in">
                            <p className="text-2xl md:text-3xl font-serif text-[var(--text-primary)] leading-relaxed mb-8">
                                "{verse.text}"
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Button onClick={startFillMode} icon={<EyeOff className="w-4 h-4" />}>
                                    Completar
                                </Button>
                                <Button onClick={startWriteMode} icon={<Pencil className="w-4 h-4" />} variant="secondary">
                                    Escribir
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === 'fill' && (
                        <div className="w-full max-w-xl animate-fade-in">
                            <div className="flex flex-wrap gap-x-2 gap-y-4 text-xl md:text-2xl font-serif leading-relaxed justify-center mb-8">
                                {words.map((word, idx) => {
                                    if (hiddenIndices.has(idx)) {
                                        const status = feedback === 'incorrect' && userInputs[idx]?.toLowerCase() !== word.replace(/[.,;:"'!?]/g, '').toLowerCase() ? 'border-red-500 bg-red-50' : 'border-[var(--accent-color)]';
                                        return (
                                            <input
                                                key={idx}
                                                type="text"
                                                value={userInputs[idx] || ''}
                                                onChange={(e) => setUserInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                                                className={`border-b-2 bg-transparent text-center min-w-[3ch] max-w-[15ch] focus:outline-none focus:border-blue-500 ${status}`}
                                                style={{ width: `${word.length}ch` }}
                                                autoFocus={idx === Array.from(hiddenIndices)[0]}
                                            />
                                        );
                                    }
                                    return <span key={idx} className="text-[var(--text-primary)]">{word}</span>;
                                })}
                            </div>

                            {feedback === 'incorrect' && (
                                <div className="text-center text-red-500 mb-4 animate-shake">
                                    Algunas palabras no coinciden. ¡Inténtalo de nuevo!
                                </div>
                            )}

                            <div className="flex gap-4 justify-center">
                                <Button variant="ghost" onClick={() => setMode('read')}>Volver</Button>
                                <Button onClick={checkFill} icon={<Check className="w-4 h-4" />}>
                                    Verificar
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === 'write' && (
                        <div className="w-full animate-fade-in">
                            <div className="mb-4 text-center text-[var(--text-secondary)] text-sm">
                                Escribe el versículo completo exactamente como lo recuerdas.
                            </div>
                            <textarea
                                value={writeInput}
                                onChange={(e) => setWriteInput(e.target.value)}
                                className="w-full p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xl font-serif resize-none focus:ring-2 focus:ring-[var(--accent-color)] min-h-[150px]"
                                placeholder="Escribe aquí..."
                                autoFocus
                            />

                            {feedback === 'incorrect' && (
                                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                                    <p className="font-bold text-red-600 mb-1">Diferencias encontradas:</p>
                                    <p className="text-[var(--text-secondary)] line-through">{writeInput}</p>
                                    <p className="text-green-600 font-medium">{verse.text}</p>
                                </div>
                            )}

                            <div className="flex gap-4 justify-center mt-6">
                                <Button variant="ghost" onClick={() => setMode('read')}>Volver</Button>
                                <Button onClick={checkWrite} icon={<Check className="w-4 h-4" />}>
                                    Verificar
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === 'result' && (
                        <div className="text-center animate-fade-in scale-in">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">¡Felicitaciones!</h3>
                            <p className="text-[var(--text-secondary)] mb-8">Has completado el ejercicio de memorización correctamente.</p>

                            <div className="flex gap-4 justify-center">
                                <Button variant="outline" onClick={() => setMode('read')} icon={<RotateCcw className="w-4 h-4" />}>
                                    Practicar otro modo
                                </Button>
                                <Button onClick={() => { if (onComplete) onComplete(); onClose(); }}>
                                    Terminar
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
