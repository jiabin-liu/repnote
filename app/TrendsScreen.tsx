"use client";

import { useMemo, useState } from "react";

type TrendSet = { weight: string; reps: string };
type TrendWorkout = { date: string; unit?: "kg" | "lbs"; activity?: string; exercises: { name: string; sets: TrendSet[] }[] };
type Unit = "kg" | "lbs";
type Point = { date: string; t: number; value: number; reps: number | null };

// Exercises shown top to bottom. Each matches logged names loosely ("Lat Pull Down" = "Lat Pulldown").
const TREND_EXERCISES = ["Bulgarian Split Squat", "Bicep Curl", "Lat Pulldown", "Barbell Squat", "Single Leg Deadlift", "Face Pull"];
const LOOKBACK_DAYS = 730;
const KG_PER_LB = 0.45359237;
const normalize = (name: string) => name.toLocaleLowerCase().replace(/[^a-z]/g, "");
const dayMs = 86_400_000;
const toTime = (date: string) => new Date(`${date}T12:00:00`).getTime();
const formatShortDate = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
const formatValue = (value: number) => (Math.round(value * 10) / 10).toString();

// Round axis ticks to friendly steps (1, 2, 2.5, 5 × 10ⁿ).
const niceTicks = (min: number, max: number, count = 4) => {
  if (min === max) { min -= 5; max += 5; }
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
};

function TrendChart({ name, points, unit, startT, endT }: { name: string; points: Point[]; unit: Unit; startT: number; endT: number }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340, H = 190, left = 44, right = 14, top = 14, bottom = 28;
  const latest = points.at(-1);
  const best = points.reduce<Point | null>((b, p) => (!b || p.value > b.value ? p : b), null);

  if (!points.length) {
    return <section className="trend-card empty"><header><h3>{name}</h3></header><p className="trend-empty">No sets logged in the last 2 years yet.</p></section>;
  }

  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)));
  const yMin = ticks[0], yMax = ticks.at(-1) ?? ticks[0] + 1;
  const x = (t: number) => left + ((t - startT) / Math.max(endT - startT, dayMs)) * (W - left - right);
  const y = (v: number) => top + (1 - (v - yMin) / Math.max(yMax - yMin, 1e-9)) * (H - top - bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.value).toFixed(1)}`).join("");
  const area = `${path}L${x(points.at(-1)!.t).toFixed(1)} ${H - bottom}L${x(points[0].t).toFixed(1)} ${H - bottom}Z`;
  // Month labels every 4 months across the window.
  const monthTicks: { t: number; label: string }[] = [];
  const cursor = new Date(startT); cursor.setDate(1); cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() <= endT) {
    if (cursor.getMonth() % 4 === 0) monthTicks.push({ t: cursor.getTime(), label: new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(cursor).replace(" ", " ’") });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const shown = active == null ? null : points[active];

  const pick = (clientX: number, target: SVGSVGElement) => {
    const box = target.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * W;
    let nearest = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.t) - sx) < Math.abs(x(points[nearest].t) - sx)) nearest = i; });
    setActive(nearest);
  };

  return (
    <section className="trend-card">
      <header>
        <h3>{name}</h3>
        <div className="trend-stats">
          <div><span>Latest</span><strong>{formatValue(latest!.value)}<small>{unit}</small></strong><time>{formatShortDate(latest!.date)}</time></div>
          <div><span>Best</span><strong>{formatValue(best!.value)}<small>{unit}</small></strong><time>{formatShortDate(best!.date)}</time></div>
        </div>
      </header>
      <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name}: heaviest set per session over the last two years, latest ${formatValue(latest!.value)} ${unit}, best ${formatValue(best!.value)} ${unit}`}
        onPointerMove={(event) => pick(event.clientX, event.currentTarget)} onPointerDown={(event) => pick(event.clientX, event.currentTarget)} onPointerLeave={() => setActive(null)}>
        <defs><linearGradient id={`trend-fill-${normalize(name)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9b6f2" stopOpacity=".45" /><stop offset="100%" stopColor="#f9c4d8" stopOpacity=".05" /></linearGradient></defs>
        {ticks.map((tick) => <g key={tick}><line className="trend-grid" x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} /><text className="trend-y" x={left - 7} y={y(tick)} dy="0.35em" textAnchor="end">{formatValue(tick)}</text></g>)}
        {monthTicks.map((tick) => <text key={tick.t} className="trend-x" x={x(tick.t)} y={H - 8} textAnchor="middle">{tick.label}</text>)}
        <path d={area} fill={`url(#trend-fill-${normalize(name)})`} />
        <path className="trend-line" d={path} />
        {points.map((p, i) => <circle key={p.date} className={i === points.length - 1 ? "trend-dot latest" : "trend-dot"} cx={x(p.t)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.2} />)}
        {shown && <g className="trend-tip" pointerEvents="none">
          <line x1={x(shown.t)} x2={x(shown.t)} y1={top} y2={H - bottom} />
          <circle cx={x(shown.t)} cy={y(shown.value)} r={6} />
          {(() => {
            const label = `${formatValue(shown.value)} ${unit}${shown.reps ? ` × ${shown.reps}` : ""} · ${formatShortDate(shown.date)}`;
            const width = label.length * 6.4 + 16;
            const tx = Math.min(Math.max(x(shown.t) - width / 2, left), W - right - width);
            return <g transform={`translate(${tx} ${top - 2})`}><rect width={width} height={22} rx={11} /><text x={width / 2} y={15} textAnchor="middle">{label}</text></g>;
          })()}
        </g>}
      </svg>
    </section>
  );
}

export default function TrendsScreen({ history, unit, onUnitChange }: { history: TrendWorkout[]; unit: Unit; onUnitChange: (unit: Unit) => void }) {
  const { series, startT, endT } = useMemo(() => {
    const end = new Date(); end.setHours(12, 0, 0, 0);
    const endTime = end.getTime();
    const startTime = endTime - LOOKBACK_DAYS * dayMs;
    const byExercise = new Map<string, Map<string, Point>>();
    TREND_EXERCISES.forEach((name) => byExercise.set(normalize(name), new Map()));
    history.forEach((workout) => {
      if (workout.activity && workout.activity !== "strength") return;
      const t = toTime(workout.date);
      if (t < startTime || t > endTime + dayMs) return;
      workout.exercises.forEach((exercise) => {
        const key = normalize(exercise.name);
        const days = byExercise.get(key);
        if (!days) return;
        exercise.sets.forEach((set) => {
          const weight = Number.parseFloat(set.weight);
          if (!Number.isFinite(weight) || weight <= 0) return;
          const kg = workout.unit === "lbs" ? weight * KG_PER_LB : weight;
          const value = unit === "lbs" ? kg / KG_PER_LB : kg;
          const reps = Number.parseInt(set.reps, 10);
          const current = days.get(workout.date);
          // One point per day: that session's heaviest set.
          if (!current || value > current.value + 1e-9) days.set(workout.date, { date: workout.date, t, value, reps: Number.isFinite(reps) && reps > 0 ? reps : null });
        });
      });
    });
    return {
      startT: startTime,
      endT: endTime,
      series: TREND_EXERCISES.map((name) => ({ name, points: [...(byExercise.get(normalize(name))?.values() ?? [])].sort((a, b) => a.t - b.t) })),
    };
  }, [history, unit]);

  return (
    <div className="trends-screen">
      <div className="trends-heading">
        <p>Heaviest set per session · last 2 years</p>
        <div className={`highlight-unit-toggle ${unit}`} role="group" aria-label="Trend weight unit"><button type="button" aria-pressed={unit === "lbs"} onClick={() => onUnitChange("lbs")}>LBS</button><button type="button" aria-pressed={unit === "kg"} onClick={() => onUnitChange("kg")}>KG</button></div>
      </div>
      {series.map((item) => <TrendChart key={item.name} name={item.name} points={item.points} unit={unit} startT={startT} endT={endT} />)}
    </div>
  );
}
