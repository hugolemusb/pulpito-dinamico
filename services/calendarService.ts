
import { CalendarEvent, GoogleCalendarConfig } from '../types';

const CALENDAR_STORAGE_KEY = 'calendar_events';
const GOOGLE_CONFIG_KEY = 'google_calendar_config';

// Load calendar events from localStorage
export const loadCalendarEvents = (): CalendarEvent[] => {
    try {
        const stored = localStorage.getItem(CALENDAR_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading calendar events:', error);
        return [];
    }
};

// Save calendar event to localStorage
export const saveCalendarEvent = (event: CalendarEvent): void => {
    try {
        const events = loadCalendarEvents();
        const existingIndex = events.findIndex(e => e.id === event.id);

        if (existingIndex >= 0) {
            // Update existing event
            events[existingIndex] = { ...event, updatedAt: Date.now() };
        } else {
            // Add new event
            events.push(event);
        }

        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
        console.error('Error saving calendar event:', error);
        throw new Error('No se pudo guardar el evento');
    }
};

// Delete calendar event from localStorage
export const deleteCalendarEvent = (id: string): void => {
    try {
        const events = loadCalendarEvents();
        const filtered = events.filter(e => e.id !== id);
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        throw new Error('No se pudo eliminar el evento');
    }
};

// Export events to ICS format - Compatible with Google Calendar, Outlook, Apple Calendar, etc.
export const exportToICS = (events: CalendarEvent[]): void => {
    try {
        // Get timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago';

        let icsContent = 'BEGIN:VCALENDAR\r\n';
        icsContent += 'VERSION:2.0\r\n';
        icsContent += 'PRODID:-//Púlpito Dinámico//Calendario Ministerial//ES\r\n';
        icsContent += 'CALSCALE:GREGORIAN\r\n';
        icsContent += 'METHOD:PUBLISH\r\n';
        icsContent += 'X-WR-CALNAME:Calendario Ministerial\r\n';
        icsContent += `X-WR-TIMEZONE:${timezone}\r\n`;

        // Add timezone definition
        icsContent += 'BEGIN:VTIMEZONE\r\n';
        icsContent += `TZID:${timezone}\r\n`;
        icsContent += 'END:VTIMEZONE\r\n';

        events.forEach(event => {
            const startDateTime = `${event.date.replace(/-/g, '')}T${event.time.replace(':', '')}00`;

            // Calculate end time (default 1 hour if not specified)
            let endDateTime: string;
            if (event.endTime) {
                endDateTime = `${event.date.replace(/-/g, '')}T${event.endTime.replace(':', '')}00`;
            } else {
                const startHour = parseInt(event.time.split(':')[0]);
                const startMin = event.time.split(':')[1];
                const endHour = (startHour + 1) % 24;
                endDateTime = `${event.date.replace(/-/g, '')}T${String(endHour).padStart(2, '0')}${startMin}00`;
            }

            const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

            icsContent += 'BEGIN:VEVENT\r\n';
            icsContent += `UID:${event.id}@pulpito-dinamico.app\r\n`;
            icsContent += `DTSTAMP:${now}\r\n`;
            icsContent += `DTSTART;TZID=${timezone}:${startDateTime}\r\n`;
            icsContent += `DTEND;TZID=${timezone}:${endDateTime}\r\n`;
            icsContent += `SUMMARY:${escapeICSText(event.title)}\r\n`;

            if (event.location) {
                icsContent += `LOCATION:${escapeICSText(event.location)}\r\n`;
            }

            // Build description
            let description = '';
            if (event.type) description += `Tipo: ${getEventTypeLabel(event.type)}\\n`;
            if (event.speaker) description += `Predicador: ${event.speaker}\\n`;
            if (event.mainVerse) description += `Versículo/Tema: ${event.mainVerse}\\n`;
            if (event.notes) description += `Notas: ${event.notes}`;

            if (description) {
                icsContent += `DESCRIPTION:${escapeICSText(description)}\r\n`;
            }

            icsContent += `CATEGORIES:${event.type.toUpperCase()}\r\n`;
            icsContent += `STATUS:CONFIRMED\r\n`;
            icsContent += 'END:VEVENT\r\n';
        });

        icsContent += 'END:VCALENDAR\r\n';

        // Create and download file
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `calendario-ministerial-${new Date().toISOString().split('T')[0]}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error exporting to ICS:', error);
        throw new Error('No se pudo exportar el calendario');
    }
};

// Helper function to escape special characters in ICS text
const escapeICSText = (text: string): string => {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
};

// Get event type label for description
const getEventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        sermon: 'Sermón',
        study: 'Estudio Bíblico',
        charla: 'Charla',
        exposicion: 'Exposición',
        tema: 'Tema',
        reunion: 'Reunión',
        taller: 'Taller',
        conferencia: 'Conferencia',
        event: 'Evento General',
        other: 'Otro'
    };
    return labels[type] || type;
};

// Load Google Calendar config
export const loadGoogleConfig = (): GoogleCalendarConfig => {
    try {
        const stored = localStorage.getItem(GOOGLE_CONFIG_KEY);
        return stored ? JSON.parse(stored) : {
            isConnected: false,
            syncEnabled: false
        };
    } catch (error) {
        console.error('Error loading Google config:', error);
        return { isConnected: false, syncEnabled: false };
    }
};

// Save Google Calendar config
export const saveGoogleConfig = (config: GoogleCalendarConfig): void => {
    try {
        localStorage.setItem(GOOGLE_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('Error saving Google config:', error);
    }
};

// Generate Google OAuth URL (placeholder for future implementation)
export const getGoogleAuthUrl = (): string => {
    // This would need to be configured with actual Google OAuth credentials
    const clientId = 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.events';

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline`;
};

// Handle Google OAuth callback (placeholder for future implementation)
export const handleGoogleCallback = async (code: string): Promise<GoogleCalendarConfig> => {
    // This would exchange the code for tokens and save them securely
    // For now, return a mock config
    console.warn('Google Calendar integration requires OAuth setup');
    return {
        isConnected: false,
        syncEnabled: false
    };
};

// Sync events with Google Calendar (placeholder for future implementation)
export const syncWithGoogleCalendar = async (
    events: CalendarEvent[],
    config: GoogleCalendarConfig
): Promise<void> => {
    if (!config.isConnected || !config.syncEnabled) {
        throw new Error('Google Calendar no está conectado');
    }

    // This would use the Google Calendar API to sync events
    // For now, just log a message
    console.warn('Google Calendar sync requires API implementation');
    throw new Error('La sincronización con Google Calendar estará disponible próximamente');
};
