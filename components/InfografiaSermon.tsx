import React, { useState } from 'react';
import { Printer, Copy, Download, Eye, LayoutGrid, Mic, RefreshCw, FileText, Import, ArrowDownCircle } from 'lucide-react';
import { extractPowerPhrases, PowerPhrasesResult, extractBoldWords, refineHighlightsWithContext } from '../services/geminiService';
import { Sermon } from '../types';

interface InfografiaSermonProps {
    sermonData?: Sermon;
    onUpdateSermon?: (updates: Partial<Sermon>) => void;
}

interface Sections {
    lectura: string;
    desarrollo: string;
    llamado: string;
    conclusion: string;
}

interface ExtractedInfo {
    versiculos: string[];
    estructura: string[];
    aplicacion: string[];
    actionWords: string[];
    keyVerses: string[];
    impactPhrases: string[];
}

export const InfografiaSermon: React.FC<InfografiaSermonProps> = ({ sermonData: propSermonData, onUpdateSermon }) => {
    // Estado local para persistencia si no hay props
    const [localSermonData, setLocalSermonData] = useState<Sermon | null>(null);
    const sermonData = propSermonData || localSermonData;

    const [pulpitContent, setPulpitContent] = useState('');
    const [sermonTitle, setSermonTitle] = useState('');
    const [mainIdea, setMainIdea] = useState('');
    const [activeView, setActiveView] = useState<'flow' | 'radial' | 'dashboard' | 'predicador' | 'pulpito' | 'timeline'>('flow');
    const [isGenerated, setIsGenerated] = useState(false);
    const [sections, setSections] = useState<Sections>({ lectura: '', desarrollo: '', llamado: '', conclusion: '' });
    const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo>({ versiculos: [], estructura: [], aplicacion: [], actionWords: [], keyVerses: [], impactPhrases: [] });

    // Store original Púlpito sections in order
    interface PulpitoSection {
        id: string;
        title: string;
        content: string;
        type: string;
        durationMin: number;
    }
    const [pulpitoSections, setPulpitoSections] = useState<PulpitoSection[]>([]);
    const [mainVerse, setMainVerse] = useState('');
    const [mainVerseText, setMainVerseText] = useState('');
    const [speaker, setSpeaker] = useState('');
    const [sermonDate, setSermonDate] = useState('');
    const [powerPhrases, setPowerPhrases] = useState<PowerPhrasesResult | null>(null);
    const [isExtractingPhrases, setIsExtractingPhrases] = useState(false);
    const [isRefining, setIsRefining] = useState(false); // Nuevo estado para feedback visual
    const [lastExtractedContent, setLastExtractedContent] = useState(''); // Para detectar cambios

    // Cargar desde localStorage si no hay props
    React.useEffect(() => {
        if (!propSermonData) {
            const saved = localStorage.getItem('current_sermon');
            if (saved) {
                try {
                    setLocalSermonData(JSON.parse(saved));
                } catch (e) {
                    console.error('Error loading sermon from storage', e);
                }
            }
        }
    }, [propSermonData]);

    // Función para guardar cambios
    const saveChanges = (updates: any) => {
        if (onUpdateSermon) {
            onUpdateSermon({ infographicData: updates });
        } else if (localSermonData) {
            const updated = { ...localSermonData, infographicData: updates };
            setLocalSermonData(updated);
            localStorage.setItem('current_sermon', JSON.stringify(updated));
        }
    };

    // Cargar estado guardado al iniciar
    React.useEffect(() => {
        if (sermonData?.infographicData && !isGenerated) {
            const saved = sermonData.infographicData;
            setSections(saved.sections);
            setExtractedInfo(saved.extractedInfo);
            setPowerPhrases(saved.powerPhrases);
            setIsGenerated(saved.isGenerated);
            setLastExtractedContent(saved.lastExtractedContent || '');

            // Cargar textos base
            const content = sermonData.sections.map(s => `${s.title}\n${s.content}`).join('\n\n');
            setPulpitContent(content);
            setSermonTitle(sermonData.title);
            setMainVerse(sermonData.mainVerse);
            setMainVerseText(sermonData.mainVerseText || '');
        }
    }, [sermonData?.id, sermonData?.infographicData]);

    // Auto-generar infografía solo cuando cambie sermonData (NUNCA se borra al cambiar de pantalla)
    React.useEffect(() => {
        if (sermonData) {
            // Extraer datos del sermón recibido
            const content = sermonData.sections.map(s => `${s.title}\n${s.content}`).join('\n\n');
            const contentChanged = content !== lastExtractedContent;

            // Si ya está generado y no hay cambios, no hacer nada
            if (isGenerated && !contentChanged) return;

            if (!isGenerated || contentChanged) {
                // Actualizar contendo base
                if (!isGenerated) {
                    setPulpitContent(content);
                    setSermonTitle(sermonData.title);
                    setMainVerse(sermonData.mainVerse);
                    setMainVerseText(sermonData.mainVerseText || '');
                }

                // Generar estructura visual
                const extractedSections = extractSections(content);
                const info = extractKeyInfo(content);
                const actionContent = extractActionContent(content);

                const newSections = extractedSections;
                const newExtractedInfo = {
                    ...info,
                    actionWords: actionContent.actionWords,
                    keyVerses: actionContent.keyVerses,
                    impactPhrases: actionContent.impactPhrases
                };

                setSections(newSections);
                setExtractedInfo(newExtractedInfo);
                setIsGenerated(true);

                // Persistir estado base
                const baseState = {
                    sections: newSections,
                    extractedInfo: newExtractedInfo,
                    powerPhrases: powerPhrases,
                    isGenerated: true,
                    lastExtractedContent: content
                };
                saveChanges(baseState);

                // Re-generar IA solo si hubo cambios reales en el texto
                if (contentChanged) {
                    setIsExtractingPhrases(true);
                    setLastExtractedContent(content);

                    extractPowerPhrases({
                        lectura: extractedSections.lectura,
                        desarrollo: extractedSections.desarrollo,
                        llamado: extractedSections.llamado,
                        conclusion: extractedSections.conclusion
                    }).then(result => {
                        setPowerPhrases(result);
                        setIsExtractingPhrases(false);
                        // Guardar final
                        saveChanges({
                            ...baseState,
                            powerPhrases: result
                        });
                    }).catch(err => {
                        console.error('Error in power phrases:', err);
                        setIsExtractingPhrases(false);
                    });
                }
            }
        }
    }, [sermonData, lastExtractedContent]);

    const seccionesPatrones = {
        lectura: /(?:lectura\s+bíblica|lectura|texto|pasaje|escritura|introducción)[\s\n:]*(.+?)(?=desarrollo|aplicación|llamado|conclusión|$)/is,
        desarrollo: /(?:desarrollo|cuerpo|enseñanza|explicación|punto)[\s\n:]*(.+?)(?=llamado|conclusión|aplicación|$)/is,
        llamado: /(?:llamado|invitación|reto|desafío|respuesta|aplicación)[\s\n:]*(.+?)(?=conclusión|$)/is,
        conclusion: /(?:conclusión|cierre|despedida|final)[\s\n:]*(.+?)$/is
    };

    const palabrasClave = {
        respuesta: ['debemos', 'nosotros', 'creemos', 'aceptar', 'confiar', 'obedecer', 'aplicar', 'responder'],
        referencias: ['génesis', 'éxodo', 'mateo', 'marcos', 'lucas', 'juan', 'hechos', 'romanos', 'corintios', 'gálatas', 'efesios', 'filipenses', 'colosenses', 'hebreos', 'santiago', 'pedro', 'apocalipsis', 'salmos', 'proverbios', 'isaías'],
        accion: ['cree', 'confía', 'ora', 'ama', 'perdona', 'sirve', 'busca', 'sigue', 'obedece', 'escucha', 'actúa', 'decide', 'entrega', 'adora', 'alaba', 'agradece', 'camina', 'vive', 'declara', 'proclama', 'levanta', 'avanza', 'confiesa', 'arrepiéntete', 'bautiza', 'permanece', 'persevera'],
        fuerza: ['poder', 'victoria', 'fe', 'esperanza', 'amor', 'gracia', 'salvación', 'redención', 'liberación', 'sanidad', 'milagro', 'promesa', 'gloria', 'bendición', 'eternidad', 'vida', 'luz', 'verdad', 'camino']
    };

    const stripHtml = (html: string) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    };

    // Smart truncate - cortar en el final de una oración completa
    const smartTruncate = (text: string, maxLen: number = 500): string => {
        if (!text || text.length <= maxLen) return text;

        // Buscar el último punto, signo de exclamación o interrogación antes del límite
        const cutText = text.substring(0, maxLen);
        const lastSentenceEnd = Math.max(
            cutText.lastIndexOf('.'),
            cutText.lastIndexOf('!'),
            cutText.lastIndexOf('?'),
            cutText.lastIndexOf(':')
        );

        if (lastSentenceEnd > maxLen * 0.5) {
            return text.substring(0, lastSentenceEnd + 1);
        }

        // Si no hay punto, buscar la última coma o espacio
        const lastComma = cutText.lastIndexOf(',');
        if (lastComma > maxLen * 0.6) {
            return text.substring(0, lastComma) + '...';
        }

        // Último recurso: cortar en el último espacio
        const lastSpace = cutText.lastIndexOf(' ');
        if (lastSpace > maxLen * 0.7) {
            return text.substring(0, lastSpace) + '...';
        }

        return cutText + '...';
    };

    const extractSections = (text: string): Sections => {
        const cleanText = stripHtml(text);
        let result: Sections = { lectura: '', desarrollo: '', llamado: '', conclusion: '' };

        let matchLectura = cleanText.match(seccionesPatrones.lectura);
        if (matchLectura) result.lectura = smartTruncate(matchLectura[1].trim(), 600);

        let matchDesarrollo = cleanText.match(seccionesPatrones.desarrollo);
        if (matchDesarrollo) result.desarrollo = smartTruncate(matchDesarrollo[1].trim(), 600);

        let matchLlamado = cleanText.match(seccionesPatrones.llamado);
        if (matchLlamado) result.llamado = smartTruncate(matchLlamado[1].trim(), 600);

        let matchConclusion = cleanText.match(seccionesPatrones.conclusion);
        if (matchConclusion) result.conclusion = smartTruncate(matchConclusion[1].trim(), 600);

        // Si no encuentra secciones, dividir por párrafos
        if (!result.lectura && !result.desarrollo) {
            const paras = cleanText.split('\n\n').filter(p => p.trim().length > 20);
            if (paras[0]) result.lectura = smartTruncate(paras[0], 600);
            if (paras[1]) result.desarrollo = smartTruncate(paras[1], 600);
            if (paras[2]) result.llamado = smartTruncate(paras[2], 600);
            if (paras[3]) result.conclusion = smartTruncate(paras[3], 600);
        }

        return result;
    };

    const extractKeyInfo = (text: string): ExtractedInfo => {
        const cleanText = stripHtml(text);
        const lines = cleanText.split('\n').filter(l => l.trim());

        let versiculos: string[] = [];
        let estructura: string[] = [];
        let aplicacion: string[] = [];

        for (let line of lines) {
            const lower = line.toLowerCase();

            if (lower.includes(':') && (lower.match(/[0-9]+:[0-9]+/) || palabrasClave.referencias.some(r => lower.includes(r)))) {
                versiculos.push(line.trim());
            } else if (palabrasClave.respuesta.some(p => lower.includes(p))) {
                aplicacion.push(line.trim());
            } else if (line.trim().length > 10) {
                estructura.push(line.trim());
            }
        }

        return {
            versiculos: versiculos.slice(0, 6),
            estructura: estructura.slice(0, 6),
            aplicacion: aplicacion.slice(0, 6),
            actionWords: [],
            keyVerses: [],
            impactPhrases: []
        };
    };

    // Extraer FRASES CORTAS clave de cada sección para vistas visuales
    const extractKeyPhrases = (content: string, maxPhrases: number = 3): string[] => {
        if (!content) return [];
        const cleanText = stripHtml(content);

        // Dividir en oraciones
        const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 15);

        // Buscar oraciones con palabras de acción o fuerza
        const keyPhrases: string[] = [];

        for (const sentence of sentences) {
            const lower = sentence.toLowerCase();
            const hasAction = palabrasClave.accion.some(a => lower.includes(a));
            const hasPower = palabrasClave.fuerza.some(f => lower.includes(f));
            const hasResponse = palabrasClave.respuesta.some(r => lower.includes(r));

            if (hasAction || hasPower || hasResponse) {
                // Tomar solo las primeras palabras importantes
                const words = sentence.trim().split(/\s+/);
                if (words.length <= 12) {
                    keyPhrases.push(sentence.trim());
                } else {
                    // Resumir a frase corta
                    keyPhrases.push(words.slice(0, 10).join(' ') + '...');
                }
            }
        }

        // Si no hay suficientes, tomar primeras oraciones cortas
        if (keyPhrases.length < maxPhrases) {
            for (const sentence of sentences) {
                const words = sentence.trim().split(/\s+/);
                if (words.length <= 15 && !keyPhrases.includes(sentence.trim())) {
                    keyPhrases.push(sentence.trim());
                    if (keyPhrases.length >= maxPhrases) break;
                }
            }
        }

        return [...new Set(keyPhrases)].slice(0, maxPhrases);
    };

    // Generar reflexión corta basada en contenido
    const generateReflection = (sectionKey: string, content: string): string => {
        const cleanText = stripHtml(content).toLowerCase();
        const reflections: { [key: string]: string[] } = {
            lectura: [
                '📖 Escucha la voz de Dios',
                '📖 Su Palabra nos guía',
                '📖 La verdad nos libera'
            ],
            desarrollo: [
                '📚 Profundiza en la enseñanza',
                '📚 Comprende el mensaje',
                '📚 Aplica la sabiduría'
            ],
            llamado: [
                '🎯 Responde al llamado',
                '🎯 Actúa con fe',
                '🎯 Decide hoy'
            ],
            conclusion: [
                '✨ Vive la verdad',
                '✨ Transforma tu caminar',
                '✨ Permanece fiel'
            ]
        };

        // Seleccionar reflexión basada en contenido
        const options = reflections[sectionKey] || reflections.desarrollo;
        const hasAction = palabrasClave.accion.some(a => cleanText.includes(a));
        const hasFaith = cleanText.includes('fe') || cleanText.includes('creer');

        if (hasAction) return options[1];
        if (hasFaith) return options[0];
        return options[2];
    };


    // Extract action words, key phrases, and verses
    const extractActionContent = (text: string) => {
        const cleanText = stripHtml(text).toLowerCase();
        const words = cleanText.split(/\s+/);

        // Find action words
        const foundActions: string[] = [];
        palabrasClave.accion.forEach(action => {
            if (cleanText.includes(action)) {
                foundActions.push(action.charAt(0).toUpperCase() + action.slice(1));
            }
        });

        // Find power words
        const foundPower: string[] = [];
        palabrasClave.fuerza.forEach(word => {
            if (cleanText.includes(word)) {
                foundPower.push(word.charAt(0).toUpperCase() + word.slice(1));
            }
        });

        // Find verses (pattern like "Juan 3:16")
        const versePattern = /([123]?\s?[a-záéíóú]+)\s+(\d+):(\d+)/gi;
        const verses: string[] = [];
        let match;
        while ((match = versePattern.exec(text)) !== null) {
            verses.push(match[0]);
        }

        // Extract impactful sentences (containing action or power words)
        const sentences = stripHtml(text).split(/[.!?]+/).filter(s => s.trim().length > 20);
        const impactful: string[] = [];
        sentences.forEach(sentence => {
            const lower = sentence.toLowerCase();
            if (palabrasClave.accion.some(a => lower.includes(a)) ||
                palabrasClave.fuerza.some(f => lower.includes(f))) {
                impactful.push(sentence.trim());
            }
        });

        return {
            actionWords: [...new Set(foundActions)].slice(0, 8),
            powerWords: [...new Set(foundPower)].slice(0, 8),
            keyVerses: [...new Set(verses)].slice(0, 6),
            impactPhrases: impactful.slice(0, 6)
        };
    };

    const generateInfographia = () => {
        if (!pulpitContent.trim()) {
            alert('Por favor, ingresa el contenido del sermón.');
            return;
        }

        const extractedSections = extractSections(pulpitContent);
        const info = extractKeyInfo(pulpitContent);
        const actionContent = extractActionContent(pulpitContent);

        setSections(extractedSections);
        setExtractedInfo({
            ...info,
            actionWords: actionContent.actionWords,
            keyVerses: actionContent.keyVerses,
            impactPhrases: actionContent.impactPhrases
        });
        setIsGenerated(true);
    };

    const clearFields = () => {
        setPulpitContent('');
        setSermonTitle('');
        setMainIdea('');
        setIsGenerated(false);
        setSections({ lectura: '', desarrollo: '', llamado: '', conclusion: '' });
        setPulpitoSections([]);
        setMainVerse('');
        setMainVerseText('');
        setSpeaker('');
        setSermonDate('');
    };

    const handleRefreshHighlights = async () => {
        if (!pulpitContent.trim()) return;
        setIsRefining(true);

        try {
            // 1. Extraer palabras en negrita/color/subrayado
            const highlighted = extractBoldWords(pulpitContent);

            if (highlighted.length === 0) {
                alert('No se encontraron palabras destacadas (negrita, color, etc) en el sermón.');
                setIsRefining(false);
                return;
            }

            // 2. Refinar con IA para obtener frases coherentes y bíblicas
            const refinedPhrases = await refineHighlightsWithContext(
                highlighted,
                { title: sermonTitle, mainIdea: mainIdea }
            );

            // 3. Actualizar estado
            const newInfo = { ...extractedInfo, actionWords: refinedPhrases };
            setExtractedInfo(newInfo);

            // Guardar cambios
            if (sermonData) {
                const updated = {
                    ...sermonData,
                    infographicData: {
                        ...sermonData.infographicData,
                        extractedInfo: newInfo,
                        isGenerated: true
                    }
                };
                saveChanges(updated.infographicData);
            }

            alert(`✓ Se generaron ${refinedPhrases.length} Frases de Poder coherentes desde tus destacados.`);
        } catch (error) {
            console.error(error);
            alert('Error al refinar los destacados. Verifica tu conexión.');
        } finally {
            setIsRefining(false);
        }
    };

    // Import directly from Púlpito (localStorage)
    const importFromPulpito = () => {
        try {
            const saved = localStorage.getItem('current_sermon');
            if (!saved) {
                alert('No hay sermón guardado en Púlpito. Primero crea un sermón en el Editor.');
                return;
            }

            const sermon = JSON.parse(saved);

            // Set sermon metadata
            setSermonTitle(sermon.title || 'Sermón sin título');
            setMainVerse(sermon.mainVerse || '');
            setMainVerseText(sermon.mainVerseText || '');
            setSpeaker(sermon.speaker || '');
            setSermonDate(sermon.date || '');

            // Preserve sections in original order
            if (sermon.sections && Array.isArray(sermon.sections)) {
                setPulpitoSections(sermon.sections);

                // Build content from sections
                const content = sermon.sections.map((s: any) =>
                    `## ${s.title}\n${stripHtml(s.content)}`
                ).join('\n\n');
                setPulpitContent(content);

                // Map to our 4 section structure based on section types
                const mapped: Sections = { lectura: '', desarrollo: '', llamado: '', conclusion: '' };

                sermon.sections.forEach((s: any, i: number) => {
                    const cleanContent = stripHtml(s.content).substring(0, 500);
                    const titleLower = (s.title || '').toLowerCase();
                    const typeLower = (s.type || '').toLowerCase();

                    // Map by title keywords or position
                    if (titleLower.includes('lectura') || titleLower.includes('texto') || titleLower.includes('introducción') || typeLower.includes('intro')) {
                        if (!mapped.lectura) mapped.lectura = cleanContent;
                    } else if (titleLower.includes('desarrollo') || titleLower.includes('punto') || titleLower.includes('cuerpo')) {
                        mapped.desarrollo += (mapped.desarrollo ? '\n' : '') + cleanContent;
                    } else if (titleLower.includes('llamado') || titleLower.includes('aplicación') || titleLower.includes('reto')) {
                        if (!mapped.llamado) mapped.llamado = cleanContent;
                    } else if (titleLower.includes('conclusión') || titleLower.includes('cierre') || titleLower.includes('final')) {
                        if (!mapped.conclusion) mapped.conclusion = cleanContent;
                    } else {
                        // Fallback: distribute by position
                        if (i === 0 && !mapped.lectura) mapped.lectura = cleanContent;
                        else if (i === sermon.sections.length - 1 && !mapped.conclusion) mapped.conclusion = cleanContent;
                        else if (!mapped.desarrollo) mapped.desarrollo = cleanContent;
                        else if (!mapped.llamado) mapped.llamado = cleanContent;
                    }
                });

                setSections(mapped);

                // Extract additional action content
                const baseInfo = extractKeyInfo(content);
                const actionContent = extractActionContent(content);
                setExtractedInfo({
                    ...baseInfo,
                    actionWords: actionContent.actionWords,
                    keyVerses: actionContent.keyVerses,
                    impactPhrases: actionContent.impactPhrases
                });

                setIsGenerated(true);

                alert(`✓ Sermón "${sermon.title}" importado con ${sermon.sections.length} secciones`);
            }
        } catch (e) {
            console.error(e);
            alert('Error al importar el sermón. Verifica que haya un sermón guardado.');
        }
    };

    const printInfographia = () => {
        window.print();
    };

    const copyToClipboard = () => {
        const idea = mainIdea || sermonTitle || 'Idea Central';
        let text = `📊 INFOGRAFÍA: ${sermonTitle}\n\n`;
        text += `💡 IDEA CENTRAL: ${idea}\n\n`;

        if (sections.lectura) text += `📖 LECTURA:\n${sections.lectura}\n\n`;
        if (sections.desarrollo) text += `📚 DESARROLLO:\n${sections.desarrollo}\n\n`;
        if (sections.llamado) text += `🎯 LLAMADO:\n${sections.llamado}\n\n`;
        if (sections.conclusion) text += `✨ CONCLUSIÓN:\n${sections.conclusion}\n`;

        navigator.clipboard.writeText(text).then(() => {
            alert('✓ Infografía copiada al portapapeles');
        });
    };

    const downloadJSON = () => {
        const data = {
            titulo: sermonTitle,
            ideaCentral: mainIdea,
            secciones: sections,
            informacion: extractedInfo,
            fecha: new Date().toLocaleString('es-CL')
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `infografia_${sermonTitle.replace(/\s+/g, '_') || 'sermon'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const idea = mainIdea || sermonTitle || 'Transformando vidas a través de la Palabra';

    const sectionConfig = {
        lectura: { icon: '📖', title: 'LECTURA BÍBLICA', color: '#3498db', bg: 'linear-gradient(135deg, #ebf5fb 0%, #d6eaf8 100%)' },
        desarrollo: { icon: '📚', title: 'DESARROLLO', color: '#27ae60', bg: 'linear-gradient(135deg, #eafaf1 0%, #d5f4e6 100%)' },
        llamado: { icon: '🎯', title: 'LLAMADO', color: '#e67e22', bg: 'linear-gradient(135deg, #fef5e7 0%, #fdebd0 100%)' },
        conclusion: { icon: '✨', title: 'CONCLUSIÓN', color: '#8e44ad', bg: 'linear-gradient(135deg, #f4ecf7 0%, #ebdef0 100%)' }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="text-center mb-8 bg-white p-6 rounded-xl shadow-lg">
                    <h1 className="text-2xl md:text-3xl font-bold text-teal-600 mb-2 flex items-center justify-center gap-3">
                        <LayoutGrid className="w-8 h-8" />
                        Infografía Sermón Dinámico
                    </h1>
                    <p className="text-gray-500">Convierte tu sermón en una guía visual para predicar con confianza</p>
                </header>

                {/* Editor Section */}
                <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
                    <h2 className="text-lg font-semibold text-teal-600 mb-4 pb-4 border-b-2 border-teal-500 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Importar Contenido
                    </h2>

                    {/* Import from Púlpito Button - PROMINENT */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-teal-50 border-2 border-dashed border-teal-400 rounded-xl">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <button
                                onClick={importFromPulpito}
                                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-teal-700 transition-all hover:-translate-y-1 shadow-xl text-lg"
                            >
                                <ArrowDownCircle className="w-6 h-6" />
                                📥 Importar desde Púlpito
                            </button>
                            <p className="text-gray-600 text-sm">
                                Carga automáticamente el sermón actual del Editor con todas sus secciones
                            </p>
                        </div>
                    </div>

                    {/* Show imported sermon info */}
                    {pulpitoSections.length > 0 && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-xl">
                            <h3 className="font-bold text-green-800 mb-2">✓ Sermón Importado</h3>
                            <div className="grid md:grid-cols-2 gap-2 text-sm text-green-700">
                                <p><strong>Título:</strong> {sermonTitle}</p>
                                <p><strong>Predicador:</strong> {speaker || 'No especificado'}</p>
                                <p><strong>Fecha:</strong> {sermonDate || 'No especificada'}</p>
                                <p><strong>Cita Base:</strong> {mainVerse || 'No especificada'}</p>
                                <p className="md:col-span-2"><strong>Secciones:</strong> {pulpitoSections.map(s => s.title).join(' → ')}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                O pega contenido manualmente:
                            </label>
                            <textarea
                                value={pulpitContent}
                                onChange={(e) => setPulpitContent(e.target.value)}
                                placeholder="Pega aquí el contenido de tu sermón..."
                                className="w-full min-h-[120px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y text-sm"
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-semibold text-gray-700 mb-2">Título del sermón:</label>
                                <input
                                    type="text"
                                    value={sermonTitle}
                                    onChange={(e) => setSermonTitle(e.target.value)}
                                    placeholder="Ej: La Fe sin obras está muerta"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block font-semibold text-gray-700 mb-2">Idea central:</label>
                                <input
                                    type="text"
                                    value={mainIdea}
                                    onChange={(e) => setMainIdea(e.target.value)}
                                    placeholder="Ej: Nuestra fe debe manifestarse en acciones"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-4">
                            <button
                                onClick={generateInfographia}
                                className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-all hover:-translate-y-0.5 shadow-lg"
                            >
                                <Eye className="w-5 h-5" />
                                Generar Infografía
                            </button>
                            <button
                                onClick={clearFields}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Limpiar
                            </button>

                            <button
                                onClick={handleRefreshHighlights}
                                disabled={isRefining}
                                title="Transformar destacados en frases bíblicas coherentes (IA)"
                                className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg ${isRefining ? 'bg-indigo-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                            >
                                <RefreshCw className={`w-5 h-5 ${isRefining ? 'animate-spin' : ''}`} />
                                {isRefining ? 'Refinando con IA...' : 'Refinar Destacados (IA)'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* View Toggle & Generated Content */}
                {isGenerated && (
                    <>
                        <div className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded-xl shadow-lg">
                            <button
                                onClick={() => setActiveView('flow')}
                                className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'flow' ? 'bg-teal-500 text-white border-teal-500' : 'border-teal-500 text-teal-500 hover:bg-teal-50'}`}
                            >
                                🔄 Flujo Visual
                            </button>
                            <button
                                onClick={() => setActiveView('radial')}
                                className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'radial' ? 'bg-teal-500 text-white border-teal-500' : 'border-teal-500 text-teal-500 hover:bg-teal-50'}`}
                            >
                                ⭐ Vista Radial
                            </button>
                            <button
                                onClick={() => setActiveView('dashboard')}
                                className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'dashboard' ? 'bg-teal-500 text-white border-teal-500' : 'border-teal-500 text-teal-500 hover:bg-teal-50'}`}
                            >
                                📊 Dashboard
                            </button>
                            <button
                                onClick={() => setActiveView('predicador')}
                                className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'predicador' ? 'bg-teal-500 text-white border-teal-500' : 'border-teal-500 text-teal-500 hover:bg-teal-50'}`}
                            >
                                <Mic className="w-4 h-4 inline mr-2" />
                                Modo Predicador
                            </button>
                            <button
                                onClick={() => setActiveView('timeline')}
                                className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'timeline' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-500 text-indigo-500 hover:bg-indigo-50'}`}
                            >
                                ⏱️ Línea de Tiempo
                            </button>
                            {pulpitoSections.length > 0 && (
                                <button
                                    onClick={() => setActiveView('pulpito')}
                                    className={`px-5 py-2 rounded-lg font-semibold transition-all border-2 ${activeView === 'pulpito' ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-500 text-blue-500 hover:bg-blue-50'}`}
                                >
                                    📜 Púlpito Original
                                </button>
                            )}
                        </div>

                        {/* FLUJO VISUAL - Tarjetas con FRASES CORTAS */}
                        {activeView === 'flow' && (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl shadow-lg p-6">
                                {/* Cabecera con idea central */}
                                <div className="text-center mb-8">
                                    <div className="inline-block bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl px-8 py-4 shadow-xl">
                                        <span className="text-4xl">💡</span>
                                        <p className="text-xl font-black text-white mt-2">{idea}</p>
                                    </div>
                                    {mainVerse && (
                                        <p className="mt-3 text-lg font-semibold text-blue-700">📖 {mainVerse}</p>
                                    )}
                                </div>

                                {/* Flujo de tarjetas conectadas */}
                                <div className="flex flex-wrap justify-center gap-4 mb-8">
                                    {(Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map((key, index) => {
                                        const config = sectionConfig[key];
                                        const content = sections[key];
                                        if (!content) return null;

                                        const phrases = extractKeyPhrases(content, 2);
                                        const reflection = generateReflection(key, content);

                                        return (
                                            <div key={key} className="flex items-center">
                                                {/* Tarjeta */}
                                                <div
                                                    className="w-64 p-4 rounded-xl shadow-lg text-center transform hover:scale-105 transition-transform"
                                                    style={{ background: config.bg, border: `3px solid ${config.color}` }}
                                                >
                                                    <span className="text-4xl">{config.icon}</span>
                                                    <h3 className="text-lg font-black mt-2" style={{ color: config.color }}>
                                                        {config.title}
                                                    </h3>
                                                    <p className="text-sm font-bold text-gray-600 mt-2">{reflection}</p>
                                                    {phrases.length > 0 && (
                                                        <div className="mt-3 text-xs text-gray-700 italic">
                                                            "{phrases[0]}"
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Flecha conectora */}
                                                {index < 3 && <span className="text-3xl text-gray-400 mx-2">→</span>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Palabras de Acción - Badges coloridos */}
                                {extractedInfo.actionWords.length > 0 && (
                                    <div className="text-center mb-6">
                                        <h4 className="font-bold text-purple-800 mb-3">🎯 ACCIONES CLAVE</h4>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {extractedInfo.actionWords.map((word, i) => (
                                                <span
                                                    key={i}
                                                    className="px-4 py-2 rounded-full text-white font-black shadow-md"
                                                    style={{ background: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed'][i % 6] }}
                                                >
                                                    {word.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Versículos en línea */}
                                {extractedInfo.keyVerses.length > 0 && (
                                    <div className="text-center p-4 bg-blue-100 rounded-xl">
                                        <span className="text-blue-800 font-semibold">📖 </span>
                                        {extractedInfo.keyVerses.map((v, i) => (
                                            <span key={i} className="text-blue-700 font-medium mx-2">{v}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* VISTA RADIAL - Círculos expandiendo del centro con FRASES CORTAS */}
                        {activeView === 'radial' && (
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-6">
                                {/* Centro: Idea Principal */}
                                <div className="flex justify-center mb-8">
                                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center shadow-2xl text-center p-4">
                                        <span className="text-5xl">💡</span>
                                        <p className="text-lg font-black text-white mt-2 leading-tight">{idea}</p>
                                    </div>
                                </div>

                                {/* Círculos satélite con frases clave */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {(Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map(key => {
                                        const config = sectionConfig[key];
                                        const content = sections[key];
                                        if (!content) return null;

                                        // Obtener UNA sola frase clave
                                        const phrases = extractKeyPhrases(content, 1);
                                        const phrase = phrases[0] || generateReflection(key, content);

                                        return (
                                            <div key={key} className="text-center">
                                                <div
                                                    className="w-24 h-24 mx-auto rounded-full flex flex-col items-center justify-center shadow-lg"
                                                    style={{ background: config.bg, border: `4px solid ${config.color}` }}
                                                >
                                                    <span className="text-3xl">{config.icon}</span>
                                                    <span className="text-xs font-bold" style={{ color: config.color }}>
                                                        {config.title}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm font-medium text-gray-700 italic px-2">
                                                    "{phrase}"
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Versículo Principal - Grande */}
                                {mainVerse && (
                                    <div className="text-center p-4 bg-blue-600 text-white rounded-full shadow-lg mb-6">
                                        <span className="text-xl font-bold">📖 {mainVerse}</span>
                                    </div>
                                )}

                                {/* Palabras de Acción en órbita */}
                                {extractedInfo.actionWords.length > 0 && (
                                    <div className="text-center">
                                        <div className="inline-flex flex-wrap justify-center gap-3 p-4 bg-purple-100 rounded-full">
                                            {extractedInfo.actionWords.map((word, i) => (
                                                <span
                                                    key={i}
                                                    className="px-4 py-2 rounded-full font-black text-white shadow"
                                                    style={{ background: ['#7c3aed', '#ec4899', '#06b6d4', '#10b981'][i % 4] }}
                                                >
                                                    {word.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DASHBOARD - Vista rápida con MÉTRICAS y FRASES */}
                        {activeView === 'dashboard' && (
                            <div className="bg-gradient-to-br from-slate-100 to-gray-200 rounded-xl shadow-lg p-6">
                                {/* Cabecera con título */}
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black text-gray-800">📊 {sermonTitle || 'Resumen Rápido'}</h2>
                                    <p className="text-blue-600 font-semibold">{mainVerse}</p>
                                </div>

                                {/* Grid de métricas visuales */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {/* Métrica: Secciones */}
                                    <div className="bg-blue-500 text-white rounded-xl p-4 text-center shadow-lg">
                                        <span className="text-3xl">📖</span>
                                        <p className="text-3xl font-black mt-2">{Object.values(sections).filter(s => s).length}</p>
                                        <p className="text-sm font-semibold">SECCIONES</p>
                                    </div>
                                    {/* Métrica: Versículos */}
                                    <div className="bg-green-500 text-white rounded-xl p-4 text-center shadow-lg">
                                        <span className="text-3xl">📜</span>
                                        <p className="text-3xl font-black mt-2">{extractedInfo.keyVerses.length || 1}</p>
                                        <p className="text-sm font-semibold">VERSÍCULOS</p>
                                    </div>
                                    {/* Métrica: Palabras Clave */}
                                    <div className="bg-purple-500 text-white rounded-xl p-4 text-center shadow-lg">
                                        <span className="text-3xl">🎯</span>
                                        <p className="text-3xl font-black mt-2">{extractedInfo.actionWords.length}</p>
                                        <p className="text-sm font-semibold">ACCIONES</p>
                                    </div>
                                    {/* Métrica: Frases */}
                                    <div className="bg-orange-500 text-white rounded-xl p-4 text-center shadow-lg">
                                        <span className="text-3xl">💬</span>
                                        <p className="text-3xl font-black mt-2">{extractedInfo.impactPhrases.length || 3}</p>
                                        <p className="text-sm font-semibold">IDEAS CLAVE</p>
                                    </div>
                                </div>

                                {/* Resumen por sección - solo frases */}
                                <div className="grid md:grid-cols-2 gap-4 mb-6">
                                    {(Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map(key => {
                                        const config = sectionConfig[key];
                                        const content = sections[key];
                                        if (!content) return null;

                                        const phrases = extractKeyPhrases(content, 2);

                                        return (
                                            <div
                                                key={key}
                                                className="bg-white rounded-xl p-4 shadow-md"
                                                style={{ borderTop: `4px solid ${config.color}` }}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">{config.icon}</span>
                                                    <h4 className="font-black" style={{ color: config.color }}>
                                                        {config.title}
                                                    </h4>
                                                </div>
                                                {phrases.length > 0 ? (
                                                    <ul className="text-sm text-gray-700 space-y-1">
                                                        {phrases.map((p, i) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <span style={{ color: config.color }}>▸</span>
                                                                <span className="italic">"{p}"</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">{generateReflection(key, content)}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Idea Central destacada */}
                                <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-6 text-center text-white shadow-xl mb-6">
                                    <span className="text-4xl">💡</span>
                                    <p className="text-xl font-black mt-2">{idea}</p>
                                </div>

                                {/* Palabras de Acción */}
                                {extractedInfo.actionWords.length > 0 && (
                                    <div className="text-center">
                                        <h4 className="font-bold text-gray-700 mb-3">🔥 ACCIONES</h4>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {extractedInfo.actionWords.map((word, i) => (
                                                <span
                                                    key={i}
                                                    className="px-4 py-2 bg-gray-800 text-white rounded-lg font-bold shadow"
                                                >
                                                    {word.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Predicador View - ALTAMENTE VISUAL para lectura rápida */}
                        {activeView === 'predicador' && (
                            <div className="bg-gray-900 text-white rounded-xl shadow-lg p-8 min-h-[600px]">
                                {/* Título y Versículo - GRANDE */}
                                <div className="text-center mb-6">
                                    <h2 className="text-4xl font-black text-white mb-4 tracking-wide">{sermonTitle || '📢 MENSAJE'}</h2>
                                    {mainVerse && (
                                        <div className="inline-block bg-blue-600 rounded-2xl px-8 py-4">
                                            <p className="text-3xl font-bold text-white">📖 {mainVerse}</p>
                                        </div>
                                    )}
                                </div>

                                {/* IDEA CENTRAL - MUY GRANDE */}
                                <div className="text-center p-8 mb-8 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 shadow-2xl">
                                    <span className="text-5xl">💡</span>
                                    <p className="text-3xl font-black mt-4 leading-snug">{idea.toUpperCase()}</p>
                                </div>

                                {/* PALABRAS CLAVE - SÚPER DESTACADAS */}
                                {extractedInfo.actionWords.length > 0 && (
                                    <div className="mb-8 text-center">
                                        <h3 className="text-2xl font-bold text-yellow-400 mb-4">🎯 PALABRAS CLAVE</h3>
                                        <div className="flex flex-wrap justify-center gap-4">
                                            {extractedInfo.actionWords.map((word, i) => (
                                                <span
                                                    key={i}
                                                    className="px-6 py-3 rounded-2xl text-2xl font-black shadow-lg transform hover:scale-105 transition-transform"
                                                    style={{
                                                        background: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'][i % 8],
                                                        color: 'white'
                                                    }}
                                                >
                                                    {word.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SECCIONES - Solo puntos clave con íconos grandes */}
                                <div className="grid md:grid-cols-2 gap-6 mb-8">
                                    {(Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map(key => {
                                        const config = sectionConfig[key];
                                        const content = sections[key];
                                        if (!content) return null;

                                        // Extraer solo las primeras 2 oraciones
                                        const shortContent = smartTruncate(content, 200);

                                        return (
                                            <div
                                                key={key}
                                                className="p-6 rounded-2xl"
                                                style={{ background: config.bg, border: `3px solid ${config.color}` }}
                                            >
                                                <div className="flex items-center gap-4 mb-4">
                                                    <span className="text-5xl">{config.icon}</span>
                                                    <h3 className="text-2xl font-black" style={{ color: config.color }}>
                                                        {config.title.toUpperCase()}
                                                    </h3>
                                                </div>
                                                <p className="text-lg text-gray-800 leading-relaxed font-medium">
                                                    {shortContent}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* CONCLUSIÓN - Destacada */}
                                <div className="p-8 bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl text-center shadow-2xl">
                                    <span className="text-5xl">🙏</span>
                                    <h3 className="text-3xl font-black mt-4 mb-4">CONCLUSIÓN</h3>
                                    <p className="text-2xl font-medium leading-relaxed">{smartTruncate(sections.conclusion || idea, 250)}</p>
                                </div>

                                {/* Versículos al pie - referencia rápida */}
                                {extractedInfo.keyVerses.length > 0 && (
                                    <div className="mt-6 p-4 bg-blue-900/70 rounded-xl text-center">
                                        <span className="text-lg text-blue-300">📖 {extractedInfo.keyVerses.join(' • ')}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Púlpito Original View - Shows exact section order */}
                        {
                            activeView === 'pulpito' && pulpitoSections.length > 0 && (
                                <div className="bg-white rounded-xl shadow-lg p-6">
                                    {/* Header with sermon info */}
                                    <div className="text-center mb-6 p-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl">
                                        <h2 className="text-2xl font-bold mb-2">{sermonTitle}</h2>
                                        <div className="flex flex-wrap justify-center gap-4 text-sm opacity-90">
                                            {speaker && <span>👤 {speaker}</span>}
                                            {sermonDate && <span>📅 {sermonDate}</span>}
                                            {mainVerse && <span>📖 {mainVerse}</span>}
                                        </div>
                                        {mainVerseText && (
                                            <p className="mt-3 italic text-blue-100">"{mainVerseText}"</p>
                                        )}
                                    </div>

                                    {/* Sections in exact order */}
                                    <div className="space-y-4">
                                        {pulpitoSections.map((section, index) => (
                                            <div
                                                key={section.id}
                                                className="p-5 rounded-xl border-l-4 transition-all hover:shadow-md"
                                                style={{
                                                    borderColor: ['#3498db', '#27ae60', '#e67e22', '#8e44ad', '#1abc9c', '#e74c3c'][index % 6],
                                                    background: `linear-gradient(135deg, ${['#ebf5fb', '#eafaf1', '#fef5e7', '#f4ecf7', '#e8f8f5', '#fadbd8'][index % 6]} 0%, white 100%)`
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                                        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">
                                                            {index + 1}
                                                        </span>
                                                        {section.title}
                                                    </h3>
                                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                                        ⏱️ {section.durationMin} min
                                                    </span>
                                                </div>
                                                <div
                                                    className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: section.content }}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total duration */}
                                    <div className="mt-6 p-3 bg-gray-100 rounded-lg text-center">
                                        <span className="font-semibold text-gray-700">
                                            ⏱️ Duración Total: {pulpitoSections.reduce((acc, s) => acc + (s.durationMin || 0), 0)} minutos
                                        </span>
                                    </div>
                                </div>
                            )
                        }

                        {/* Timeline View - Línea de Tiempo */}
                        {
                            activeView === 'timeline' && (
                                <div className="bg-white rounded-xl shadow-lg p-6">
                                    {/* Header */}
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2">⏱️ Línea de Tiempo del Sermón</h2>
                                        <p className="text-gray-600">{sermonTitle}</p>
                                        {mainVerse && <p className="text-blue-600 text-sm mt-1">📖 {mainVerse}</p>}
                                    </div>

                                    {/* Timeline */}
                                    <div className="relative">
                                        {/* Línea central */}
                                        <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-blue-500 via-green-500 via-orange-500 to-purple-500"></div>

                                        {/* Timeline Items */}
                                        <div className="space-y-8 relative">
                                            {(Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map((key, index) => {
                                                const config = sectionConfig[key];
                                                const content = sections[key];
                                                if (!content) return null;

                                                const isLeft = index % 2 === 0;

                                                return (
                                                    <div key={key} className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                                        {/* Content */}
                                                        <div className={`w-5/12 ${isLeft ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                                                            <div
                                                                className="p-4 rounded-xl shadow-md"
                                                                style={{ background: config.bg, borderLeft: isLeft ? 'none' : `4px solid ${config.color}`, borderRight: isLeft ? `4px solid ${config.color}` : 'none' }}
                                                            >
                                                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2" style={{ justifyContent: isLeft ? 'flex-end' : 'flex-start' }}>
                                                                    <span className="text-xl">{config.icon}</span>
                                                                    {config.title}
                                                                </h4>
                                                                <p className="text-sm text-gray-700 italic">
                                                                    "{extractKeyPhrases(content, 1)[0] || generateReflection(key, content)}"
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Center Icon */}
                                                        <div className="w-2/12 flex justify-center">
                                                            <div
                                                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg z-10"
                                                                style={{ background: config.color }}
                                                            >
                                                                {index + 1}
                                                            </div>
                                                        </div>

                                                        {/* Empty space */}
                                                        <div className="w-5/12"></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Action Words Timeline Footer */}
                                    <div className="mt-10 p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                                        <h3 className="font-bold text-purple-800 text-center mb-4">🎯 PALABRAS DE ACCIÓN A TRAVÉS DEL MENSAJE</h3>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {extractedInfo.actionWords.map((word, i) => (
                                                <div
                                                    key={i}
                                                    className="px-4 py-2 bg-white rounded-full shadow-md flex items-center gap-2"
                                                    style={{ border: `2px solid ${['#3498db', '#27ae60', '#e67e22', '#8e44ad', '#e74c3c', '#1abc9c', '#f39c12', '#9b59b6'][i % 8]}` }}
                                                >
                                                    <span className="w-3 h-3 rounded-full" style={{ background: ['#3498db', '#27ae60', '#e67e22', '#8e44ad', '#e74c3c', '#1abc9c', '#f39c12', '#9b59b6'][i % 8] }}></span>
                                                    <span className="font-semibold text-gray-800">• {word}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Key Verses Strip */}
                                    {extractedInfo.keyVerses.length > 0 && (
                                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                                            <h4 className="font-bold text-blue-800 mb-2">📖 Versículos en Orden</h4>
                                            <div className="flex flex-wrap gap-3">
                                                {extractedInfo.keyVerses.map((verse, i) => (
                                                    <span key={i} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                                                        {i + 1}. {verse}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Impact Summary */}
                                    <div className="mt-6 p-4 bg-amber-50 rounded-xl border-l-4 border-amber-500">
                                        <h4 className="font-bold text-amber-800 mb-2">💡 Idea Central</h4>
                                        <p className="text-lg text-amber-700 font-semibold">"{idea}"</p>
                                    </div>
                                </div>
                            )
                        }

                        {/* Export Section */}
                        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t-2 border-gray-300">
                            <button onClick={printInfographia} className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all">
                                <Printer className="w-4 h-4" /> Imprimir
                            </button>
                            <button onClick={copyToClipboard} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all">
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button onClick={downloadJSON} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all">
                                <Download className="w-4 h-4" /> Descargar JSON
                            </button>
                        </div>
                    </>
                )}
            </div >
        </div >
    );
};
