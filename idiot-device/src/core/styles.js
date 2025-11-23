import {
  Dimensions,
  PixelRatio,
  Platform,
  StatusBar,
  StyleSheet,
} from "react-native";

const normalizeFontSize = (size) => {
  let { width, height } = Dimensions.get("window");
  if (Platform.OS === "web" && height / width < 1) {
    width /= 2.3179;
    height *= 0.7668;
  }
  const scale = Math.min(width / 375, height / 667); // Based on a standard screen size
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const screenHeight = Dimensions.get("screen").height;
export const windowHeight = Dimensions.get("window").height;
export const mainColor = "#4286F5";
export const secondaryColor = "#F5B142";
export const tertiaryColor = "#F542DF";
export const quaternaryColor = "#42F557";
export const backgroundColor = "#000000";

export const header = 70;
export const footer = 60;
export const ratio =
  Dimensions.get("window").height / Dimensions.get("window").width;
export const main =
  Dimensions.get("window").height -
  (header + footer + (ratio > 1.7 ? 0 : StatusBar.currentHeight));
export const StatusBarHeight = StatusBar.currentHeight;
export const NavigatorBarHeight = screenHeight - windowHeight;
export const iconSize = normalizeFontSize(24);
export const roundButtonSize = normalizeFontSize(24);

const GlobalStyles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor,
  },
  scrollContainer: {
    width: "100%",
    height: "auto",
  },
  scrollContainerContent: {
    height: "100%",
    width: "100%",
    justifyContent: "space-evenly",
    alignItems: "center",
    gap: 20,
  },
  inputChat: {
    borderRadius: 10,
    borderColor: secondaryColor,
    borderWidth: 2,
    color: "black",
    backgroundColor: "white",
    fontSize: normalizeFontSize(24),
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "left",
    flex: 1, // allows expansion if within a row container
  },
});

export default GlobalStyles;
