import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "./AppProviders";

describe("AppProviders", () => {
  it.each(["light", "dark"] as const)("renders Salt in %s mode without console errors", (mode) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = render(<AppProviders initialMode={mode}><p>Application content</p></AppProviders>);
    expect(screen.getByText("Application content")).not.toBeNull();
    expect(document.documentElement.dataset.mode).toBe(mode);
    expect(document.documentElement.classList.contains("salt-density-medium")).toBe(true);
    unmount();
    expect(consoleError).not.toHaveBeenCalled();
  });
});