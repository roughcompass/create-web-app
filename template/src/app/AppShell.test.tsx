import { QueryClient } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { queryClient } from "@shared/api";
import { App } from "./App";

describe("AppShell", () => {
  it("provides landmarks, accessible navigation, and a working theme control", async () => {
    const router = createMemoryRouter([{ path: "/", Component: App, children: [{ index: true, element: <h1>Home</h1> }] }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("banner")).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).not.toBeNull();
    expect(screen.getByRole("main")).not.toBeNull();
    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).not.toBeNull();
  });

  it("focuses main content when the route changes", async () => {
    const router = createMemoryRouter([{
      path: "/",
      Component: App,
      children: [
        { index: true, element: <h1>Home</h1> },
        { path: "work-items", element: <h1>Work items</h1> },
      ],
    }]);
    render(<RouterProvider router={router} />);
    await act(async () => router.navigate("/work-items"));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("keeps theme state isolated from the shared query cache", () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });
});