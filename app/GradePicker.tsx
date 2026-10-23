"use client";

import { useEffect, useRef } from "react";

const ITEM_HEIGHT = 44;
export const GRADE_NUMBERS = ["10", "11", "12", "13"];
export const GRADE_LETTERS = ["A", "B", "C", "D"];
export const DEFAULT_MAX_ATTEMPT_GRADE = "5.11D";
export const DEFAULT_MAX_SEND_GRADE = "5.11B";

export const splitGrade = (grade: string) => {
  const match = grade.match(/^5\.(1[0-3])([A-D])$/);
  return match ? { number: match[1], letter: match[2] } : { number: "11", letter: "B" };
};

// One scroll-snapping wheel column (iOS-picker style). The centred row is the value.
function Wheel({ options, value, onChange, label }: { options: string[]; value: string; onChange: (value: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const element = ref.current;
    if (element && Math.round(element.scrollTop / ITEM_HEIGHT) !== index) element.scrollTop = index * ITEM_HEIGHT;
  }, [index]);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

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
          const next = options[Math.min(options.length - 1, Math.max(0, Math.round(element.scrollTop / ITEM_HEIGHT)))];
          if (next !== value) onChange(next);
        }, 80);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" && index > 0) { event.preventDefault(); onChange(options[index - 1]); }
        if (event.key === "ArrowDown" && index < options.length - 1) { event.preventDefault(); onChange(options[index + 1]); }
      }}
    >
      {options.map((option, optionIndex) => (
        <div key={option} role="option" aria-selected={optionIndex === index} className={`grade-wheel-item${optionIndex === index ? " selected" : ""}`}
          onClick={() => { ref.current?.scrollTo({ top: optionIndex * ITEM_HEIGHT, behavior: "smooth" }); onChange(option); }}>{option}</div>
      ))}
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
        <Wheel label={`${label} letter`} options={GRADE_LETTERS} value={letter} onChange={(next) => update("letter", next)} />
        <i className="grade-picker-band" aria-hidden="true" />
      </div>
      <strong className="grade-picker-value" aria-live="polite">{value}</strong>
    </div>
  );
}
