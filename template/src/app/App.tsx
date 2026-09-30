import { Outlet } from "react-router";
import { AppProviders } from "./AppProviders";
import { AppShell } from "./AppShell";
import { RouteFocus } from "./RouteFocus";

export function App() {
  return (
    <AppProviders>
      <RouteFocus />
      <AppShell><Outlet /></AppShell>
    </AppProviders>
  );
}