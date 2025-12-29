import React, { useState, useEffect, useCallback } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Trash2, Loader2, ArrowUpLeft, Move, Lock, Unlock } from 'lucide-react';

export const ImageResizer: React.FC = () => {
    const [target, setTarget] = useState<HTMLImageElement | null>(null);
    const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [isFreeMove, setIsFreeMove] = useState(false);

    useEffect(() => {
        if (target) {
            setIsFreeMove(target.style.position === 'absolute');
            updateRect();
        }
    }, [target]);

    // Initial Selection Listener
    useEffect(() => {
        const handleImageClick = (e: MouseEvent | TouchEvent) => {
            const el = e.target as HTMLElement;
            if (el.tagName === 'IMG' && el.closest('[contenteditable="true"]')) {
                // Image inside contentEditable
                e.preventDefault(); // Stop default generic resize handles
                e.stopPropagation();
                setTarget(el as HTMLImageElement);
            } else if (target && !el.closest('.pulpito-image-resizer')) {
                // Click outside -> Deselect
                setTarget(null);
            }
        };

        // We use touchend/mouseup to allow selection
        document.addEventListener('mouseup', handleImageClick);
        document.addEventListener('touchend', handleImageClick); // For iPad

        return () => {
            document.removeEventListener('mouseup', handleImageClick);
            document.removeEventListener('touchend', handleImageClick);
        };
    }, [target]);

    // Update Rect on Window Resize or Scroll
    const updateRect = useCallback(() => {
        if (target) {
            if (!target.isConnected) {
                setTarget(null);
                return;
            }
            setOverlayRect(target.getBoundingClientRect());
        }
    }, [target]);

    useEffect(() => {
        if (target) {
            if (!target.isConnected) {
                setTarget(null);
                return;
            }
            updateRect();
            window.addEventListener('scroll', updateRect, true);
            window.addEventListener('resize', updateRect);
            // Observer mutation for size change
            const observer = new ResizeObserver(() => {
                if (!target.isConnected) {
                    setTarget(null);
                    return;
                }
                updateRect();
            });
            observer.observe(target);
            return () => {
                window.removeEventListener('scroll', updateRect, true);
                window.removeEventListener('resize', updateRect);
                observer.disconnect();
            };
        }
    }, [target, updateRect]);

    // --- RESIZE LOGIC ---
    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, direction: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!target) return;

        setIsResizing(true);
        const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const startWidth = target.clientWidth;
        // Keep aspect ratio potentially?
        const aspectRatio = target.naturalWidth / target.naturalHeight;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
            const diffX = currentX - startX;

            let newWidth = startWidth;
            if (direction.includes('right')) newWidth += diffX;
            else newWidth -= diffX;

            newWidth = Math.max(50, newWidth); // Min width

            target.style.width = `${newWidth}px`;
            target.style.height = 'auto'; // Maintain aspect ratio
            updateRect();
        };

        const handleUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
            // Trigger input event to save changes in editor
            const event = new Event('input', { bubbles: true });
            target.closest('[contenteditable]')?.dispatchEvent(event);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove); // For iPad drag
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
    };

    // --- FREE MOVE LOGIC ---
    const toggleFreeMove = () => {
        if (!target) return;

        if (isFreeMove) {
            // Relock to flow
            target.style.position = 'static';
            target.style.left = 'auto';
            target.style.top = 'auto';
            setIsFreeMove(false);
        } else {
            // Unlock to absolute
            // Use standard offsetParent logic
            const parent = target.offsetParent || target.parentElement;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                const rect = target.getBoundingClientRect();

                const left = rect.left - parentRect.left;
                const top = rect.top - parentRect.top;

                target.style.position = 'absolute';
                target.style.left = `${left}px`;
                target.style.top = `${top}px`;
                target.style.zIndex = '10';
            }
            setIsFreeMove(true);
        }
        updateRect();
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!target || !isFreeMove) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const rect = target.getBoundingClientRect();
        const offsetX = startX - rect.left;
        const offsetY = startY - rect.top;

        // Use standard offsetParent
        const parent = target.offsetParent || target.parentElement;
        const parentRect = parent?.getBoundingClientRect() || { left: 0, top: 0 };

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
            const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;

            const newLeft = currentX - parentRect.left - offsetX;
            const newTop = currentY - parentRect.top - offsetY;

            target.style.left = `${newLeft}px`;
            target.style.top = `${newTop}px`;
            updateRect();
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
            // Save
            const event = new Event('input', { bubbles: true });
            target.closest('[contenteditable]')?.dispatchEvent(event);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
    };

    // --- ALIGNMENT LOGIC ---
    const setAlign = (align: 'left' | 'center' | 'right') => {
        if (!target) return;
        // Reset to static flow
        target.style.position = 'relative'; // or static
        target.style.left = 'auto';
        target.style.top = 'auto';
        setIsFreeMove(false);

        target.style.display = 'block'; // Ensure block for margin auto
        target.style.marginLeft = align === 'left' ? '0' : 'auto';
        target.style.marginRight = align === 'right' ? '0' : 'auto';
        target.style.float = 'none'; // Clear floats

        // Trigger save
        const event = new Event('input', { bubbles: true });
        target.closest('[contenteditable]')?.dispatchEvent(event);
        updateRect();
    };

    const handleDelete = () => {
        if (!target) return;
        const parent = target.parentElement;
        target.remove();
        // Trigger save
        const event = new Event('input', { bubbles: true });
        parent?.closest('[contenteditable]')?.dispatchEvent(event);
        setTarget(null);
    };

    if (!target || !overlayRect) return null;

    return (
        <div
            className="pulpito-image-resizer fixed z-[9000] pointer-events-none"
            style={{
                left: overlayRect.left,
                top: overlayRect.top,
                width: overlayRect.width,
                height: overlayRect.height,
                border: '2px solid #2563eb', // Blue border
                boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
                cursor: isFreeMove ? 'move' : 'default',
            }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart} // Enable drag on body
        >
            {/* Toolbar (Above) */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-lg px-2 py-1 shadow-xl flex items-center gap-1 pointer-events-auto" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                <button onMouseDown={toggleFreeMove} className={`p-1.5 rounded ${isFreeMove ? 'bg-indigo-600' : 'hover:bg-slate-700'}`} title={isFreeMove ? "Fijar al Texto" : "Mover Libremente"}>
                    {isFreeMove ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button onMouseDown={() => setAlign('left')} className="p-1.5 hover:bg-slate-700 rounded"><AlignLeft className="w-4 h-4" /></button>
                <button onMouseDown={() => setAlign('center')} className="p-1.5 hover:bg-slate-700 rounded"><AlignCenter className="w-4 h-4" /></button>
                <button onMouseDown={() => setAlign('right')} className="p-1.5 hover:bg-slate-700 rounded"><AlignRight className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button onMouseDown={handleDelete} className="p-1.5 hover:bg-red-900/50 text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>

            {/* Resize Handles (Corners) */}
            {/* Top Left */}
            <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-sm"
                onMouseDown={(e) => handleResizeStart(e, 'top-left')}
                onTouchStart={(e) => handleResizeStart(e, 'top-left')}
            />
            {/* Top Right */}
            <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-sm"
                onMouseDown={(e) => handleResizeStart(e, 'top-right')}
                onTouchStart={(e) => handleResizeStart(e, 'top-right')}
            />
            {/* Bottom Left */}
            <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-sm"
                onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
                onTouchStart={(e) => handleResizeStart(e, 'bottom-left')}
            />
            {/* Bottom Right */}
            <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-sm"
                onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
                onTouchStart={(e) => handleResizeStart(e, 'bottom-right')}
            />
        </div>
    );
};
