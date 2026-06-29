"use client"
import React, { createContext, useContext, useState, useCallback } from "react"

interface DrawerContextType {
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

const DrawerContext = createContext<DrawerContextType>({
  open: false,
  toggle: () => {},
  setOpen: () => {},
})

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((prev) => !prev), [])
  return (
    <DrawerContext.Provider value={{ open, toggle, setOpen }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  return useContext(DrawerContext)
}
