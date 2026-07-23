import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, EmptyState, SectionTitle, Skeleton, Stat } from "../../src/components/ui";
import { useAuth } from "../../src/store/auth";

interface WorkoutRow {
  id: string;
  type: string;
  title: string | null;
  started_at: string;
  duration_min: number | null;
  source: string;
  confirmed: boolean;
  sets: { exercise: string; reps: number | null; load_kg: number | null; is_pr: boolean }[];
  run: { distance_km: number | null } | null;
}

export default function Training() {
  const { api } = useAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [weekly, setWeekly] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([api.listWorkouts(), api.weeklyTraining()]);
    setWorkouts((w.workouts as WorkoutRow[]) ?? []);
    setWeekly(s);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const importCalendar = async () => {
    await api.connect("google_calendar").catch(() => undefined);
    await api.importCalendar(7);
    await load();
  };

  if (loading) {
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16">
        <Skeleton height={120} />
        <Skeleton height={100} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-bg-light dark:bg-bg-dark"
      contentContainerClassName="px-5 pt-16 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-3">Training</Text>

      {weekly ? (
        <Card>
          <Text className="text-xs uppercase tracking-wide text-subtle-light dark:text-subtle-dark mb-2">
            This week
          </Text>
          <View className="flex-row mb-2">
            <Stat label="Sessions" value={weekly.sessions ?? 0} />
            <Stat label="Run km" value={weekly.running_km ?? 0} />
            <Stat label="Zone 2" value={weekly.zone2_min ?? 0} unit="min" />
          </View>
          <View className="flex-row">
            <Stat label="Volume" value={weekly.strength_volume_kg ?? 0} unit="kg" />
            <Stat label="PRs" value={weekly.personal_records ?? 0} />
            <Stat label="Days" value={weekly.training_days ?? 0} />
          </View>
        </Card>
      ) : null}

      <View className="mt-3">
        <Button title="Log workout" onPress={() => router.push("/workout-log")} />
      </View>
      <View className="mt-2">
        <Button title="Import from Google Calendar" variant="ghost" onPress={importCalendar} />
      </View>

      <SectionTitle>Recent workouts</SectionTitle>
      {workouts.length === 0 ? (
        <EmptyState title="No workouts yet" message="Import your calendar or log a session to get started." />
      ) : (
        workouts.slice(0, 20).map((w) => (
          <Card key={w.id} className="mb-2">
            <View className="flex-row justify-between">
              <Text className="font-semibold text-text-light dark:text-text-dark">
                {w.title ?? w.type}
              </Text>
              <Text className="text-xs text-subtle-light dark:text-subtle-dark">{w.source}</Text>
            </View>
            <Text className="text-sm text-subtle-light dark:text-subtle-dark">
              {new Date(w.started_at).toLocaleDateString()} · {w.duration_min ?? "—"} min
              {w.run?.distance_km ? ` · ${w.run.distance_km} km` : ""}
              {!w.confirmed ? " · unconfirmed" : ""}
            </Text>
            {w.sets.some((s) => s.is_pr) ? (
              <Text className="text-xs text-readiness-green mt-1">🏆 New PR logged</Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
