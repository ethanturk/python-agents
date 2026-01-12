"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { DocumentSetProvider } from "@/contexts/DocumentSetContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DocumentSetProvider>{children}</DocumentSetProvider>
    </AuthProvider>
  );
}
