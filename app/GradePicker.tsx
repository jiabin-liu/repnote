"use client";

import { useEffect, useRef } from "react";

const ITEM_HEIGHT = 44;
export const GRADE_NUMBERS = ["10", "11", "12", "13"];
export const GRADE_LETTERS = ["A", "B", "C", "D"];
export const DEFAULT_MAX_ATTEMPT_GRADE = "5.11D";
export const DEFAULT_MAX_SEND_GRADE = "5.11B";
export const CLIMB_STYLES = [{ value: "top_rope", label: "Top rope" }, { value: "lead", label: "Lead" }, { value: "boulder", label: "Boulder" }] as const;
export type ClimbStyle = typeof CLIMB_STYLES[number]["value"];
export const DEFAULT_CLIMB_STYLE: ClimbStyle = "lead";
export const climbStyleLabel = (style: string | null | undefined) => CLIMB_STYLES.find((option) => option.value === style)?.label ?? null;

export const splitGrade = (grade: string) => {
  const match = grade.match(/^5\.(1[0-3])([A-D])$/);
  return match ? { number: match[1], letter: match[2] } : { number: "11", letter: "B" };
};

// One scroll-snapping wheel column (iOS-picker style). The centred row is the value.
// With `loop`, the options repeat so scrolling past the last one wraps to the first (…C, D, A, B…).
const LOOP_COPIES = 7;
function Wheel({ options, value, onChange, label, loop = false }: { options: string[]; value: string; onChange: (value: string) => void; label: string; loop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = options.length;
  const copies = loop ? LOOP_COPIES : 1;
  const middle = loop ? Math.floor(LOOP_COPIES / 2) * count : 0;
  const index = Math.max(0, options.indexOf(value));
  const rows = Array.from({ length: count * copies }, (_, row) => options[row % count]);

  // Keep the scroll position on the selected row; for a looping wheel, recentre into the middle copy
  // so there is always room to keep scrolling either way.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const row = Math.round(element.scrollTop / ITEM_HEIGHT);
    const target = loop ? middle + index : index;
    if (loop ? row % count !== index || Math.abs(row - target) >= count : row !== index) element.scrollTop = target * ITEM_HEIGHT;
  }, [index, loop, middle, count]);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const step = (delta: number) => onChange(options[loop ? (index + delta + count) % count : Math.min(count - 1, Math.max(0, index + delta))]);

  return (
    <div
      ref={ref}
      className="grade-wheel"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={(event) => {
        const element = event.currentTarget;
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          const row = Math.min(rows.length - 1, Math.max(0, Math.round(element.scrollTop / ITEM_HEIGHT)));
          const nextIndex = row % count;
          if (loop && Math.abs(row - (middle + nextIndex)) >= count) element.scrollTop = (middle + nextIndex) * ITEM_HEIGHT;
          if (options[nextIndex] !== value) onChange(options[nextIndex]);
        }, 90);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" && (loop || index > 0)) { event.preventDefault(); step(-1); }
        if (event.key === "ArrowDown" && (loop || index < count - 1)) { event.preventDefault(); step(1); }
      }}
    >
      {rows.map((option, row) => {
        const selected = row % count === index;
        return <div key={`${option}-${row}`} role="option" aria-selected={selected} className={`grade-wheel-item${selected ? " selected" : ""}`}
          onClick={() => { ref.current?.scrollTo({ top: row * ITEM_HEIGHT, behavior: "smooth" }); onChange(option); }}>{option}</div>;
      })}
    </div>
  );
}

export default function GradePicker({ label, value, onChange }: { label: string; value: string; onChange: (grade: string) => void }) {
  const { number, letter } = splitGrade(value);
  // Both wheels can settle in the same tick, so build each change from the latest grade, not the render-time one.
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  const update = (part: "number" | "letter", next: string) => {
    const current = splitGrade(latest.current);
    const grade = part === "number" ? `5.${next}${current.letter}` : `5.${current.number}${next}`;
    latest.current = grade;
    onChange(grade);
  };
  return (
    <div className="grade-picker">
      <span className="grade-picker-label">{label}</span>
      <div className="grade-picker-wheels">
        <span className="grade-prefix" aria-hidden="true">5.</span>
        <Wheel label={`${label} number`} options={GRADE_NUMBERS} value={number} onChange={(next) => update("number", next)} />
        <Wheel label={`${label} letter`} options={GRADE_LETTERS} value={letter} onChange={(next) => update("letter", next)} loop />
        <i className="grade-picker-band" aria-hidden="true" />
      </div>
      <strong className="grade-picker-value" aria-live="polite">{value}</strong>
    </div>
  );
}
