
import React, { useState, useEffect } from 'react';
import { Book, TheologicalTradition, SavedQuote, TextSettings } from '../types';
import { Button } from './Button';
import { useTranslation } from '../context/LanguageContext';
import { Library, Upload, Search, BookOpen, X, Quote, FileText, Loader2, ArrowRight, List, ChevronRight, Bookmark, Maximize2, Minimize2, Image as ImageIcon, Trash2, Copy, Check, ChevronDown, ArrowUpCircle, CheckSquare, Square, MousePointer2, Cloud, PlusCircle, Ban } from 'lucide-react';

interface LibraryManagerProps {
  textSettings: TextSettings;
}

const TRADITIONS: TheologicalTradition[] = ['Bautista', 'Metodista', 'Pentecostal', 'Reformada', 'Católica', 'General'];
const LIBRARY_FOLDERS = ['Teología', 'General', 'Estudio'];
const MAX_CAPACITY = 40;

// Datos iniciales SOLO si no hay nada guardado
const DEFAULT_SAMPLES: Book[] = [
  {
    id: 'sample-1',
    title: 'Manual de Ejemplo (PDF Simulado)',
    author: 'Sistema Púlpito',
    tradition: 'General',
    category: 'Manual',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300',
    content: `Bienvenido a tu Biblioteca Digital.\n\nPuedes subir archivos PDF o EPUB reales y el sistema extraerá el texto para que puedas buscar citas y referencias bíblicas.\n\n--- Pág 1 ---\nPrueba subiendo un archivo usando el botón "Subir Libro".`,
    addedAt: Date.now(),
    isFavorite: false,
    tags: ['Ayuda']
  }
];

interface TextFragment {
  id: string;
  text: string;
  index: number;
  preview: string;
}

interface TocItem {
  label: string;
  index: number;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ textSettings }) => {
  const { t } = useTranslation();

  // 1. GESTIÓN DE SLOTS (10 ESPACIOS)
  const [librarySlots, setLibrarySlots] = useState<(Book | null)[]>(() => {
    try {
      const saved = localStorage.getItem('library_books');
      let loadedBooks: (Book | null)[] = [];

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          loadedBooks = parsed.slice(0, MAX_CAPACITY);
        }
      } else {
        loadedBooks = [...DEFAULT_SAMPLES];
      }

      while (loadedBooks.length < MAX_CAPACITY) {
        loadedBooks.push(null);
      }
      return loadedBooks;

    } catch (e) {
      console.error("Error cargando biblioteca", e);
      const empty = new Array(MAX_CAPACITY).fill(null);
      empty[0] = DEFAULT_SAMPLES[0];
      return empty;
    }
  });

  // Sincronización automática
  useEffect(() => {
    localStorage.setItem('library_books', JSON.stringify(librarySlots));
  }, [librarySlots]);

  const [viewMode, setViewMode] = useState<'grid' | 'reader'>('grid');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedTradition, setSelectedTradition] = useState<string>('All');

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());

  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState({ title: '', author: '', tradition: 'General', category: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Reader & Search Logic State
  const [inBookQuery, setInBookQuery] = useState('');
  const [foundFragments, setFoundFragments] = useState<TextFragment[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [quoteTags, setQuoteTags] = useState<string>('');
  const [fullScreen, setFullScreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedBookIds(new Set());
  };

  const handleSelectBook = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();

    const newSelected = new Set(selectedBookIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBookIds(newSelected);
  };

  // --- BORRADO MASIVO ---
  const handleDeleteSelected = () => {
    if (selectedBookIds.size === 0) return;

    if (window.confirm(`¿Estás seguro de eliminar los ${selectedBookIds.size} libros seleccionados?`)) {
      setLibrarySlots(currentSlots => {
        // Filtrar libros no eliminados y desplazar al inicio
        const remainingBooks = currentSlots.filter(slot => slot && !selectedBookIds.has(slot.id));
        // Rellenar con null al final
        const newSlots: (Book | null)[] = [...remainingBooks];
        while (newSlots.length < MAX_CAPACITY) {
          newSlots.push(null);
        }
        return newSlots;
      });

      setIsSelectionMode(false);
      setSelectedBookIds(new Set());

      if (selectedBook && selectedBookIds.has(selectedBook.id)) {
        setViewMode('grid');
        setSelectedBook(null);
      }
    }
  };

  // --- BORRADO INDIVIDUAL (CORREGIDO Y REFORZADO) ---
  const handleDeleteIndividual = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    setLibrarySlots(prevSlots => {
      // Filtrar el libro eliminado y desplazar los demás al inicio
      const remainingBooks = prevSlots.filter(slot => slot && slot.id !== id);
      // Rellenar con null al final
      const newSlots: (Book | null)[] = [...remainingBooks];
      while (newSlots.length < MAX_CAPACITY) {
        newSlots.push(null);
      }
      return newSlots;
    });

    // Si estábamos leyendo ese libro, volver a la estantería
    if (selectedBook && selectedBook.id === id) {
      setSelectedBook(null);
      setViewMode('grid');
    }
  };

  // --- GENERACIÓN DE ÍNDICE (ToC) ---
  useEffect(() => {
    if (selectedBook) {
      const items: TocItem[] = [];
      const content = selectedBook.content;
      const pageRegex = /--- Pág (\d+) ---/g;
      let match;
      while ((match = pageRegex.exec(content)) !== null) {
        items.push({ label: `Página ${match[1]}`, index: match.index });
      }
      if (items.length === 0) {
        const chapterRegex = /### (.+)/g;
        while ((match = chapterRegex.exec(content)) !== null) {
          items.push({ label: match[1].trim(), index: match.index });
        }
      }
      if (items.length > 100) {
        const filtered = items.filter((_, i) => i % 10 === 0);
        setToc(filtered);
      } else {
        setToc(items);
      }
    }
  }, [selectedBook]);

  const scrollToTocIndex = (index: number) => {
    setShowToc(false);
    const area = document.getElementById('book-content-area');
    if (area) {
      if (index === 0) {
        area.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (selectedBook) {
        const percentage = index / selectedBook.content.length;
        const scrollPos = area.scrollHeight * percentage;
        area.scrollTo({ top: scrollPos, behavior: 'smooth' });
      }
    }
  };

  // --- LÓGICA DE BÚSQUEDA ---
  useEffect(() => {
    if (viewMode === 'reader' && selectedBook) {
      if (!inBookQuery.trim()) {
        setFoundFragments([]);
        return;
      }
      const query = inBookQuery.toLowerCase();
      const content = selectedBook.content;
      const fragments: TextFragment[] = [];
      let pos = content.toLowerCase().indexOf(query);
      let count = 0;
      while (pos !== -1 && count < 50) {
        const start = Math.max(0, pos - 60);
        const end = Math.min(content.length, pos + query.length + 100);
        const preview = "..." + content.substring(start, end).replace(/\s+/g, ' ').trim() + "...";
        fragments.push({ id: `frag-${count}`, index: count, text: content.substring(pos, pos + query.length), preview: preview });
        pos = content.toLowerCase().indexOf(query, pos + 1);
        count++;
      }
      setFoundFragments(fragments);
    }
  }, [inBookQuery, selectedBook, viewMode]);

  const scrollToFragment = (matchIndex: number) => {
    const element = document.getElementById(`highlight-${matchIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-blue-500/50', 'rounded');
      setTimeout(() => { element.classList.remove('ring-4', 'ring-blue-500/50', 'rounded'); }, 2000);
    }
  };

  const copyFragmentText = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // --- PROCESAMIENTO DE ARCHIVOS ---
  const extractTextFromEpub = async (file: File): Promise<string> => {
    // @ts-ignore
    if (!window.JSZip) throw new Error("Librería JSZip no cargada");
    const zip = new (window as any).JSZip();
    const content = await zip.loadAsync(file);
    const container = await content.file("META-INF/container.xml")?.async("string");
    if (!container) throw new Error("EPUB inválido: falta container.xml");
    const opfPathMatch = container.match(/full-path="([^"]+)"/);
    if (!opfPathMatch) throw new Error("No se encontró archivo OPF");
    const opfPath = opfPathMatch[1];
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));
    const opfContent = await content.file(opfPath)?.async("string");
    if (!opfContent) throw new Error("No se pudo leer OPF");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(opfContent, "text/xml");
    const manifest = xmlDoc.getElementsByTagName("manifest")[0];
    const spine = xmlDoc.getElementsByTagName("spine")[0];
    const idToHref: Record<string, string> = {};
    Array.from(manifest.getElementsByTagName("item")).forEach((item: any) => { idToHref[item.getAttribute("id")] = item.getAttribute("href"); });
    const itemRefs = Array.from(spine.getElementsByTagName("itemref"));
    let fullText = "";
    for (let i = 0; i < itemRefs.length; i++) {
      const idref = itemRefs[i].getAttribute("idref");
      if (idref && idToHref[idref]) {
        let href = idToHref[idref];
        if (opfDir) href = `${opfDir}/${href}`;
        const fileData = await content.file(href)?.async("string");
        if (fileData) {
          const doc = parser.parseFromString(fileData, "text/html");
          const title = doc.querySelector("h1, h2")?.textContent || `Sección ${i + 1}`;
          const bodyText = doc.body.textContent || "";
          const cleanText = bodyText.replace(/\s+/g, ' ').trim();
          fullText += `### ${title}\n\n${cleanText}\n\n`;
          setProcessingStatus(`Procesando sección ${i + 1} de ${itemRefs.length}...`);
        }
      }
    }
    return fullText;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    if (fileType === "text/plain") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }
    if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
      setProcessingStatus("Analizando PDF...");
      try {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = "";
        const totalPages = pdf.numPages;
        for (let i = 1; i <= totalPages; i++) {
          setProcessingStatus(`Página ${i} de ${totalPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += `--- Pág ${i} ---\n${pageText}\n\n`;
        }
        return fullText;
      } catch (error) { throw new Error("Error en PDF. Puede estar encriptado."); }
    }
    if (fileType === "application/epub+zip" || fileName.endsWith('.epub')) { return await extractTextFromEpub(file); }
    return "Formato no soportado.";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      const fileName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
      setUploadMeta(prev => ({ ...prev, title: fileName }));
    }
  };

  const processUpload = async () => {
    if (!uploadFile) return;

    const emptyIndex = librarySlots.findIndex(slot => slot === null);
    if (emptyIndex === -1) {
      alert("La biblioteca está llena (Máx 10 libros). Elimina uno para hacer espacio.");
      return;
    }

    setIsProcessing(true);
    setProcessingStatus("Leyendo archivo...");
    try {
      const extractedText = await extractTextFromFile(uploadFile);

      // Try to generate cover from PDF first page
      let coverUrl = '';
      const fileName = uploadFile.name.toLowerCase();
      if ((uploadFile.type === "application/pdf" || fileName.endsWith('.pdf')) && (window as any).pdfjsLib) {
        try {
          setProcessingStatus("Generando portada...");
          const arrayBuffer = await uploadFile.arrayBuffer();
          const pdf = await (window as any).pdfjsLib.getDocument(arrayBuffer).promise;
          const page = await pdf.getPage(1);
          const scale = 0.5; // Small scale for thumbnail
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;

          coverUrl = canvas.toDataURL('image/jpeg', 0.7);
        } catch (e) {
          console.error('Error generating cover:', e);
        }
      }

      const newBook: Book = {
        id: Date.now().toString(),
        title: uploadMeta.title || uploadFile.name,
        author: uploadMeta.author || 'Desconocido',
        tradition: uploadMeta.tradition as TheologicalTradition,
        category: uploadMeta.category || 'General',
        coverUrl: coverUrl,
        content: extractedText,
        addedAt: Date.now(),
        isFavorite: false,
        tags: [],
        fileName: uploadFile.name // Store original filename
      };

      const newSlots = [...librarySlots];
      newSlots[emptyIndex] = newBook;
      setLibrarySlots(newSlots);

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadMeta({ title: '', author: '', tradition: 'General', category: '' });
      setProcessingStatus('');

      setSelectedBook(newBook);
      setViewMode('reader');
    } catch (error: any) { alert(`Error: ${error.message}`); } finally { setIsProcessing(false); }
  };

  const handleBookClick = (book: Book) => {
    if (isSelectionMode) return;
    setSelectedBook(book);
    setViewMode('reader');
    setInBookQuery('');
  };

  const handleTextSelection = () => {
    const text = window.getSelection()?.toString();
    if (text && text.length > 0) { setSelectedText(text); }
  };

  const saveQuote = () => {
    if (!selectedBook || !selectedText) return;
    const newQuote: SavedQuote = {
      id: Date.now().toString(),
      text: selectedText,
      bookId: selectedBook.id,
      bookTitle: selectedBook.title,
      author: selectedBook.author,
      createdAt: Date.now(),
      tags: quoteTags.split(',').map(t => t.trim()).filter(t => t)
    };
    const existingQuotes = JSON.parse(localStorage.getItem('saved_quotes') || '[]');
    localStorage.setItem('saved_quotes', JSON.stringify([newQuote, ...existingQuotes]));
    alert("Cita guardada");
    setSelectedText('');
    setQuoteTags('');
  };

  const renderContentWithHighlights = (text: string, query: string) => {
    if (!query) return renderBibleRefs(text);
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
    let matchCounter = 0;
    return (
      <span>
        {parts.map((part, i) => {
          if (part.toLowerCase() === query.toLowerCase()) {
            const currentMatchIndex = matchCounter++;
            return (<mark key={i} id={`highlight-${currentMatchIndex}`} className="bg-yellow-300 text-black font-bold px-0.5 rounded shadow-sm scroll-mt-32 transition-colors duration-1000">{part}</mark>);
          } else { return renderBibleRefs(part); }
        })}
      </span>
    );
  };

  const renderBibleRefs = (text: string) => {
    const bibleRegex = /((?:[123]\s)?[A-ZÁÉÍÓÚ][a-zñáéíóú]+\.?\s\d+(?::\d+(?:-\d+)?)?)/g;
    const parts = text.split(bibleRegex);
    return (
      <>
        {parts.map((part, i) => {
          const isRef = /^(?:[123]\s)?[A-ZÁÉÍÓÚ][a-zñáéíóú]+\.?\s\d+(?::\d+(?:-\d+)?)?$/.test(part);
          return isRef ? (<span key={i} className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-1 rounded mx-0.5" title="Ver versículo">{part}</span>) : (<span key={i}>{part}</span>);
        })}
      </>
    );
  };

  // Helper to translate traditions for display
  const getTraditionLabel = (trad: string) => {
    if (trad === 'General') return t('library.categories.general');
    if (trad === 'Bautista') return t('library.categories.baptist');
    if (trad === 'Metodista') return t('library.categories.methodist');
    if (trad === 'Pentecostal') return t('library.categories.pentecostal');
    if (trad === 'Reformada') return t('library.categories.reformed');
    if (trad === 'Católica') return t('library.categories.catholic');
    return trad;
  };

  // Filtrado visual de slots
  const displayedSlots = librarySlots.map(slot => {
    if (!slot) return null;
    const matchesSearch = slot.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) || slot.author.toLowerCase().includes(librarySearchQuery.toLowerCase());
    const matchesTradition = selectedTradition === 'All' || slot.tradition === selectedTradition;
    return (matchesSearch && matchesTradition) ? slot : 'hidden';
  });

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* --- MODO ESTANTERÍA (GRID) --- */}
      {viewMode === 'grid' && (
        <>
          <header className="h-[72px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[var(--accent-color)] p-2 rounded-lg text-white shadow-md">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-[var(--text-primary)]">{t('library.title')}</h1>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono">{t('library.capacity')}: {librarySlots.filter(s => s !== null).length} / {MAX_CAPACITY}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {isSelectionMode ? (
                <>
                  <Button variant="danger" onClick={handleDeleteSelected} disabled={selectedBookIds.size === 0}>
                    <Trash2 className="w-4 h-4 mr-2" /> {t('library.delete')} ({selectedBookIds.size})
                  </Button>
                  <Button variant="ghost" onClick={toggleSelectionMode}>{t('library.cancel')}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={toggleSelectionMode} title="Modo Selección">
                    <MousePointer2 className="w-4 h-4 mr-2" /> {t('library.edit_mode')}
                  </Button>
                  <Button onClick={() => setIsUploadModalOpen(true)} icon={<Upload className="w-4 h-4" />} disabled={librarySlots.every(s => s !== null)}>
                    {t('library.upload')}
                  </Button>
                </>
              )}
            </div>
          </header>

          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row gap-4 mb-6 shrink-0">
              <div className="relative flex-1">
                <input type="text" value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)} placeholder={t('library.search_placeholder')} className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] shadow-sm" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 scrollbar-hide">
                <button onClick={() => setSelectedTradition('All')} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors border font-medium ${selectedTradition === 'All' ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}>{t('library.categories.all')}</button>
                {TRADITIONS.map(trad => (
                  <button key={trad} onClick={() => setSelectedTradition(trad)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors border font-medium ${selectedTradition === trad ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}>{getTraditionLabel(trad)}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pb-10">
                {displayedSlots.map((book, index) => {
                  if (book === 'hidden') return null;

                  if (book === null) {
                    return (
                      <div key={`empty-${index}`} onClick={() => setIsUploadModalOpen(true)} className="group border-2 border-dashed border-[var(--border-color)] rounded-xl aspect-[2/3] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent-color)] hover:bg-[var(--bg-tertiary)] transition-all relative">
                        <div className="p-4 rounded-full bg-[var(--bg-secondary)] mb-2 group-hover:scale-110 transition-transform">
                          <PlusCircle className="w-8 h-8 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)]" />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">{t('library.available')}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] absolute top-2 right-3 font-mono opacity-50">#{index + 1}</span>
                      </div>
                    );
                  }

                  // Libro Válido
                  const isSelected = selectedBookIds.has(book.id);
                  return (
                    <div
                      key={book.id}
                      onClick={(e) => {
                        if (isSelectionMode) { handleSelectBook(e, book.id); }
                        else { handleBookClick(book); }
                      }}
                      className={`group bg-[var(--bg-secondary)] rounded-xl border overflow-hidden cursor-pointer transition-all hover:-translate-y-1 flex flex-col h-full relative ${isSelectionMode && isSelected ? 'border-red-500 ring-2 ring-red-500 shadow-md' : 'border-[var(--border-color)] hover:shadow-xl'}`}
                    >
                      <div className="aspect-[2/3] relative overflow-hidden bg-[var(--bg-tertiary)]">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt={book.title} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isSelectionMode && isSelected ? 'opacity-80' : ''}`} />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                            <BookOpen className="w-12 h-12 text-white/50 mb-3" />
                            <span className="text-white/80 font-serif font-bold text-sm line-clamp-3">{book.title}</span>
                          </div>
                        )}

                        {isSelectionMode && (
                          <div className="absolute top-2 right-2 z-50 transition-all transform scale-110">
                            {isSelected ? (
                              <div className="bg-red-500 text-white rounded-md p-1 shadow-lg"><CheckSquare className="w-6 h-6" /></div>
                            ) : (
                              <div className="bg-white/80 text-gray-500 rounded-md p-1 shadow-sm backdrop-blur-sm"><Square className="w-6 h-6" /></div>
                            )}
                          </div>
                        )}

                        {/* BOTÓN BORRAR INDIVIDUAL - AISLADO PARA EVITAR CONFLICTOS */}
                        {!isSelectionMode && (
                          <div
                            className="absolute top-2 right-2 z-[100]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleDeleteIndividual(e, book.id)}
                              className="bg-red-600 text-white p-2 rounded-full shadow-lg transition-all hover:scale-110 hover:bg-red-700 md:opacity-0 md:group-hover:opacity-100"
                              title="Eliminar y liberar espacio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <span className="absolute bottom-2 right-2 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">#{index + 1}</span>

                        {/* Filename overlay at bottom of cover */}
                        {book.fileName && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                            <p className="text-[9px] text-white/90 truncate font-mono">{book.fileName}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-[var(--text-primary)] text-sm line-clamp-2 leading-tight mb-1 group-hover:text-[var(--accent-color)] transition-colors">{book.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mb-2">{book.author}</p>
                        <div className="mt-auto flex gap-1 flex-wrap">
                          <span className="text-[9px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)] uppercase tracking-wide">{getTraditionLabel(book.tradition)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- MODO LECTOR --- */}
      {viewMode === 'reader' && selectedBook && (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in bg-[var(--bg-primary)]">
          <header className="h-[60px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-4 shrink-0 shadow-md z-20">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setViewMode('grid')}>
                <ArrowRight className="w-4 h-4 rotate-180 mr-2" /> Atrás
              </Button>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-sm text-[var(--text-primary)] truncate max-w-[200px] md:max-w-md">{selectedBook.title}</h2>
                <span className="text-xs text-[var(--text-secondary)] truncate">{selectedBook.author}</span>
              </div>
            </div>

            {/* Menú de Navegación del Libro */}
            <div className="flex items-center gap-2 mr-4">
              {toc.length > 0 && (
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setShowToc(!showToc)} className="flex items-center gap-2">
                    <List className="w-4 h-4" /> <span className="hidden sm:inline">Índice</span> <ChevronDown className="w-3 h-3" />
                  </Button>

                  {showToc && (
                    <div className="absolute top-full right-0 mt-2 w-64 max-h-[400px] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 animate-fade-in">
                      <div className="p-2 sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">Tabla de Contenidos</span>
                        <button onClick={() => setShowToc(false)}><X className="w-3 h-3" /></button>
                      </div>
                      <div className="p-1">
                        <button onClick={() => scrollToTocIndex(0)} className="w-full text-left px-3 py-2 text-sm text-[var(--accent-color)] hover:bg-[var(--bg-tertiary)] rounded flex items-center gap-2">
                          <ArrowUpCircle className="w-3 h-3" /> Ir al inicio
                        </button>
                        {toc.map((item, i) => (
                          <button key={i} onClick={() => scrollToTocIndex(item.index)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded truncate">{item.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 max-w-md relative group hidden md:block">
              <input type="text" value={inBookQuery} onChange={(e) => setInBookQuery(e.target.value)} placeholder={t('library.search_in_book')} className="w-full pl-10 pr-4 py-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:bg-[var(--bg-primary)] transition-all shadow-inner" />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)]" />
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button variant="ghost" size="icon" onClick={(e) => handleDeleteIndividual(e, selectedBook.id)} title="Eliminar este libro" className="text-red-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setFullScreen(!fullScreen)} title={fullScreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}>
                {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden relative">
            <div id="book-content-area" className="flex-1 overflow-y-auto p-8 md:p-12 md:px-20 scroll-smooth relative" onMouseUp={handleTextSelection}>
              <div className="max-w-3xl mx-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm min-h-full p-10 md:p-16 text-[var(--text-primary)] relative" style={{ fontSize: `${textSettings.fontSize}px`, lineHeight: textSettings.lineHeight }}>
                <div className="mb-10 text-center border-b border-[var(--border-color)] pb-4">
                  <h1 className="text-3xl font-serif font-bold mb-2 text-[var(--text-primary)]">{selectedBook.title}</h1>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedBook.author} • {getTraditionLabel(selectedBook.tradition)}</p>
                </div>
                <div className="font-serif whitespace-pre-wrap leading-relaxed selection:bg-yellow-200 selection:text-black">
                  {renderContentWithHighlights(selectedBook.content, inBookQuery)}
                </div>
              </div>

              {selectedText && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl rounded-full px-4 py-2 flex items-center gap-2 animate-fade-in z-50">
                  <button onClick={saveQuote} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full text-[var(--accent-color)]" title="Guardar Cita"><Quote className="w-5 h-5" /></button>
                  <div className="w-px h-4 bg-[var(--border-color)]"></div>
                  <input
                    type="text"
                    value={quoteTags}
                    onChange={(e) => setQuoteTags(e.target.value)}
                    placeholder="Tags (ej. fe, amor)..."
                    className="bg-transparent border-none outline-none text-sm w-32 text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                  />
                  <button onClick={() => setSelectedText('')} className="ml-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {/* Search Sidebar */}
            {inBookQuery && (
              <div className="w-80 bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col shrink-0 z-10 hidden lg:flex">
                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                  <h3 className="font-bold text-xs uppercase text-[var(--text-secondary)]">Resultados de Búsqueda</h3>
                  <p className="text-xs mt-1 text-[var(--text-primary)]">{foundFragments.length} coincidencias</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {foundFragments.map((frag) => (
                    <div key={frag.id} onClick={() => scrollToFragment(frag.index)} className="p-3 bg-[var(--bg-primary)] rounded border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent-color)] group">
                      <p className="text-xs font-mono text-[var(--text-secondary)] mb-1">Coincidencia #{frag.index + 1}</p>
                      <p className="text-sm text-[var(--text-primary)] line-clamp-3" dangerouslySetInnerHTML={{ __html: frag.preview.replace(new RegExp(`(${inBookQuery})`, 'gi'), '<mark class="bg-yellow-200 rounded-sm px-0.5">$1</mark>') }} />
                      <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => copyFragmentText(e, frag.id, frag.text)} className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)]">
                          {copiedId === frag.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {foundFragments.length === 0 && (
                    <div className="p-4 text-center text-[var(--text-secondary)] text-sm">
                      Sin resultados.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL DE SUBIDA --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] w-full max-w-md rounded-xl shadow-2xl border border-[var(--border-color)] overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-tertiary)]">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2"><Upload className="w-4 h-4" /> {t('library.upload')}</h3>
              <button onClick={() => setIsUploadModalOpen(false)}><X className="w-5 h-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" /></button>
            </div>

            <div className="p-6 space-y-4">
              {!uploadFile ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border-color)] rounded-lg cursor-pointer bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Cloud className="w-8 h-8 mb-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors" />
                    <p className="mb-2 text-sm text-[var(--text-secondary)]"><span className="font-semibold">Clic para subir</span> o arrastra aquí</p>
                    <p className="text-xs text-[var(--text-secondary)]">PDF, EPUB (Max 10MB)</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.epub" onChange={handleFileUpload} />
                </label>
              ) : (
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-green-100 dark:bg-green-800 p-2 rounded text-green-600 dark:text-green-300">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-green-800 dark:text-green-200 truncate">{uploadFile.name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setUploadFile(null); setUploadMeta({ title: '', author: '', tradition: 'General', category: '' }); }}
                    className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full text-green-700 dark:text-green-300 transition-colors"
                    title="Quitar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Título</label>
                  <input type="text" value={uploadMeta.title} onChange={(e) => setUploadMeta({ ...uploadMeta, title: e.target.value })} className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm" placeholder="Título del libro" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Autor</label>
                  <input type="text" value={uploadMeta.author} onChange={(e) => setUploadMeta({ ...uploadMeta, author: e.target.value })} className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm" placeholder="Nombre del autor" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Tradición</label>
                    <select value={uploadMeta.tradition} onChange={(e) => setUploadMeta({ ...uploadMeta, tradition: e.target.value })} className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm">
                      {TRADITIONS.map(t => <option key={t} value={t}>{getTraditionLabel(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--text-secondary)] mb-1">Categoría</label>
                    <input type="text" value={uploadMeta.category} onChange={(e) => setUploadMeta({ ...uploadMeta, category: e.target.value })} className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm" placeholder="Ej. Teología" />
                  </div>
                </div>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-[var(--accent-color)] animate-pulse justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {processingStatus || t('library.ocr_processing')}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={processUpload} disabled={!uploadFile || isProcessing || !uploadMeta.title} loading={isProcessing} className="w-full">
                  {isProcessing ? 'Procesando...' : 'Guardar en Biblioteca'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
