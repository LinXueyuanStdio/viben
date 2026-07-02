"use client"

import * as React from "react"
import type { ReactNode } from "react"

export interface TopbarSlots {
  centerContent?: ReactNode
  rightContent?: ReactNode
  hasSidePage?: boolean
}

const TopbarSlotContext = React.createContext<TopbarSlots | null>(null)

export function TopbarSlotProvider({
  value,
  children,
}: {
  value: TopbarSlots
  children: ReactNode
}) {
  const memoValue = React.useMemo(
    () => value,
    [value.centerContent, value.rightContent, value.hasSidePage]
  )
  return (
    <TopbarSlotContext.Provider value={memoValue}>
      {children}
    </TopbarSlotContext.Provider>
  )
}

export function useTopbarSlots(): TopbarSlots | null {
  return React.useContext(TopbarSlotContext)
}
