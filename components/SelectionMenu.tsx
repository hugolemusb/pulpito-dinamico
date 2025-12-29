import React, { useState, useEffect, useRef } from 'react';
import { Copy, FileText, Check } from 'lucide-react';
import { usePersistence } from '../context/PersistenceContext';

export const SelectionMenu: React.FC = () => {
    const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [showCopied, setShowCopied] = useState(false);
    const [showAdded, setShowAdded] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // We can access context to directly append to notes if we want to be fancy
    // but standard copy is the primary request.
    // actually, let's try to append to localStorage notes directly for "Quick Note"

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();

            // If no selection or inside the menu itself (to prevent closing when clicking buttons)
            if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                if (!showCopied && !showAdded) setPosition(null); // Keep showing if we are displaying feedback
                return;
            }

            const text = selection.toString().trim();
            if (text.length === 0) return;

            setSelectedText(text);

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Check if selection is inside an input or textarea (native browser behavior is usually better there, but user asked for "all sections")
            // We often want to avoid blocking native input controls, but let's see. 
            // This listener is global.

            setPosition({
                x: rect.left + (rect.width / 2),
                y: rect.top - 10 // Above the selection
            });

            setShowCopied(false);
            setShowAdded(false);
        };

        // We use 'mouseup' because 'selectionchange' fires too often while dragging
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange); // For keyboard selection

        // Close on click outside
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                // We typically rely on selection clearing to hide, but if user clicks without clearing selection (rare), we might want to hide?
                // Actually, clicking usually clears selection.
            }
        };
        document.addEventListener('mousedown', handleClick);

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [showCopied, showAdded]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent clearing selection immediately
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(selectedText);
            setShowCopied(true);
            setTimeout(() => {
                setShowCopied(false);
                // Optional: clear selection? window.getSelection()?.removeAllRanges();
                // User might want to copy again or extend. Keep logic simple.
            }, 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const handleAddToNotes = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const currentNotes = localStorage.getItem('pulpito_global_notes') || '';
        const newNotes = currentNotes + (currentNotes ? '\n\n' : '') + selectedText;
        localStorage.setItem('pulpito_global_notes', newNotes);

        setShowAdded(true);
        setTimeout(() => setShowAdded(false), 2000);
    };

    if (!position) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] flex items-center bg-slate-900 text-white rounded-lg shadow-xl px-2 py-1.5 gap-2 transition-all animate-fade-in"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)'
            }}
        >
            <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:bg-slate-700 px-2 py-1 rounded transition-colors text-xs font-bold"
                title="Copiar al portapapeles"
            >
                {showCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {showCopied ? 'Copiado' : 'Copiar'}
            </button>
            <div className="w-px h-4 bg-slate-700"></div>
            <button
                onClick={handleAddToNotes}
                className="flex items-center gap-1 hover:bg-slate-700 px-2 py-1 rounded transition-colors text-xs font-bold"
                title="Enviar a Notas (Directo)"
            >
                {showAdded ? <Check className="w-3 h-3 text-green-400" /> : <FileText className="w-3 h-3" />}
                {showAdded ? 'Enviado' : 'A Notas'}
            </button>

            {/* Triangle arrow at bottom */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900"></div>
        </div>
    );
};
