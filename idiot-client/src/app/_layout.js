import { ContextProvider } from "@/src/providers/contextModule";
import {
  Exo2_400Regular,
  Exo2_700Bold,
  useFonts,
} from "@expo-google-fonts/exo-2";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";
import SmartProvider from "../providers/smartProvider";

export default function RootLayout() {
  useFonts({
    Exo2_400Regular,
    Exo2_700Bold,
  });

  return (
    <React.Fragment>
      <SmartProvider>
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
      </SmartProvider>
    </React.Fragment>
  );
}
