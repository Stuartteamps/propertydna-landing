import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { Dashboard } from "../../src/api/types";
import { Button, Card, EmptyState, MacroBar, SectionTitle, Skeleton, Stat } from "../../src/components/ui";
import { macroColors } from "../../src/theme/colors";
import { macroProgress } from "../../src/lib/nutrition";
import { fmtNum } from "../../src/lib/format";
import { useAuth } from "../../src/store/auth";

interface MealRow {
  id: string;
  name: string | null;
  meal_type: string;
  overall_confidence: number | null;
  items: { name: string }[];
}

export default function Nutrition() {
  const { api } = useAuth();
  const router = useRouter();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [d, m] = await Promise.all([api.getDashboard(), api.listMeals()]);
    setDash(d);
    setMeals((m.meals as MealRow[]) ?? []);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !dash) {
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16">
        <Skeleton height={160} />
        <Skeleton height={100} />
      </ScrollView>
    );
  }

  const macros = macroProgress(dash.nutrition.targets, dash.nutrition.consumed);
  const t = dash.nutrition.targets;

  return (
    <ScrollView
      className="flex-1 bg-bg-light dark:bg-bg-dark"
      contentContainerClassName="px-5 pt-16 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-3">Nutrition</Text>

      <Card>
        <View className="flex-row mb-3">
          <Stat label="Target" value={fmtNum(t.calories)} unit="kcal" />
          <Stat label="Protein" value={fmtNum(t.protein_g)} unit="g" />
          <Stat label="Water" value={fmtNum(t.hydration_ml)} unit="ml" />
        </View>
        {macros.map((m) => (
          <MacroBar key={m.key} label={m.label} consumed={m.consumed} target={m.target} pct={m.pct} unit={m.unit} color={macroColors[m.key] ?? "#3E7BFA"} />
        ))}
        <View className="mt-2">
          <Button title="Photograph a meal" onPress={() => router.push("/meal-camera")} />
        </View>
      </Card>

      <SectionTitle>Today's meals</SectionTitle>
      {meals.length === 0 ? (
        <EmptyState title="No meals yet" message="Snap a photo of your next meal to log it automatically." />
      ) : (
        meals.map((m) => (
          <Card key={m.id} className="mb-2">
            <View className="flex-row justify-between">
              <Text className="font-semibold text-text-light dark:text-text-dark">
                {m.name ?? m.meal_type}
              </Text>
              {m.overall_confidence != null ? (
                <Text className="text-xs text-subtle-light dark:text-subtle-dark">
                  est · {Math.round(m.overall_confidence * 100)}%
                </Text>
              ) : null}
            </View>
            <Text className="text-sm text-subtle-light dark:text-subtle-dark">
              {m.items.map((i) => i.name).join(", ")}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
