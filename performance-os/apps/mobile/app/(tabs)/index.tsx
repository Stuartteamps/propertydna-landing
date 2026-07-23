import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { Dashboard } from "../../src/api/types";
import {
  Button,
  Card,
  EmptyState,
  MacroBar,
  ScoreRing,
  SectionTitle,
  Skeleton,
  Stat,
} from "../../src/components/ui";
import { macroColors } from "../../src/theme/colors";
import { macroProgress } from "../../src/lib/nutrition";
import { fmtHours, fmtNum } from "../../src/lib/format";
import { readinessLabel } from "../../src/lib/readiness";
import { useAuth } from "../../src/store/auth";

export default function Today() {
  const { api } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.getDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your day");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16">
        <Skeleton height={200} />
        <Skeleton height={120} />
        <Skeleton height={120} />
      </ScrollView>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-bg-light dark:bg-bg-dark px-5 pt-24">
        <EmptyState title="Offline or unavailable" message={error ?? "No data yet."} />
        <View className="mt-4">
          <Button title="Retry" onPress={load} />
        </View>
      </View>
    );
  }

  const macros = macroProgress(data.nutrition.targets, data.nutrition.consumed);

  return (
    <ScrollView
      className="flex-1 bg-bg-light dark:bg-bg-dark"
      contentContainerClassName="px-5 pt-16 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark">
        {data.greeting_name ? `Good morning, ${data.greeting_name}` : "Today"}
      </Text>
      <Text className="text-subtle-light dark:text-subtle-dark mb-4">{data.date}</Text>

      {/* Readiness */}
      <Card className="items-center">
        <ScoreRing score={data.readiness.score} band={data.readiness.band} />
        <Text className="text-base font-semibold mt-2 text-text-light dark:text-text-dark">
          {readinessLabel(data.readiness.band)}
        </Text>
        {data.readiness.explanation.slice(0, 2).map((e, i) => (
          <Text key={i} className="text-sm text-center text-subtle-light dark:text-subtle-dark mt-1">
            {e}
          </Text>
        ))}
        {data.readiness.data_completeness < 0.4 ? (
          <Text className="text-xs text-readiness-yellow mt-2">Limited data — connect Apple Health</Text>
        ) : null}
      </Card>

      {/* Coach message */}
      <Card className="mt-3">
        <Text className="text-xs uppercase tracking-wide text-subtle-light dark:text-subtle-dark mb-1">
          Coach
        </Text>
        <Text className="text-base text-text-light dark:text-text-dark">{data.coach_message}</Text>
      </Card>

      {/* Recovery snapshot */}
      <SectionTitle>Recovery</SectionTitle>
      <Card>
        <View className="flex-row">
          <Stat label="Sleep" value={fmtHours(data.recovery.sleep_hours)} />
          <Stat label="HRV" value={fmtNum(data.recovery.hrv)} unit="ms" />
          <Stat label="Rest HR" value={fmtNum(data.recovery.resting_hr)} unit="bpm" />
        </View>
      </Card>

      {/* Nutrition */}
      <SectionTitle>Fuel</SectionTitle>
      <Card>
        {macros.map((m) => (
          <MacroBar
            key={m.key}
            label={m.label}
            consumed={m.consumed}
            target={m.target}
            pct={m.pct}
            unit={m.unit}
            color={macroColors[m.key] ?? "#3E7BFA"}
          />
        ))}
        <View className="mt-2">
          <Button title="Log a meal (photo)" onPress={() => router.push("/meal-camera")} />
        </View>
      </Card>

      {/* Today's plan */}
      <SectionTitle>Plan</SectionTitle>
      <Card>
        <Text className="text-base font-semibold text-text-light dark:text-text-dark">
          {data.workout ? data.workout.title ?? data.workout.type : "No scheduled workout"}
        </Text>
        {data.workout?.duration_min ? (
          <Text className="text-subtle-light dark:text-subtle-dark">{data.workout.duration_min} min</Text>
        ) : null}
        <View className="mt-3">
          <Button
            title={
              data.morning_routine.completed
                ? "Morning routine ✓ complete"
                : `10-min morning routine (${data.morning_routine.intensity})`
            }
            variant={data.morning_routine.completed ? "ghost" : "primary"}
            onPress={() => router.push("/routine")}
          />
        </View>
      </Card>

      {/* Journal */}
      <SectionTitle>Reflect</SectionTitle>
      <Card>
        <Text className="text-sm text-subtle-light dark:text-subtle-dark mb-3">
          A one-minute check-in sharpens tomorrow's readiness read.
        </Text>
        <Button title="Journal entry" variant="ghost" onPress={() => router.push("/journal")} />
      </Card>

      {/* Recommendations */}
      <SectionTitle>Recovery tools</SectionTitle>
      <Card>
        {Object.entries(data.recommendations).map(([k, v]) => (
          <View key={k} className="mb-2">
            <Text className="text-sm font-semibold capitalize text-text-light dark:text-text-dark">
              {k.replace(/_/g, " ")}
            </Text>
            <Text className="text-sm text-subtle-light dark:text-subtle-dark">{v}</Text>
          </View>
        ))}
      </Card>

      {/* Alerts */}
      {data.alerts.length > 0 ? (
        <>
          <SectionTitle>Attention</SectionTitle>
          {data.alerts.map((a, i) => (
            <Card key={i} className="mb-2">
              <Text className="font-semibold text-text-light dark:text-text-dark">{a.title}</Text>
              <Text className="text-sm text-subtle-light dark:text-subtle-dark">{a.message}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <Text className="text-[11px] text-center text-subtle-light dark:text-subtle-dark mt-6">
        {data.disclaimer}
      </Text>
    </ScrollView>
  );
}
