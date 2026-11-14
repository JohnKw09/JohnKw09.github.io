import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, BriefcaseBusiness, CalendarDays,
  Check, CheckSquare2, ChevronDown, Clock3, Coffee, Dumbbell, House,
  Menu, Moon, MoreVertical, Pencil, Plus, Search, Settings, Sparkles, Sun, Target,
  Trash2, Trophy, X, Zap, ChartNoAxesColumnIncreasing, CalendarPlus, Play, Pause,
  RotateCcw, SlidersHorizontal, Heart, Tag, Timer, CircleHelp,
} from 'lucide-react';
import { CATEGORIES, dateKey, makeId, readData, writeData } from './storage';
import type { AppView, Category, DayEvent, PlannerData, Priority, Task } from './types';

const todayKey = dateKey(new Date());
const weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const priorityLabel: Record<Priority, string> = { high: 'Wysoki', medium: 'Średni', low: 'Niski' };

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number): string {
  const date = localDate(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('pl-PL', options).format(localDate(value));
}

function startOfWeek(value: string): string {
  const date = localDate(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

function weekDates(value: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(value), index));
}

function categoryIcon(category: Category) {
  if (category === 'Praca') return <BriefcaseBusiness size={14} />;
  if (category === 'Dom') return <House size={14} />;
  if (category === 'Zdrowie') return <Dumbbell size={14} />;
  if (category === 'Rozwój') return <BookOpen size={14} />;
  if (category === 'Planowanie') return <CalendarDays size={14} />;
  return <Heart size={14} />;
}

function App() {
  const [data, setData] = useState<PlannerData>(() => readData());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<AppView>('home');
  const [filter, setFilter] = useState('today');
  const [taskStatus, setTaskStatus] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'task' | 'event' | 'focus' | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusStarted, setFocusStarted] = useState<number | null>(null);

  useEffect(() => writeData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);
  useEffect(() => {
    if (focusRunning && focusSeconds === 0) finishFocus();
    // finishFocus is intentionally triggered only when the timer reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeconds, focusRunning]);

  const dayTasks = useMemo(() => data.tasks
    .filter((task) => task.date === selectedDate)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')), [data.tasks, selectedDate]);
  const scopedTasks = useMemo(() => {
    if (query.trim() || filter === 'all') return data.tasks;
    if (filter === 'important') return data.tasks.filter((task) => task.priority === 'high');
    if (filter === 'private') return data.tasks.filter((task) => task.category === 'Prywatne');
    if (filter === 'today') return data.tasks.filter((task) => task.date === todayKey);
    return dayTasks;
  }, [data.tasks, dayTasks, filter, query]);
  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pl');
    return scopedTasks.filter((task) => {
      const statusMatches = taskStatus === 'all'
        || (taskStatus === 'open' && !task.done)
        || (taskStatus === 'done' && task.done);
      const categoryMatches = categoryFilter === 'all' || task.category === categoryFilter;
      const priorityMatches = priorityFilter === 'all' || task.priority === priorityFilter;
      const queryMatches = !normalized || `${task.title} ${task.description} ${task.category}`.toLocaleLowerCase('pl').includes(normalized);
      return statusMatches && categoryMatches && priorityMatches && queryMatches;
    });
  }, [scopedTasks, taskStatus, categoryFilter, priorityFilter, query]);

  const todayTasks = data.tasks.filter((task) => task.date === todayKey);
  const todayDone = todayTasks.filter((task) => task.done).length;
  const dayMinutes = todayTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const streak = useMemo(() => calculateStreak(data), [data]);
  const greeting = new Date().getHours() < 12 ? 'Dzień dobry' : new Date().getHours() < 18 ? 'Miłego popołudnia' : 'Dobry wieczór';

  function updateData(updater: (previous: PlannerData) => PlannerData) {
    setData((previous) => updater(previous));
  }

  function toggleTask(task: Task) {
    updateData((previous) => ({
      ...previous,
      tasks: previous.tasks.map((item) => item.id === task.id
        ? { ...item, done: !item.done, completedAt: !item.done ? dateKey(new Date()) : undefined }
        : item),
    }));
  }

  function removeTask(task: Task) {
    if (!window.confirm(`Usunąć zadanie „${task.title}”?`)) return;
    updateData((previous) => ({ ...previous, tasks: previous.tasks.filter((item) => item.id !== task.id) }));
    setToast('Zadanie usunięte');
  }

  function saveTask(task: Task) {
    updateData((previous) => ({
      ...previous,
      tasks: editingTask
        ? previous.tasks.map((item) => item.id === task.id ? task : item)
        : [...previous.tasks, task],
    }));
    setSelectedDate(task.date);
    setMonth(localDate(task.date));
    setFilter('date');
    setModal(null);
    setEditingTask(null);
    setToast(editingTask ? 'Zapisano zmiany' : 'Dodano zadanie do planu');
  }

  function saveEvent(event: DayEvent) {
    updateData((previous) => ({ ...previous, events: [...previous.events, event] }));
    setSelectedDate(event.date);
    setMonth(localDate(event.date));
    setFilter('date');
    setModal(null);
    setToast('Dodano wydarzenie do kalendarza');
  }

  function finishFocus() {
    setFocusRunning(false);
    if (focusStarted !== null) {
      const minutes = Math.max(1, Math.round((Date.now() - focusStarted) / 60_000));
      updateData((previous) => ({ ...previous, focusSessions: [...previous.focusSessions, { id: makeId(), date: todayKey, minutes }] }));
      setToast('Sesja skupienia zapisana. Dobra robota!');
    }
    setFocusStarted(null);
    setFocusSeconds(25 * 60);
  }

  function changeMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function chooseDate(date: string) {
    setSelectedDate(date);
    setMonth(localDate(date));
    setFilter('date');
    setView('home');
    setMenuOpen(false);
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    setMonth(localDate(date));
    setFilter('date');
  }

  function openTask(task?: Task) {
    setEditingTask(task ?? null);
    setModal('task');
  }

  const taskModal = modal === 'task' && <TaskModal task={editingTask} date={selectedDate} onClose={() => { setModal(null); setEditingTask(null); }} onSave={saveTask} />;
  const eventModal = modal === 'event' && <EventModal date={selectedDate} onClose={() => setModal(null)} onSave={saveEvent} />;
  const focusModal = modal === 'focus' && <FocusModal seconds={focusSeconds} running={focusRunning} onToggle={() => {
    if (!focusRunning && focusStarted === null) setFocusStarted(Date.now());
    setFocusRunning((running) => !running);
  }} onReset={() => { setFocusRunning(false); setFocusStarted(null); setFocusSeconds(25 * 60); }} onClose={() => setModal(null)} />;

  return (
    <div className={`app-shell ${data.settings.theme === 'dark' ? 'theme-dark' : ''}`}>
      <div className="app-frame">
        {menuOpen && <button className="mobile-scrim" aria-label="Zamknij menu" onClick={() => setMenuOpen(false)} />}
        <Sidebar
          view={view} setView={(next) => { setView(next); setMenuOpen(false); }}
          selectedDate={selectedDate} chooseDate={chooseDate} month={month} changeMonth={changeMonth}
          tasks={data.tasks} settings={data.settings} streak={streak} open={menuOpen}
          onClose={() => setMenuOpen(false)} onFilter={(nextFilter) => {
            setFilter(nextFilter);
            if (nextFilter === 'today') {
              setSelectedDate(todayKey);
              setMonth(localDate(todayKey));
            }
          }} filter={filter}
        />
        <main className="main-area">
          <header className="topbar">
            <div className="mobile-brand-row">
              <button className="icon-button mobile-menu-button" aria-label="Otwórz menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
              <div className="brand mobile-brand"><span className="brand-mark"><Check size={20} strokeWidth={3} /></span><span>MyDay</span></div>
            </div>
            <div className="topbar-tools">
              <label className="search-box"><Search size={19} /><input value={query} onChange={(event) => { setQuery(event.target.value); setView('home'); }} placeholder="Szukaj zadań…" aria-label="Szukaj zadań" />{query && <button onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie"><X size={15} /></button>}</label>
              <button className="icon-button notification-button" aria-label="Powiadomienia" onClick={() => setToast(todayTasks.filter((task) => !task.done).length ? `Masz ${todayTasks.filter((task) => !task.done).length} zadań do zrobienia dziś` : 'Wszystko gotowe na dziś!')}><Bell size={19} /><span /></button>
              <button className="profile-button" aria-label="Ustawienia profilu" onClick={() => setView('settings')}>{data.settings.name.trim().charAt(0).toLocaleUpperCase('pl')}</button>
            </div>
          </header>

          <div className="page-content">
            {view === 'home' && <>
              <section className="welcome-row">
                <div><div className="eyebrow">{formatDate(todayKey, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>{greeting}, {data.settings.name}! <span className="wave">👋</span></h1><p>Oto Twój plan na dziś — powodzenia!</p></div>
                <button className="primary-button add-task-button" onClick={() => openTask()}><Plus size={18} /> Dodaj zadanie</button>
              </section>

              <section className="stats-grid" aria-label="Podsumowanie dnia">
                <StatCard icon={<Check size={20} />} tone="violet" value={`${todayDone} / ${todayTasks.length}`} label="Zadań na dziś" sparkline="M0 34 C15 38 18 20 31 27 S50 5 64 18 S82 14 100 2" />
                <StatCard icon={<Clock3 size={20} />} tone="mint" value={formatDuration(dayMinutes)} label="Zaplanowany czas" sparkline="M0 35 C18 34 16 15 35 25 S54 32 68 16 S85 18 100 3" />
                <StatCard icon={<Trophy size={20} />} tone="peach" value={`${todayTasks.length ? Math.round(todayDone / todayTasks.length * 100) : 0}%`} label="Postęp dnia" sparkline="M0 38 C12 38 14 29 28 29 S39 15 53 24 S72 22 82 10 S92 9 100 2" />
                <StatCard icon={<Sparkles size={20} />} tone="lilac" value={`${streak} dni`} label="Twoja seria" sparkline="M0 37 C16 37 20 25 33 29 S45 9 60 20 S79 20 88 7 S95 10 100 1" />
              </section>

              <section className="dashboard-grid">
                <div className="panel task-panel">
                  <div className="panel-heading"><h2><span className="heading-icon"><CheckSquare2 size={18} /></span>{query.trim() ? 'Wyniki wyszukiwania' : filter === 'all' ? 'Wszystkie zadania' : filter === 'important' ? 'Ważne zadania' : filter === 'private' ? 'Prywatne zadania' : selectedDate === todayKey ? 'Dzisiejsze zadania' : `Zadania · ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}`}</h2><button className="primary-button compact-button" onClick={() => openTask()}><Plus size={16} /> Dodaj zadanie</button></div>
                  <div className="task-toolbar"><div className="task-tabs">
                    {(['all', 'open', 'done'] as const).map((key) => <button key={key} className={taskStatus === key ? 'selected' : ''} onClick={() => setTaskStatus(key)}><span className={`filter-dot ${key}`} />{({ all: 'Wszystkie', open: 'Aktywne', done: 'Gotowe' } as const)[key]}<b>{key === 'all' ? scopedTasks.length : key === 'open' ? scopedTasks.filter((task) => !task.done).length : scopedTasks.filter((task) => task.done).length}</b></button>)}
                  </div><div className="select-filters"><label><SlidersHorizontal size={14} /><select aria-label="Filtruj kategorię" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Kategorie</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><select aria-label="Filtruj priorytet" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">Priorytet</option><option value="high">Wysoki</option><option value="medium">Średni</option><option value="low">Niski</option></select></div></div>
                  <div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => openTask(task)} onDelete={() => removeTask(task)} />) : <div className="empty-state"><span className="empty-illustration">{query ? <Search size={25} /> : <Sparkles size={26} />}</span><strong>{query ? 'Nie znaleźliśmy takich zadań' : 'Ten dzień jest jeszcze otwarty'}</strong><span>{query ? 'Spróbuj innej frazy.' : 'Dodaj zadanie i zacznij spokojnie planować.'}</span>{!query && <button className="text-button" onClick={() => openTask()}><Plus size={15} /> Dodaj pierwsze zadanie</button>}</div>}</div>
                </div>

                <CalendarPanel month={month} selectedDate={selectedDate} tasks={data.tasks} events={data.events} onMonth={changeMonth} onSelect={chooseDate} onAddEvent={() => setModal('event')} compact />

                <div className="panel quick-panel"><div className="panel-heading"><h2><Zap size={18} className="icon-violet" /> Szybkie akcje</h2></div><div className="quick-actions"><button className="quick-action violet-action" onClick={() => openTask()}><Plus size={18} />Dodaj zadanie</button><button className="quick-action blue-action" onClick={() => setModal('event')}><CalendarPlus size={17} />Dodaj wydarzenie</button><button className="quick-action mint-action" onClick={() => setView('stats')}><ChartNoAxesColumnIncreasing size={18} />Zobacz statystyki</button><button className="quick-action peach-action" onClick={() => setModal('focus')}><Sun size={18} />Tryb skupienia</button></div></div>

                <div className="panel progress-panel"><div className="panel-heading"><h2><ChartNoAxesColumnIncreasing size={18} className="icon-violet" /> Twój postęp</h2><button className="subtle-link" onClick={() => setView('stats')}>Szczegóły <ArrowRight size={14} /></button></div><MiniProgress tasks={data.tasks} date={todayKey} /></div>

                <div className="inspiration-card"><div className="mountain-art"><div className="sunset-sun" /><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="mountain mountain-dark" /></div><div className="inspiration-copy"><span>Małe kroki</span><span>prowadzą do wielkich zmian <Heart size={15} fill="currentColor" /></span></div><button onClick={() => setToast('Każdy dobry dzień zaczyna się od małego kroku ✨')}>Zainspiruj się <ArrowRight size={15} /></button></div>
              </section>

              <section className="bottom-agenda"><div className="panel agenda-panel"><div className="panel-heading"><h2><Clock3 size={17} className="icon-violet" /> Najbliższe</h2><button className="subtle-link" onClick={() => setView('calendar')}>Kalendarz <ArrowRight size={14} /></button></div><Upcoming tasks={dayTasks} events={data.events.filter((event) => event.date === selectedDate)} /></div><div className="panel note-panel"><div className="panel-heading"><h2><Pencil size={16} className="icon-violet" /> Notatka dnia</h2><span className="autosave-label">zapisuje się automatycznie</span></div><textarea aria-label="Notatka dnia" placeholder="Zapisz myśl, cel albo coś, o czym chcesz pamiętać…" value={data.notes[selectedDate] ?? ''} onChange={(event) => updateData((previous) => ({ ...previous, notes: { ...previous.notes, [selectedDate]: event.target.value } }))} /></div></section>
            </>}

            {view === 'calendar' && <section className="inner-page"><PageTitle eyebrow="Zaplanuj z wyprzedzeniem" title="Kalendarz" description="Wybierz dzień, dodaj zadania i miej swój plan pod ręką." action={<button className="primary-button" onClick={() => setModal('event')}><Plus size={17} /> Dodaj wydarzenie</button>} /><CalendarPanel month={month} selectedDate={selectedDate} tasks={data.tasks} events={data.events} onMonth={changeMonth} onSelect={selectCalendarDate} onAddEvent={() => setModal('event')} /><div className="panel calendar-agenda"><div className="panel-heading"><h2>{formatDate(selectedDate)}</h2><button className="primary-button compact-button" onClick={() => openTask()}><Plus size={16} /> Dodaj zadanie</button></div><AgendaForDate tasks={data.tasks.filter((task) => task.date === selectedDate)} events={data.events.filter((event) => event.date === selectedDate)} onToggle={toggleTask} /></div></section>}

            {view === 'stats' && <StatisticsPage tasks={data.tasks} focusSessions={data.focusSessions} />}

            {view === 'settings' && <SettingsPage settings={data.settings} onSave={(settings) => updateData((previous) => ({ ...previous, settings }))} />}
          </div>
          <footer className="app-footer"><span>Made with <Heart size={12} fill="currentColor" /> for your day</span><button onClick={() => setToast('Twoje dane są zapisywane bezpiecznie w tej przeglądarce.') }><CircleHelp size={14} /> Jak to działa?</button></footer>
        </main>
      </div>
      {taskModal}{eventModal}{focusModal}
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function calculateStreak(data: PlannerData): number {
  const activity = new Set(data.tasks.filter((task) => task.done).map((task) => task.completedAt ?? task.date));
  const focusDays = data.focusSessions.map((session) => session.date);
  focusDays.forEach((date) => activity.add(date));
  let cursor = activity.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let count = 0;
  while (activity.has(cursor)) { count += 1; cursor = addDays(cursor, -1); }
  return count;
}

function StatCard({ icon, tone, value, label, sparkline }: { icon: ReactNode; tone: string; value: string; label: string; sparkline: string }) {
  return <article className={`stat-card stat-${tone}`}><span className="stat-icon">{icon}</span><div className="stat-copy"><strong>{value}</strong><span>{label}</span></div><svg className="sparkline" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true"><path d={sparkline} /></svg></article>;
}

function Sidebar({ view, setView, selectedDate, chooseDate, month, changeMonth, tasks, settings, streak, open, onClose, onFilter, filter }: {
  view: AppView; setView: (view: AppView) => void; selectedDate: string; chooseDate: (date: string) => void;
  month: Date; changeMonth: (amount: number) => void; tasks: Task[]; settings: PlannerData['settings']; streak: number;
  open: boolean; onClose: () => void; onFilter: (filter: string) => void; filter: string;
}) {
  const counts = {
    all: tasks.length,
    today: tasks.filter((task) => task.date === todayKey && !task.done).length,
    important: tasks.filter((task) => task.priority === 'high').length,
    private: tasks.filter((task) => task.category === 'Prywatne').length,
  };
  const items: { id: AppView; label: string; icon: ReactNode }[] = [
    { id: 'home', label: 'Strona główna', icon: <House size={18} /> },
    { id: 'calendar', label: 'Kalendarz', icon: <CalendarDays size={18} /> },
    { id: 'stats', label: 'Statystyki', icon: <ChartNoAxesColumnIncreasing size={18} /> },
    { id: 'settings', label: 'Ustawienia', icon: <Settings size={18} /> },
  ];
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="brand"><span className="brand-mark"><Check size={20} strokeWidth={3} /></span><span>MyDay</span><button className="icon-button sidebar-close" aria-label="Zamknij menu" onClick={onClose}><X size={18} /></button></div>
    <nav className="primary-nav" aria-label="Główna nawigacja">{items.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
    <div className="sidebar-divider" />
    <div className="quick-filter-title">Szybkie filtry</div>
    <div className="quick-filters">
      {([['all', 'Wszystkie'], ['today', 'Dziś'], ['important', 'Ważne'], ['private', 'Prywatne']] as const).map(([id, label]) => <button key={id} className={filter === id && view === 'home' ? 'filter-active' : ''} onClick={() => { onFilter(id); setView('home'); }}><span className={`filter-dot ${id}`} />{label}<b className={`filter-count ${id}`}>{counts[id]}</b></button>)}
    </div>
    <div className="sidebar-calendar"><div className="sidebar-section-title"><span>Kalendarz</span><div className="calendar-arrows"><button aria-label="Poprzedni miesiąc" onClick={() => changeMonth(-1)}><ArrowLeft size={14} /></button><button aria-label="Następny miesiąc" onClick={() => changeMonth(1)}><ArrowRight size={14} /></button></div></div><MiniCalendar month={month} selectedDate={selectedDate} tasks={tasks} onSelect={chooseDate} /></div>
    <div className="sidebar-bottom"><div className="plant-art" aria-hidden="true"><i /><i /><i /><i /><span /></div><div className="sidebar-greeting">Małe kroki,<br />wielkie rzeczy <Heart size={14} /></div><div className="sidebar-profile"><div className="avatar">{settings.name.trim().charAt(0).toLocaleUpperCase('pl')}</div><div><strong>{settings.name}</strong><span><Sparkles size={12} /> {streak ? `${streak} dni z rzędu` : 'Dobrego dnia!'}</span></div><ChevronDown size={16} className="profile-chevron" /></div></div>
  </aside>;
}

function MiniCalendar({ month, selectedDate, tasks, onSelect }: { month: Date; selectedDate: string; tasks: Task[]; onSelect: (date: string) => void }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    const date = new Date(year, monthIndex, day);
    return { date: dateKey(date), day: date.getDate(), inMonth: day > 0 && day <= count };
  });
  const taskDates = new Set(tasks.map((task) => task.date));
  return <><div className="mini-month-title">{new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(month)}</div><div className="mini-calendar-grid"><div className="week-labels">{weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div>{cells.map((cell) => <button key={cell.date} onClick={() => onSelect(cell.date)} className={`${cell.inMonth ? '' : 'outside-month'} ${cell.date === selectedDate ? 'date-selected' : ''} ${cell.date === todayKey ? 'date-today' : ''}`} aria-label={formatDate(cell.date)}><span>{cell.day}</span>{taskDates.has(cell.date) && <i />}</button>)}</div></>;
}

function CalendarPanel({ month, selectedDate, tasks, events, onMonth, onSelect, onAddEvent, compact = false }: {
  month: Date; selectedDate: string; tasks: Task[]; events: DayEvent[]; onMonth: (amount: number) => void;
  onSelect: (date: string) => void; onAddEvent: () => void; compact?: boolean;
}) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const previousCount = new Date(year, monthIndex, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    let day = index - offset + 1; let date = new Date(year, monthIndex, day); let inMonth = true;
    if (day < 1) { day = previousCount + day; date = new Date(year, monthIndex - 1, day); inMonth = false; }
    if (index >= offset + dayCount) { day = index - offset - dayCount + 1; date = new Date(year, monthIndex + 1, day); inMonth = false; }
    return { date: dateKey(date), day, inMonth };
  });
  const busyDates = new Set([...tasks.map((task) => task.date), ...events.map((event) => event.date)]);
  return <section className={`panel calendar-panel ${compact ? 'calendar-compact' : ''}`}>
    <div className="panel-heading calendar-heading"><h2><CalendarDays size={18} /> Kalendarz</h2><div className="calendar-heading-right"><button className="text-button add-event-link" onClick={onAddEvent}><Plus size={15} /> Wydarzenie</button><button className="calendar-month-arrow" aria-label="Poprzedni miesiąc" onClick={() => onMonth(-1)}><ArrowLeft size={17} /></button><strong>{new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(month)}</strong><button className="calendar-month-arrow" aria-label="Następny miesiąc" onClick={() => onMonth(1)}><ArrowRight size={17} /></button></div></div>
    <div className="calendar-grid"><div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((cell) => <button key={cell.date} onClick={() => onSelect(cell.date)} className={`${cell.inMonth ? '' : 'outside-month'} ${cell.date === selectedDate ? 'date-selected' : ''} ${cell.date === todayKey ? 'date-today' : ''}`} aria-label={`${formatDate(cell.date)}${busyDates.has(cell.date) ? ', zaplanowane' : ''}`}><span>{cell.day}</span>{busyDates.has(cell.date) && <i />}</button>)}</div></div>
    {!compact && <div className="calendar-legend"><span><i className="legend-dot today-dot" /> Dzisiaj</span><span><i className="legend-dot busy-dot" /> Zaplanowane</span><span className="legend-selected">Wybrano: <b>{formatDate(selectedDate)}</b></span></div>}
  </section>;
}

function TaskRow({ task, onToggle, onEdit, onDelete }: { task: Task; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  return <article className={`task-row ${task.done ? 'task-done' : ''}`}>
    <button className={`task-check ${task.done ? 'checked' : ''}`} onClick={onToggle} aria-label={task.done ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}>{task.done && <Check size={14} strokeWidth={3} />}</button>
    <div className="task-main"><button className="task-title" onClick={onEdit}>{task.title}</button>{task.description && <span className="task-description">{task.description}</span>}<div className="task-meta"><span><Clock3 size={12} />{task.time || 'Bez godziny'}</span><span className={`category-chip cat-${task.category.toLowerCase().replace('ł', 'l').replace('ó', 'o').replace('ś', 's')}`}>{categoryIcon(task.category)}{task.category}</span></div></div>
    <span className={`priority-pill priority-${task.priority}`}><i />{priorityLabel[task.priority]}</span>
    <span className="task-time">{task.time || '—'}</span>
    <div className="task-menu-wrap"><button className="row-menu-button" aria-label={`Opcje: ${task.title}`} onClick={() => setMenu((value) => !value)}><MoreVertical size={17} /></button>{menu && <><button className="menu-dismiss" aria-label="Zamknij menu" onClick={() => setMenu(false)} /><div className="row-menu"><button onClick={() => { setMenu(false); onEdit(); }}><Pencil size={14} /> Edytuj</button><button className="danger-action" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={14} /> Usuń</button></div></>}</div>
  </article>;
}

function Upcoming({ tasks, events }: { tasks: Task[]; events: DayEvent[] }) {
  const list = [...tasks.filter((task) => !task.done).map((task) => ({ id: task.id, time: task.time, title: task.title, kind: 'task' })), ...events.map((event) => ({ id: event.id, time: event.time, title: event.title, kind: 'event' }))].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')).slice(0, 4);
  return list.length ? <div className="upcoming-list">{list.map((item) => <div className="upcoming-item" key={`${item.kind}-${item.id}`}><span className="upcoming-time">{item.time || '—'}</span><span className={`upcoming-marker ${item.kind}`} /><div><strong>{item.title}</strong><small>{item.kind === 'event' ? 'Wydarzenie' : 'Zadanie'}</small></div></div>)}</div> : <div className="agenda-empty"><Coffee size={19} /><span>Brak kolejnych punktów planu. Zrób sobie chwilę przerwy.</span></div>;
}

function MiniProgress({ tasks, date }: { tasks: Task[]; date: string }) {
  const days = weekDates(date); const counts = days.map((day) => tasks.filter((task) => task.date === day && task.done).length);
  const max = Math.max(1, ...counts); const total = tasks.filter((task) => task.date === date).length; const done = counts[days.indexOf(date)] ?? 0;
  return <div className="mini-progress"><div className="progress-ring" style={{ '--progress': `${total ? done / total * 100 : 0}%` } as CSSProperties}><div><strong>{total ? Math.round(done / total * 100) : 0}%</strong><span>dzisiaj</span></div></div><div className="week-bars">{days.map((day, index) => <div className="week-bar-column" key={day}><div className="week-bar-track"><i style={{ height: `${Math.max(7, counts[index] / max * 100)}%` }} /></div><span>{weekdays[index]}</span></div>)}</div></div>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title-row"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function AgendaForDate({ tasks, events, onToggle }: { tasks: Task[]; events: DayEvent[]; onToggle: (task: Task) => void }) {
  const rows = [...tasks.map((task) => ({ time: task.time, title: task.title, type: 'task' as const, task })), ...events.map((event) => ({ time: event.time, title: event.title, type: 'event' as const, task: undefined }))].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  if (!rows.length) return <div className="agenda-empty wide-empty"><Sparkles size={22} /><strong>Tu jest jeszcze miejsce na plany</strong><span>Dodaj zadanie lub wydarzenie na ten dzień.</span></div>;
  return <div className="agenda-date-list">{rows.map((row, index) => <div className="agenda-date-row" key={`${row.type}-${row.title}-${index}`}><span className="agenda-date-time">{row.time || '—'}</span><span className={`agenda-date-marker ${row.type}`} />{row.task && <button className={`task-check small-check ${row.task.done ? 'checked' : ''}`} onClick={() => onToggle(row.task!)} aria-label="Zmień status">{row.task.done && <Check size={12} />}</button>}<div><strong className={row.task?.done ? 'struck' : ''}>{row.title}</strong><span>{row.type === 'task' ? `Zadanie · ${row.task?.category}` : 'Wydarzenie'}</span></div><span className={row.task ? `priority-pill priority-${row.task.priority}` : 'event-label'}>{row.task ? priorityLabel[row.task.priority] : 'Wydarzenie'}</span></div>)}</div>;
}

function StatisticsPage({ tasks, focusSessions }: { tasks: Task[]; focusSessions: PlannerData['focusSessions'] }) {
  const done = tasks.filter((task) => task.done);
  const week = weekDates(todayKey);
  const weeklyDone = done.filter((task) => week.includes(task.completedAt ?? task.date));
  const weekCounts = week.map((day) => tasks.filter((task) => task.done && (task.completedAt ?? task.date) === day).length);
  const max = Math.max(1, ...weekCounts);
  const categoryCounts = CATEGORIES.map((category) => ({ category, count: tasks.filter((task) => task.category === category).length })).filter((entry) => entry.count > 0);
  const highestDayCount = Math.max(0, ...weekCounts);
  const productiveDay = highestDayCount ? weekdays[weekCounts.indexOf(highestDayCount)] : '—';
  const completion = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
  return <section className="inner-page stats-page"><PageTitle eyebrow="Doceniaj małe kroki" title="Twoje statystyki" description="Zobacz, jak dobrze dbasz o swój czas i codzienne cele." />
    <div className="stats-overview"><div className="panel overview-card overview-lilac"><span>Ukończone zadania</span><strong>{completion}%</strong><div className="overview-track"><i style={{ width: `${completion}%` }} /></div><small>{done.length} z {tasks.length} wszystkich zadań</small></div><div className="panel overview-card"><span>Ten tydzień</span><strong>{weeklyDone.length}</strong><small>wykonanych zadań</small><span className="overview-emoji"><CheckSquare2 size={24} /></span></div><div className="panel overview-card overview-mint"><span>Najbardziej produktywny dzień</span><strong>{productiveDay}</strong><small>{Math.max(0, ...weekCounts)} ukończonych zadań</small><span className="overview-emoji"><Sparkles size={24} /></span></div><div className="panel overview-card"><span>Czas skupienia</span><strong>{focusSessions.reduce((sum, session) => sum + session.minutes, 0)}<small> min</small></strong><small>{focusSessions.length} sesji Pomodoro</small><span className="overview-emoji"><Timer size={24} /></span></div></div>
    <div className="stats-detail-grid"><div className="panel chart-panel"><div className="panel-heading"><h2>Aktywność w tym tygodniu</h2><span className="chart-legend"><i /> Ukończone zadania</span></div><div className="chart-area"><div className="chart-y-axis"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div><div className="chart-bars">{week.map((day, index) => <div className="chart-column" key={day}><div className="chart-bar-track"><i style={{ height: `${weekCounts[index] ? Math.max(8, weekCounts[index] / max * 100) : 0}%` }} /></div><span>{weekdays[index]}</span></div>)}</div></div></div>
      <div className="panel category-chart"><div className="panel-heading"><h2>Zadania według kategorii</h2><Tag size={17} className="icon-violet" /></div>{categoryCounts.length ? <div className="category-breakdown">{categoryCounts.map(({ category, count }) => <div key={category} className="category-breakdown-row"><div><span className={`category-chip cat-${category.toLowerCase().replace('ł', 'l').replace('ó', 'o').replace('ś', 's')}`}>{categoryIcon(category)}{category}</span><strong>{count}</strong></div><div className="breakdown-track"><i style={{ width: `${tasks.length ? count / tasks.length * 100 : 0}%` }} /></div></div>)}</div> : <div className="empty-chart">Dodane zadania pokażą tu podział kategorii.</div>}</div></div>
  </section>;
}

function SettingsPage({ settings, onSave }: { settings: PlannerData['settings']; onSave: (settings: PlannerData['settings']) => void }) {
  return <section className="inner-page"><PageTitle eyebrow="Dostosuj MyDay do siebie" title="Ustawienia" description="Ustaw swoje imię i wybierz wygląd aplikacji." /><div className="panel settings-panel"><h2>Twój profil</h2><label className="settings-field"><span>Jak mamy się do Ciebie zwracać?</span><input value={settings.name} maxLength={32} onChange={(event) => onSave({ ...settings, name: event.target.value || 'Ty' })} placeholder="Twoje imię" /></label><div className="settings-divider" /><div className="settings-theme"><div><strong>Wygląd aplikacji</strong><span>Wybierz jasny lub ciemny motyw.</span></div><div className="theme-switcher"><button className={settings.theme === 'light' ? 'active' : ''} onClick={() => onSave({ ...settings, theme: 'light' })}><Sun size={16} /> Jasny</button><button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => onSave({ ...settings, theme: 'dark' })}><Moon size={16} /> Ciemny</button></div></div></div><div className="panel data-info"><div className="data-info-icon"><Check size={19} /></div><div><strong>Twoje dane pozostają na tym urządzeniu</strong><span>Zadania, wydarzenia, ustawienia i sesje skupienia zapisujemy lokalnie w przeglądarce (localStorage).</span></div></div></section>;
}

function TaskModal({ task, date, onClose, onSave }: { task: Task | null; date: string; onClose: () => void; onSave: (task: Task) => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [taskDate, setTaskDate] = useState(task?.date ?? date);
  const [time, setTime] = useState(task?.time ?? '09:00');
  const [duration, setDuration] = useState(task?.duration ?? 30);
  const [category, setCategory] = useState<Category>(task?.category ?? 'Praca');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [description, setDescription] = useState(task?.description ?? '');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({ id: task?.id ?? makeId(), title: title.trim(), date: taskDate, time, duration, category, priority, description: description.trim(), done: task?.done ?? false, completedAt: task?.completedAt });
  }
  return <ModalFrame title={task ? 'Edytuj zadanie' : 'Nowe zadanie'} onClose={onClose}><form onSubmit={submit} className="form-body"><label className="form-field full-field"><span>Nazwa zadania</span><input autoFocus required maxLength={90} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Przygotować prezentację" /></label><div className="form-row"><label className="form-field"><span>Data</span><input required type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} /></label><label className="form-field"><span>Godzina</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><div className="form-row"><label className="form-field"><span>Kategoria</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Priorytet</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="low">Niski</option><option value="medium">Średni</option><option value="high">Wysoki</option></select></label></div><label className="form-field"><span>Planowany czas</span><div className="input-with-unit"><input type="number" min={5} max={720} step={5} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /><span>min</span></div></label><label className="form-field"><span>Krótki opis <small>(opcjonalnie)</small></span><textarea rows={3} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dodaj kilka szczegółów…" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" type="submit"><Check size={16} /> {task ? 'Zapisz zmiany' : 'Dodaj zadanie'}</button></div></form></ModalFrame>;
}

function EventModal({ date, onClose, onSave }: { date: string; onClose: () => void; onSave: (event: DayEvent) => void }) {
  const [title, setTitle] = useState(''); const [eventDate, setEventDate] = useState(date); const [time, setTime] = useState('12:00'); const [description, setDescription] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!title.trim()) return; onSave({ id: makeId(), title: title.trim(), date: eventDate, time, description: description.trim() }); }
  return <ModalFrame title="Dodaj wydarzenie" onClose={onClose}><form className="form-body" onSubmit={submit}><label className="form-field"><span>Nazwa wydarzenia</span><input autoFocus required maxLength={90} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Spotkanie zespołu" /></label><div className="form-row"><label className="form-field"><span>Data</span><input type="date" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label><label className="form-field"><span>Godzina</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><label className="form-field"><span>Opis <small>(opcjonalnie)</small></span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dodaj szczegóły…" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Anuluj</button><button type="submit" className="primary-button"><CalendarPlus size={16} /> Zapisz wydarzenie</button></div></form></ModalFrame>;
}

function FocusModal({ seconds, running, onToggle, onReset, onClose }: { seconds: number; running: boolean; onToggle: () => void; onReset: () => void; onClose: () => void }) {
  const minutes = Math.floor(seconds / 60); const remaining = seconds % 60;
  return <ModalFrame title="Tryb skupienia" onClose={onClose}><div className="focus-content"><div className="focus-label"><Target size={16} /> Jedna rzecz na raz</div><div className="focus-clock"><span>{String(minutes).padStart(2, '0')}</span><i>:</i><span>{String(remaining).padStart(2, '0')}</span></div><p>25 minut spokojnej pracy<br />i krótka przerwa dla Ciebie.</p><div className="focus-controls"><button className="primary-button" onClick={onToggle}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Wstrzymaj' : 'Rozpocznij skupienie'}</button><button className="icon-button reset-button" aria-label="Zresetuj timer" onClick={onReset}><RotateCcw size={17} /></button></div></div></ModalFrame>;
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><span className="modal-kicker"><Sparkles size={13} /> MyDay</span><h2>{title}</h2></div><button className="icon-button modal-close" aria-label="Zamknij" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

function formatDuration(minutes: number): string {
  if (!minutes) return '0 min';
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return `${hours ? `${hours}h ` : ''}${rest ? `${rest}min` : ''}`.trim();
}

export default App;

