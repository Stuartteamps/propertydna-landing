/**
 * Ambient module stubs so editors/tsc don't error before `npm install` pulls the real
 * Expo/RN packages. These are erased at build time; the real types come from node_modules.
 */
declare module "expo-router";
declare module "expo-camera";
declare module "expo-secure-store";
declare module "expo-haptics";
declare module "expo-status-bar";
declare module "react-native-svg";
declare module "react-native-safe-area-context";
declare module "react-native-health";
declare module "@testing-library/react-native";
