import React, { useState } from 'react';
import { SearchResult, TextSettings } from '../types';
import { Brain, BookOpen, Book, GraduationCap, Quote } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

interface DeepStudyViewProps {
    result: SearchResult;
    textSettings?: TextSettings;
}

export const DeepStudyView: React.FC<DeepStudyViewProps> = ({ result, textSettings }) => {
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        selectedText: string;
        position: { x: number; y: number };
    }>({ show: false, selectedText: '', position: { x: 0, y: 0 } });

    // Handle text selection (mouse)
    const handleTextSelection = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (selectedText && selectedText.length > 1) {
            setTimeout(() => {
                const text = window.getSelection()?.toString().trim();
                if (text && text.length > 1) {
                    setContextMenu({
                        show: true,
                        selectedText: text,
                        position: { x: e.clientX, y: e.clientY }
                    });
                }
            }, 100);
        }
    };

    // Handle touch selection (iPad/mobile)
    const handleTouchEnd = (e: React.TouchEvent) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (selectedText && selectedText.length > 1) {
            const touch = e.changedTouches[0];
            setContextMenu({
                show: true,
                selectedText,
                position: { x: touch.clientX, y: touch.clientY - 50 }
            });
        }
    };

    return (
        <div className="space-y-6" onMouseUp={handleTextSelection} onTouchEnd={handleTouchEnd}>
            {/* Resumen Ejecutivo */}
            <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
                <div className="bg-[var(--bg-tertiary)] px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2">
                    <Brain className="w-5 h-5 text-teal-500" />
                    <h3 className="font-semibold text-[var(--text-primary)]">Perspectiva General</h3>
                </div>
                <div className="p-6">
                    <div className="mb-3">
                        <span className="text-xs font-bold tracking-wider text-teal-600 uppercase">
                            Concepto: {result.insight.psychologicalConcept}
                        </span>
                        <h4 className="text-xl font-bold text-[var(--text-primary)] mt-1">
                            {result.insight.title}
                        </h4>
                    </div>
                    <p className="text-[var(--text-primary)] opacity-90 leading-relaxed text-justify">
                        {result.insight.content}
                    </p>
                </div>
            </div>

            {/* Fundamento Bíblico */}
            {result.biblicalFoundation && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-700 overflow-hidden">
                    <div className="bg-blue-600 dark:bg-blue-800 px-6 py-3 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">Fundamento Bíblico</h3>
                    </div>
                    <div className="p-6">
                        <p
                            className="text-blue-900 dark:text-blue-100 leading-relaxed text-justify"
                            style={{ fontSize: textSettings?.fontSize, lineHeight: textSettings?.lineHeight }}
                        >
                            {result.biblicalFoundation}
                        </p>
                    </div>
                </div>
            )}

            {/* Perspectiva Psicológica Cristocéntrica */}
            {result.psychologicalInsight && (
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl shadow-sm border-2 border-teal-200 dark:border-teal-700 overflow-hidden">
                    <div className="bg-teal-600 dark:bg-teal-800 px-6 py-3 flex items-center gap-2">
                        <Brain className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">Perspectiva Psicológica Cristocéntrica</h3>
                    </div>
                    <div className="p-6">
                        <p
                            className="text-teal-900 dark:text-teal-100 leading-relaxed text-justify"
                            style={{ fontSize: textSettings?.fontSize, lineHeight: textSettings?.lineHeight }}
                        >
                            {result.psychologicalInsight}
                        </p>
                    </div>
                </div>
            )}



            {/* Aplicaciones Prácticas - Exactamente 2 */}
            {result.practicalApplications && result.practicalApplications.length > 0 && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl shadow-sm border-2 border-red-200 dark:border-red-700 overflow-hidden">
                    <div className="bg-red-600 dark:bg-red-800 px-6 py-3 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">Aplicaciones Prácticas</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        {result.practicalApplications.slice(0, 2).map((app, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-red-300 dark:border-red-600">
                                <span className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-base font-bold">
                                    {idx + 1}
                                </span>
                                <p className="text-base text-red-800 dark:text-red-200 font-medium leading-relaxed flex-1">
                                    {app}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cita Teológica - Metáfora/Parábola */}
            {result.theologicalQuote && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg border-2 border-purple-300 dark:border-purple-700 overflow-hidden">
                    <div className="bg-purple-600 dark:bg-purple-800 px-6 py-3 flex items-center gap-2">
                        <Quote className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">Reflexión Teológica</h3>
                    </div>
                    <div className="p-8">
                        <div className="relative">
                            <Quote className="absolute -top-2 -left-2 w-12 h-12 text-purple-200 dark:text-purple-800 opacity-30" />
                            <p className="text-xl italic font-serif text-purple-900 dark:text-purple-100 leading-relaxed relative z-10 pl-8">
                                "{result.theologicalQuote.text}"
                            </p>
                        </div>
                        <div className="mt-6 pl-8 pt-4 border-t border-purple-200 dark:border-purple-700">
                            <p className="text-base font-bold text-purple-700 dark:text-purple-300">
                                — {result.theologicalQuote.author}
                            </p>
                            {result.theologicalQuote.context && (
                                <p className="text-sm text-purple-600 dark:text-purple-400 mt-3 leading-relaxed">
                                    {result.theologicalQuote.context}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Citas Populares */}
            {result.popularQuotes && result.popularQuotes.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl shadow-sm border-2 border-emerald-200 dark:border-emerald-700 overflow-hidden">
                    <div className="bg-emerald-600 dark:bg-emerald-800 px-6 py-3 flex items-center gap-2">
                        <Quote className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">Citas Populares</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        {result.popularQuotes.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-800/50 rounded-lg p-5 border border-emerald-300 dark:border-emerald-600 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <Quote className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-1" />
                                    <div className="flex-1">
                                        <p className="text-base italic text-emerald-900 dark:text-emerald-100 leading-relaxed mb-3">
                                            "{item.quote}"
                                        </p>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                                — {item.author}
                                            </p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                {item.source}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.show && (
                <ContextMenu
                    selectedText={contextMenu.selectedText}
                    position={contextMenu.position}
                    onClose={() => setContextMenu({ show: false, selectedText: '', position: { x: 0, y: 0 } })}
                    onAddNote={(note) => {
                        alert(`Nota guardada: "${note.noteText}"`);
                        setContextMenu({ show: false, selectedText: '', position: { x: 0, y: 0 } });
                    }}
                    sectionId="deep-study"
                />
            )}
        </div>
    );
};
