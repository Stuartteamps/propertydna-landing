// Shared API response/request shapes (kept in sync with apps/api schemas).

export type ReadinessBand = "green" | "yellow" | "red" | "unknown";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  onboarded: boolean;
}

export interface MacroSet {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  hydration_ml?: number;
}

export interface FoodItem {
  name: string;
  estimated_quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: number;
}

export interface FoodAnalysis {
  meal_name: string;
  meal_type: string;
  items: FoodItem[];
  totals: MacroSet & Record<string, number>;
  assumptions: string[];
  overall_confidence: number;
  is_estimate: boolean;
}

export interface Dashboard {
  date: string;
  greeting_name: string | null;
  readiness: {
    score: number | null;
    band: ReadinessBand;
    explanation: string[];
    data_completeness: number;
  };
  recovery: {
    sleep_hours: number | null;
    sleep_quality: number | null;
    hrv: number | null;
    hrv_baseline: number | null;
    resting_hr: number | null;
  };
  nutrition: {
    targets: MacroSet;
    consumed: MacroSet;
    remaining: MacroSet;
  };
  workout: {
    id: string;
    type: string;
    title: string | null;
    duration_min: number | null;
    confirmed: boolean;
  } | null;
  morning_routine: {
    id: string;
    intensity: string;
    duration_min: number;
    completed: boolean;
    is_deload: boolean;
  };
  recommendations: Record<string, string>;
  coach_message: string;
  alerts: { level: string; title: string; message: string }[];
  disclaimer: string;
}

export interface RoutineExercise {
  block: "warmup" | "main" | "mobility" | "cooldown";
  name: string;
  prescription: string;
  substitution: string | null;
}

export interface Routine {
  id: string;
  date: string;
  progression_week: number;
  is_deload: boolean;
  intensity_target: string;
  total_duration_min: number;
  completed: boolean;
  exercises: RoutineExercise[];
}
