/** Full component-test config for a dev machine (requires `npm install`). Run: npx jest -c jest-expo.config.js */
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|nativewind|react-native-svg|react-native-reanimated))",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/src/components/__tests__/**/*.test.tsx"],
};
