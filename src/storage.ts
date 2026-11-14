import type { Category, PlannerData, Priority, Task } from './types';

export const STORAGE_KEY = 'myday-v1';
export const CATEGORIES: Category[] = ['Praca', 'Dom', 'Zdrowie', 'Rozwój', 'Planowanie', 'Prywatne'];

export function dateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function readData(): PlannerData {
  const empty: PlannerData = {
    tasks: [], events: [], focusSessions: [], notes: {},
    settings: { name: 'Anna', theme: 'light' },
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const date = dateKey(new Date());
      empty.tasks = [
        { id: 'sample-1', title: 'Przygotować prezentację', date, time: '09:00', duration: 45, category: 'Praca', priority: 'high', description: '', done: true, completedAt: date },
        { id: 'sample-2', title: 'Odpowiedzieć na maile', date, time: '10:00', duration: 30, category: 'Praca', priority: 'medium', description: '', done: true, completedAt: date },
        { id: 'sample-3', title: 'Zrobić zakupy', date, time: '12:00', duration: 45, category: 'Dom', priority: 'low', description: '', done: false },
        { id: 'sample-4', title: 'Trening na siłowni', date, time: '17:00', duration: 60, category: 'Zdrowie', priority: 'medium', description: '', done: false },
        { id: 'sample-5', title: 'Przeczytać 20 stron książki', date, time: '19:00', duration: 30, category: 'Rozwój', priority: 'low', description: '', done: false },
      ];
      return empty;
    }
    const parsed = JSON.parse(raw) as Partial<PlannerData> & { notes?: Record<string, string> };
    const tasks: Task[] = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task) => {
          const category = String(task.category ?? '');
          return {
          id: String(task.id ?? crypto.randomUUID()),
          title: String(task.title ?? 'Zadanie'),
          date: String(task.date ?? dateKey(new Date())),
          time: String(task.time ?? ''),
          duration: Number(task.duration ?? 30),
          category: CATEGORIES.includes(category as Category)
            ? category as Category
            : category === 'Osobiste' ? 'Prywatne' : category === 'Inne' ? 'Planowanie' : 'Praca',
          priority: (['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium') as Priority,
          description: String(task.description ?? ''),
          done: Boolean(task.done),
          completedAt: task.completedAt,
          };
        })
      : [];
    return {
      tasks,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      focusSessions: Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [],
      notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
      settings: { ...empty.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return empty;
  }
}

export function writeData(data: PlannerData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Nie udało się zapisać danych MyDay.', error);
  }
}

export function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
