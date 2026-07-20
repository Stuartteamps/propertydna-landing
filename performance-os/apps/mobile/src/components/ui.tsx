import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../theme/colors";

/** Premium-feeling card container. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`rounded-3xl p-5 bg-card-light dark:bg-card-dark ${className}`}>{children}</View>
  );
}

/** Large, readable metric value with a caption. */
export function Stat({
  label,
  value,
  unit,
  accessibilityLabel,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} className="flex-1">
      <Text className="text-xs uppercase tracking-wide text-subtle-light dark:text-subtle-dark">
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text className="text-3xl font-bold text-text-light dark:text-text-dark">{value}</Text>
        {unit ? (
          <Text className="ml-1 text-sm text-subtle-light dark:text-subtle-dark">{unit}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`rounded-2xl px-5 py-4 items-center justify-center ${
        primary ? "bg-accent" : "border border-border-light dark:border-border-dark"
      } ${disabled || loading ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={primary ? "#fff" : colors.accent} />
      ) : (
        <Text className={`font-semibold ${primary ? "text-white" : "text-accent"}`}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Readiness ring — SVG progress ring with the score inside. */
export function ScoreRing({
  score,
  band,
  size = 168,
}: {
  score: number | null;
  band: string;
  size?: number;
}) {
  // Lazy-require react-native-svg so this file is importable in non-native tests.
  const Svg = require("react-native-svg");
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(1, score / 100));
  const color = colors.readiness[(band as keyof typeof colors.readiness) ?? "unknown"] ?? colors.readiness.unknown;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg.Svg width={size} height={size}>
        <Svg.Circle cx={size / 2} cy={size / 2} r={r} stroke="#8A94A633" strokeWidth={stroke} fill="none" />
        <Svg.Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg.Svg>
      <View className="absolute items-center">
        <Text className="text-5xl font-bold text-text-light dark:text-text-dark">
          {score === null ? "—" : score}
        </Text>
        <Text className="text-xs uppercase tracking-widest text-subtle-light dark:text-subtle-dark">
          readiness
        </Text>
      </View>
    </View>
  );
}

/** Horizontal macro progress bar. */
export function MacroBar({
  label,
  consumed,
  target,
  pct,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  pct: number;
  unit: string;
  color: string;
}) {
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-text-light dark:text-text-dark">{label}</Text>
        <Text className="text-sm text-subtle-light dark:text-subtle-dark">
          {Math.round(consumed)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-border-light dark:bg-border-dark overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-2 rounded-full" />
      </View>
    </View>
  );
}

export function Skeleton({ height = 80 }: { height?: number }) {
  return <View style={{ height }} className="rounded-3xl bg-border-light dark:bg-border-dark opacity-60 mb-3" />;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="items-center">
      <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-1">{title}</Text>
      <Text className="text-sm text-center text-subtle-light dark:text-subtle-dark">{message}</Text>
    </Card>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-lg font-bold text-text-light dark:text-text-dark mt-6 mb-2">{children}</Text>
  );
}
