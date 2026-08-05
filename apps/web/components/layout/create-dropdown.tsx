"use client"

import React from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CREATE_MENU_ITEMS, CREATE_TEAM_ITEM } from "@/lib/navigation/create-menu-items"

export function CreateDropdown() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t("nav.create")}>
          <Plus className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("nav.create")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CREATE_MENU_ITEMS.map((item, idx) => (
          <React.Fragment key={item.labelKey}>
            {idx === 2 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => router.push(item.href)}>
              <item.icon className="mr-2 h-4 w-4" />
              {t(item.labelKey)}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(CREATE_TEAM_ITEM.href)}>
          <CREATE_TEAM_ITEM.icon className="mr-2 h-4 w-4 shrink-0" />
          {t(CREATE_TEAM_ITEM.labelKey)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
