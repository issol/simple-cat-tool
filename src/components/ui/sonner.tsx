"use client"

import { Toaster as Sonner } from "sonner"

function Toaster() {
  return (
    <Sonner
      position="top-center"
      theme="light"
      richColors
      expand
      visibleToasts={5}
      style={{ zIndex: 9999 }}
      toastOptions={{
        style: {
          background: "#ffffff",
          color: "#1e293b",
          border: "1px solid #e2e8f0",
        },
      }}
    />
  )
}

export { Toaster }
