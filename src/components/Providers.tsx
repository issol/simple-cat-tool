"use client"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth/AuthProvider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
