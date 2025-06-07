"use client";
// ABOUTME: Root providers component that wraps the entire application with theme, session, observability, and error boundary providers
// ABOUTME: Combines all necessary providers to avoid hydration issues and ensure proper client-side functionality

import { ThemeProvider } from "@/features/theme/theme-provider";
import { Toaster } from "@/ui/toaster";
import { AppErrorBoundary } from "@/ui/error-boundary";
import { ObservabilityProvider } from "@/observability/observability-provider";
import { SessionProvider } from "next-auth/react";

export const RootProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
        suppressHydrationWarning
      >
        <ObservabilityProvider>
          <AppErrorBoundary>
            {children}
            <Toaster />
          </AppErrorBoundary>
        </ObservabilityProvider>
      </ThemeProvider>
    </SessionProvider>
  );
};