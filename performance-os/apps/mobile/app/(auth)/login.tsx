import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { Button, Card } from "../../src/components/ui";
import { useAuth } from "../../src/store/auth";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@arete.app");
  const [password, setPassword] = useState("performance123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "rounded-2xl px-4 py-4 mb-3 bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-bg-light dark:bg-bg-dark"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-text-light dark:text-text-dark mb-1">Arete</Text>
        <Text className="text-base text-subtle-light dark:text-subtle-dark mb-8">
          Your personal health & performance operating system.
        </Text>
        <Card>
          <TextInput
            className={inputCls}
            placeholder="Email"
            placeholderTextColor="#8A94A6"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className={inputCls}
            placeholder="Password"
            placeholderTextColor="#8A94A6"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text className="text-readiness-red mb-3">{error}</Text> : null}
          <Button title={mode === "login" ? "Sign in" : "Create account"} onPress={submit} loading={busy} />
          <View className="items-center mt-4">
            <Text
              onPress={() => setMode(mode === "login" ? "register" : "login")}
              className="text-accent"
            >
              {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
            </Text>
          </View>
        </Card>
        <Text className="text-xs text-center text-subtle-light dark:text-subtle-dark mt-6">
          Demo: demo@arete.app / performance123
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
