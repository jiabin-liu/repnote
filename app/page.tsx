"use client";
/* eslint-disable react-hooks/refs, @next/next/no-img-element -- Native History uses refs; the tiny local SVG favicon needs no image optimizer. */

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { Calculator, CalendarDays, ChevronDown, ChevronsDown, ChevronsUp, FileInput, List, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import RmCalculator from "./rm/RmCalculator";
import CustomSelect from "./CustomSelect";

type SetRow = { id: string; weight: string; reps: string; note: string };
type Exercise = { id: string; name: string; sets: SetRow[] };
type ExerciseLibraryItem = { id: string; name: string; frequency: number; isFrequent: boolean };
type PrHighlight = {
  lift: "bench_press" | "squat" | "deadlift";
  setId: string;
  weight: number;
  unit: "kg" | "lbs";
  weightKg: number;
  previousBestKg: number | null;
  improvementKg: number | null;
};
type Workout = {
  id: string;
  status?: "draft" | "completed";
  draftOfWorkoutId?: string | null;
  date: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  unit?: "kg" | "lbs";
  note: string;
  source?: string;
  prHighlights?: PrHighlight[];
  exercises: Exercise[];
};

const PR_LIFT_LABELS: Record<PrHighlight["lift"], string> = { bench_press: "BP", squat: "SQ", deadlift: "DL" };
const PR_LIFT_NAMES: Record<PrHighlight["lift"], string> = { bench_press: "Bench Press", squat: "Squat", deadlift: "Deadlift" };
const formatPrWeight = (weight: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(weight);

const HISTORY_KEY = "repnote-history-v1";
const CUSTOM_EXERCISES_KEY = "repnote-custom-exercises-v1";
const REPNOTE_VIEW_STATE = "repnoteView";
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptySet = (): SetRow => ({ id: makeId(), weight: "", reps: "", note: "" });
const formatClock = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const formatDate = (iso: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(iso));
const formatBuildTime = (iso: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
const formatRecordDate = (date: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
const formatMonthName = (month: string | number) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2000, Number.parseInt(String(month), 10) - 1, 1));
const localDateKey = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateFromWorkout = (workout: Workout) => new Date(`${workout.date}T12:00:00`);
const duration = (start: string, end?: string) => {
  if (!end) return "In progress";
  const mins = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
};

function SwipeableHistoryRow({ workout, onOpen, onDelete }: { workout: Workout; onOpen: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number; offset: number } | null>(null);
  const currentOffset = useRef(0);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const finishDrag = () => {
    if (!start.current) return;
    const shouldOpen = dragging.current ? currentOffset.current < -36 : open;
    setOpen(shouldOpen);
    currentOffset.current = shouldOpen ? -76 : 0;
    setOffset(currentOffset.current);
    suppressClick.current = dragging.current;
    dragging.current = false;
    setIsDragging(false);
    start.current = null;
  };

  return (
    <div className={`swipe-row ${open ? "open" : ""}`}>
      <button className="delete-workout" aria-label="Delete workout" onFocus={() => { setOpen(true); currentOffset.current = -76; setOffset(-76); }} onClick={onDelete}>Delete</button>
      <button
        className={`history-card${workout.prHighlights?.length ? " pr-workout" : ""}${isDragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          start.current = { x: event.clientX, y: event.clientY, offset: open ? -76 : 0 };
          currentOffset.current = open ? -76 : 0;
          dragging.current = false;
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const distanceX = event.clientX - start.current.x;
          const distanceY = event.clientY - start.current.y;
          if (!dragging.current && Math.abs(distanceX) > 7 && Math.abs(distanceX) > Math.abs(distanceY)) {
            dragging.current = true;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (!dragging.current) return;
          currentOffset.current = Math.max(-76, Math.min(0, start.current.offset + distanceX));
          setOffset(currentOffset.current);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (open) { setOpen(false); currentOffset.current = 0; setOffset(0); }
          else onOpen();
        }}
      >
        <time dateTime={workout.date}><strong>{dateFromWorkout(workout).getDate()}</strong><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dateFromWorkout(workout)).toUpperCase()}</span></time>
        <div className="history-exercise-summary">{workout.exercises.length ? workout.exercises.map((exercise) => <span className="history-exercise-name" key={exercise.id}>{exercise.name}<i aria-label={`${exercise.sets.length} sets`}>×{exercise.sets.length}</i></span>) : <span className="history-exercise-name">Free training</span>}</div>
        {workout.prHighlights?.length ? <span className="history-pr-highlight" aria-label={`New personal record: ${workout.prHighlights.map((highlight) => `${PR_LIFT_NAMES[highlight.lift]} ${formatPrWeight(highlight.weight)} ${highlight.unit}`).join(", ")}`}><b>PR</b><span>{workout.prHighlights.map((highlight) => `${PR_LIFT_LABELS[highlight.lift]} ${formatPrWeight(highlight.weight)} ${highlight.unit}`).join(" · ")}</span></span> : null}
      </button>
    </div>
  );
}

function SwipeToDelete({ children, label, onDelete, className = "" }: { children: ReactNode; label: string; onDelete: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const baseOffset = open ? -74 : 0;
  const offset = Math.max(-74, Math.min(0, baseOffset + dragX));

  const finishDrag = () => {
    if (!start.current) return;
    setOpen(offset < -34);
    setDragX(0);
    suppressClick.current = dragging.current;
    dragging.current = false;
    start.current = null;
  };

  return (
    <div className={`draft-swipe ${open ? "open" : ""} ${className}`.trim()}>
      <button className="draft-swipe-delete" aria-label={label} onFocus={() => setOpen(true)} onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
      <div
        className="draft-swipe-content"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => { start.current = { x: event.clientX, y: event.clientY }; dragging.current = false; }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const distanceX = event.clientX - start.current.x;
          const distanceY = event.clientY - start.current.y;
          if (!dragging.current && Math.abs(distanceX) > 7 && Math.abs(distanceX) > Math.abs(distanceY)) {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (dragging.current) setDragX(distanceX);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >{children}</div>
    </div>
  );
}

function ExerciseSearchPicker({ options, query, onQueryChange, onChoose }: { options: ExerciseLibraryItem[]; query: string; onQueryChange: (value: string) => void; onChoose: (name: string) => void }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = options.filter((item) => !normalizedQuery || item.name.toLocaleLowerCase().includes(normalizedQuery));

  return (
    <div className="exercise-search-picker">
      <label className="exercise-search-field"><Search aria-hidden="true" /><span>Search exercises</span><input autoFocus aria-label="Search exercises" role="combobox" aria-controls="exercise-search-results" aria-expanded="true" aria-autocomplete="list" value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      <div className="exercise-search-results" id="exercise-search-results" role="listbox" aria-label="Exercise results">
        {matches.length ? matches.map((item) => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => onChoose(item.name)}>{item.name}<Plus aria-hidden="true" /></button>) : <p>No matching exercises</p>}
      </div>
    </div>
  );
}

function CalendarMonth({ year, month, workouts, collapsed, onToggle, onOpen }: { year: number; month: number; workouts: Workout[]; collapsed: boolean; onToggle: () => void; onOpen: (workout: Workout) => void }) {
  const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const workoutsByDay = new Map<number, Workout[]>();
  workouts.forEach((workout) => {
    const day = Number(workout.date.slice(8, 10));
    workoutsByDay.set(day, [...(workoutsByDay.get(day) ?? []), workout]);
  });

  return (
    <section className={`calendar-month${collapsed ? " collapsed" : ""}`}>
      <div className="calendar-month-heading"><h4><button type="button" className="month-toggle" aria-expanded={!collapsed} onClick={onToggle}><span>{formatMonthName(month)} {year}</span><ChevronDown aria-hidden="true" /></button></h4><small>{workouts.length}</small></div>
      {!collapsed && <><div className="calendar-weekdays" aria-hidden="true">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({ length: firstDayOffset }, (_, index) => <span className="calendar-cell blank" key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayWorkouts = workoutsByDay.get(day);
          const hasPr = dayWorkouts?.some((workout) => workout.prHighlights?.length);
          return <span className="calendar-cell" key={day}>{dayWorkouts ? <button className={hasPr ? "pr-day" : undefined} aria-label={`Open workout from ${formatMonthName(month)} ${day}, ${year}${hasPr ? ", personal record" : ""}`} onClick={() => onOpen(dayWorkouts[0])}>{day}</button> : day}</span>;
        })}
      </div></>}
    </section>
  );
}


export default function Home() {
  return <RepnoteApp />;
}

function RepnoteApp() {
  const [tab, setTab] = useState<"today" | "history" | "rm">("history");
  const [draft, setDraft] = useState<Workout | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [history, setHistory] = useState<Workout[]>([]);
  const [historyView, setHistoryView] = useState<"list" | "calendar">("list");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => new Set());
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [highlightUnit, setHighlightUnit] = useState<"kg" | "lbs">("lbs");
  const [selected, setSelected] = useState<Workout | null>(null);
  const [workoutDetailOpen, setWorkoutDetailOpen] = useState(false);
  const [exerciseLibraryOpen, setExerciseLibraryOpen] = useState(false);
  const [newExercise, setNewExercise] = useState("");
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [showRareExercises, setShowRareExercises] = useState(false);
  const [rareExercise, setRareExercise] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const [draftSyncStatus, setDraftSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [showBuildInfo, setShowBuildInfo] = useState(false);
  const [showWorkoutMenu, setShowWorkoutMenu] = useState(false);
  const versionMenuRef = useRef<HTMLDivElement>(null);
  const workoutMenuRef = useRef<HTMLDivElement>(null);
  const draftTouchStart = useRef<{ x: number; y: number } | null>(null);
  const libraryTouchStart = useRef<{ x: number; y: number } | null>(null);
  const appScrollRef = useRef<HTMLElement>(null);
  const coveredScrollTopRef = useRef(0);
  const draftHistoryPushedRef = useRef(false);
  const workoutHistoryPushedRef = useRef(false);
  const libraryHistoryPushedRef = useRef(false);
  const latestDraftRef = useRef<Workout | null>(null);
  const latestSelectedRef = useRef<Workout | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  latestDraftRef.current = draft;
  latestSelectedRef.current = selected;
  const apiBase = "/api";

  const queueDraftSave = (snapshot: Workout) => {
    setDraftSyncStatus("saving");
    draftSaveChainRef.current = draftSaveChainRef.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, status: "draft", finishedAt: null }) });
      if (!response.ok) throw new Error("Draft save failed");
      localStorage.removeItem("repnote-draft-v1");
      localStorage.removeItem("repnote-editing-workout-v1");
      setDraftSyncStatus("saved");
    }).catch(() => setDraftSyncStatus("error"));
    return draftSaveChainRef.current;
  };

  const openMainTab = (nextTab: "history" | "rm") => {
    setShowWorkoutMenu(false);
    const returnToDraft = nextTab === "history" && Boolean(draft);
    document.documentElement.classList.toggle("draft-open", returnToDraft);
    setTab(returnToDraft ? "today" : nextTab);
    requestAnimationFrame(() => {
      if (appScrollRef.current) appScrollRef.current.scrollTop = 0;
    });
  };

  useEffect(() => {
    if (!showBuildInfo) return;
    const closeVersionMenu = (event: PointerEvent) => {
      if (!versionMenuRef.current?.contains(event.target as Node)) setShowBuildInfo(false);
    };
    document.addEventListener("pointerdown", closeVersionMenu);
    return () => document.removeEventListener("pointerdown", closeVersionMenu);
  }, [showBuildInfo]);

  useEffect(() => {
    if (!showWorkoutMenu) return;
    const closeWorkoutMenu = (event: PointerEvent) => {
      if (!workoutMenuRef.current?.contains(event.target as Node)) setShowWorkoutMenu(false);
    };
    document.addEventListener("pointerdown", closeWorkoutMenu);
    return () => document.removeEventListener("pointerdown", closeWorkoutMenu);
  }, [showWorkoutMenu]);

  const openDraftView = () => {
    if (!draftHistoryPushedRef.current) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "draft");
      const state = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
      History.prototype.pushState.call(window.history, { ...state, __NA: true, [REPNOTE_VIEW_STATE]: "draft" }, "", `${url.pathname}${url.search}${url.hash}`);
      draftHistoryPushedRef.current = true;
      coveredScrollTopRef.current = appScrollRef.current?.scrollTop ?? 0;
      document.documentElement.classList.add("draft-open");
    }
    setTab("today");
  };

  const openWorkoutDetail = (workout: Workout) => {
    if (!workoutHistoryPushedRef.current) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", `workout-${workout.id}`);
      const state = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
      History.prototype.pushState.call(window.history, { ...state, __NA: true, [REPNOTE_VIEW_STATE]: "workout", workoutId: workout.id }, "", `${url.pathname}${url.search}${url.hash}`);
      workoutHistoryPushedRef.current = true;
      coveredScrollTopRef.current = appScrollRef.current?.scrollTop ?? 0;
      document.documentElement.classList.add("detail-open");
    }
    setSelected(workout);
    setWorkoutDetailOpen(true);
  };

  const closeWorkoutDetail = () => {
    if (workoutHistoryPushedRef.current) window.history.back();
    else {
      document.documentElement.classList.remove("detail-open");
      setWorkoutDetailOpen(false);
    }
  };

  const openExerciseLibrary = () => {
    setShowWorkoutMenu(false);
    if (!libraryHistoryPushedRef.current) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "exercises");
      const state = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
      History.prototype.pushState.call(window.history, { ...state, __NA: true, [REPNOTE_VIEW_STATE]: "exercises" }, "", `${url.pathname}${url.search}${url.hash}`);
      libraryHistoryPushedRef.current = true;
      coveredScrollTopRef.current = appScrollRef.current?.scrollTop ?? 0;
      document.documentElement.classList.add("library-open");
    }
    setExerciseLibraryOpen(true);
  };

  const closeExerciseLibrary = () => {
    if (libraryHistoryPushedRef.current) window.history.back();
    else {
      document.documentElement.classList.remove("library-open");
      setExerciseLibraryOpen(false);
    }
  };

  useEffect(() => {
    try {
      const legacyDraft = localStorage.getItem("repnote-draft-v1");
      const legacyEditingWorkoutId = localStorage.getItem("repnote-editing-workout-v1");
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      const savedCustomExercises = localStorage.getItem(CUSTOM_EXERCISES_KEY);
      const localHistory: Workout[] = (savedHistory ? JSON.parse(savedHistory) : []).map((item: Workout) => ({ ...item, date: item.date ?? (item.finishedAt || item.startedAt || new Date().toISOString()).slice(0, 10) }));
      const localExerciseData: Array<string | ExerciseLibraryItem> = savedCustomExercises ? JSON.parse(savedCustomExercises) : [];
      const localExercises = localExerciseData.map((item) => typeof item === "string" ? { id: item, name: item, frequency: 0, isFrequent: false } : { frequency: 0, isFrequent: false, ...item });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the visible cache before the remote D1 response arrives.
      setHistory(localHistory);
      setExerciseLibrary(localExercises);
      Promise.all([
        fetch(`${apiBase}/workouts`).then((response) => response.ok ? response.json() : Promise.reject()),
        fetch(`${apiBase}/exercises`).then((response) => response.ok ? response.json() : Promise.reject()),
        fetch("/api/draft").then((response) => response.ok ? response.json() : Promise.reject()),
      ]).then(async ([workoutData, exerciseData, draftData]) => {
        const remoteWorkouts = (workoutData.workouts ?? []) as Workout[];
        setHistory(remoteWorkouts);
        setExerciseLibrary((exerciseData.exercises ?? []) as ExerciseLibraryItem[]);
        const remoteDraft = (draftData.draft ?? null) as Workout | null;
        const migratedDraft = !remoteDraft && legacyDraft ? { ...JSON.parse(legacyDraft) as Workout, status: "draft" as const, draftOfWorkoutId: legacyEditingWorkoutId || null } : null;
        const restoredDraft = remoteDraft ?? migratedDraft;
        if (restoredDraft) {
          setDraft(restoredDraft);
          setEditingWorkoutId(restoredDraft.draftOfWorkoutId ?? null);
        }
      }).catch(() => setPermissionError("Could not load data. Check your connection and reload."));
    } catch { /* Ignore malformed local data. */ }
    setReady(true);
  }, [apiBase]);

  useEffect(() => {
    if (!ready || !draft) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    const snapshot = structuredClone(draft);
    draftSaveTimerRef.current = setTimeout(() => { draftSaveTimerRef.current = null; void queueDraftSave(snapshot); }, 500);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [draft, ready]);

  useEffect(() => {
    if (!draft || draftSyncStatus !== "error") return;
    let retried = false;
    const retry = () => {
      if (retried || !latestDraftRef.current) return;
      retried = true;
      window.clearTimeout(timer);
      void queueDraftSave(structuredClone(latestDraftRef.current));
    };
    const timer = window.setTimeout(retry, 3000);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [draft, draftSyncStatus]);

  useEffect(() => {
    const flushDraft = () => {
      const current = latestDraftRef.current;
      if (!current) return;
      void fetch("/api/draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...current, status: "draft", finishedAt: null }), keepalive: true });
    };
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exerciseLibrary));
  }, [exerciseLibrary, ready]);

  useEffect(() => {
    const handleHistoryNavigation = (event: PopStateEvent) => {
      const state = event.state && typeof event.state === "object" ? event.state as Record<string, unknown> : {};
      setShowDiscardConfirm(false);
      if (state[REPNOTE_VIEW_STATE] === "draft" && latestDraftRef.current) {
        draftHistoryPushedRef.current = true;
        workoutHistoryPushedRef.current = false;
        libraryHistoryPushedRef.current = false;
        document.documentElement.classList.remove("detail-open", "library-open");
        document.documentElement.classList.add("draft-open");
        setWorkoutDetailOpen(false);
        setExerciseLibraryOpen(false);
        setTab("today");
        return;
      }
      if (state[REPNOTE_VIEW_STATE] === "workout" && latestSelectedRef.current) {
        draftHistoryPushedRef.current = false;
        workoutHistoryPushedRef.current = true;
        libraryHistoryPushedRef.current = false;
        document.documentElement.classList.remove("draft-open", "library-open");
        document.documentElement.classList.add("detail-open");
        setExerciseLibraryOpen(false);
        setTab("history");
        setWorkoutDetailOpen(true);
        return;
      }
      if (state[REPNOTE_VIEW_STATE] === "exercises") {
        draftHistoryPushedRef.current = false;
        workoutHistoryPushedRef.current = false;
        libraryHistoryPushedRef.current = true;
        document.documentElement.classList.remove("draft-open", "detail-open");
        document.documentElement.classList.add("library-open");
        setWorkoutDetailOpen(false);
        setExerciseLibraryOpen(true);
        setTab("history");
        return;
      }
      draftHistoryPushedRef.current = false;
      workoutHistoryPushedRef.current = false;
      libraryHistoryPushedRef.current = false;
      document.documentElement.classList.remove("draft-open", "detail-open", "library-open");
      setWorkoutDetailOpen(false);
      setExerciseLibraryOpen(false);
      setTab("history");
      requestAnimationFrame(() => {
        if (appScrollRef.current) appScrollRef.current.scrollTop = coveredScrollTopRef.current;
      });
    };
    const previousScrollRestoration = window.history.scrollRestoration;
    // eslint-disable-next-line react-hooks/immutability -- Browser history is the external system synchronized by this effect.
    window.history.scrollRestoration = "manual";
    document.documentElement.classList.add("repnote-app-open");
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", handleHistoryNavigation);
      window.history.scrollRestoration = previousScrollRestoration;
      document.documentElement.classList.remove("repnote-app-open", "draft-open", "detail-open", "library-open");
    };
  }, []);

  useEffect(() => {
    if (tab === "today" && draft && !draftHistoryPushedRef.current) openDraftView();
  }, [tab, draft]);

  const exerciseFilterOptions = useMemo(() => {
    const names = new Set(exerciseLibrary.map((exercise) => exercise.name));
    history.forEach((workout) => workout.exercises.forEach((exercise) => names.add(exercise.name)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [exerciseLibrary, history]);

  const filteredHistory = useMemo(() => exerciseFilter
    ? history.filter((workout) => workout.exercises.some((exercise) => exercise.name === exerciseFilter))
    : history, [exerciseFilter, history]);

  const bigThreeRecords = useMemo(() => {
    const liftNames = ["Bench Press", "Squat", "Deadlift"] as const;
    const records = liftNames.map((name) => {
      let best: { kg: number; date: string } | null = null;
      history.forEach((workout) => {
        workout.exercises.filter((exercise) => exercise.name === name).forEach((exercise) => {
          exercise.sets.forEach((set) => {
            const weight = Number.parseFloat(set.weight);
            if (!Number.isFinite(weight) || weight <= 0) return;
            const kg = workout.unit === "lbs" ? weight / 2.2046226218 : weight;
            if (!best || kg > best.kg || (Math.abs(kg - best.kg) < 0.0001 && workout.date < best.date)) best = { kg, date: workout.date };
          });
        });
      });
      return { name, best };
    });
    return { records, totalKg: records.reduce((sum, record) => sum + (record.best?.kg ?? 0), 0) };
  }, [history]);

  const trainingStats = useMemo(() => {
    const workoutDays = new Set(history.filter((workout) => workout.exercises.length > 0).map((workout) => workout.date)).size;
    const firstWorkoutDate = history.filter((workout) => workout.exercises.length > 0).reduce<string | null>((first, workout) => !first || workout.date < first ? workout.date : first, null);
    return { workoutDays, firstWorkoutDate };
  }, [history]);

  const formatHighlightWeight = (kg: number) => {
    const value = highlightUnit === "lbs" ? kg * 2.2046226218 : kg;
    return Number.isInteger(Math.round(value * 10) / 10) ? String(Math.round(value)) : value.toFixed(1);
  };

  const grouped = useMemo(() => {
    const result: Record<string, Record<string, Workout[]>> = {};
    [...filteredHistory].sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt || "").localeCompare(a.finishedAt || "")).forEach((item) => {
      const date = dateFromWorkout(item);
      // Non-integer keys preserve the insertion order established by the
      // descending workout sort. Integer-like object keys are re-ordered by JS.
      const year = `${date.getFullYear()}-year`;
      const month = `${date.getMonth() + 1}-month`;
      result[year] ??= {};
      result[year][month] ??= [];
      result[year][month].push(item);
    });
    return result;
  }, [filteredHistory]);

  const visibleMonthKeys = useMemo(() => Object.entries(grouped).flatMap(([year, months]) => Object.keys(months).map((month) => `${year}/${month}`)), [grouped]);
  const allMonthsCollapsed = visibleMonthKeys.length > 0 && visibleMonthKeys.every((key) => collapsedMonths.has(key));
  const toggleMonth = (key: string) => setCollapsedMonths((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAllMonths = () => setCollapsedMonths((current) => {
    if (visibleMonthKeys.length > 0 && visibleMonthKeys.every((key) => current.has(key))) {
      const next = new Set(current);
      visibleMonthKeys.forEach((key) => next.delete(key));
      return next;
    }
    return new Set([...current, ...visibleMonthKeys]);
  });

  const startWorkout = () => {
    setEditingWorkoutId(null);
    setDraftSyncStatus("idle");
    setDraft({ id: makeId(), status: "draft", draftOfWorkoutId: null, date: localDateKey(), startedAt: new Date().toISOString(), finishedAt: null, unit: "lbs", note: "", exercises: [] });
    openDraftView();
  };
  const returnToHistory = () => {
    setShowDiscardConfirm(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
    const nextState = { ...currentState };
    delete nextState[REPNOTE_VIEW_STATE];
    delete nextState.workoutId;
    History.prototype.replaceState.call(window.history, nextState, "", `${url.pathname}${url.search}${url.hash}`);
    draftHistoryPushedRef.current = false;
    document.documentElement.classList.remove("draft-open");
    setTab("history");
    requestAnimationFrame(() => {
      if (appScrollRef.current) appScrollRef.current.scrollTop = coveredScrollTopRef.current;
    });
  };
  const beginDraftBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    draftTouchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const moveDraftBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const start = draftTouchStart.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX > 8 && deltaX > deltaY && event.cancelable) event.preventDefault();
  };
  const finishDraftBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const start = draftTouchStart.current;
    draftTouchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX >= 60 && deltaX > deltaY * 1.25) returnToHistory();
  };
  const beginLibraryBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (touch) libraryTouchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const moveLibraryBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const start = libraryTouchStart.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX > 8 && deltaX > deltaY && event.cancelable) event.preventDefault();
  };
  const finishLibraryBackTouch = (event: ReactTouchEvent<HTMLElement>) => {
    const start = libraryTouchStart.current;
    libraryTouchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX >= 60 && deltaX > deltaY * 1.25) closeExerciseLibrary();
  };
  const exerciseOptions = exerciseLibrary.map((item) => item.name);
  const frequentExercises = exerciseLibrary.filter((item) => item.isFrequent);
  const rareExercises = exerciseLibrary.filter((item) => !item.isFrequent);
  const addExercise = (name: string) => {
    const clean = name.trim();
    if (!clean || !draft) return;
    setDraft({ ...draft, exercises: [...draft.exercises, { id: makeId(), name: clean, sets: [emptySet()] }] });
  };
  const saveCustomExercise = () => {
    const clean = newExercise.trim();
    if (!clean || exerciseOptions.some((name) => name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return;
    const item = { id: `library-${makeId()}`, name: clean, frequency: 0, isFrequent: false };
    setExerciseLibrary((items) => [...items, item]);
    setNewExercise("");
    void fetch(`${apiBase}/exercises`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).then((response) => { if (!response.ok) throw new Error("Save failed"); }).catch(() => setPermissionError("Exercise could not be saved. Check your connection and try again."));
  };
  const toggleFrequentExercise = (item: ExerciseLibraryItem) => {
    const isFrequent = !item.isFrequent;
    setExerciseLibrary((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, isFrequent } : candidate));
    void fetch(`${apiBase}/exercises`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isFrequent }) }).then((response) => { if (!response.ok) throw new Error("Update failed"); }).catch(() => {
      setExerciseLibrary((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, isFrequent: item.isFrequent } : candidate));
      setPermissionError("Exercise preference could not be saved. Check your connection and try again.");
    });
  };
  const updateExercise = (exerciseId: string, fn: (exercise: Exercise) => Exercise) => {
    if (!draft) return;
    setDraft({ ...draft, exercises: draft.exercises.map((exercise) => exercise.id === exerciseId ? fn(exercise) : exercise) });
  };
  const updateSet = (exerciseId: string, setId: string, field: keyof Omit<SetRow, "id">, value: string) =>
    updateExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, [field]: value } : set) }));
  const editWorkout = (workout: Workout) => {
    setEditingWorkoutId(workout.id);
    const draftId = `draft-${workout.id}-${Date.now()}`;
    const editingDraft: Workout = {
      ...structuredClone(workout),
      id: draftId,
      status: "draft",
      draftOfWorkoutId: workout.id,
      finishedAt: null,
      exercises: workout.exercises.map((exercise, exerciseIndex) => ({
        ...structuredClone(exercise),
        id: `${draftId}-exercise-${exerciseIndex}`,
        sets: exercise.sets.map((set, setIndex) => ({ ...structuredClone(set), id: `${draftId}-exercise-${exerciseIndex}-set-${setIndex}` })),
      })),
    };
    setDraftSyncStatus("idle");
    setDraft(editingDraft);
    setWorkoutDetailOpen(false);
    document.documentElement.classList.remove("detail-open");
    setShowDiscardConfirm(false);
    openDraftView();
  };
  const finishWorkout = async () => {
    if (!draft || finishingWorkout) return;
    if (draftSaveTimerRef.current) { clearTimeout(draftSaveTimerRef.current); draftSaveTimerRef.current = null; }
    setFinishingWorkout(true);
    try {
      await draftSaveChainRef.current;
      const finished: Workout = { ...draft, id: editingWorkoutId ?? draft.id, status: "completed", draftOfWorkoutId: null, finishedAt: new Date().toISOString() };
      const response = await fetch(`${apiBase}/workouts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...finished, draftId: draft.id }) });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as { workout?: Workout | null };
      const savedWorkout = result.workout ?? finished;
      setHistory((items) => editingWorkoutId ? items.map((item) => item.id === editingWorkoutId ? savedWorkout : item) : [savedWorkout, ...items]);
      setDraft(null);
      setEditingWorkoutId(null);
      setDraftSyncStatus("idle");
      returnToHistory();
      setSelected(savedWorkout);
      void fetch(`${apiBase}/exercises`).then((result) => result.ok ? result.json() : Promise.reject()).then((exerciseData: { exercises?: ExerciseLibraryItem[] }) => setExerciseLibrary(exerciseData.exercises ?? [])).catch(() => undefined);
    } catch {
      setDraftSyncStatus("error");
      setPermissionError("Workout could not be saved. Your draft is still available; check your connection and try again.");
    } finally {
      setFinishingWorkout(false);
    }
  };
  const discardDraft = async () => {
    if (!draft) return;
    if (draftSaveTimerRef.current) { clearTimeout(draftSaveTimerRef.current); draftSaveTimerRef.current = null; }
    setDraftSyncStatus("saving");
    await draftSaveChainRef.current;
    try {
      const response = await fetch(`/api/draft?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Discard failed");
    } catch {
      setDraftSyncStatus("error");
      setShowDiscardConfirm(false);
      setPermissionError("Draft could not be discarded. It remains safely stored; check your connection and try again.");
      return;
    }
    setDraft(null);
    setEditingWorkoutId(null);
    setDraftSyncStatus("idle");
    setShowDiscardConfirm(false);
    returnToHistory();
  };
  const deleteWorkout = async (workout: Workout) => {
    setHistory((items) => items.filter((item) => item.id !== workout.id));
    if (selected?.id === workout.id) setSelected(null);
    try {
      const response = await fetch(`${apiBase}/workouts?id=${encodeURIComponent(workout.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
    } catch {
      setHistory((items) => items.some((item) => item.id === workout.id) ? items : [...items, workout]);
      setPermissionError("Workout could not be deleted. Check your connection and try again.");
    }
  };

  const historyScreen = (
    <div className="history-screen">
      <section className="training-duration-card" aria-label="Workout overview and controls">
        <div className="training-card-top">
          <div className="training-card-summary"><strong>{trainingStats.workoutDays}</strong><div><span>Total workouts</span><small>{trainingStats.firstWorkoutDate ? `Since ${formatRecordDate(trainingStats.firstWorkoutDate)}` : "Start your first workout"}</small></div></div>
          <button className="history-new-workout" aria-label={draft ? editingWorkoutId ? "Continue editing workout" : "Continue workout" : "Create workout"} title={draft ? "Continue workout" : "Create workout"} onClick={draft ? openDraftView : startWorkout}>{draft ? <FileInput aria-hidden="true" /> : <Plus aria-hidden="true" />}</button>
        </div>
        <div className="training-card-filter"><span>Filter</span><CustomSelect className="exercise-filter" ariaLabel="Filter workouts by exercise" value={exerciseFilter} onChange={setExerciseFilter} options={[{ value: "", label: "All exercises" }, ...exerciseFilterOptions.map((name) => ({ value: name, label: name }))]} /><div className="history-controls"><button type="button" className="collapse-all" aria-label={allMonthsCollapsed ? "Expand all months" : "Collapse all months"} title={allMonthsCollapsed ? "Expand all months" : "Collapse all months"} aria-pressed={allMonthsCollapsed} onClick={toggleAllMonths}>{allMonthsCollapsed ? <ChevronsDown aria-hidden="true" /> : <ChevronsUp aria-hidden="true" />}</button><div className="history-view-switch" aria-label="View mode"><button className={historyView === "list" ? "active" : ""} aria-label="List view" title="List view" aria-pressed={historyView === "list"} onClick={() => setHistoryView("list")}><List aria-hidden="true" /></button><button className={historyView === "calendar" ? "active" : ""} aria-label="Calendar view" title="Calendar view" aria-pressed={historyView === "calendar"} onClick={() => setHistoryView("calendar")}><CalendarDays aria-hidden="true" /></button></div></div></div>
      </section>
      {history.length > 0 && <section className="big-three-highlight" aria-labelledby="big-three-title"><div className="big-three-heading"><h2 id="big-three-title">Big Three</h2><div className="big-three-meta"><div className={`highlight-unit-toggle ${highlightUnit}`} role="group" aria-label="Big Three weight unit"><button type="button" aria-pressed={highlightUnit === "lbs"} onClick={() => setHighlightUnit("lbs")}>LBS</button><button type="button" aria-pressed={highlightUnit === "kg"} onClick={() => setHighlightUnit("kg")}>KG</button></div></div></div><div className="big-three-grid">{bigThreeRecords.records.map((record) => <div className="big-three-record" key={record.name}><span>{record.name}</span><strong>{record.best ? formatHighlightWeight(record.best.kg) : "—"} <small>{record.best ? highlightUnit : ""}</small></strong><time dateTime={record.best?.date}>{record.best ? formatRecordDate(record.best.date) : "No record"}</time></div>)}<div className="big-three-record total"><span>Total</span><strong>{bigThreeRecords.totalKg > 0 ? formatHighlightWeight(bigThreeRecords.totalKg) : "—"} <small>{bigThreeRecords.totalKg > 0 ? highlightUnit : ""}</small></strong><time>Combined best</time></div></div></section>}
      {history.length === 0 ? <div className="empty-state"><b>No workouts yet</b><p>Create your first workout with the + button above.</p></div> : filteredHistory.length === 0 ? <div className="empty-state filter-empty"><b>No matching workouts</b><p>No workouts contain {exerciseFilter}.</p><button onClick={() => setExerciseFilter("")}>Clear filter</button></div> : historyView === "list" ? Object.entries(grouped).map(([year, months]) => (
        <section className="year-group compact-list-year" key={year}>{Object.entries(months).map(([month, items]) => (
          <div className={`month-group${collapsedMonths.has(`${year}/${month}`) ? " collapsed" : ""}`} key={month}><h4><button type="button" className="month-toggle" aria-expanded={!collapsedMonths.has(`${year}/${month}`)} onClick={() => toggleMonth(`${year}/${month}`)}><span>{formatMonthName(month)} {Number.parseInt(year, 10)}</span><ChevronDown aria-hidden="true" /></button><small>{items.length}</small></h4>{!collapsedMonths.has(`${year}/${month}`) && items.map((item) => <SwipeableHistoryRow key={item.id} workout={item} onOpen={() => openWorkoutDetail(item)} onDelete={() => void deleteWorkout(item)} />)}</div>
        ))}</section>
      )) : Object.entries(grouped).map(([year, months]) => (
        <section className="calendar-year compact-calendar-year" key={year}>{Object.entries(months).map(([month, items]) => <CalendarMonth key={month} year={Number.parseInt(year, 10)} month={Number.parseInt(month, 10)} workouts={items} collapsed={collapsedMonths.has(`${year}/${month}`)} onToggle={() => toggleMonth(`${year}/${month}`)} onOpen={openWorkoutDetail} />)}</section>
      ))}
    </div>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-version" ref={versionMenuRef}><button type="button" className="topbar-favicon" aria-label="View release time" aria-expanded={showBuildInfo} onClick={() => { setShowWorkoutMenu(false); setShowBuildInfo((open) => !open); }}><img src="/favicon.svg" alt="" /></button>{showBuildInfo && <div className="version-dropdown release-time-dropdown" role="status"><time dateTime={__APP_BUILD_TIME__}>{formatBuildTime(__APP_BUILD_TIME__)}</time></div>}</div>
        <h1 className="topbar-title">{tab === "rm" ? "RM Calculator" : tab === "today" ? "Workout" : "Workouts"}</h1>
        {tab === "history" && <div className="topbar-actions" ref={workoutMenuRef}><button type="button" className="topbar-more" aria-label="More workout options" aria-haspopup="menu" aria-expanded={showWorkoutMenu} onClick={() => { setShowBuildInfo(false); setShowWorkoutMenu((open) => !open); }}><MoreHorizontal aria-hidden="true" /></button>{showWorkoutMenu && <div className="workout-actions-menu" role="menu"><button type="button" role="menuitem" onClick={openExerciseLibrary}>Manage exercises</button></div>}</div>}
      </header>

      {tab === "today" && draft && <div className="draft-back-gesture" aria-hidden="true" onTouchStart={beginDraftBackTouch} onTouchMove={moveDraftBackTouch} onTouchEnd={finishDraftBackTouch} onTouchCancel={() => { draftTouchStart.current = null; }} />}
      <section ref={appScrollRef} className="content app-scroll">
        {permissionError && <div className="permission-error" role="alert"><span>{permissionError}</span><button aria-label="Dismiss message" onClick={() => setPermissionError("")}>×</button></div>}
        {(tab === "history" || tab === "today") && <div className={`tab-content ${tab === "today" ? "is-covered" : ""}`.trim()} aria-hidden={tab === "today" ? "true" : undefined}>{historyScreen}</div>}
        {tab === "today" ? (
          !draft ? (
            <div className="start-screen">
              <div className="date-block"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date())}</p><strong>{new Date().getDate()}</strong><span>{new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date())}</span></div>
              <div className="start-copy"><p className="eyebrow">TODAY&apos;S SESSION</p><h2>Start when you&apos;re ready.</h2><p>Log every weight and every rep,<br />and listen to what your body tells you.</p></div>
              <div className="start-actions">
                <button className="primary-button start-button" onClick={startWorkout}><span>Start today&apos;s workout</span><b>→</b></button>
              </div>
              <div className="quote"><span>“</span><p>You don&apos;t have to be at your best.<br />You just have to show up.</p></div>
            </div>
          ) : (
            <div className="workout-screen">
              <div className="session-heading"><div><button className="session-back" onClick={returnToHistory}><span aria-hidden="true">←</span> Back to workouts</button><h2>{editingWorkoutId ? "Edit workout" : "New workout"}</h2></div><button className="finish-button" disabled={finishingWorkout} onClick={() => void finishWorkout()}>{finishingWorkout ? "Saving…" : editingWorkoutId ? "Save changes" : "Finish workout"}</button></div>
              {draftSyncStatus === "error" && <div className="draft-sync-error" role="alert">Draft sync is offline. Keep this page open and try again when your connection returns.</div>}
              <label className="note-card"><span>Notes</span><textarea aria-label="Workout notes" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
              <section className="session-unit-picker" aria-label="Weight unit"><div className={`weight-unit-toggle ${(draft.unit ?? "lbs") === "lbs" ? "lbs" : "kg"}`} role="group" aria-label="Weight unit"><span className="weight-unit-thumb" aria-hidden="true" /><button type="button" aria-pressed={(draft.unit ?? "lbs") === "lbs"} onClick={() => setDraft({ ...draft, unit: "lbs" })}>LBS</button><button type="button" aria-pressed={(draft.unit ?? "lbs") === "kg"} onClick={() => setDraft({ ...draft, unit: "kg" })}>KG</button></div></section>

              <div className="quick-add"><div className="quick-add-options">{frequentExercises.map((item) => <button key={item.id} disabled={draft.exercises.some((ex) => ex.name === item.name)} onClick={() => addExercise(item.name)}>＋ {item.name}</button>)}<button className="rare-exercise-toggle" aria-expanded={showRareExercises} onClick={() => { setRareExercise(""); setShowRareExercises((value) => !value); }}><span>More exercises</span><ChevronDown aria-hidden="true" /></button></div>{showRareExercises && <ExerciseSearchPicker options={rareExercises.filter((item) => !draft.exercises.some((exercise) => exercise.name === item.name))} query={rareExercise} onQueryChange={setRareExercise} onChoose={(name) => { addExercise(name); setRareExercise(""); setShowRareExercises(false); }} />}</div>

              <div className="exercise-list">
                {draft.exercises.map((exercise, index) => (
                  <article className="exercise-card" key={exercise.id}>
                    <SwipeToDelete className="exercise-title-swipe" label={`Delete ${exercise.name}`} onDelete={() => setDraft({ ...draft, exercises: draft.exercises.filter((e) => e.id !== exercise.id) })}><div className="exercise-title"><span>{String(index + 1).padStart(2, "0")}</span><h3>{exercise.name}</h3></div></SwipeToDelete>
                    <div className="set-labels"><span>SET</span><span>WEIGHT ({(draft.unit ?? "lbs").toUpperCase()})</span><span>REPS</span><span>NOTE</span><i /></div>
                    {exercise.sets.map((set, setIndex) => (
                      <SwipeToDelete className="set-row-swipe" label={`Delete set ${setIndex + 1}`} onDelete={() => updateExercise(exercise.id, (ex) => ({ ...ex, sets: ex.sets.filter((s) => s.id !== set.id) }))} key={set.id}><div className="set-row">
                        <b>{setIndex + 1}</b>
                        <input inputMode="decimal" aria-label={`Set ${setIndex + 1} weight`} value={set.weight} onChange={(e) => updateSet(exercise.id, set.id, "weight", e.target.value)} />
                        <input inputMode="numeric" aria-label={`Set ${setIndex + 1} reps`} value={set.reps} onChange={(e) => updateSet(exercise.id, set.id, "reps", e.target.value)} />
                        <input aria-label={`Set ${setIndex + 1} note`} value={set.note} onChange={(e) => updateSet(exercise.id, set.id, "note", e.target.value)} />
                        <i aria-hidden="true" />
                      </div></SwipeToDelete>
                    ))}
                    <button className="add-set" onClick={() => updateExercise(exercise.id, (ex) => ({ ...ex, sets: [...ex.sets, emptySet()] }))}>＋ Add set</button>
                  </article>
                ))}
              </div>

              <div className="draft-actions">
                {draft.exercises.length > 0 && <button className="primary-button mobile-finish" disabled={finishingWorkout} onClick={() => void finishWorkout()}>{finishingWorkout ? "Saving…" : editingWorkoutId ? "Save changes" : "Finish and save workout"} {!finishingWorkout && <b>→</b>}</button>}
                <button className="discard-draft" onClick={() => setShowDiscardConfirm(true)}>{editingWorkoutId ? "Cancel editing" : "Discard workout"}</button>
                {showDiscardConfirm && <div className="discard-confirm" role="alertdialog" aria-labelledby="discard-title"><strong id="discard-title">{editingWorkoutId ? "Cancel your changes?" : "Discard this workout?"}</strong><p>{editingWorkoutId ? "Your changes will not be saved. The original workout will remain unchanged." : "All exercises, sets, and notes in this draft will be lost."}</p><div><button onClick={() => setShowDiscardConfirm(false)}>Keep training</button><button className="confirm-discard" onClick={() => void discardDraft()}>{editingWorkoutId ? "Cancel changes" : "Discard workout"}</button></div></div>}
              </div>
            </div>
          )
        ) : tab === "rm" ? <RmCalculator embedded /> : null}
      </section>

      <nav className="tabbar" aria-label="Main navigation">
        <button className={tab === "history" || tab === "today" ? "active" : ""} onClick={() => openMainTab("history")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h5M11 13h5" /></svg>Workouts{draft && <i />}</button>
        <button className={tab === "rm" ? "active" : ""} onClick={() => openMainTab("rm")}><Calculator aria-hidden="true" />RM</button>
      </nav>

      {exerciseLibraryOpen && <article className="exercise-library-page workout-detail-page"><div className="page-back-gesture" aria-hidden="true" onTouchStart={beginLibraryBackTouch} onTouchMove={moveLibraryBackTouch} onTouchEnd={finishLibraryBackTouch} onTouchCancel={() => { libraryTouchStart.current = null; }} /><div className="detail-page-inner exercise-library-content"><button className="session-back" onClick={closeExerciseLibrary}><span aria-hidden="true">←</span> Back to workouts</button><div className="exercise-library-heading"><div><p className="eyebrow">EXERCISES</p><h2>Exercise library</h2></div><span>{exerciseOptions.length}</span></div>{permissionError && <div className="permission-error" role="alert"><span>{permissionError}</span><button aria-label="Dismiss message" onClick={() => setPermissionError("")}>×</button></div>}<section className="exercise-library-panel"><div className="library-add"><div><input id="exercise-name" aria-label="Exercise name" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCustomExercise()} placeholder="Add an exercise" /><button onClick={saveCustomExercise} disabled={!newExercise.trim()}>Add</button></div></div><div className="exercise-library"><div className="library-section"><h4><span>EXERCISE</span><span>TIMES</span><span>FREQUENT</span></h4>{exerciseLibrary.map((item) => <div className="library-row" key={item.id}><strong>{item.name}</strong><span className="exercise-frequency"><b>{item.frequency}</b></span><label className="frequent-check"><input type="checkbox" checked={item.isFrequent} onChange={() => toggleFrequentExercise(item)} aria-label={`Mark ${item.name} as frequent`} /></label></div>)}</div></div></section></div></article>}

      {workoutDetailOpen && selected && <article className="workout-detail-page"><div className="detail-page-inner"><button className="session-back" onClick={closeWorkoutDetail}><span aria-hidden="true">←</span> Back to workouts</button><div className="detail-heading"><h2>{formatDate(`${selected.date}T12:00:00`)}</h2><button className="edit-workout" aria-label="Edit workout" title="Edit workout" onClick={() => editWorkout(selected)}><Pencil aria-hidden="true" /></button></div>{selected.startedAt && selected.finishedAt && <div className="time-strip"><div><span>START</span><strong>{formatClock(selected.startedAt)}</strong></div><i>→</i><div><span>FINISH</span><strong>{formatClock(selected.finishedAt)}</strong></div><div><span>DURATION</span><strong>{duration(selected.startedAt, selected.finishedAt)}</strong></div></div>}{selected.note && <div className="detail-note"><span>GENERAL NOTE</span><p>{selected.note}</p></div>}<div className="detail-exercises">{selected.exercises.map((exercise) => <section key={exercise.id}><h3>{exercise.name}<span>{exercise.sets.length} sets</span></h3>{exercise.sets.map((set, index) => <div key={set.id}><b>{index + 1}</b><strong>{set.weight || "—"} <small>{selected.unit ?? "kg"}</small></strong><strong>{set.reps || "—"} <small>reps</small></strong><p>{set.note || ""}</p></div>)}</section>)}</div></div></article>}
    </main>
  );
}
