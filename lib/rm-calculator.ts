export const RM_LEVELS = [
  // NSCA Training Load Chart values where published; missing positions are
  // interpolated to preserve the existing 12RM (70%) and 15RM (67%) anchors.
  { reps: 1, percentage: 1 },
  { reps: 2, percentage: 0.95 },
  { reps: 3, percentage: 0.93 },
  { reps: 4, percentage: 0.9 },
  { reps: 5, percentage: 0.87 },
  { reps: 6, percentage: 0.85 },
  { reps: 7, percentage: 0.83 },
  { reps: 8, percentage: 0.8 },
  { reps: 9, percentage: 0.77 },
  { reps: 10, percentage: 0.75 },
  { reps: 11, percentage: 0.725 },
  { reps: 12, percentage: 0.7 },
  { reps: 13, percentage: 0.69 },
  { reps: 14, percentage: 0.68 },
  { reps: 15, percentage: 0.67 },
] as const;

export function calculateOneRmEstimates(weight: number, reps: number) {
  const level = RM_LEVELS.find((item) => item.reps === reps);
  if (!Number.isFinite(weight) || weight <= 0 || !level) return null;
  if (reps === 1) return { nsca: weight, brzycki: weight, epley: weight };
  return {
    nsca: weight / level.percentage,
    brzycki: weight * 36 / (37 - reps),
    epley: weight * (1 + reps / 30),
  };
}

export function estimateEquivalentOneRm(weight: number, reps: number) {
  const estimates = calculateOneRmEstimates(weight, reps);
  if (!estimates) return null;
  return [estimates.nsca, estimates.brzycki, estimates.epley].sort((a, b) => a - b)[1];
}
