export type Priority = 'low' | 'medium' | 'high';
export type Category = 'Praca' | 'Dom' | 'Zdrowie' | 'Rozwój' | 'Planowanie' | 'Prywatne';
export type AppView = 'home' | 'calendar' | 'stats' | 'settings';

export interface Task {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  category: Category;
  priority: Priority;
  description: string;
  done: boolean;
  completedAt?: string;
}

export interface DayEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
}

export interface FocusSession {
  id: string;
  date: string;
  minutes: number;
}

export interface UserSettings {
  name: string;
  theme: 'light' | 'dark';
}

export interface PlannerData {
  tasks: Task[];
  events: DayEvent[];
  focusSessions: FocusSession[];
  notes: Record<string, string>;
  settings: UserSettings;
}
