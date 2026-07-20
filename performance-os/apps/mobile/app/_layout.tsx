import "../global.css";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Slot, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../src/store/auth";

function Gate() {
  const { token, onboarded, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-light dark:bg-bg-dark">
        <ActivityIndicator />
      </View>
    );
  }

  const inAuth = pathname?.startsWith("/login") || pathname?.startsWith("/onboarding");
  if (!token && !inAuth) return <Redirect href="/login" />;
  if (token && !onboarded && pathname !== "/onboarding") return <Redirect href="/onboarding" />;
  if (token && onboarded && inAuth) return <Redirect href="/" />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
