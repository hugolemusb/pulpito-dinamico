import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, X, Download, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Clock, MapPin, User, Book } from 'lucide-react';
import { CalendarEvent, TextSettings } from '../types';
import { loadCalendarEvents, saveCalendarEvent, deleteCalendarEvent, exportToICS } from '../services/calendarService';
import { Button } from './Button';

interface CalendarViewProps {
    textSettings: TextSettings;
}

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const EVENT_TYPES = [
    { value: 'sermon', label: 'Sermón', color: 'bg-blue-100 text-blue-800 border-blue-500' },
    { value: 'study', label: 'Estudio Bíblico', color: 'bg-purple-100 text-purple-800 border-purple-500' },
    { value: 'charla', label: 'Charla', color: 'bg-indigo-100 text-indigo-800 border-indigo-500' },
    { value: 'exposicion', label: 'Exposición', color: 'bg-cyan-100 text-cyan-800 border-cyan-500' },
    { value: 'tema', label: 'Tema', color: 'bg-teal-100 text-teal-800 border-teal-500' },
    { value: 'reunion', label: 'Reunión', color: 'bg-amber-100 text-amber-800 border-amber-500' },
    { value: 'taller', label: 'Taller', color: 'bg-orange-100 text-orange-800 border-orange-500' },
    { value: 'conferencia', label: 'Conferencia', color: 'bg-rose-100 text-rose-800 border-rose-500' },
    { value: 'event', label: 'Evento General', color: 'bg-green-100 text-green-800 border-green-500' },
    { value: 'other', label: 'Otro', color: 'bg-gray-100 text-gray-800 border-gray-500' }
];

// Get ISO week number
const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Get week start date (Sunday)
const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
};

export const CalendarView: React.FC<CalendarViewProps> = ({ textSettings }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([getWeekNumber(new Date())]));
    const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent>>({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        endTime: '11:00',
        type: 'sermon',
        speaker: '',
        location: '',
        mainVerse: '',
        notes: ''
    });

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = () => {
        setEvents(loadCalendarEvents());
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (Date | null)[] = [];
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }
        return days;
    };

    const getEventsForDate = (date: Date | null) => {
        if (!date) return [];
        const dateStr = date.toISOString().split('T')[0];
        return events.filter(e => e.date === dateStr);
    };

    const getEventsForWeek = (weekNum: number) => {
        return events.filter(e => {
            const eventDate = new Date(e.date);
            return getWeekNumber(eventDate) === weekNum &&
                eventDate.getMonth() === currentDate.getMonth() &&
                eventDate.getFullYear() === currentDate.getFullYear();
        }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    };

    const getWeeksInMonth = (): number[] => {
        const weeks = new Set<number>();
        const days = getDaysInMonth(currentDate);
        days.forEach(day => {
            if (day) weeks.add(getWeekNumber(day));
        });
        return Array.from(weeks).sort((a, b) => a - b);
    };

    const getEventTypeColor = (type: string) => {
        const found = EVENT_TYPES.find(t => t.value === type);
        return found?.color || 'bg-gray-100 text-gray-800 border-gray-500';
    };

    const getEventTypeLabel = (type: string) => {
        const found = EVENT_TYPES.find(t => t.value === type);
        return found?.label || 'Otro';
    };

    const handleCreateEvent = (date?: Date) => {
        setSelectedEvent(null);
        setEditingEvent({
            title: '',
            date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            time: '10:00',
            endTime: '11:00',
            type: 'sermon',
            speaker: '',
            location: '',
            mainVerse: '',
            notes: ''
        });
        setShowEventModal(true);
    };

    const handleEditEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setEditingEvent(event);
        setShowEventModal(true);
    };

    const handleSaveEvent = () => {
        try {
            const eventToSave: CalendarEvent = {
                id: selectedEvent?.id || Date.now().toString(),
                title: editingEvent.title || 'Sin título',
                date: editingEvent.date || new Date().toISOString().split('T')[0],
                time: editingEvent.time || '10:00',
                endTime: editingEvent.endTime,
                type: editingEvent.type || 'sermon',
                speaker: editingEvent.speaker,
                location: editingEvent.location,
                mainVerse: editingEvent.mainVerse,
                notes: editingEvent.notes,
                sermonId: editingEvent.sermonId,
                sermonFile: editingEvent.sermonFile,
                googleCalendarEventId: editingEvent.googleCalendarEventId,
                createdAt: selectedEvent?.createdAt || Date.now(),
                updatedAt: Date.now()
            };
            saveCalendarEvent(eventToSave);
            loadEvents();
            setShowEventModal(false);
        } catch (error: any) {
            alert(error.message || 'Error al guardar');
        }
    };

    const handleDeleteEvent = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            deleteCalendarEvent(id);
            setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
            setShowEventModal(false);
            setSelectedEvent(null);
        } catch (error: any) {
            alert(error.message || 'Error al eliminar');
        }
    };

    const handleExportICS = () => {
        if (events.length === 0) {
            alert('No hay eventos para exportar. Crea al menos un evento primero.');
            return;
        }
        try {
            exportToICS(events);
            alert(`Se exportaron ${events.length} eventos exitosamente.`);
        } catch (error: any) {
            console.error('Export error:', error);
            alert(error.message || 'Error al exportar');
        }
    };

    // Download single event as ICS file
    const handleDownloadEvent = (event: CalendarEvent) => {
        try {
            exportToICS([event]);
            alert('Evento descargado exitosamente.');
        } catch (error: any) {
            alert(error.message || 'Error al descargar evento');
        }
    };

    const toggleWeekExpanded = (weekNum: number) => {
        setExpandedWeeks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(weekNum)) {
                newSet.delete(weekNum);
            } else {
                newSet.add(weekNum);
            }
            return newSet;
        });
    };

    const days = getDaysInMonth(currentDate);
    const weeksInMonth = getWeeksInMonth();

    return (
        <div className="flex h-full animate-fade-in">
            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] p-4 md:p-6 shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-lg text-white">
                                <CalendarIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold font-serif text-[var(--text-primary)]">Calendario Ministerial</h2>
                                <p className="text-sm text-[var(--text-secondary)]">Gestiona tus predicaciones y eventos</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {/* View Mode Toggle */}
                            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('month')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    Mes
                                </button>
                                <button
                                    onClick={() => setViewMode('year')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'year' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    Año
                                </button>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleExportICS} icon={<Download className="w-4 h-4" />}>Exportar</Button>
                            <Button variant="primary" size="sm" onClick={() => handleCreateEvent()} icon={<Plus className="w-4 h-4" />}>Nuevo</Button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                        <button onClick={() => viewMode === 'year'
                            ? setCurrentDate(new Date(currentDate.getFullYear() - 1, 0))
                            : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-bold">
                            {viewMode === 'year' ? currentDate.getFullYear() : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                        </h3>
                        <button onClick={() => viewMode === 'year'
                            ? setCurrentDate(new Date(currentDate.getFullYear() + 1, 0))
                            : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {viewMode === 'month' ? (
                        <div className="max-w-5xl mx-auto">
                            {/* Days header with week number column */}
                            <div className="grid grid-cols-8 gap-1 mb-2">
                                <div className="text-center font-bold text-[var(--text-secondary)] uppercase text-xs py-2">Sem</div>
                                {DAYS_OF_WEEK.map(day => (
                                    <div key={day} className="text-center font-bold text-[var(--text-secondary)] uppercase text-xs py-2">{day}</div>
                                ))}
                            </div>

                            {/* Calendar rows with week numbers */}
                            {(() => {
                                const rows: React.ReactElement[] = [];
                                let currentRow: (Date | null)[] = [];
                                let weekNum = 0;

                                days.forEach((day, index) => {
                                    currentRow.push(day);

                                    if (currentRow.length === 7 || index === days.length - 1) {
                                        // Pad the last row if needed
                                        while (currentRow.length < 7) currentRow.push(null);

                                        // Get week number from first non-null day in row
                                        const firstDay = currentRow.find(d => d !== null);
                                        weekNum = firstDay ? getWeekNumber(firstDay) : weekNum;

                                        rows.push(
                                            <div key={`row-${index}`} className="grid grid-cols-8 gap-1 mb-1">
                                                {/* Week number */}
                                                <div className="flex items-center justify-center bg-[var(--bg-tertiary)] rounded-lg text-xs font-bold text-[var(--text-secondary)]">
                                                    S{weekNum}
                                                </div>

                                                {/* Days */}
                                                {currentRow.map((day, dayIndex) => {
                                                    const dayEvents = getEventsForDate(day);
                                                    const isToday = day && day.toDateString() === new Date().toDateString();
                                                    return (
                                                        <div
                                                            key={dayIndex}
                                                            className={`min-h-[80px] bg-[var(--bg-secondary)] border rounded-lg p-1.5 transition-all ${day ? 'hover:border-blue-400 cursor-pointer' : 'opacity-30'} ${isToday ? 'border-2 border-blue-500 shadow-md' : 'border-[var(--border-color)]'}`}
                                                            onClick={() => day && handleCreateEvent(day)}
                                                        >
                                                            {day && (
                                                                <>
                                                                    <span className={`text-xs font-medium block mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-[var(--text-secondary)]'}`}>{day.getDate()}</span>
                                                                    <div className="space-y-0.5">
                                                                        {dayEvents.slice(0, 2).map(event => (
                                                                            <div
                                                                                key={event.id}
                                                                                onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                                                                className={`text-[10px] px-1 py-0.5 rounded border-l-2 truncate ${getEventTypeColor(event.type)}`}
                                                                            >
                                                                                {event.time.slice(0, 5)} {event.title}
                                                                            </div>
                                                                        ))}
                                                                        {dayEvents.length > 2 && (
                                                                            <div className="text-[10px] text-[var(--text-secondary)] italic">+{dayEvents.length - 2}</div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                        currentRow = [];
                                    }
                                });

                                return rows;
                            })()}
                        </div>
                    ) : (
                        /* Year View - 12 Months Grid */
                        <div className="max-w-6xl mx-auto grid grid-cols-3 md:grid-cols-4 gap-4">
                            {MONTHS.map((monthName, monthIndex) => {
                                // Count events for this month
                                const monthEvents = events.filter(e => {
                                    const eventDate = new Date(e.date);
                                    return eventDate.getMonth() === monthIndex && eventDate.getFullYear() === currentDate.getFullYear();
                                });
                                const isCurrentMonth = new Date().getMonth() === monthIndex && new Date().getFullYear() === currentDate.getFullYear();

                                return (
                                    <div
                                        key={monthIndex}
                                        onClick={() => {
                                            setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
                                            setViewMode('month');
                                        }}
                                        className={`bg-[var(--bg-secondary)] border rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-[var(--accent-color)] transition-all ${isCurrentMonth ? 'border-2 border-blue-500 shadow-md' : 'border-[var(--border-color)]'}`}
                                    >
                                        <h4 className={`font-bold text-lg mb-2 ${isCurrentMonth ? 'text-blue-600' : 'text-[var(--text-primary)]'}`}>
                                            {monthName}
                                        </h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {monthEvents.length > 0 ? (
                                                <>
                                                    <span className="bg-[var(--accent-color)] text-white text-xs px-2 py-1 rounded-full font-bold">
                                                        {monthEvents.length} {monthEvents.length === 1 ? 'evento' : 'eventos'}
                                                    </span>
                                                    <div className="flex gap-1 mt-1">
                                                        {monthEvents.filter(e => e.type === 'sermon').length > 0 && (
                                                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                                {monthEvents.filter(e => e.type === 'sermon').length} serm
                                                            </span>
                                                        )}
                                                        {monthEvents.filter(e => e.type === 'study').length > 0 && (
                                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                                                {monthEvents.filter(e => e.type === 'study').length} est
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-[var(--text-secondary)] italic">Sin eventos</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Events by Week */}
            <div className="w-80 bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--border-color)]">
                    <h3 className="font-bold text-[var(--text-primary)]">Eventos por Semana</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{events.length} eventos totales</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {weeksInMonth.map(weekNum => {
                        const weekEvents = getEventsForWeek(weekNum);
                        const isExpanded = expandedWeeks.has(weekNum);

                        return (
                            <div key={weekNum} className="mb-2">
                                <button
                                    onClick={() => toggleWeekExpanded(weekNum)}
                                    className="w-full flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
                                >
                                    <span className="font-medium text-sm">Semana {weekNum}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-[var(--accent-color)] text-white px-2 py-0.5 rounded-full">{weekEvents.length}</span>
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </button>

                                {isExpanded && weekEvents.length > 0 && (
                                    <div className="mt-1 space-y-1 pl-2">
                                        {weekEvents.map(event => (
                                            <div
                                                key={event.id}
                                                onClick={() => handleEditEvent(event)}
                                                className={`p-2 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow bg-[var(--bg-primary)] ${getEventTypeColor(event.type).split(' ')[2]}`}
                                            >
                                                <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                                                    <Clock className="w-3 h-3" />
                                                    {event.date.split('-').reverse().join('/')} {event.time}
                                                </div>
                                                <div className="font-medium text-sm truncate">{event.title}</div>
                                                <div className="text-xs text-[var(--text-secondary)]">{getEventTypeLabel(event.type)}</div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mt-1">
                                                        <MapPin className="w-3 h-3" /> {event.location}
                                                    </div>
                                                )}
                                                {event.speaker && (
                                                    <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                                                        <User className="w-3 h-3" /> {event.speaker}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isExpanded && weekEvents.length === 0 && (
                                    <p className="text-xs text-[var(--text-secondary)] italic p-2 pl-4">Sin eventos esta semana</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Statistics */}
                <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <div className="text-lg font-bold text-blue-600">{events.filter(e => e.type === 'sermon').length}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Sermones</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                            <div className="text-lg font-bold text-purple-600">{events.filter(e => e.type === 'study').length}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Estudios</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            <div className="text-lg font-bold text-amber-600">{events.filter(e => e.type === 'reunion').length}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Reuniones</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/20 p-2 rounded">
                            <div className="text-lg font-bold text-gray-600">{events.filter(e => !['sermon', 'study', 'reunion'].includes(e.type)).length}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Otros</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Modal */}
            {showEventModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[var(--bg-secondary)] w-full max-w-2xl rounded-2xl shadow-2xl border border-[var(--border-color)] max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold">{selectedEvent ? 'Editar Evento' : 'Nuevo Evento'}</h2>
                            <button onClick={() => setShowEventModal(false)}><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div>
                                <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Título *</label>
                                <input type="text" value={editingEvent.title} onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]" placeholder="Ej: Sermón Dominical" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Fecha *</label>
                                    <input type="date" value={editingEvent.date} onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Hora Inicio *</label>
                                    <input type="time" value={editingEvent.time} onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Hora Fin</label>
                                    <input type="time" value={editingEvent.endTime || ''} onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Tipo de Evento</label>
                                <select value={editingEvent.type} onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value as any })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                    {EVENT_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Predicador/Expositor</label>
                                    <input type="text" value={editingEvent.speaker || ''} onChange={(e) => setEditingEvent({ ...editingEvent, speaker: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Lugar</label>
                                    <input type="text" value={editingEvent.location || ''} onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Versículo/Tema Base</label>
                                <input type="text" value={editingEvent.mainVerse || ''} onChange={(e) => setEditingEvent({ ...editingEvent, mainVerse: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]" placeholder="Ej: Juan 3:16 o Tema: La Fe" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-[var(--text-secondary)] mb-1">Notas</label>
                                <textarea value={editingEvent.notes || ''} onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })} className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] resize-none" rows={3} placeholder="Notas adicionales..." />
                            </div>
                            {selectedEvent && (
                                <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                                    <button onClick={(e) => handleDeleteEvent(e, selectedEvent.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                                        <Trash2 className="w-4 h-4" /> Eliminar
                                    </button>
                                    <button onClick={() => handleDownloadEvent(selectedEvent)} className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                        <Download className="w-4 h-4" /> Descargar .ics
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 shrink-0">
                            <Button variant="ghost" onClick={() => setShowEventModal(false)}>Cancelar</Button>
                            <Button onClick={handleSaveEvent}>{selectedEvent ? 'Guardar Cambios' : 'Crear Evento'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
