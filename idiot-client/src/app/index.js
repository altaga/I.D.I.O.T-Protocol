import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import GlobalStyles, { mainColor } from "../core/styles";
import {
  formatTimestamp,
  getEncryptedStorageValue,
  useStateAsync,
} from "../core/utils";
import { TextInput } from 'react-native-paper';
import ContextModule from "../providers/contextModule";

export default function Tab4() {
  const context = React.useContext(ContextModule);
  const scrollView = useRef(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputHeight, setInputHeight] = useStateAsync("auto");

  async function chatWithAgent(message) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const user = await getEncryptedStorageValue("user");
    const raw = JSON.stringify({
      message,
      context: {
        address: context.value.address,
        user,
      },
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch("/api/chatWithAgent", requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch(() => resolve(null));
    });
  }

  function responseModifier(response) {
    let temp = response;
    if (temp["last_tool"] === "any_tool") {
    }
    return temp;
  }

  const sendMessage = useCallback(async () => {
    setLoading(true);
    const userMessage = message;
    setMessage("");
    let temp = [...context.value.chatGeneral];
    temp.push({
      message: userMessage,
      type: "user",
      time: Date.now(),
      tool: "",
    });
    context.setValue({
      chatGeneral: temp,
    });
    scrollView.current.scrollToEnd({ animated: true });
    const response = await chatWithAgent(message);
    const finalResponse = responseModifier(response);
    temp.push({
      message: finalResponse.message,
      type: "system",
      time: Date.now(),
      tool: response["last_tool"],
    });
    context.setValue({
      chatGeneral: temp,
    });
    setLoading(false);
    setTimeout(() => scrollView.current.scrollToEnd({ animated: true }), 100);
  }, [scrollView, context, message, setMessage, setLoading]);

  return (
    <SafeAreaView style={[GlobalStyles.container]}>
      <ScrollView
        ref={(view) => {
          scrollView.current = view;
        }}
        showsVerticalScrollIndicator={false}
        style={[GlobalStyles.scrollContainer]}
        contentContainerStyle={[
          GlobalStyles.scrollContainerContent,
          {
            width: "90%",
            height: "auto",
            alignSelf: "center",
            gap: 0,
          },
        ]}
      >
        {context.value.chatGeneral.map((item, index, array) => (
          <LinearGradient
            angle={90}
            useAngle={true}
            key={`Message:${index}`}
            style={[
              {
                borderRadius: 10,
                borderBottomRightRadius: item.type === "user" ? 0 : 10,
                borderBottomLeftRadius: item.type === "user" ? 10 : 0,
                paddingHorizontal: 16,
                paddingVertical: 10,
                maxWidth: "80%",
                alignSelf: item.type === "user" ? "flex-end" : "flex-start",
              },
              index !== 0 && array[index - 1].type !== item.type
                ? { marginTop: 16 }
                : { marginTop: 5 },
            ]}
            colors={[
              item.type === "user" ? mainColor + "cc" : mainColor + "40",
              item.type === "user" ? mainColor + "cc" : mainColor + "40",
            ]}
          >
            <Text
              style={{
                color: "white",
                textAlign: "justify",
                marginBottom: 10,
                fontSize: 16,
              }}
            >
              {item.message}
            </Text>
            <Text
              style={{
                color: "#cccccc",
                alignSelf: "flex-end",
                fontSize: 12,
                marginRight: -5,
                marginBottom: -5,
              }}
            >
              {formatTimestamp(item.time)}
            </Text>
          </LinearGradient>
        ))}
      </ScrollView>
      <View
        style={[
          {
            height: "auto",
            width: "94%",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginVertical: 10,
          },
        ]}
      >
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={1}
          style={{
            width: "84%",
            fontSize: 24,
            outlineStyle:"solid",
            outlineColor: mainColor,
            borderRadius: 10,
          }}
          dense={true}
        />
        <Pressable
          onPress={sendMessage}
          disabled={message.length <= 0 || loading}
          style={[
            {
              width: "10%",
              height: "auto",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: mainColor,
              borderRadius: 50,
              aspectRatio: 1,
              padding: 20,
            },
            message.length <= 0 || loading ? { opacity: 0.5 } : {},
          ]}
        >
          {loading ? (
            <ActivityIndicator size={22} color="white" />
          ) : (
            <Ionicons name="send" size={22} color="white" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
