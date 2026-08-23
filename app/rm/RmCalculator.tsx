"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateOneRmEstimates, RM_LEVELS } from "../../lib/rm-calculator";

type Unit = "kg" | "lbs";

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function RmCalculator({ embedded = false }: { embedded?: boolean }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState<Unit>("lbs");
  const numericWeight = Number.parseFloat(weight);
  const numericReps = Number.parseInt(reps, 10);
  const selectedLevel = RM_LEVELS.find((level) => level.reps === numericReps);
  const hasValidInput = Number.isFinite(numericWeight) && numericWeight > 0 && selectedLevel != null;
  const estimates = hasValidInput ? calculateOneRmEstimates(numericWeight, numericReps) : null;
  const estimatedOneRm = estimates?.nsca ?? null;
  const brzyckiOneRm = estimates?.brzycki ?? null;
  const epleyOneRm = estimates?.epley ?? null;
  const referenceSets = useMemo(() => estimatedOneRm == null || brzyckiOneRm == null || epleyOneRm == null ? [] : RM_LEVELS.map((level) => ({
    ...level,
    tableWeight: estimatedOneRm * level.percentage,
    brzyckiWeight: brzyckiOneRm * (37 - level.reps) / 36,
    epleyWeight: level.reps === 1 ? epleyOneRm : epleyOneRm / (1 + level.reps / 30),
  })), [estimatedOneRm, brzyckiOneRm, epleyOneRm]);
  const Root = embedded ? "div" : "main";

  return (
    <Root className={`rm-page ${embedded ? "embedded" : ""}`}>
      {!embedded && <header className="rm-topbar">
        <Link href="/" className="rm-back"><span aria-hidden="true">←</span> Back to Repnote</Link>
        <div className="rm-brand"><span aria-hidden="true">R</span><div><p>TRAINING TOOL</p><h1>RM Calculator</h1></div></div>
      </header>}

      <section className="rm-layout">
        <section className="rm-card" aria-label="RM calculator">
          <div className="rm-fields">
            <label><span>WEIGHT</span><div><input type="number" min="0" step="0.5" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} /><span className="rm-unit-switch" aria-label="Weight unit"><button type="button" className={unit === "lbs" ? "active" : ""} aria-pressed={unit === "lbs"} onClick={() => setUnit("lbs")}>LBS</button><button type="button" className={unit === "kg" ? "active" : ""} aria-pressed={unit === "kg"} onClick={() => setUnit("kg")}>KG</button></span></div></label>
            <span className="rm-times" aria-hidden="true">×</span>
            <label className="rm-field"><span>REPS</span><div className="rm-field-line"><input type="number" min="1" max="20" step="1" inputMode="numeric" aria-label="Reps" value={reps} onChange={(event) => setReps(event.target.value)} /><b>reps</b></div></label>
          </div>
          {weight && reps && !hasValidInput && <p className="rm-validation">Enter a positive weight and select a supported rep count.</p>}
        </section>
      </section>

      <section className="rm-reference" aria-labelledby="reference-heading">
        <div className="rm-reference-heading"><h2 id="reference-heading">Reference weights</h2><div className="rm-range-legend" aria-label="Weight range legend"><span className="safe">Safe low</span><span className="danger">Danger high</span></div></div>
        <div className="rm-reference-columns" aria-hidden="true"><span>RM</span><span>NSCA</span><span>Brzycki</span><span>Epley</span></div>
        <div className="rm-reference-grid">
          {RM_LEVELS.map((level, index) => {
            const item = referenceSets[index];
            const results = item ? [item.tableWeight, item.brzyckiWeight, item.epleyWeight] : [];
            const displayedResults = results.map((value) => Number(formatWeight(value)));
            const lowest = displayedResults.length ? Math.min(...displayedResults) : null;
            const highest = displayedResults.length ? Math.max(...displayedResults) : null;
            const hasRange = lowest != null && highest != null && highest > lowest;
            return <div className={item ? "rm-reference-row ready" : "rm-reference-row"} key={level.reps}><b>{level.reps}<small> RM</small></b>{results.length ? results.map((value, resultIndex) => {
              const displayed = displayedResults[resultIndex];
              const rangeClass = hasRange && displayed === lowest ? "safe-result" : hasRange && displayed === highest ? "danger-result" : "";
              const rangeLabel = rangeClass === "safe-result" ? "safe low" : rangeClass === "danger-result" ? "danger high" : "estimate";
              return <span className={rangeClass} aria-label={`${formatWeight(value)} ${unit}, ${rangeLabel}`} key={resultIndex}>{formatWeight(value)} <small>{unit}</small></span>;
            }) : <><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></>}</div>;
          })}
        </div>
        <div className="rm-method-notes" aria-label="Calculation methods">
          <div><strong>NSCA</strong><p>Percentage lookup. Missing 11, 13 and 14RM values are interpolated between the published anchors.</p></div>
          <div><strong>Brzycki</strong><p><code>1RM = weight × 36 ÷ (37 − reps)</code></p></div>
          <div><strong>Epley</strong><p><code>1RM = weight × (1 + reps ÷ 30)</code></p></div>
        </div>
      </section>
    </Root>
  );
}
