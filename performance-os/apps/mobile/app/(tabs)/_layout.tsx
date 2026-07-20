import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors } from "../../src/theme/colors";

function icon(label: string) {
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 20 }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarStyle: { borderTopWidth: 0.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icon("◎") }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition", tabBarIcon: icon("🍽") }} />
      <Tabs.Screen name="training" options={{ title: "Training", tabBarIcon: icon("🏋") }} />
      <Tabs.Screen name="trends" options={{ title: "Trends", tabBarIcon: icon("📈") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
