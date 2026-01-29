
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Book, Brain, FileText, FileType, Presentation, Printer, GraduationCap, BookOpen, X, FileInput, MonitorPlay } from 'lucide-react';
import { Button } from './Button';
import { searchSemanticInsights, lookupDictionaryTerm } from '../services/geminiService';
import { fetchVerseText } from '../services/bibleService';
import { SearchResult, DictionaryResult, TextSettings, Sermon, SectionType } from '../types';
import { useTranslation } from '../context/LanguageContext';

interface BibleSearchProps {
  textSettings?: TextSettings;
  onNavigate?: (view: string) => void;
}

export const BibleSearch: React.FC<BibleSearchProps> = ({ textSettings, onNavigate }) => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'search' | 'dictionary'>('search');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [dictResult, setDictResult] = useState<DictionaryResult | null>(null);
  const [selectedDictVerse, setSelectedDictVerse] = useState<{ ref: string, text: string } | null>(null);
  const [isLoadingDictVerse, setIsLoadingDictVerse] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('last_study_session');
    if (savedSession) {
      try {
        const { savedQuery, savedResult, savedTab, savedDictResult } = JSON.parse(savedSession);
        if (savedQuery) setQuery(savedQuery);
        if (savedResult) setResult(savedResult);
        if (savedTab) setActiveTab(savedTab);
        if (savedDictResult) setDictResult(savedDictResult);
      } catch (e) {
        console.error("Error loading study session", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('last_study_session', JSON.stringify({
      savedQuery: query,
      savedResult: result,
      savedTab: activeTab,
      savedDictResult: dictResult
    }));
  }, [query, result, activeTab, dictResult]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);

    // Solo reseteamos el resultado de la pestaña ACTIVA para no perder la info de la otra
    if (activeTab === 'search') {
      setResult(null);
    } else {
      setDictResult(null);
      setSelectedDictVerse(null);
    }

    try {
      if (activeTab === 'search') {
        const data = await searchSemanticInsights(query);
        setResult(data);
      } else {
        const data = await lookupDictionaryTerm(query);
        setDictResult(data);
      }
    } catch (error: any) {
      alert(error.message || "Error en búsqueda");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDictRefClick = async (ref: string) => {
    setIsLoadingDictVerse(true);
    setSelectedDictVerse(null);
    try {
      const text = await fetchVerseText(ref, 'RVR1960');
      setSelectedDictVerse({ ref, text });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDictVerse(false);
    }
  };

  const downloadTXT = () => {
    if (activeTab === 'search' && !result) return;
    if (activeTab === 'dictionary' && !dictResult) return;
    let content = "";
    if (activeTab === 'search' && result) {
      content = `ESTUDIO BÍBLICO: ${query.toUpperCase()}\n`;
      content += `==========================================\n\n`;
      content += `FUNDAMENTO BÍBLICO:\n`;
      result.verses.forEach(v => {
        content += `${v.ref} (${v.version})\n"${v.text}"\n`;
        if (v.tags) content += `Tags: ${v.tags.join(', ')}\n`;
        content += `-------------------\n`;
      });
      content += `\nPERSPECTIVA INTEGRAL:\nTitle: ${result.insight.title}\nConcept: ${result.insight.psychologicalConcept}\n\n${result.insight.content}\n\nAPLICACIÓN PRÁCTICA:\nReflexiona sobre cómo este concepto cambia tu perspectiva.\n`;
    } else if (activeTab === 'dictionary' && dictResult) {
      content = `DICCIONARIO TEOLÓGICO: ${dictResult.term.toUpperCase()}\n`;
      content += `==========================================\n\n`;
      content += `PALABRA ORIGINAL: ${dictResult.originalWord} (${dictResult.language})\n`;
      content += `FONÉTICA: /${dictResult.phonetic}/\n\n`;
      content += `DEFINICIÓN:\n${dictResult.definition}\n\n`;
      content += `SIGNIFICADO TEOLÓGICO:\n${dictResult.theologicalSignificance}\n\n`;
      content += `REFERENCIAS BÍBLICAS:\n${dictResult.biblicalReferences.join('\n')}\n`;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Estudio_${query.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadWord = () => {
    let contentHtml = "";
    if (activeTab === 'search' && result) {
      contentHtml = `<h1>ESTUDIO: ${query.toUpperCase()}</h1><hr/><h2>Fundamento Bíblico</h2>${result.verses.map(v => `<div style="margin-bottom: 15px;"><h3>${v.ref} <span style="font-size: 10pt; color: #666;">(${v.version})</span></h3><p><i>"${v.text}"</i></p></div>`).join('')}<hr/><h2>Perspectiva Integral: ${result.insight.title}</h2><p><strong>Concepto:</strong> ${result.insight.psychologicalConcept}</p><p>${result.insight.content}</p><div style="border: 1px solid #cc0000; padding: 10px; margin-top: 10px;"><strong>Aplicación Práctica:</strong> Reflexiona sobre cómo este concepto cambia tu perspectiva.</div>`;
    } else if (activeTab === 'dictionary' && dictResult) {
      contentHtml = `<h1>DICCIONARIO: ${dictResult.term.toUpperCase()}</h1><hr/><div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px;"><h2 style="margin: 0;">${dictResult.originalWord}</h2><p style="margin: 5px 0;"><strong>Idioma:</strong> ${dictResult.language} | <strong>Fonética:</strong> /${dictResult.phonetic}/</p></div><h3>Definición</h3><p>${dictResult.definition}</p><h3>Significado Teológico</h3><p>${dictResult.theologicalSignificance}</p><h3>Referencias</h3><ul>${dictResult.biblicalReferences.map(ref => `<li>${ref}</li>`).join('')}</ul>`;
    } else {
      return;
    }
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${query}</title><style>body { font-family: 'Times New Roman', serif; color: #000000; } h1 { font-size: 20pt; font-weight: bold; text-align: center; color: #2563EB; } h2 { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; } p { font-size: 12pt; line-height: 1.5; }</style></head><body>`;
    const footer = "</body></html>";
    const sourceHTML = header + contentHtml + footer;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Estudio_${query.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPPT = async () => {
    setIsExporting(true);
    try {
      if (!(window as any).PptxGenJS) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const PptxGenJS = (window as any).PptxGenJS;
      const pres = new PptxGenJS();
      pres.layout = 'LAYOUT_16x9';
      pres.company = 'Púlpito Dinámico';
      pres.subject = query;
      if (activeTab === 'search' && result) {
        let slide = pres.addSlide();
        slide.addText(`Estudio: ${query}`, { x: 0.5, y: 2.5, w: '90%', fontSize: 44, bold: true, color: '2563EB', align: 'center' });
        let slide2 = pres.addSlide();
        slide2.addText("Fundamento Bíblico", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '1E293B' });
        let yPos = 1.5;
        result.verses.forEach(v => {
          const text = `${v.ref} (${v.version})\n"${v.text}"`;
          slide2.addText(text, { x: 0.5, y: yPos, w: '90%', h: 1.5, fontSize: 14, color: '333333', italic: true, shrinkText: true });
          yPos += 1.8;
        });
        let slide3 = pres.addSlide();
        slide3.addText(`Perspectiva: ${result.insight.psychologicalConcept}`, { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '1E293B' });
        slide3.addText(result.insight.title, { x: 0.5, y: 1.2, fontSize: 18, bold: true, color: '2563EB' });
        slide3.addText(result.insight.content, { x: 0.5, y: 1.8, w: '90%', h: 3.5, fontSize: 16, color: '333333', shrinkText: true });
      } else if (activeTab === 'dictionary' && dictResult) {
        let slide = pres.addSlide();
        slide.addText(`Diccionario: ${dictResult.term}`, { x: 0.5, y: 1.0, fontSize: 32, bold: true, color: '2563EB' });
        slide.addText(`${dictResult.originalWord}`, { x: 0.5, y: 2.0, fontSize: 48, bold: true, color: '1E293B' });
        slide.addText(`${dictResult.language} | /${dictResult.phonetic}/`, { x: 0.5, y: 3.0, fontSize: 18, color: '64748B' });
        let slide2 = pres.addSlide();
        slide2.addText("Significado Teológico", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '1E293B' });
        slide2.addText(dictResult.definition, { x: 0.5, y: 1.2, w: '90%', h: 2.0, fontSize: 18, color: '333333' });
        slide2.addText(dictResult.theologicalSignificance, { x: 0.5, y: 3.5, w: '90%', h: 2.0, fontSize: 16, color: '2563EB' });
      }
      await pres.writeFile({ fileName: `Estudio_${query.replace(/\s+/g, '_')}.pptx` });
    } catch (error) {
      console.error(error);
      alert("Error generando presentación.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if ((activeTab === 'search' && !result) || (activeTab === 'dictionary' && !dictResult)) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert("Permite ventanas emergentes para imprimir.");
      return;
    }
    let contentHtml = "";
    if (activeTab === 'search' && result) {
      contentHtml = `<h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;">Estudio: ${query}</h1><div style="margin-top: 20px;"><h3 style="background: #eee; padding: 5px;">Fundamento Bíblico</h3>${result.verses.map(v => `<div style="margin-bottom: 15px; padding-left: 10px; border-left: 3px solid #666;"><strong>${v.ref}</strong> <span>(${v.version})</span><p style="font-style: italic;">"${v.text}"</p></div>`).join('')}</div><div style="margin-top: 30px;"><h3 style="background: #eee; padding: 5px;">Perspectiva Integral: ${result.insight.title}</h3><p><strong>Concepto Psicológico:</strong> ${result.insight.psychologicalConcept}</p><p style="text-align: justify; line-height: 1.6;">${result.insight.content}</p></div>`;
    } else if (activeTab === 'dictionary' && dictResult) {
      contentHtml = `<h1 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;">Diccionario: ${dictResult.term}</h1><div style="text-align: center; margin: 20px 0; padding: 20px; background: #f9f9f9; border: 1px solid #ddd;"><h2 style="font-size: 36pt; margin: 0;">${dictResult.originalWord}</h2><p style="margin: 5px 0; color: #666;">${dictResult.language} • /${dictResult.phonetic}/</p></div><h3>Definición</h3><p style="line-height: 1.6;">${dictResult.definition}</p><h3>Significado Teológico Profundo</h3><p style="line-height: 1.6; text-align: justify;">${dictResult.theologicalSignificance}</p><h3>Referencias</h3><ul>${dictResult.biblicalReferences.map(r => `<li>${r}</li>`).join('')}</ul>`;
    }
    printWindow.document.write(`<html><head><title>Estudio - ${query}</title><style>body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; background: #fff; } h1, h3 { color: #000; } p { font-size: 12pt; }</style></head><body>${contentHtml}<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`);
    printWindow.document.close();
  };

  const handleInsertToPulpit = () => {
    if (!onNavigate) {
      alert("Navegación no disponible");
      return;
    }

    try {
      const saved = localStorage.getItem('current_sermon');
      const currentSermon: Sermon = saved ? JSON.parse(saved) : {
        id: Date.now().toString(), title: 'Nuevo Sermón', sections: []
      };
      if (!currentSermon.sections) currentSermon.sections = [];

      let newSection;

      if (activeTab === 'search' && result) {
        let content = `<h3>Fundamento Bíblico</h3>`;
        result.verses.forEach(v => {
          content += `<p><strong>${v.ref} (${v.version})</strong><br/><em>"${v.text}"</em></p>`;
        });
        content += `<hr/><h3>${result.insight.title}</h3>`;
        content += `<p>${result.insight.content}</p>`;

        newSection = {
          id: Date.now().toString(),
          type: SectionType.EXTRA,
          title: `Estudio: ${query}`,
          durationMin: 5,
          content: content
        };
      } else if (activeTab === 'dictionary' && dictResult) {
        newSection = {
          id: Date.now().toString(),
          type: SectionType.EXTRA,
          title: `Diccionario: ${dictResult.term}`,
          durationMin: 3,
          content: `
                  <h3>${dictResult.originalWord} (${dictResult.language})</h3>
                  <p><strong>Definición:</strong> ${dictResult.definition}</p>
                  <p><strong>Teología:</strong> ${dictResult.theologicalSignificance}</p>
                  <ul>${dictResult.biblicalReferences.map(r => `<li>${r}</li>`).join('')}</ul>
                `
        };
      } else {
        return;
      }

      currentSermon.sections.push(newSection);
      localStorage.setItem('current_sermon', JSON.stringify(currentSermon));
      onNavigate('editor');
    } catch (e) {
      console.error(e);
      alert("Error al insertar");
    }
  };

  // Open teleprompter with study/dictionary content
  const handleOpenTeleprompter = () => {
    if (!onNavigate) {
      alert("Navegación no disponible");
      return;
    }

    let content: { title: string; content: string } | null = null;

    if (activeTab === 'search' && result) {
      let html = `<h2>Estudio: ${query}</h2>`;
      html += `<h3>Fundamento Bíblico</h3>`;
      result.verses.forEach(v => {
        html += `<p><strong>${v.ref}</strong> (${v.version})<br/><em>"${v.text}"</em></p>`;
      });
      html += `<hr/><h3>${result.insight.title}</h3>`;
      html += `<p>${result.insight.content}</p>`;
      content = { title: `Estudio: ${query}`, content: html };
    } else if (activeTab === 'dictionary' && dictResult) {
      let html = `<h2>${dictResult.originalWord}</h2>`;
      html += `<p><strong>Idioma:</strong> ${dictResult.language} | <strong>Fonética:</strong> /${dictResult.phonetic}/</p>`;
      html += `<h3>Definición</h3><p>${dictResult.definition}</p>`;
      html += `<h3>Significado Teológico</h3><p>${dictResult.theologicalSignificance}</p>`;
      html += `<h3>Referencias</h3><ul>${dictResult.biblicalReferences.map(r => `<li>${r}</li>`).join('')}</ul>`;
      content = { title: `Diccionario: ${dictResult.term}`, content: html };
    }

    if (!content) {
      alert('Realiza una búsqueda primero');
      return;
    }

    // Save for teleprompter - use separate keys for study and dictionary
    const storageKey = activeTab === 'search' ? 'teleprompter_study_content' : 'teleprompter_dictionary_content';
    localStorage.setItem(storageKey, JSON.stringify(content));
    localStorage.setItem('teleprompter_content_type', activeTab === 'search' ? 'study' : 'dictionary');
    onNavigate('teleprompter');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
      <header className="h-[60px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-sm md:text-base text-[var(--text-primary)] flex items-center gap-2"><Book className="w-5 h-5 text-blue-600" /> {activeTab === 'search' ? t('search.title') : t('search.dictionary')}</h1>
          <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
            <button onClick={() => setActiveTab('search')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'search' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}><GraduationCap className="w-4 h-4" />{t('search.tab.topic')}</button>
            <button onClick={() => setActiveTab('dictionary')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'dictionary' ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}><BookOpen className="w-4 h-4" />{t('search.tab.dict')}</button>
          </div>
        </div>
        {((activeTab === 'search' && result) || (activeTab === 'dictionary' && dictResult)) && (
          <div className="flex gap-1 pl-2">
            <Button variant="outline" size="sm" onClick={handleOpenTeleprompter} title="Abrir en Teleprompter" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200">
              <MonitorPlay className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleInsertToPulpit} title="Insertar en Púlpito" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
              <FileInput className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={downloadWord} title={t('export.word')}><FileText className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={downloadTXT} title={t('export.txt')}><FileType className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={downloadPPT} title={t('export.ppt')} loading={isExporting}><Presentation className="w-4 h-4" /></Button>
            <Button variant="primary" size="sm" onClick={handlePrint} title={t('export.print')}><Printer className="w-4 h-4 mr-2" /> {t('editor.print')}</Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div
          className="max-w-7xl mx-auto space-y-8 min-h-full flex flex-col"
          style={{ maxWidth: textSettings ? `${textSettings.maxWidth}%` : undefined }}
        >
          <div className="text-center space-y-4 pt-4">
            <h2 className="text-3xl font-serif font-bold text-[var(--text-primary)]">{activeTab === 'search' ? t('search.title') : t('search.dictionary')}</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">{activeTab === 'search' ? t('search.study_desc') : t('search.dict_desc')}</p>
          </div>

          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto w-full group shrink-0">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tema o término: fe, amor, gracia, shalom..." className="w-full pl-12 pr-4 py-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent text-lg placeholder-[var(--text-secondary)] outline-none transition-colors" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-6 h-6 group-focus-within:text-[var(--accent-color)] transition-colors" />
            <Button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('search.button')}</Button>
          </form>

          <div className="animate-fade-in pb-12 flex-1">
            {activeTab === 'search' && result && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden transition-colors h-fit">
                  <div className="bg-[var(--bg-tertiary)] px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2"><Book className="w-5 h-5 text-amber-600" /><h3 className="font-semibold text-amber-700 dark:text-amber-500">{t('search.foundation')}</h3></div>
                  <div className="p-6 space-y-6">
                    {result.verses.map((verse, idx) => (
                      <div key={idx} className="group border-b border-[var(--border-color)] last:border-0 pb-4 last:pb-0">
                        <div className="flex justify-between items-baseline mb-2"><span className="font-bold text-xl text-amber-700 dark:text-amber-500 font-serif">{verse.ref}</span><span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">{verse.version}</span></div>
                        <p className="font-reading text-lg leading-relaxed text-[var(--text-primary)] opacity-90 text-justify italic">"{verse.text}"</p>
                        {verse.tags && (<div className="flex gap-2 mt-3 flex-wrap">{verse.tags.map(tag => (<span key={tag} className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full">#{tag}</span>))}</div>)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden relative transition-colors h-fit">
                  <div className="bg-[var(--bg-tertiary)] px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2"><Brain className="w-5 h-5 text-teal-500" /><h3 className="font-semibold text-[var(--text-primary)]">{t('search.perspective')}</h3></div>
                  <div className="p-6">
                    <div className="mb-4"><span className="text-xs font-bold tracking-wider text-teal-600 uppercase">Concepto: {result.insight.psychologicalConcept}</span><h4 className="text-xl font-bold text-[var(--text-primary)] mt-1">{result.insight.title}</h4></div>
                    <div
                      className="text-[var(--text-primary)] opacity-90 leading-relaxed space-y-4 text-justify"
                      style={{
                        fontSize: textSettings ? `${textSettings.fontSize}px` : undefined,
                        lineHeight: textSettings ? textSettings.lineHeight : undefined
                      }}
                    >
                      <p>{result.insight.content}</p>
                    </div>

                    {/* Aplicación Práctica - Dinámica */}
                    {result.insight.practicalApplication && (
                      <div className="mt-6 p-5 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--accent-color)]/30 shadow-sm">
                        <h5 className="text-sm font-bold text-[var(--accent-color)] mb-2 uppercase tracking-wide border-b border-[var(--border-color)] pb-1 flex items-center gap-2">
                          <span>🎯</span> Aplicación Práctica
                        </h5>
                        <p className="text-base text-[var(--text-primary)] font-medium leading-relaxed">{result.insight.practicalApplication}</p>
                      </div>
                    )}

                    {/* Cita Famosa - Nueva Sección */}
                    {result.insight.famousQuote && (
                      <div className="mt-6 p-5 bg-[var(--bg-secondary)] rounded-lg border-l-4 border-[var(--accent-color)] shadow-sm">
                        <h5 className="text-sm font-bold text-[var(--text-secondary)] mb-3 uppercase tracking-wide flex items-center gap-2">
                          <span>💭</span> Cita Famosa
                        </h5>
                        <p className="text-base text-[var(--text-primary)] italic leading-relaxed">{result.insight.famousQuote}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'dictionary' && dictResult && (
              <div className="max-w-3xl mx-auto bg-[var(--bg-secondary)] rounded-xl shadow-lg border border-[var(--border-color)] overflow-hidden relative pb-10">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-8 text-white text-center"><h2 className="text-4xl font-serif font-bold tracking-wide mb-2">{dictResult.originalWord}</h2><div className="flex items-center justify-center gap-4 text-blue-100 font-mono text-sm"><span className="uppercase tracking-widest">{dictResult.language}</span><span>•</span><span>/{dictResult.phonetic}/</span></div><div className="mt-6 inline-block bg-white/10 px-4 py-1 rounded-full text-sm font-medium border border-white/20">{dictResult.term}</div></div>
                <div className="p-8 space-y-8">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-[var(--accent-color)] uppercase tracking-wide text-xs mb-3"><BookOpen className="w-4 h-4" /> {t('search.definition')}</h3>
                    <p
                      className="text-lg text-[var(--text-primary)] leading-relaxed font-reading border-l-4 border-[var(--accent-color)] pl-4 text-justify"
                      style={{
                        fontSize: textSettings ? `${textSettings.fontSize}px` : undefined,
                        lineHeight: textSettings ? textSettings.lineHeight : undefined
                      }}
                    >
                      {dictResult.definition}
                    </p>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-[var(--accent-color)] uppercase tracking-wide text-xs mb-3"><GraduationCap className="w-4 h-4" /> {t('search.theology')}</h3>
                    <div className="bg-[var(--bg-tertiary)] p-5 rounded-lg border border-[var(--border-color)]">
                      <p
                        className="text-[var(--text-primary)] leading-relaxed text-justify"
                        style={{
                          fontSize: textSettings ? `${textSettings.fontSize}px` : undefined,
                          lineHeight: textSettings ? textSettings.lineHeight : undefined
                        }}
                      >
                        {dictResult.theologicalSignificance}
                      </p>
                    </div>
                  </div>
                  <div><h3 className="flex items-center gap-2 font-bold text-[var(--accent-color)] uppercase tracking-wide text-xs mb-3"><BookOpen className="w-4 h-4" /> Referencias Bíblicas</h3><div className="flex flex-wrap gap-2">{dictResult.biblicalReferences.map((ref, i) => (<button key={i} onClick={() => handleDictRefClick(ref)} className="px-3 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors text-[var(--text-secondary)] rounded-full text-sm border border-[var(--border-color)] cursor-pointer active:scale-95" title="Leer versículo">{ref}</button>))}</div></div>
                </div>
                {(selectedDictVerse || isLoadingDictVerse) && (<div className="mx-8 mb-8 mt-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-blue-500 overflow-hidden animate-fade-in relative"><div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center"><span className="font-bold text-sm">{isLoadingDictVerse ? "Buscando..." : selectedDictVerse?.ref}</span><button onClick={() => setSelectedDictVerse(null)} className="hover:bg-blue-700 p-1 rounded"><X className="w-4 h-4" /></button></div><div className="p-6">{isLoadingDictVerse ? (<div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>) : (<p className="font-serif text-lg leading-relaxed text-slate-800 dark:text-slate-200 italic text-justify">"{selectedDictVerse?.text}"</p>)}</div></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
