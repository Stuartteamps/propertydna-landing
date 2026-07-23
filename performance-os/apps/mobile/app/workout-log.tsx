import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, SectionTitle } from "../src/components/ui";
import { useAuth } from "../src/store/auth";

type Mode = "strength" | "run";
interface SetRow { exercise_name: string; reps: string; load_kg: string; rpe: string; is_pr: boolean }

const emptySet = (): SetRow => ({ exercise_name: "", reps: "", load_kg: "", rpe: "", is_pr: false });

const input =
  "rounded-xl px-3 py-2 bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark " +
  "border border-border-light dark:border-border-dark";

export default function WorkoutLog() {
  const { api } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("strength");
  const [title, setTitle] = useState("");
  const [sets, setSets] = useState<SetRow[]>([emptySet()]);
  const [run, setRun] = useState({ distance_km: "", duration_min: "", avg_hr: "", zone2_min: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editSet = (i: number, k: keyof SetRow, v: string | boolean) =>
    setSets((s) => s.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "strength") {
        const payloadSets = sets
          .filter((s) => s.exercise_name.trim())
          .map((s, idx) => ({
            exercise_name: s.exercise_name.trim(),
            set_number: idx + 1,
            reps: s.reps ? Number(s.reps) : null,
            load_kg: s.load_kg ? Number(s.load_kg) : null,
            rpe: s.rpe ? Number(s.rpe) : null,
            is_pr: s.is_pr,
          }));
        if (!payloadSets.length) throw new Error("Add at least one exercise");
        await api.createWorkout({ type: "strength", title: title || "Strength", sets: payloadSets });
      } else {
        await api.createWorkout({
          type: "running",
          title: title || "Run",
          run: {
            distance_km: run.distance_km ? Number(run.distance_km) : null,
            duration_min: run.duration_min ? Number(run.duration_min) : null,
            avg_hr: run.avg_hr ? Number(run.avg_hr) : null,
            zone2_min: run.zone2_min ? Number(run.zone2_min) : null,
          },
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16 pb-10">
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-3">Log workout</Text>

      {/* Mode toggle */}
      <View className="flex-row rounded-2xl overflow-hidden border border-border-light dark:border-border-dark mb-4">
        {(["strength", "run"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)}
            className={`flex-1 py-3 items-center ${mode === m ? "bg-accent" : ""}`}>
            <Text className={mode === m ? "text-white font-semibold" : "text-text-light dark:text-text-dark"}>
              {m === "strength" ? "Strength" : "Run"}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput className={`${input} mb-3`} placeholder="Title (optional)" placeholderTextColor="#8A94A6"
        value={title} onChangeText={setTitle} />

      {mode === "strength" ? (
        <>
          <SectionTitle>Sets</SectionTitle>
          {sets.map((s, i) => (
            <Card key={i} className="mb-2">
              <TextInput className={`${input} mb-2`} placeholder="Exercise" placeholderTextColor="#8A94A6"
                value={s.exercise_name} onChangeText={(v) => editSet(i, "exercise_name", v)} />
              <View className="flex-row gap-2">
                <TextInput className={`${input} flex-1`} placeholder="Reps" placeholderTextColor="#8A94A6"
                  keyboardType="numeric" value={s.reps} onChangeText={(v) => editSet(i, "reps", v)} />
                <TextInput className={`${input} flex-1`} placeholder="kg" placeholderTextColor="#8A94A6"
                  keyboardType="numeric" value={s.load_kg} onChangeText={(v) => editSet(i, "load_kg", v)} />
                <TextInput className={`${input} flex-1`} placeholder="RPE" placeholderTextColor="#8A94A6"
                  keyboardType="numeric" value={s.rpe} onChangeText={(v) => editSet(i, "rpe", v)} />
              </View>
              <Pressable onPress={() => editSet(i, "is_pr", !s.is_pr)} className="mt-2">
                <Text className={s.is_pr ? "text-readiness-green" : "text-subtle-light dark:text-subtle-dark"}>
                  {s.is_pr ? "★ PR" : "☆ Mark PR"}
                </Text>
              </Pressable>
            </Card>
          ))}
          <Button title="+ Add set" variant="ghost" onPress={() => setSets((s) => [...s, emptySet()])} />
        </>
      ) : (
        <Card>
          <View className="flex-row gap-2 mb-2">
            <TextInput className={`${input} flex-1`} placeholder="Distance km" placeholderTextColor="#8A94A6"
              keyboardType="numeric" value={run.distance_km}
              onChangeText={(v) => setRun({ ...run, distance_km: v })} />
            <TextInput className={`${input} flex-1`} placeholder="Duration min" placeholderTextColor="#8A94A6"
              keyboardType="numeric" value={run.duration_min}
              onChangeText={(v) => setRun({ ...run, duration_min: v })} />
          </View>
          <View className="flex-row gap-2">
            <TextInput className={`${input} flex-1`} placeholder="Avg HR" placeholderTextColor="#8A94A6"
              keyboardType="numeric" value={run.avg_hr} onChangeText={(v) => setRun({ ...run, avg_hr: v })} />
            <TextInput className={`${input} flex-1`} placeholder="Zone 2 min" placeholderTextColor="#8A94A6"
              keyboardType="numeric" value={run.zone2_min}
              onChangeText={(v) => setRun({ ...run, zone2_min: v })} />
          </View>
        </Card>
      )}

      {error ? <Text className="text-readiness-red mt-3">{error}</Text> : null}
      <View className="mt-5">
        <Button title="Save workout" onPress={save} loading={busy} />
      </View>
    </ScrollView>
  );
}
