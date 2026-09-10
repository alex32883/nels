"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SerwistProvider>
  );
}
