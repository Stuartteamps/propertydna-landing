import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

import type { FoodAnalysis, FoodItem } from "../src/api/types";
import { Button, Card, SectionTitle } from "../src/components/ui";
import { confidenceLabel } from "../src/lib/format";
import { sumItems } from "../src/lib/nutrition";
import { useAuth } from "../src/store/auth";

export default function MealCamera() {
  const { api } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    setError(null);
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) throw new Error("Could not capture photo");
      const result = await api.analyzeMeal({ uri: photo.uri, type: "image/jpeg" });
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const editItem = (idx: number, field: keyof FoodItem, value: string) => {
    if (!analysis) return;
    const items = analysis.items.map((it, i) =>
      i === idx ? { ...it, [field]: field === "name" ? value : Number(value) || 0 } : it,
    );
    setAnalysis({ ...analysis, items });
  };

  const save = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      const imageId = analysis.assumptions.find((a) => a.startsWith("image_id:"))?.split(":")[1];
      await api.saveMeal({
        name: analysis.meal_name,
        meal_type: analysis.meal_type,
        source: "ai_photo",
        image_id: imageId,
        overall_confidence: analysis.overall_confidence,
        assumptions: analysis.assumptions,
        items: analysis.items,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-bg-dark" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-light dark:bg-bg-dark px-6">
        <Text className="text-text-light dark:text-text-dark text-center mb-4">
          Camera access is needed to photograph meals.
        </Text>
        <Button title="Grant camera access" onPress={requestPermission} />
      </View>
    );
  }

  if (analysis) {
    const totals = sumItems(analysis.items);
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16 pb-10">
        <Text className="text-2xl font-bold text-text-light dark:text-text-dark">{analysis.meal_name}</Text>
        <Text className="text-subtle-light dark:text-subtle-dark mb-1">
          Estimate · {confidenceLabel(analysis.overall_confidence)} confidence
        </Text>
        <Text className="text-xs text-readiness-yellow mb-3">
          AI estimate — tap any value to correct it before saving.
        </Text>

        {analysis.items.map((it, idx) => (
          <Card key={idx} className="mb-2">
            <TextInput
              className="text-base font-semibold text-text-light dark:text-text-dark"
              value={it.name}
              onChangeText={(v) => editItem(idx, "name", v)}
            />
            <View className="flex-row gap-2 mt-2">
              {(["calories", "protein_g", "carbohydrates_g", "fat_g"] as (keyof FoodItem)[]).map((f) => (
                <View key={String(f)} className="flex-1">
                  <Text className="text-[10px] uppercase text-subtle-light dark:text-subtle-dark">
                    {String(f).replace("_g", "").replace("carbohydrates", "carbs")}
                  </Text>
                  <TextInput
                    className="rounded-xl px-2 py-2 bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark"
                    keyboardType="numeric"
                    value={String(it[f])}
                    onChangeText={(v) => editItem(idx, f, v)}
                  />
                </View>
              ))}
            </View>
            <Text className="text-xs text-subtle-light dark:text-subtle-dark mt-1">
              {confidenceLabel(it.confidence)} confidence
            </Text>
          </Card>
        ))}

        <Card className="mb-3">
          <Text className="font-semibold text-text-light dark:text-text-dark">
            Total ~{Math.round(totals.calories)} kcal · {Math.round(totals.protein_g)}g protein
          </Text>
        </Card>
        {error ? <Text className="text-readiness-red mb-2">{error}</Text> : null}
        <Button title="Save meal" onPress={save} loading={busy} />
        <View className="mt-2">
          <Button title="Retake" variant="ghost" onPress={() => setAnalysis(null)} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View className="absolute bottom-0 left-0 right-0 p-8 items-center">
        {error ? <Text className="text-white mb-3">{error}</Text> : null}
        <Button title={busy ? "Analyzing…" : "Capture meal"} onPress={capture} loading={busy} />
      </View>
    </View>
  );
}
