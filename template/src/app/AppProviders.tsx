import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "@shared/api";
import { AppThemeProvider, type AppThemeMode } from "@shared/ui";
import { AppErrorBoundary } from "./AppErrorBoundary";

export interface AppProvidersProps {
  children: ReactNode;
  initialMode?: AppThemeMode;
}

export function AppProviders({ children, initialMode = "light" }: AppProvidersProps) {
  return (
    <AppErrorBoundary>
      <AppThemeProvider initialMode={initialMode}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppThemeProvider>
    </AppErrorBoundary>
  );
}