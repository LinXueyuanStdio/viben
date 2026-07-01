"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface TopbarContentContextType {
  isRead: boolean
  immersive: boolean
  center: ReactNode
  right: ReactNode
  setIsRead: (v: boolean) => void
  setImmersive: (v: boolean) => void
  setCenter: (node: ReactNode) => void
  setRight: (node: ReactNode) => void
}

const ctx = createContext<TopbarContentContextType>({
  isRead: false,
  immersive: false,
  center: null,
  right: null,
  setIsRead: () => {},
  setImmersive: () => {},
  setCenter: () => {},
  setRight: () => {},
})

export function TopbarContentProvider({ children }: { children: ReactNode }) {
  const [isRead, setIsRead] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [center, setCenter] = useState<ReactNode>(null)
  const [right, setRight] = useState<ReactNode>(null)

  return (
    <ctx.Provider value={{ isRead, immersive, center, right, setIsRead, setImmersive, setCenter, setRight }}>
      {children}
    </ctx.Provider>
  )
}

export function useTopbarContent() {
  return useContext(ctx)
}
