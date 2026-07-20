import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Button, Card, SectionTitle, Stat } from "../../src/components/ui";
import { requestPermissions, syncHealth } from "../../src/health/appleHealth";
import { useAuth } from "../../src/store/auth";

export default function Profile() {
  const { api, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProfile(await api.getProfile().catch(() => null));
    setIntegrations((await api.integrationStatus().catch(() => ({}))) as Record<string, any>);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const connectHealth = async () => {
    setStatus("Connecting Apple Health…");
    await requestPermissions().catch(() => false);
    await api.connect("apple_health").catch(() => undefined);
    const res = await syncHealth(api, 14);
    setStatus(`Synced ${res.records_imported} Health records.`);
    await load();
  };

  const p = profile?.profile ?? {};
  const goals: { objective: string }[] = profile?.goals ?? [];

  return (
    <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16 pb-10">
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-3">Profile</Text>

      <Card>
        <Text className="text-lg font-semibold text-text-light dark:text-text-dark">{p.name ?? "—"}</Text>
        <View className="flex-row mt-3">
          <Stat label="Weight" value={p.weight_kg ?? "—"} unit="kg" />
          <Stat label="Goal" value={p.goal_weight_kg ?? "—"} unit="kg" />
          <Stat label="Body fat" value={p.body_fat_pct ?? "—"} unit="%" />
        </View>
        {goals.length > 0 ? (
          <Text className="text-sm text-subtle-light dark:text-subtle-dark mt-3">
            Objectives: {goals.map((g) => g.objective.replace(/_/g, " ")).join(", ")}
          </Text>
        ) : null}
      </Card>

      <SectionTitle>Integrations</SectionTitle>
      <Card>
        <View className="flex-row justify-between mb-2">
          <Text className="text-text-light dark:text-text-dark">Apple Health</Text>
          <Text className="text-subtle-light dark:text-subtle-dark">
            {integrations.apple_health?.status ?? "disconnected"}
          </Text>
        </View>
        <View className="flex-row justify-between mb-3">
          <Text className="text-text-light dark:text-text-dark">Google Calendar</Text>
          <Text className="text-subtle-light dark:text-subtle-dark">
            {integrations.google_calendar?.status ?? "disconnected"}
          </Text>
        </View>
        <Button title="Connect & sync Apple Health" onPress={connectHealth} />
        {status ? <Text className="text-sm text-readiness-green mt-2">{status}</Text> : null}
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <Button
          title="Export my data"
          variant="ghost"
          onPress={async () => {
            await api.request("/account/export");
            Alert.alert("Export ready", "Your data export was generated.");
          }}
        />
        <View className="mt-2">
          <Button title="Sign out" variant="ghost" onPress={logout} />
        </View>
      </Card>

      <Text className="text-[11px] text-center text-subtle-light dark:text-subtle-dark mt-6">
        Performance OS is for education & wellness only and is not a substitute for professional
        medical advice.
      </Text>
    </ScrollView>
  );
}
