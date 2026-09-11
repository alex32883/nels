"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { runSync } from "@/lib/sync";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (isLogin) return;
    void runSync();
    const onOnline = () => {
      void runSync();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isLogin]);

  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <ToastProvider>
        {isLogin ? children : <AppShell>{children}</AppShell>}
      </ToastProvider>
    </SerwistProvider>
  );
}
