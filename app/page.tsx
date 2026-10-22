"use client";
/* eslint-disable react-hooks/refs, @next/next/no-img-element -- Native History uses refs; the tiny local SVG favicon needs no image optimizer. */

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { Calculator, ChevronDown, ChevronsDown, ChevronsUp, MoreHorizontal, Pencil, Plus, Search, Trash2, Trophy, X } from "lucide-react";
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
type Activity = "strength" | "cardio" | "climbing" | "ski";
type Workout = {
  id: string;
  activity?: Activity;
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

const PR_LIFT_NAMES: Record<PrHighlight["lift"], string> = { bench_press: "Bench Press", squat: "Squat", deadlift: "Deadlift" };
const ACTIVITY_LABELS: Record<Activity, string> = { strength: "Lifting", cardio: "Cardio", climbing: "Climbing", ski: "Ski" };
const ACTIVITY_ORDER: Activity[] = ["strength", "climbing", "cardio", "ski"];
const activityOf = (workout: Workout): Activity => workout.activity ?? "strength";
// A lifting day counts when it has exercises or was imported from the calendar (no sets recorded).
const countsAsWorkout = (workout: Workout) => activityOf(workout) !== "strength" || workout.exercises.length > 0 || workout.source === "apple-calendar";
const activitySplit = (activities: Activity[]) => activities.length > 1 ? { background: `linear-gradient(135deg, ${activities.map((activity, i) => `var(--activity-${activity}) ${(i / activities.length) * 100}% ${((i + 1) / activities.length) * 100}%`).join(", ")})` } : undefined;
const formatPrWeight = (weight: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(weight);

const HISTORY_KEY = "repnote-history-v1";
const BACKGROUND_KEY = "repnote-background-updated-v1";
const BUTTON_IMAGE_KEY = "repnote-button-image-updated-v1";
// Shrink a picked photo to a JPEG data URL small enough for one D1 value.
const imageFileToDataUrl = async (file: File, maxSide = 1600, quality = 0.82, type: "image/jpeg" | "image/png" = "image/jpeg") => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  if (type === "image/png") return canvas.toDataURL("image/png");
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  for (let q = quality - 0.12; dataUrl.length > 1_700_000 && q > 0.4; q -= 0.12) dataUrl = canvas.toDataURL("image/jpeg", q);
  return dataUrl;
};
const CUSTOM_EXERCISES_KEY = "repnote-custom-exercises-v1";
const REPNOTE_VIEW_STATE = "repnoteView";
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptySet = (): SetRow => ({ id: makeId(), weight: "", reps: "", note: "" });
const formatClock = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const formatDate = (iso: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(iso));
const formatBuildTime = (iso: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
const formatRecordDate = (date: string) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
const formatMonthName = (month: string | number) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2000, Number.parseInt(String(month), 10) - 1, 1));
const LIFT_RECORD_NAMES = ["Bulgarian Split Squat", "Barbell Squat", "Bicep Curl", "Single Leg Deadlift"] as const;
type LiftBest = { kg: number; reps: number | null; date: string };
const ACTIVITY_MONTHS = 3;
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localDateKey = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateFromWorkout = (workout: Workout) => new Date(`${workout.date}T12:00:00`);
const duration = (start: string, end?: string) => {
  if (!end) return "In progress";
  const mins = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
};

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

function ExerciseSearchPicker({ options, query, onQueryChange, onChoose, canCreate, onCreate }: { options: ExerciseLibraryItem[]; query: string; onQueryChange: (value: string) => void; onChoose: (name: string) => void; canCreate: (name: string) => boolean; onCreate: (name: string) => void }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = options.filter((item) => !normalizedQuery || item.name.toLocaleLowerCase().includes(normalizedQuery));
  const newName = query.trim();
  const showCreate = Boolean(newName) && canCreate(newName);

  return (
    <div className="exercise-search-picker">
      <label className="exercise-search-field"><Search aria-hidden="true" /><span>Search exercises</span><input autoFocus aria-label="Search exercises" role="combobox" aria-controls="exercise-search-results" aria-expanded="true" aria-autocomplete="list" value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && showCreate && !matches.some((item) => item.name.toLocaleLowerCase() === normalizedQuery)) onCreate(newName); }} /></label>
      <div className="exercise-search-results" id="exercise-search-results" role="listbox" aria-label="Exercise results">
        {matches.map((item) => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => onChoose(item.name)}>{item.name}<Plus aria-hidden="true" /></button>)}
        {showCreate && <button type="button" role="option" aria-selected="false" className="exercise-search-create" onClick={() => onCreate(newName)}>Add new exercise “{newName}”<Plus aria-hidden="true" /></button>}
        {!matches.length && !showCreate && <p>{newName ? "Already in this workout" : "Type a name to add a new exercise"}</p>}
      </div>
    </div>
  );
}

function CalendarMonth({ year, month, workouts, collapsed, onToggle, onOpen, onAddToday, todayKey }: { year: number; month: number; workouts: Workout[]; collapsed: boolean; onToggle: () => void; onOpen: (date: string) => void; onAddToday: () => void; todayKey: string }) {
  const firstDayOffset = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const workoutsByDay = new Map<number, Workout[]>();
  workouts.forEach((workout) => {
    const day = Number(workout.date.slice(8, 10));
    workoutsByDay.set(day, [...(workoutsByDay.get(day) ?? []), workout]);
  });

  return (
    <section className={`calendar-month${collapsed ? " collapsed" : ""}`}>
      <div className="calendar-month-heading"><h4><button type="button" className="month-toggle" aria-expanded={!collapsed} onClick={onToggle}><span>{formatMonthName(month)} {year}</span><ChevronDown aria-hidden="true" /></button></h4><small>{workouts.length}</small></div>
      {!collapsed && <><div className="calendar-weekdays" aria-hidden="true">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({ length: firstDayOffset }, (_, index) => <span className="calendar-cell blank" key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayWorkouts = workoutsByDay.get(day);
          const hasPr = dayWorkouts?.some((workout) => workout.prHighlights?.length);
          const activities = ACTIVITY_ORDER.filter((activity) => dayWorkouts?.some((workout) => activityOf(workout) === activity));
          const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const className = [`activity-${activities.length > 1 ? "mixed" : activities[0] ?? "strength"}`, hasPr ? "pr-day" : "", key === todayKey ? "today" : ""].filter(Boolean).join(" ");
          return <span className={`calendar-cell${!dayWorkouts && key === todayKey ? " today" : ""}`} key={day}>{dayWorkouts ? <button className={className} style={activitySplit(activities)} aria-label={`Open ${activities.map((activity) => ACTIVITY_LABELS[activity]).join(" and ")} on ${formatMonthName(month)} ${day}, ${year}${hasPr ? ", personal record" : ""}`} onClick={() => onOpen(key)}>{day}</button> : key === todayKey ? <button type="button" className="today-add" aria-label={`Add a workout for today, ${formatMonthName(month)} ${day}`} onClick={onAddToday}><span>{day}</span><Plus aria-hidden="true" /></button> : day}</span>;
        })}
      </div></>}
    </section>
  );
}


export default function Home() {
  return <RepnoteApp />;
}

function RepnoteApp() {
  const [tab, setTab] = useState<"today" | "history" | "lifts" | "rm">("history");
  const [draft, setDraft] = useState<Workout | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [history, setHistory] = useState<Workout[]>([]);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => new Set());
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [highlightUnit, setHighlightUnit] = useState<"kg" | "lbs">("lbs");
  const [selected, setSelected] = useState<Workout | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
  const [showNewEntryMenu, setShowNewEntryMenu] = useState(false);
  const [backgroundUpdatedAt, setBackgroundUpdatedAt] = useState<string | null>(null);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [buttonImageUpdatedAt, setButtonImageUpdatedAt] = useState<string | null>(null);
  const buttonImageInputRef = useRef<HTMLInputElement>(null);
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

  const openMainTab = (nextTab: "history" | "lifts" | "rm") => {
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
      url.searchParams.set("view", `day-${workout.date}`);
      const state = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
      History.prototype.pushState.call(window.history, { ...state, __NA: true, [REPNOTE_VIEW_STATE]: "workout", workoutId: workout.id }, "", `${url.pathname}${url.search}${url.hash}`);
      workoutHistoryPushedRef.current = true;
      coveredScrollTopRef.current = appScrollRef.current?.scrollTop ?? 0;
      document.documentElement.classList.add("detail-open");
    }
    setSelected(workout);
    setWorkoutDetailOpen(true);
  };

  const openDayDetail = (date: string) => {
    const dayWorkouts = history.filter((workout) => workout.date === date);
    if (!dayWorkouts.length) return;
    setSelectedDate(date);
    setConfirmDeleteId(null);
    openWorkoutDetail(dayWorkouts[0]);
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
      setBackgroundUpdatedAt(localStorage.getItem(BACKGROUND_KEY));
      setButtonImageUpdatedAt(localStorage.getItem(BUTTON_IMAGE_KEY));
      fetch("/api/background?slot=button&meta=1").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { updatedAt: string | null }) => {
        setButtonImageUpdatedAt(data.updatedAt);
        if (data.updatedAt) localStorage.setItem(BUTTON_IMAGE_KEY, data.updatedAt); else localStorage.removeItem(BUTTON_IMAGE_KEY);
      }).catch(() => undefined);
      fetch("/api/background?meta=1").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { updatedAt: string | null }) => {
        setBackgroundUpdatedAt(data.updatedAt);
        if (data.updatedAt) localStorage.setItem(BACKGROUND_KEY, data.updatedAt); else localStorage.removeItem(BACKGROUND_KEY);
      }).catch(() => undefined);
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

  const selectedDayWorkouts = useMemo(() => selectedDate
    ? history.filter((workout) => workout.date === selectedDate).sort((a, b) => ACTIVITY_ORDER.indexOf(activityOf(a)) - ACTIVITY_ORDER.indexOf(activityOf(b)) || (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
    : [], [history, selectedDate]);

  const filteredHistory = useMemo(() => exerciseFilter
    ? history.filter((workout) => workout.exercises.some((exercise) => exercise.name === exerciseFilter))
    : history, [exerciseFilter, history]);

  const liftRecords = useMemo(() => LIFT_RECORD_NAMES.map((name) => {
    let best = null as LiftBest | null;
    history.forEach((workout) => {
      workout.exercises.filter((exercise) => exercise.name === name).forEach((exercise) => {
        exercise.sets.forEach((set) => {
          const weight = Number.parseFloat(set.weight);
          if (!Number.isFinite(weight) || weight <= 0) return;
          const kg = workout.unit === "lbs" ? weight / 2.2046226218 : weight;
          const reps = Number.parseInt(set.reps, 10);
          const candidate = { kg, reps: Number.isFinite(reps) && reps > 0 ? reps : null, date: workout.date };
          // Heaviest weight wins; at equal weight, more reps, then the earliest date.
          const sameWeight = best && Math.abs(kg - best.kg) < 0.0001;
          if (!best || (!sameWeight && kg > best.kg) || (sameWeight && ((candidate.reps ?? 0) > (best.reps ?? 0) || ((candidate.reps ?? 0) === (best.reps ?? 0) && workout.date < best.date)))) best = candidate;
        });
      });
    });
    return { name, best };
  }), [history]);

  const recentActivity = useMemo(() => {
    const todayKey = localDateKey();
    const today = new Date(`${todayKey}T12:00:00`);
    const activitiesByDate = new Map<string, Set<Activity>>();
    const notesByDate = new Map<string, string[]>();
    history.forEach((workout) => {
      if (!countsAsWorkout(workout)) return;
      activitiesByDate.set(workout.date, (activitiesByDate.get(workout.date) ?? new Set<Activity>()).add(activityOf(workout)));
      const label = activityOf(workout) === "strength" && workout.exercises.length ? workout.exercises.map((exercise) => exercise.name).join(", ") : workout.note;
      if (label) notesByDate.set(workout.date, [...(notesByDate.get(workout.date) ?? []), label]);
    });
    // The current month plus the previous ones, oldest first, each laid out like a calendar (Sunday first).
    const months = Array.from({ length: ACTIVITY_MONTHS }, (_, index) => {
      const first = new Date(today.getFullYear(), today.getMonth() - (ACTIVITY_MONTHS - 1 - index), 1, 12);
      const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const key = dateKey(new Date(first.getFullYear(), first.getMonth(), dayIndex + 1, 12));
        const activities = ACTIVITY_ORDER.filter((activity) => activitiesByDate.get(key)?.has(activity));
        return { key, day: dayIndex + 1, activities, notes: notesByDate.get(key) ?? [], isToday: key === todayKey, isFuture: key > todayKey };
      });
      return { key: dateKey(first), label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(first), leadingBlanks: first.getDay(), days };
    });
    const workoutDays = months.reduce((sum, month) => sum + month.days.filter((day) => day.activities.length > 0).length, 0);
    return { months, workoutDays };
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
    // Always show the current month (newest first) so today can be tapped to log a workout.
    if (!exerciseFilter) {
      const today = new Date(`${localDateKey()}T12:00:00`);
      const year = `${today.getFullYear()}-year`;
      const month = `${today.getMonth() + 1}-month`;
      if (!result[year]?.[month]) return { [year]: { [month]: [], ...(result[year] ?? {}) }, ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== year)) };
    }
    return result;
  }, [filteredHistory, exerciseFilter]);

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
  const logActivity = async (activity: Exclude<Activity, "strength">) => {
    setShowNewEntryMenu(false);
    const now = new Date().toISOString();
    const entry: Workout = { id: makeId(), status: "completed", activity, date: localDateKey(), startedAt: now, finishedAt: now, unit: "lbs", note: "", exercises: [] };
    setHistory((items) => [entry, ...items]);
    try {
      const response = await fetch(`${apiBase}/workouts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as { workout?: Workout | null };
      if (result.workout) setHistory((items) => items.map((item) => item.id === entry.id ? result.workout as Workout : item));
    } catch {
      setHistory((items) => items.filter((item) => item.id !== entry.id));
      setPermissionError(`${ACTIVITY_LABELS[activity]} could not be logged. Check your connection and try again.`);
    }
  };
  const changeBackground = async (file: File | undefined) => {
    if (!file) return;
    setShowWorkoutMenu(false);
    setBackgroundSaving(true);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const response = await fetch("/api/background", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      if (!response.ok) throw new Error("Save failed");
      const { updatedAt } = await response.json() as { updatedAt: string };
      setBackgroundUpdatedAt(updatedAt);
      try { localStorage.setItem(BACKGROUND_KEY, updatedAt); } catch { /* storage is a convenience only */ }
    } catch {
      setPermissionError("Background could not be saved. Try a smaller photo or check your connection.");
    } finally {
      setBackgroundSaving(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  };
  const changeButtonImage = async (file: File | undefined) => {
    if (!file) return;
    setShowWorkoutMenu(false);
    try {
      // Keep transparency (PNG) and a small size; this only ever renders at ~80px.
      const dataUrl = await imageFileToDataUrl(file, 360, 0.9, "image/png");
      const response = await fetch("/api/background?slot=button", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      if (!response.ok) throw new Error("Save failed");
      const { updatedAt } = await response.json() as { updatedAt: string };
      setButtonImageUpdatedAt(updatedAt);
      try { localStorage.setItem(BUTTON_IMAGE_KEY, updatedAt); } catch { /* convenience only */ }
    } catch {
      setPermissionError("Button picture could not be saved. Try a smaller image or check your connection.");
    } finally {
      if (buttonImageInputRef.current) buttonImageInputRef.current.value = "";
    }
  };
  const removeButtonImage = async () => {
    setShowWorkoutMenu(false);
    const previous = buttonImageUpdatedAt;
    setButtonImageUpdatedAt(null);
    try {
      const response = await fetch("/api/background?slot=button", { method: "DELETE" });
      if (!response.ok) throw new Error("Remove failed");
      try { localStorage.removeItem(BUTTON_IMAGE_KEY); } catch { /* ignore */ }
    } catch {
      setButtonImageUpdatedAt(previous);
      setPermissionError("Button picture could not be removed. Check your connection and try again.");
    }
  };
  const removeBackground = async () => {
    setShowWorkoutMenu(false);
    const previous = backgroundUpdatedAt;
    setBackgroundUpdatedAt(null);
    try {
      const response = await fetch("/api/background", { method: "DELETE" });
      if (!response.ok) throw new Error("Remove failed");
      try { localStorage.removeItem(BACKGROUND_KEY); } catch { /* ignore */ }
    } catch {
      setBackgroundUpdatedAt(previous);
      setPermissionError("Background could not be removed. Check your connection and try again.");
    }
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
  const addExercise = (name: string) => {
    const clean = name.trim();
    if (!clean || !draft) return;
    setDraft({ ...draft, exercises: [...draft.exercises, { id: makeId(), name: clean, sets: [emptySet()] }] });
  };
  const isNewExerciseName = (name: string) => !exerciseOptions.some((option) => option.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  const createLibraryExercise = (name: string) => {
    const clean = name.trim();
    if (!clean || !isNewExerciseName(clean)) return false;
    const item = { id: `library-${makeId()}`, name: clean, frequency: 0, isFrequent: false };
    setExerciseLibrary((items) => [...items, item]);
    void fetch(`${apiBase}/exercises`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).then((response) => { if (!response.ok) throw new Error("Save failed"); }).catch(() => {
      setExerciseLibrary((items) => items.filter((candidate) => candidate.id !== item.id));
      setPermissionError("Exercise could not be saved. Check your connection and try again.");
    });
    return true;
  };
  const saveCustomExercise = () => {
    if (createLibraryExercise(newExercise)) setNewExercise("");
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
    const draftId = `draft-${workout.id}-${makeId()}`;
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
    setConfirmDeleteId(null);
    if (workoutDetailOpen && selectedDate === workout.date && selectedDayWorkouts.length <= 1) closeWorkoutDetail();
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
          <div className="training-card-summary"><strong>{recentActivity.workoutDays}</strong><div><span>Workouts · last {ACTIVITY_MONTHS} months</span><span className="activity-legend" aria-label="Activity colors">{ACTIVITY_ORDER.map((activity) => <span key={activity}><i className={`activity-dot activity-${activity}`} aria-hidden="true" />{ACTIVITY_LABELS[activity]}</span>)}</span></div></div>
        </div>
        {/* Cells depend on the browser's local date, so render them only after hydration. */}
        <div className="activity-months" role="img" aria-label={`Workout days in the last ${ACTIVITY_MONTHS} months: ${recentActivity.workoutDays}`}>{ready && recentActivity.months.map((month) => <div className="activity-month" key={month.key}><b>{month.label}</b><div className="activity-month-grid">{WEEKDAY_INITIALS.map((initial, index) => <span className="activity-weekday" key={`w-${index}`}>{initial}</span>)}{Array.from({ length: month.leadingBlanks }, (_, index) => <i key={`blank-${index}`} className="activity-blank" />)}{month.days.map((day) => day.activities.length ? <button type="button" key={day.key} onClick={() => openDayDetail(day.key)} className={["activity-cell", day.activities.length === 0 ? (day.isFuture ? "future" : "rest") : day.activities.length > 1 ? "activity-mixed" : `activity-${day.activities[0]}`, day.isToday ? "today" : ""].filter(Boolean).join(" ")} style={activitySplit(day.activities)} title={day.isFuture ? undefined : `${formatRecordDate(day.key)}: ${day.activities.length ? `${day.activities.map((activity) => ACTIVITY_LABELS[activity]).join(" + ")}${day.notes.length ? ` (${day.notes.join("; ")})` : ""}` : "rest"}`} /> : <i key={day.key} className={["activity-cell", day.isFuture ? "future" : "rest", day.isToday ? "today" : ""].filter(Boolean).join(" ")} title={day.isFuture ? undefined : `${formatRecordDate(day.key)}: rest`} />)}</div></div>)}</div>
        <div className="training-card-filter"><span>Filter</span><CustomSelect className="exercise-filter" ariaLabel="Filter workouts by exercise" value={exerciseFilter} onChange={setExerciseFilter} options={[{ value: "", label: "All exercises" }, ...exerciseFilterOptions.map((name) => ({ value: name, label: name }))]} /><div className="history-controls"><button type="button" className="collapse-all" aria-label={allMonthsCollapsed ? "Expand all months" : "Collapse all months"} title={allMonthsCollapsed ? "Expand all months" : "Collapse all months"} aria-pressed={allMonthsCollapsed} onClick={toggleAllMonths}>{allMonthsCollapsed ? <ChevronsDown aria-hidden="true" /> : <ChevronsUp aria-hidden="true" />}</button></div></div>
      </section>
      {history.length === 0 ? <div className="empty-state"><b>No workouts yet</b><p>Create your first workout with the + button above.</p></div> : filteredHistory.length === 0 ? <div className="empty-state filter-empty"><b>No matching workouts</b><p>No workouts contain {exerciseFilter}.</p><button onClick={() => setExerciseFilter("")}>Clear filter</button></div> : Object.entries(grouped).map(([year, months]) => (
        <section className="calendar-year compact-calendar-year" key={year}>{Object.entries(months).map(([month, items]) => <CalendarMonth key={month} year={Number.parseInt(year, 10)} month={Number.parseInt(month, 10)} workouts={items} collapsed={collapsedMonths.has(`${year}/${month}`)} onToggle={() => toggleMonth(`${year}/${month}`)} onOpen={openDayDetail} onAddToday={() => setShowNewEntryMenu(true)} todayKey={localDateKey()} />)}</section>
      ))}
    </div>
  );

  const liftsScreen = (
    <div className="lifts-screen">
      {history.length > 0 ? <section className="big-three-highlight" aria-labelledby="lift-records-title"><div className="big-three-heading"><h2 id="lift-records-title">Best lifts</h2><div className="big-three-meta"><div className={`highlight-unit-toggle ${highlightUnit}`} role="group" aria-label="Best lifts weight unit"><button type="button" aria-pressed={highlightUnit === "lbs"} onClick={() => setHighlightUnit("lbs")}>LBS</button><button type="button" aria-pressed={highlightUnit === "kg"} onClick={() => setHighlightUnit("kg")}>KG</button></div></div></div><div className="big-three-grid">{liftRecords.map((record) => <div className="big-three-record" key={record.name}><span title={record.name}>{record.name}</span><strong>{record.best ? formatHighlightWeight(record.best.kg) : "—"} <small>{record.best ? highlightUnit : ""}</small></strong><em className="lift-record-reps">{record.best?.reps ? `× ${record.best.reps} ${record.best.reps === 1 ? "rep" : "reps"}` : "\u00a0"}</em><time dateTime={record.best?.date}>{record.best ? formatRecordDate(record.best.date) : "No record"}</time></div>)}</div></section> : <div className="empty-state"><b>No lifts yet</b><p>Log a lifting workout and your best sets show up here.</p></div>}
    </div>
  );

  const newEntryOptions: { activity: Activity; label: string; hint: string }[] = [
    { activity: "strength", label: draft ? (editingWorkoutId ? "Continue editing" : "Continue lifting") : "Lifting", hint: draft ? "Back to your open workout" : "Log sets, reps and weight" },
    { activity: "climbing", label: "Climbing", hint: "Mark today as a climbing day" },
    { activity: "cardio", label: "Cardio", hint: "Tennis, pickleball, a run…" },
    { activity: "ski", label: "Ski", hint: "Mark today as a ski day" },
  ];
  const chooseNewEntry = (activity: Activity) => {
    setShowNewEntryMenu(false);
    if (activity !== "strength") { void logActivity(activity); return; }
    if (workoutDetailOpen) {
      // Leave the day page's history entry in place so "back" from the editor returns to it.
      workoutHistoryPushedRef.current = false;
      document.documentElement.classList.remove("detail-open");
      setWorkoutDetailOpen(false);
    }
    if (draft) openDraftView(); else startWorkout();
  };

  return (
    <main className={`app-shell${backgroundUpdatedAt ? " has-photo-background" : ""}`}>
      <div className="app-backdrop" aria-hidden="true" style={backgroundUpdatedAt ? { backgroundImage: `url(/api/background?v=${encodeURIComponent(backgroundUpdatedAt)})` } : undefined} />
      <input ref={backgroundInputRef} type="file" accept="image/*" hidden onChange={(event) => void changeBackground(event.target.files?.[0])} />
      <input ref={buttonImageInputRef} type="file" accept="image/*" hidden onChange={(event) => void changeButtonImage(event.target.files?.[0])} />
      <header className="topbar">
        <div className="topbar-version" ref={versionMenuRef}><button type="button" className="topbar-favicon" aria-label="View release time" aria-expanded={showBuildInfo} onClick={() => { setShowWorkoutMenu(false); setShowBuildInfo((open) => !open); }}><img src="/favicon.svg" alt="" /></button>{showBuildInfo && <div className="version-dropdown release-time-dropdown" role="status"><time dateTime={__APP_BUILD_TIME__}>{formatBuildTime(__APP_BUILD_TIME__)}</time></div>}</div>
        <h1 className="topbar-title">{tab === "rm" ? "RM Calculator" : tab === "lifts" ? "Best Lifts" : tab === "today" ? "Workout" : "Workouts"}</h1>
        {tab === "history" && <div className="topbar-actions" ref={workoutMenuRef}><button type="button" className="topbar-more" aria-label="More workout options" aria-haspopup="menu" aria-expanded={showWorkoutMenu} onClick={() => { setShowBuildInfo(false); setShowWorkoutMenu((open) => !open); }}><MoreHorizontal aria-hidden="true" /></button>{showWorkoutMenu && <div className="workout-actions-menu" role="menu"><button type="button" role="menuitem" onClick={openExerciseLibrary}>Manage exercises</button><button type="button" role="menuitem" disabled={backgroundSaving} onClick={() => backgroundInputRef.current?.click()}>{backgroundSaving ? "Saving background…" : backgroundUpdatedAt ? "Change background" : "Set background photo"}</button>{backgroundUpdatedAt && <button type="button" role="menuitem" onClick={() => void removeBackground()}>Remove background</button>}<button type="button" role="menuitem" onClick={() => buttonImageInputRef.current?.click()}>{buttonImageUpdatedAt ? "Change button picture" : "Set button picture"}</button>{buttonImageUpdatedAt && <button type="button" role="menuitem" onClick={() => void removeButtonImage()}>Remove button picture</button>}</div>}</div>}
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

              <div className="quick-add"><div className="quick-add-options">{frequentExercises.map((item) => <button key={item.id} disabled={draft.exercises.some((ex) => ex.name === item.name)} onClick={() => addExercise(item.name)}>＋ {item.name}</button>)}<button className="rare-exercise-toggle" aria-expanded={showRareExercises} onClick={() => { setRareExercise(""); setShowRareExercises((value) => !value); }}><span>More exercises</span><ChevronDown aria-hidden="true" /></button></div>{showRareExercises && <ExerciseSearchPicker options={exerciseLibrary.filter((item) => !draft.exercises.some((exercise) => exercise.name === item.name))} query={rareExercise} onQueryChange={setRareExercise} onChoose={(name) => { addExercise(name); setRareExercise(""); setShowRareExercises(false); }} canCreate={isNewExerciseName} onCreate={(name) => { if (createLibraryExercise(name)) addExercise(name); setRareExercise(""); setShowRareExercises(false); }} />}</div>

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
        ) : tab === "rm" ? <RmCalculator embedded /> : tab === "lifts" ? liftsScreen : null}
      </section>

      <nav className="tabbar" aria-label="Main navigation">
        <button className={tab === "history" || tab === "today" ? "active" : ""} onClick={() => openMainTab("history")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h5M11 13h5" /></svg>Workouts{draft && <i />}</button>
        <button className={tab === "lifts" ? "active" : ""} onClick={() => openMainTab("lifts")}><Trophy aria-hidden="true" />Best lifts</button>
        <button className={tab === "rm" ? "active" : ""} onClick={() => openMainTab("rm")}><Calculator aria-hidden="true" />RM</button>
      </nav>

      {tab === "history" && !workoutDetailOpen && !exerciseLibraryOpen && <button type="button" className="new-workout-fab" aria-label={draft ? "Continue workout or log an activity" : "Log a workout"} aria-haspopup="dialog" onClick={() => setShowNewEntryMenu(true)}>{buttonImageUpdatedAt ? <span className="fab-picture"><img src={`/api/background?slot=button&v=${encodeURIComponent(buttonImageUpdatedAt)}`} alt="" /><i aria-hidden="true"><Plus /></i></span> : <span className="fab-heart"><Plus aria-hidden="true" /></span>}<span className="fab-label">{draft ? "Continue" : "New workout"}</span></button>}

      {showNewEntryMenu && <div className="new-entry-sheet-backdrop" onClick={() => setShowNewEntryMenu(false)}><section className="new-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="new-entry-title" onClick={(event) => event.stopPropagation()}><header><h2 id="new-entry-title">What did you do today? ♡</h2><button type="button" className="sheet-close" aria-label="Close" onClick={() => setShowNewEntryMenu(false)}><X aria-hidden="true" /></button></header><div className="new-entry-options">{newEntryOptions.map((option) => <button type="button" key={option.activity} className={`new-entry-option activity-${option.activity}`} onClick={() => chooseNewEntry(option.activity)}><i className={`activity-heart activity-${option.activity}`} aria-hidden="true" /><span><b>{option.label}</b><small>{option.hint}</small></span></button>)}</div></section></div>}

      {exerciseLibraryOpen && <article className="exercise-library-page workout-detail-page"><div className="page-back-gesture" aria-hidden="true" onTouchStart={beginLibraryBackTouch} onTouchMove={moveLibraryBackTouch} onTouchEnd={finishLibraryBackTouch} onTouchCancel={() => { libraryTouchStart.current = null; }} /><div className="detail-page-inner exercise-library-content"><button className="session-back" onClick={closeExerciseLibrary}><span aria-hidden="true">←</span> Back to workouts</button><div className="exercise-library-heading"><div><p className="eyebrow">EXERCISES</p><h2>Exercise library</h2></div><span>{exerciseOptions.length}</span></div>{permissionError && <div className="permission-error" role="alert"><span>{permissionError}</span><button aria-label="Dismiss message" onClick={() => setPermissionError("")}>×</button></div>}<section className="exercise-library-panel"><div className="library-add"><div><input id="exercise-name" aria-label="Exercise name" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCustomExercise()} placeholder="Add an exercise" /><button onClick={saveCustomExercise} disabled={!newExercise.trim()}>Add</button></div></div><div className="exercise-library"><div className="library-section"><h4><span>EXERCISE</span><span>TIMES</span><span>FREQUENT</span></h4>{exerciseLibrary.map((item) => <div className="library-row" key={item.id}><strong>{item.name}</strong><span className="exercise-frequency"><b>{item.frequency}</b></span><label className="frequent-check"><input type="checkbox" checked={item.isFrequent} onChange={() => toggleFrequentExercise(item)} aria-label={`Mark ${item.name} as frequent`} /></label></div>)}</div></div></section></div></article>}

      {workoutDetailOpen && selectedDayWorkouts.length > 0 && <article className="workout-detail-page"><div className="detail-page-inner"><button className="session-back" onClick={closeWorkoutDetail}><span aria-hidden="true">←</span> Back to workouts</button><div className="detail-heading"><h2>{formatDate(`${selectedDayWorkouts[0].date}T12:00:00`)}</h2>{selectedDayWorkouts[0].date === localDateKey() && <button type="button" className="day-add" onClick={() => setShowNewEntryMenu(true)}><Plus aria-hidden="true" />Add</button>}</div>
        <div className="day-entries">{selectedDayWorkouts.map((workout) => {
          const activity = activityOf(workout);
          const fromCalendar = workout.source === "apple-calendar";
          return <section className={`day-entry activity-${activity}`} key={workout.id}>
            <header className="day-entry-header"><span className="day-entry-title"><i className={`activity-dot activity-${activity}`} aria-hidden="true" />{ACTIVITY_LABELS[activity]}{fromCalendar && workout.note && <small>{workout.note}</small>}</span>
              <span className="day-entry-actions">{activity === "strength" && <button className="edit-workout" aria-label="Edit workout" title="Edit workout" onClick={() => editWorkout(workout)}><Pencil aria-hidden="true" /></button>}{confirmDeleteId === workout.id ? <><button className="day-entry-cancel" onClick={() => setConfirmDeleteId(null)}>Keep</button><button className="day-entry-delete confirm" onClick={() => void deleteWorkout(workout)}>Delete</button></> : <button className="day-entry-delete" aria-label={`Delete ${ACTIVITY_LABELS[activity]}`} title="Delete" onClick={() => setConfirmDeleteId(workout.id)}><Trash2 aria-hidden="true" /></button>}</span>
            </header>
            {activity === "strength" && !fromCalendar && workout.startedAt && workout.finishedAt && <div className="time-strip"><div><span>START</span><strong>{formatClock(workout.startedAt)}</strong></div><i>→</i><div><span>FINISH</span><strong>{formatClock(workout.finishedAt)}</strong></div><div><span>DURATION</span><strong>{duration(workout.startedAt, workout.finishedAt)}</strong></div></div>}
            {!fromCalendar && workout.note && <div className="detail-note"><span>NOTE</span><p>{workout.note}</p></div>}
            {workout.prHighlights?.length ? <p className="day-entry-pr"><b>PR</b> {workout.prHighlights.map((highlight) => `${PR_LIFT_NAMES[highlight.lift]} ${formatPrWeight(highlight.weight)} ${highlight.unit}`).join(" · ")}</p> : null}
            {workout.exercises.length > 0 && <div className="detail-exercises">{workout.exercises.map((exercise) => <section key={exercise.id}><h3>{exercise.name}<span>{exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}</span></h3>{exercise.sets.map((set, index) => <div key={set.id}><b>{index + 1}</b><strong>{set.weight || "—"} <small>{workout.unit ?? "kg"}</small></strong><strong>{set.reps || "—"} <small>reps</small></strong><p>{set.note || ""}</p></div>)}</section>)}</div>}
            {activity !== "strength" && !workout.note && <p className="day-entry-empty">Logged {ACTIVITY_LABELS[activity].toLowerCase()} this day.</p>}
          </section>;
        })}</div></div></article>}
    </main>
  );
}
