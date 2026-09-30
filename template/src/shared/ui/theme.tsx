import { SaltProvider } from "@salt-ds/core";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppThemeMode = "light" | "dark";

interface AppThemeValue {
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => void;
}

const AppThemeContext = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children, initialMode = "light" }: { children: ReactNode; initialMode?: AppThemeMode }) {
  const [mode, setMode] = useState<AppThemeMode>(initialMode);
  const theme = useMemo(() => ({ mode, setMode }), [mode]);
  return (
    <SaltProvider mode={mode} density="medium">
      <AppThemeContext value={theme}>{children}</AppThemeContext>
    </SaltProvider>
  );
}

export function useAppTheme(): AppThemeValue {
  const theme = useContext(AppThemeContext);
  if (theme === null) throw new Error("useAppTheme must be used inside AppThemeProvider");
  return theme;
}