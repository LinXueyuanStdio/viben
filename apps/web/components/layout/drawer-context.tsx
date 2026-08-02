"use client"
import React, { createContext, useContext, useState, useCallback } from "react"

interface DrawerContextType {
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
  immersive: boolean
  setImmersive: (v: boolean) => void
}

const DrawerContext = createContext<DrawerContextType>({
  open: true,
  toggle: () => {},
  setOpen: () => {},
  immersive: false,
  setImmersive: () => {},
})

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const [immersive, setImmersive] = useState(false)
  const toggle = useCallback(() => setOpen((prev) => !prev), [])
  return (
    <DrawerContext.Provider value={{ open, toggle, setOpen, immersive, setImmersive }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  return useContext(DrawerContext)
}
