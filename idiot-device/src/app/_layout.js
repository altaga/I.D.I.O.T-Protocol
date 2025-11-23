import { ContextProvider } from "@/src/providers/contextModule";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <React.Fragment>
      <ContextProvider>
        <Stack
          initialRouteName="index"
          screenOptions={{
            animation: "simple_push",
            headerShown: false,
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
        <StatusBar style="auto" />
      </ContextProvider>
    </React.Fragment>
  );
}
