export const colors = {
  bg: { light: "#F5F7FA", dark: "#0B0F14" },
  card: { light: "#FFFFFF", dark: "#151B23" },
  text: { light: "#0B0F14", dark: "#F5F7FA" },
  subtle: { light: "#5B6472", dark: "#8A94A6" },
  border: { light: "#E4E8EE", dark: "#232B36" },
  readiness: { green: "#2FBF71", yellow: "#F5B301", red: "#E5484D", unknown: "#8A94A6" },
  accent: "#3E7BFA",
} as const;

export const macroColors: Record<string, string> = {
  calories: "#3E7BFA",
  protein_g: "#2FBF71",
  carbs_g: "#F5B301",
  fat_g: "#E5484D",
  fiber_g: "#8A6BFF",
};
