import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Card, EmptyState, SectionTitle, Skeleton } from "../../src/components/ui";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/store/auth";

type Point = { date: string; value: number };

const METRICS: { key: string; label: string; color: string }[] = [
  { key: "readiness", label: "Readiness", color: colors.readiness.green },
  { key: "hrv", label: "HRV (ms)", color: colors.accent },
  { key: "sleep", label: "Sleep (h)", color: "#8A6BFF" },
  { key: "resting_hr", label: "Resting HR", color: colors.readiness.red },
];

function Sparkline({ points, color }: { points: Point[]; color: string }) {
  if (points.length < 2) return <Text className="text-subtle-light dark:text-subtle-dark text-sm">Not enough data</Text>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View className="flex-row items-end h-16 gap-[2px]">
      {points.map((p, i) => {
        const h = 8 + ((p.value - min) / range) * 48;
        return <View key={i} style={{ height: h, backgroundColor: color, width: 6 }} className="rounded-sm" />;
      })}
    </View>
  );
}

export default function Trends() {
  const { api } = useAuth();
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const results = await Promise.all(METRICS.map((m) => api.trendSeries(m.key, 30)));
    const map: Record<string, Point[]> = {};
    METRICS.forEach((m, i) => (map[m.key] = results[i].points));
    setSeries(map);
    setReport(await api.weeklyReport().catch(() => null));
    setLoading(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <ScrollView className="flex-1 bg-bg-light dark:bg-bg-dark" contentContainerClassName="px-5 pt-16">
        <Skeleton height={100} />
        <Skeleton height={100} />
      </ScrollView>
    );
  }

  const improved = (report?.improved as string[]) ?? [];
  const priorities = (report?.priorities_next_week as string[]) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-bg-light dark:bg-bg-dark"
      contentContainerClassName="px-5 pt-16 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text className="text-2xl font-bold text-text-light dark:text-text-dark mb-3">Trends</Text>

      {METRICS.map((m) => (
        <Card key={m.key} className="mb-3">
          <Text className="text-sm font-semibold text-text-light dark:text-text-dark mb-2">{m.label}</Text>
          <Sparkline points={series[m.key] ?? []} color={m.color} />
        </Card>
      ))}

      <SectionTitle>Weekly report</SectionTitle>
      {report ? (
        <Card>
          {improved.length > 0 ? (
            <>
              <Text className="text-sm font-semibold text-readiness-green mb-1">Improved</Text>
              {improved.map((s, i) => (
                <Text key={i} className="text-sm text-subtle-light dark:text-subtle-dark">• {s}</Text>
              ))}
            </>
          ) : null}
          {priorities.length > 0 ? (
            <>
              <Text className="text-sm font-semibold text-accent mt-3 mb-1">Next week</Text>
              {priorities.map((s, i) => (
                <Text key={i} className="text-sm text-subtle-light dark:text-subtle-dark">• {s}</Text>
              ))}
            </>
          ) : null}
          {report.summary ? (
            <Text className="text-sm text-text-light dark:text-text-dark mt-3">{String(report.summary)}</Text>
          ) : null}
        </Card>
      ) : (
        <EmptyState title="No report yet" message="Log a few days of data to unlock your weekly report." />
      )}
    </ScrollView>
  );
}
