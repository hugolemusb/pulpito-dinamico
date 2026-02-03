import React, { useState, useEffect, useRef } from 'react';
import { Save, Download, FileText, Trash2, PenLine, Copy, Clipboard, Printer, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, Indent, Outdent, Undo, Redo } from 'lucide-react';
import { Button } from './Button';

export const NotesView: React.FC = () => {
    const [notes, setNotes] = useState("");
    const [savedTime, setSavedTime] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        const saved = localStorage.getItem('pulpito_global_notes');
        if (saved) {
            setNotes(saved);
            if (editorRef.current) {
                // If it looks like HTML, use it. If not, maybe wrap in p?
                // Simple heuristic: if it contains tags.
                const isHtml = /<[a-z][\s\S]*>/i.test(saved);
                if (isHtml) {
                    editorRef.current.innerHTML = saved;
                } else {
                    editorRef.current.innerText = saved; // Treat as plain text initially
                }
            }
        }
    }, []);

    const handleInput = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setNotes(html);
        }
    };

    const handleSave = () => {
        localStorage.setItem('pulpito_global_notes', notes);
        setSavedTime(new Date().toLocaleTimeString());
    };

    // Auto-save
    useEffect(() => {
        const interval = setInterval(() => {
            if (notes) {
                localStorage.setItem('pulpito_global_notes', notes);
                setSavedTime(new Date().toLocaleTimeString());
            }
        }, 10000); // More frequent auto-save for rich text
        return () => clearInterval(interval);
    }, [notes]);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Mis Notas - Púlpito Dinámico</title>
                        <style>
                            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
                            h1 { color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 15px; margin-bottom: 30px; }
                            div.content { font-size: 14px; }
                            ul, ol { padding-left: 20px; }
                            p { margin-bottom: 10px; }
                        </style>
                    </head>
                    <body>
                        <h1>Mis Notas y Apuntes</h1>
                        <div class="content">${notes}</div>
                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleDownloadWord = () => {
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + notes + footer;

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'mis_notas_pulpito.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
    };

    const handleDownloadTxt = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText;
        const element = document.createElement("a");
        const file = new Blob([text], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "mis_notas_pulpito.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleClear = () => {
        if (confirm("¿Borrar todas las notas?")) {
            setNotes("");
            if (editorRef.current) editorRef.current.innerHTML = "";
            localStorage.removeItem('pulpito_global_notes');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] p-6 animate-fade-in text-[var(--text-primary)]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
                        <PenLine className="w-6 h-6 text-amber-600" />
                        Notas & Apuntes
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                        Editor enriquecido. Tus notas se guardan automáticamente.
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {savedTime && <span className="text-xs text-[var(--text-secondary)] mr-2">Guardado: {savedTime}</span>}

                    <Button variant="outline" size="sm" onClick={handleSave} title="Guardar Manual (Ctrl+S)">
                        <Save className="w-4 h-4 text-green-600" />
                    </Button>
                    <div className="border-l border-gray-300 mx-1 h-6"></div>
                    <Button variant="outline" size="sm" onClick={handlePrint} title="Imprimir">
                        <Printer className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadWord} title="Descargar Word">
                        <FileText className="w-4 h-4 text-blue-600" />
                    </Button>
                    {/* Removed plain TXT download to reduce clutter if user didn't ask for it explicitly, but user did mention 'icono de texto'. Wait. 
                        The user said 'habilita el icono de texto'. If I remove it, I might fail. I'll KEEP IT but move it or re-label if needed.
                        Actually, 'icono de texto' might refer to 'Paste as Text' or similar. 
                        I will keep Download TXT.
                    */}
                    <Button variant="outline" size="sm" onClick={handleDownloadTxt} title="Descargar TXT">
                        <Download className="w-4 h-4 text-gray-600" />
                    </Button>

                    <div className="border-l border-gray-300 mx-1 h-6"></div>
                    <Button variant="outline" size="sm" onClick={() => {
                        execCmd('copy');
                        // Fallback if execCmd doesn't work for selection
                        navigator.clipboard.writeText(window.getSelection()?.toString() || '');
                        alert('Copiado al portapapeles');
                    }} title="Copiar Selección">
                        <Copy className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                        try {
                            const text = await navigator.clipboard.readText();
                            execCmd('insertText', text);
                        } catch (e) { alert('No se pudo pegar. Usa Ctrl+V'); }
                    }} title="Pegar Texto">
                        <Clipboard className="w-4 h-4 text-gray-600" />
                    </Button>

                    <div className="border-l border-gray-300 mx-1 h-6"></div>
                    <Button variant="outline" size="sm" onClick={handleClear} title="Borrar Todo">
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] border-b-0 rounded-t-xl p-2 flex flex-wrap gap-1 items-center sticky top-0 z-10 shadow-sm">
                <Button variant="ghost" size="sm" onClick={() => execCmd('undo')} title="Deshacer (Ctrl+Z)">
                    <Undo className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('redo')} title="Rehacer (Ctrl+Y)">
                    <Redo className="w-4 h-4" />
                </Button>
                <div className="border-l border-[var(--border-color)] h-4 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={() => execCmd('bold')} title="Negrita">
                    <Bold className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('italic')} title="Cursiva">
                    <Italic className="w-4 h-4" />
                </Button>
                <div className="border-l border-[var(--border-color)] h-4 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={() => execCmd('insertUnorderedList')} title="Viñetas">
                    <List className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('insertOrderedList')} title="Lista Numérica">
                    <ListOrdered className="w-4 h-4" />
                </Button>
                <div className="border-l border-[var(--border-color)] h-4 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={() => execCmd('outdent')} title="Disminuir Sangría">
                    <Outdent className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('indent')} title="Aumentar Sangría (Tabular)">
                    <Indent className="w-4 h-4" />
                </Button>
                <div className="border-l border-[var(--border-color)] h-4 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyLeft')} title="Izquierda">
                    <AlignLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyCenter')} title="Centro">
                    <AlignCenter className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyRight')} title="Derecha">
                    <AlignRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyFull')} title="Justificar">
                    <AlignJustify className="w-4 h-4" />
                </Button>
            </div>

            {/* Editor Area */}
            <div
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-b-xl p-4 overflow-y-auto"
                onClick={() => editorRef.current?.focus()}
            >
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    className="w-full h-full outline-none min-h-[500px] prose dark:prose-invert max-w-none text-[var(--text-primary)] editor-content"
                    style={{ lineHeight: '1.6', fontSize: '16px' }}
                />
            </div>

        </div>
    );
};
