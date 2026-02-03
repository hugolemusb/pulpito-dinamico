import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Button } from './Button';
import { Brain, Plus, Trash2, BookOpen, PlayCircle, Save } from 'lucide-react';
import { MemoryVerse, Sermon } from '../types';
import { VerseTrainer } from './VerseTrainer';

export const MemoryAid: React.FC = () => {
    const { t } = useTranslation();
    const [verses, setVerses] = useState<MemoryVerse[]>([]);
    const [activeTrainerVerse, setActiveTrainerVerse] = useState<MemoryVerse | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newVerse, setNewVerse] = useState<Partial<MemoryVerse>>({ reference: '', text: '', difficulty: 'medium' });

    // Load from current sermon or local storage independent memory items
    useEffect(() => {
        // Attempt to load from current sermon if available
        const savedSermon = localStorage.getItem('current_sermon');
        if (savedSermon) {
            try {
                const sermon: Sermon = JSON.parse(savedSermon);
                if (sermon.memoryVerses) {
                    setVerses(sermon.memoryVerses);
                }
            } catch (e) { console.error(e); }
        }
        // Also could load from a separate 'memory_box' storage for unattached verses
    }, []);

    const saveVerses = (updatedVerses: MemoryVerse[]) => {
        setVerses(updatedVerses);
        // Update current sermon with new list
        const savedSermon = localStorage.getItem('current_sermon');
        if (savedSermon) {
            try {
                const sermon: Sermon = JSON.parse(savedSermon);
                sermon.memoryVerses = updatedVerses;
                localStorage.setItem('current_sermon', JSON.stringify(sermon));
                // You would typically trigger a save event or hook here
            } catch (e) { console.error(e); }
        }
    };

    const handleAddVerse = () => {
        if (!newVerse.reference || !newVerse.text) return;
        const verse: MemoryVerse = {
            id: Date.now().toString(),
            reference: newVerse.reference,
            text: newVerse.text,
            difficulty: newVerse.difficulty as any || 'medium',
            createdAt: Date.now()
        };
        saveVerses([...verses, verse]);
        setNewVerse({ reference: '', text: '', difficulty: 'medium' });
        setShowAddForm(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Eliminar este versículo?')) {
            saveVerses(verses.filter(v => v.id !== id));
        }
    };

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in max-w-5xl mx-auto w-full">
            <div className="mb-8 flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Ayuda Memoria</h1>
                        <p className="text-[var(--text-secondary)]">Entrena tu mente y memoriza la Palabra</p>
                    </div>
                </div>
                <Button onClick={() => setShowAddForm(true)} icon={<Plus className="w-5 h-5" />}>
                    Nuevo Versículo
                </Button>
            </div>

            {showAddForm && (
                <div className="bg-[var(--bg-secondary)] p-6 rounded-xl border border-[var(--border-color)] mb-8 animate-slide-down shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">Agregar Versículo para Memorizar</h3>
                        <button onClick={() => setShowAddForm(false)} className="text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Referencia</label>
                            <input
                                value={newVerse.reference}
                                onChange={e => setNewVerse({ ...newVerse, reference: e.target.value })}
                                className="w-full p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]"
                                placeholder="ej. Salmos 23:1"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Texto</label>
                            <textarea
                                value={newVerse.text}
                                onChange={e => setNewVerse({ ...newVerse, text: e.target.value })}
                                className="w-full p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]"
                                rows={2}
                                placeholder="El texto completo del versículo..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleAddVerse} icon={<Save className="w-4 h-4" />}>Guardar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid of Verses */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {verses.length === 0 && !showAddForm && (
                    <div className="col-span-full py-12 text-center text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] border-dashed">
                        <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">No hay versículos guardados</p>
                        <p className="text-sm">Agrega versículos relacionados a tu sermón actual para practicarlos.</p>
                        <Button variant="ghost" className="mt-4" onClick={() => setShowAddForm(true)}>Comenzar ahora</Button>
                    </div>
                )}

                {verses.map(verse => (
                    <div key={verse.id} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all overflow-hidden group">
                        <div className="p-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] flex justify-between items-center">
                            <span className="font-bold text-[var(--accent-color)] flex items-center gap-2">
                                <BookOpen className="w-4 h-4" /> {verse.reference}
                            </span>
                            <button
                                onClick={() => handleDelete(verse.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 min-h-[100px] flex items-center justify-center text-center">
                            <p className="text-[var(--text-primary)] font-serif italic line-clamp-3">"{verse.text}"</p>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border-color)]">
                            <Button
                                variant="primary"
                                className="w-full justify-center"
                                icon={<PlayCircle className="w-4 h-4" />}
                                onClick={() => setActiveTrainerVerse(verse)}
                            >
                                Entrenar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {activeTrainerVerse && (
                <VerseTrainer
                    verse={activeTrainerVerse}
                    onClose={() => setActiveTrainerVerse(null)}
                    onComplete={() => console.log('Completed')}
                />
            )}
        </div>
    );
};
