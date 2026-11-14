import type { AvatarId, Category, DayEvent, FocusSession, PlannerData, Priority, Task, UserSettings } from './types';

export const STORAGE_KEY = 'myday-v1';
export const CATEGORIES: Category[] = ['Praca', 'Dom', 'Zdrowie', 'Rozwój', 'Planowanie', 'Prywatne'];
export const AVATAR_IDS = ['initial', 'flower', 'sun', 'moon', 'leaf', 'butterfly', 'sparkles'] as const;

export function dateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidStoredShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const validRecords = (items: unknown, withDate = true) => Array.isArray(items)
    && items.every((item) => isRecord(item) && (!withDate || isDateKey(item.date)));
  const validDateMap = (items: unknown) => isRecord(items)
    && Object.entries(items).every(([key, entry]) => isDateKey(key) && typeof entry === 'string');
  const settingsValid = !('settings' in value) || (isRecord(value.settings)
    && (!('name' in value.settings) || typeof value.settings.name === 'string')
    && (!('theme' in value.settings) || value.settings.theme === 'light' || value.settings.theme === 'dark')
    && (!('avatar' in value.settings) || AVATAR_IDS.includes(value.settings.avatar as AvatarId)));
  return (!('tasks' in value) || validRecords(value.tasks))
    && (!('events' in value) || validRecords(value.events))
    && (!('focusSessions' in value) || validRecords(value.focusSessions))
    && (!('notes' in value) || validDateMap(value.notes))
    && (!('noteSavedAt' in value) || validDateMap(value.noteSavedAt))
    && settingsValid
    && (!('selectedDate' in value) || isDateKey(value.selectedDate));
}

function preserveInvalidStoredValue(raw: string): void {
  try {
    const backupKey = `${STORAGE_KEY}-backup-${Date.now()}`;
    localStorage.setItem(backupKey, raw);
  } catch {
    // The primary planner data can still be saved when backup storage is full.
  }
}

function validTime(value: unknown): string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
}

function normalizeTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const category = String(value.category ?? '');
  const normalizedCategory: Category = CATEGORIES.includes(category as Category)
    ? category as Category
    : category === 'Osobiste' ? 'Prywatne' : category === 'Inne' ? 'Planowanie' : 'Praca';
  const priority = value.priority;
  const duration = Number(value.duration ?? 30);
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Zadanie',
    date: isDateKey(value.date) ? value.date : dateKey(new Date()),
    time: validTime(value.time),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 30,
    category: normalizedCategory,
    priority: (priority === 'high' || priority === 'medium' || priority === 'low' ? priority : 'medium') as Priority,
    description: typeof value.description === 'string' ? value.description : '',
    done: typeof value.done === 'boolean' ? value.done : false,
    completedAt: isDateKey(value.completedAt) ? value.completedAt : undefined,
  };
}

function normalizeEvent(value: unknown): DayEvent | null {
  if (!isRecord(value)) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Wydarzenie',
    date: isDateKey(value.date) ? value.date : dateKey(new Date()),
    time: validTime(value.time),
    description: typeof value.description === 'string' ? value.description : '',
  };
}

function normalizeFocusSession(value: unknown): FocusSession | null {
  if (!isRecord(value) || !isDateKey(value.date)) return null;
  const minutes = Number(value.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    date: value.date,
    minutes: Math.round(minutes),
  };
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => isDateKey(key) && typeof entry === 'string')) as Record<string, string>;
}

function defaultSettings(): UserSettings {
  return { name: 'Anna', theme: 'light', avatar: 'initial' };
}

function sampleTasks(date: string): Task[] {
  return [
    { id: 'sample-1', title: 'Przygotować prezentację', date, time: '09:00', duration: 45, category: 'Praca', priority: 'high', description: '', done: true, completedAt: date },
    { id: 'sample-2', title: 'Odpowiedzieć na maile', date, time: '10:00', duration: 30, category: 'Praca', priority: 'medium', description: '', done: true, completedAt: date },
    { id: 'sample-3', title: 'Zrobić zakupy', date, time: '12:00', duration: 45, category: 'Dom', priority: 'low', description: '', done: false },
    { id: 'sample-4', title: 'Trening na siłowni', date, time: '17:00', duration: 60, category: 'Zdrowie', priority: 'medium', description: '', done: false },
    { id: 'sample-5', title: 'Przeczytać 20 stron książki', date, time: '19:00', duration: 30, category: 'Rozwój', priority: 'low', description: '', done: false },
  ];
}

function emptyData(): PlannerData {
  const today = dateKey(new Date());
  return {
    tasks: [],
    events: [],
    focusSessions: [],
    notes: {},
    noteSavedAt: {},
    selectedDate: today,
    settings: defaultSettings(),
  };
}

export function readData(): PlannerData {
  const fallback = emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      fallback.tasks = sampleTasks(fallback.selectedDate);
      return fallback;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;

    const storedSettings = isRecord(parsed.settings) ? parsed.settings : {};
    const name = typeof storedSettings.name === 'string' && storedSettings.name.trim()
      ? storedSettings.name.trim().slice(0, 32)
      : fallback.settings.name;
    const settings: UserSettings = {
      name,
      theme: storedSettings.theme === 'dark' ? 'dark' : 'light',
      avatar: AVATAR_IDS.includes(storedSettings.avatar as AvatarId) ? storedSettings.avatar as AvatarId : 'initial',
    };
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map(normalizeTask).filter((task): task is Task => task !== null)
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.map(normalizeEvent).filter((event): event is DayEvent => event !== null)
      : [];
    const focusSessions = Array.isArray(parsed.focusSessions)
      ? parsed.focusSessions.map(normalizeFocusSession).filter((session): session is FocusSession => session !== null)
      : [];

    return {
      tasks,
      events,
      focusSessions,
      notes: normalizeStringMap(parsed.notes),
      noteSavedAt: normalizeStringMap(parsed.noteSavedAt),
      selectedDate: isDateKey(parsed.selectedDate) ? parsed.selectedDate : fallback.selectedDate,
      settings,
    };
  } catch {
    // Keep startup usable if browser storage is blocked or contains invalid JSON.
    // writeData also backs up unreadable content before replacing the main key.
    return fallback;
  }
}

export function writeData(data: PlannerData): void {
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous !== null) {
      try {
        if (!hasValidStoredShape(JSON.parse(previous))) preserveInvalidStoredValue(previous);
      } catch {
        preserveInvalidStoredValue(previous);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Nie udało się zapisać danych MyDay.', error);
  }
}

export function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
