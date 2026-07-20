import type { MacroSet } from "../api/types";

export interface MacroProgress {
  key: keyof MacroSet;
  label: string;
  consumed: number;
  target: number;
  remaining: number;
  pct: number; // 0-100, clamped
  unit: string;
}

const MACRO_META: { key: keyof MacroSet; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
];

export function clampPct(consumed: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((consumed / target) * 100)));
}

export function macroProgress(targets: MacroSet, consumed: MacroSet): MacroProgress[] {
  return MACRO_META.map(({ key, label, unit }) => {
    const t = Number(targets[key] ?? 0);
    const c = Number(consumed[key] ?? 0);
    return {
      key,
      label,
      unit,
      consumed: c,
      target: t,
      remaining: Math.max(0, Math.round(t - c)),
      pct: clampPct(c, t),
    };
  });
}

/** Sum food items into a MacroSet total (used in the meal edit screen). */
export function sumItems(
  items: { calories: number; protein_g: number; carbohydrates_g: number; fat_g: number; fiber_g: number }[],
): MacroSet {
  return items.reduce<MacroSet>(
    (acc, it) => ({
      calories: acc.calories + (it.calories || 0),
      protein_g: acc.protein_g + (it.protein_g || 0),
      carbs_g: acc.carbs_g + (it.carbohydrates_g || 0),
      fat_g: acc.fat_g + (it.fat_g || 0),
      fiber_g: acc.fiber_g + (it.fiber_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );
}
