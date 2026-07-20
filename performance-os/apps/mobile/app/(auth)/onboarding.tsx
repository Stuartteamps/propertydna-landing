import React, { useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, SectionTitle } from "../../src/components/ui";
import { useAuth } from "../../src/store/auth";

const OBJECTIVES = [
  "fat_loss",
  "muscle_gain",
  "recomposition",
  "endurance",
  "strength",
  "longevity",
  "general_health",
  "athletic_performance",
];

export default function Onboarding() {
  const { api, setOnboarded } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("Alex");
  const [dob, setDob] = useState("1983-04-12");
  const [sex, setSex] = useState("male");
  const [heightCm, setHeightCm] = useState("185");
  const [weightKg, setWeightKg] = useState("86");
  const [goalWeightKg, setGoalWeightKg] = useState("84");
  const [experience, setExperience] = useState("advanced");
  const [selected, setSelected] = useState<string[]>(["longevity", "athletic_performance"]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (o: string) =>
    setSelected((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));

  const submit = async () => {
    if (!consent) {
      setError("Please acknowledge the disclaimer to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitOnboarding({
        name,
        date_of_birth: dob,
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        goal_weight_kg: Number(goalWeightKg),
        training_experience: experience,
        weekly_training_days: 6,
        wake_time: "05:00",
        bedtime: "21:30",
        units: "imperial",
        goals: selected.map((o, i) => ({ objective: o, priority: i + 1 })),
        supplements: ["Creatine", "Vitamin D3", "Omega-3"],
        consent_accepted: true,
      });
      setOnboarded(true);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "rounded-2xl px-4 py-3 mb-3 bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark";

  return (
    <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-6 py-16">
      <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-1">Let's set you up</Text>
      <Text className="text-subtle-light dark:text-subtle-dark mb-4">
        A few basics to personalize your targets. You can change these anytime.
      </Text>

      <Card>
        <TextInput className={input} placeholder="Name" placeholderTextColor="#8A94A6" value={name} onChangeText={setName} />
        <TextInput className={input} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor="#8A94A6" value={dob} onChangeText={setDob} />
        <View className="flex-row gap-3">
          <TextInput className={`${input} flex-1`} placeholder="Height cm" placeholderTextColor="#8A94A6" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
          <TextInput className={`${input} flex-1`} placeholder="Weight kg" placeholderTextColor="#8A94A6" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
        </View>
        <TextInput className={input} placeholder="Goal weight kg" placeholderTextColor="#8A94A6" keyboardType="numeric" value={goalWeightKg} onChangeText={setGoalWeightKg} />
      </Card>

      <SectionTitle>Primary objectives</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {OBJECTIVES.map((o) => {
          const on = selected.includes(o);
          return (
            <Text
              key={o}
              onPress={() => toggle(o)}
              className={`px-4 py-2 rounded-full overflow-hidden ${
                on ? "bg-accent text-white" : "border border-border-light dark:border-border-dark text-text-light dark:text-text-dark"
              }`}
            >
              {o.replace(/_/g, " ")}
            </Text>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between mt-8">
        <Text className="flex-1 text-sm text-subtle-light dark:text-subtle-dark pr-3">
          I understand Arete is for education & wellness only and does not provide medical advice.
        </Text>
        <Switch value={consent} onValueChange={setConsent} />
      </View>

      {error ? <Text className="text-readiness-red mt-3">{error}</Text> : null}
      <View className="mt-6">
        <Button title="Finish setup" onPress={submit} loading={busy} />
      </View>
    </ScrollView>
  );
}
