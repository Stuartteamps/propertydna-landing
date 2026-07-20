import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import type { Routine } from "../src/api/types";
import { Button, Card, Skeleton } from "../src/components/ui";
import { mmss } from "../src/lib/format";
import { useAuth } from "../src/store/auth";

const WORK_SECONDS = 40;

export default function RoutineScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setRoutine(await api.getRoutine());
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          return WORK_SECONDS;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  if (!routine) {
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16">
        <Skeleton height={120} />
        <Skeleton height={200} />
      </ScrollView>
    );
  }

  const ex = routine.exercises[idx];
  const isLast = idx >= routine.exercises.length - 1;

  const next = () => {
    setRemaining(WORK_SECONDS);
    Haptics.selectionAsync().catch(() => undefined);
    if (isLast) return;
    setIdx((i) => i + 1);
  };

  const complete = async () => {
    await api.completeRoutine(routine.id).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16 pb-10">
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark">Morning routine</Text>
      <Text className="text-subtle-light dark:text-subtle-dark mb-4">
        Week {routine.progression_week} · {routine.intensity_target}
        {routine.is_deload ? " · deload" : ""} · ~{routine.total_duration_min} min
      </Text>

      <Card className="items-center">
        <Text className="text-xs uppercase tracking-widest text-subtle-light dark:text-subtle-dark">
          {ex.block}
        </Text>
        <Text className="text-2xl font-bold text-text-light dark:text-text-dark my-1 text-center">
          {ex.name}
        </Text>
        <Text className="text-subtle-light dark:text-subtle-dark mb-3">{ex.prescription}</Text>
        <Text className="text-6xl font-bold text-accent mb-4">{mmss(remaining)}</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title={running ? "Pause" : "Start"}
              onPress={() => setRunning((r) => !r)}
            />
          </View>
          <View className="flex-1">
            <Button title={isLast ? "Last one" : "Next"} variant="ghost" onPress={next} />
          </View>
        </View>
        {ex.substitution ? (
          <Text className="text-xs text-subtle-light dark:text-subtle-dark mt-3">
            Easier option: {ex.substitution}
          </Text>
        ) : null}
      </Card>

      <View className="mt-4">
        {routine.exercises.map((e, i) => (
          <View
            key={i}
            className={`flex-row justify-between py-2 border-b border-border-light dark:border-border-dark ${
              i === idx ? "opacity-100" : "opacity-60"
            }`}
          >
            <Text className="text-text-light dark:text-text-dark">
              {i === idx ? "▶ " : ""}
              {e.name}
            </Text>
            <Text className="text-subtle-light dark:text-subtle-dark">{e.prescription}</Text>
          </View>
        ))}
      </View>

      <View className="mt-6">
        <Button title="Mark routine complete" onPress={complete} />
      </View>
    </ScrollView>
  );
}
