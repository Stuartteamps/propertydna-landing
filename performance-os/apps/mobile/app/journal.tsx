import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, SectionTitle } from "../src/components/ui";
import { useAuth } from "../src/store/auth";

const input =
  "rounded-xl px-3 py-3 bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark " +
  "border border-border-light dark:border-border-dark mb-3";

function Scale({ label, value, onChange }: { label: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <View className="mb-4">
      <Text className="text-sm text-text-light dark:text-text-dark mb-2">{label}</Text>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              value === n ? "bg-accent" : "border border-border-light dark:border-border-dark"
            }`}>
            <Text className={value === n ? "text-white font-bold" : "text-text-light dark:text-text-dark"}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Journal() {
  const { api } = useAuth();
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [win, setWin] = useState("");
  const [challenge, setChallenge] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Prefill from today's entry if it exists (upsert edits rather than duplicates).
  useEffect(() => {
    (async () => {
      const res = await api.request<{ entries: any[] }>("/journal?days=1&limit=1").catch(() => null);
      const e = res?.entries?.[0];
      if (e) {
        setMood(e.mood); setEnergy(e.energy); setStress(e.stress); setSoreness(e.soreness);
        setGratitude(e.gratitude ?? ""); setWin(e.daily_win ?? "");
        setChallenge(e.daily_challenge ?? ""); setNotes(e.notes ?? "");
      }
    })();
  }, [api]);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveJournal({
        mood, energy, stress, soreness,
        gratitude: gratitude || null, daily_win: win || null,
        daily_challenge: challenge || null, notes: notes || null,
      });
      setSaved(true);
      setTimeout(() => router.back(), 350);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16 pb-10">
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-1">Journal</Text>
      <Text className="text-subtle-light dark:text-subtle-dark mb-4">Takes under a minute.</Text>

      <Card>
        <Scale label="Mood" value={mood} onChange={setMood} />
        <Scale label="Energy" value={energy} onChange={setEnergy} />
        <Scale label="Stress" value={stress} onChange={setStress} />
        <Scale label="Soreness" value={soreness} onChange={setSoreness} />
      </Card>

      <SectionTitle>Reflections (optional)</SectionTitle>
      <TextInput className={input} placeholder="Grateful for…" placeholderTextColor="#8A94A6"
        value={gratitude} onChangeText={setGratitude} />
      <TextInput className={input} placeholder="Today's win" placeholderTextColor="#8A94A6"
        value={win} onChangeText={setWin} />
      <TextInput className={input} placeholder="Today's challenge" placeholderTextColor="#8A94A6"
        value={challenge} onChangeText={setChallenge} />
      <TextInput className={`${input} h-24`} placeholder="Notes" placeholderTextColor="#8A94A6"
        multiline value={notes} onChangeText={setNotes} />

      <Button title={saved ? "Saved ✓" : "Save entry"} onPress={save} loading={busy} />
      <Text className="text-[11px] text-center text-subtle-light dark:text-subtle-dark mt-4">
        Reflective only — not a mental-health assessment.
      </Text>
    </ScrollView>
  );
}
