import { useState, useRef, useCallback, useEffect } from 'react';
import * as EncryptedStorage from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatTimestamp(unixTimestamp) {
  const now = new Date();
  const messageDate = new Date(unixTimestamp * 1000); // Convert from seconds to milliseconds

  const diffMs = now - messageDate;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";

  // Return formatted date (e.g. 03/Jul or 03/Jul/2025 if not same year)
  const day = messageDate.getDate();
  const month = messageDate.toLocaleString("default", { month: "short" });
  const year = messageDate.getFullYear();

  const showYear = year !== now.getFullYear();
  return `${day}/${month}${showYear ? "/" + year : ""}`;
}


export function useStateAsync(initialValue) {
  const [state, setState] = useState(initialValue);
  const resolverRef = useRef(null);

  const asyncSetState = useCallback((newValue) => {
    setState(newValue);
    return new Promise(resolve => {
      resolverRef.current = resolve;
    });
  }, []);

  // Resolve the promise after state updates
  useEffect(() => {
    if (resolverRef.current) {
      resolverRef.current(state);
      resolverRef.current = null;
    }
  }, [state]);

  return [state, asyncSetState];
}

export async function getAsyncStorageValue(label) {
  try {
    const session = await AsyncStorage.getItem("General");
    if (label in JSON.parse(session)) {
      return JSON.parse(session)[label];
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

export async function setAsyncStorageValue(value) {
  const session = await AsyncStorage.getItem("General");
  await AsyncStorage.setItem(
    "General",
    JSON.stringify({
      ...JSON.parse(session),
      ...value,
    })
  );
}

export async function getEncryptedStorageValue(label) {
  try {
    const session = await EncryptedStorage.getItem("General");
    if (label in JSON.parse(session)) {
      return JSON.parse(session)[label];
    } else {
      return null;
    }
  } catch {
    try {
      const session = await AsyncStorage.getItem("GeneralBackup");
      if (label in JSON.parse(session)) {
        return JSON.parse(session)[label];
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
}

export async function setEncryptedStorageValue(value) {
  try {
    const session = await EncryptedStorage.getItem("General");
    await EncryptedStorage.setItem(
      "General",
      JSON.stringify({
        ...JSON.parse(session),
        ...value,
      })
    );
  } catch {
    const session = await AsyncStorage.getItem("GeneralBackup");
    await AsyncStorage.setItem(
      "GeneralBackup",
      JSON.stringify({
        ...JSON.parse(session),
        ...value,
      })
    );
  }
}

export async function clearStorage() {
  await AsyncStorage.clear();
  try {
    await EncryptedStorage.clear();
  } catch {
    //console.log("EncryptedStorage not available");
  }
}
