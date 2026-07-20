/**
 * Component tests — run on a dev machine after `npm install`:
 *   npx jest -c jest-expo.config.js
 * They require the React Native renderer (jest-expo preset) which is not installed in CI.
 */
import React from "react";
import { render } from "@testing-library/react-native";

import { EmptyState, MacroBar, Stat } from "../ui";

describe("UI components", () => {
  test("Stat renders label, value and unit", () => {
    const { getByText } = render(<Stat label="HRV" value={62} unit="ms" />);
    expect(getByText("HRV")).toBeTruthy();
    expect(getByText("62")).toBeTruthy();
    expect(getByText("ms")).toBeTruthy();
  });

  test("MacroBar shows consumed/target", () => {
    const { getByText } = render(
      <MacroBar label="Protein" consumed={90} target={150} pct={60} unit="g" color="#2FBF71" />,
    );
    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("90 / 150 g")).toBeTruthy();
  });

  test("EmptyState renders title and message", () => {
    const { getByText } = render(<EmptyState title="No meals" message="Snap a photo." />);
    expect(getByText("No meals")).toBeTruthy();
    expect(getByText("Snap a photo.")).toBeTruthy();
  });
});
