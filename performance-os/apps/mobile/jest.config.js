/**
 * Container config: runs the framework-agnostic logic + API-client tests with ts-jest
 * (no React Native runtime needed). Component tests that require the RN renderer live under
 * src/components/__tests__ and run on a dev machine via `jest-expo` (see MOBILE_BUILD.md).
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/lib"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.check.json" }],
  },
};
