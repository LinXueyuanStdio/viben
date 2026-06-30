"use client"

import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { FilePlus2, MessageSquareText, Package, Plus, Wand } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
        <DropdownMenuItem onClick={() => router.push("/moment")}>
          <MessageSquareText className="mr-2 h-4 w-4" />
          {t("nav.postMoment")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/pages/new")}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          {t("nav.createPage")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/publish?type=mcp")}>
          <Package className="mr-2 h-4 w-4" />
          {t("nav.publishMcp")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/publish?type=skill")}>
          <Wand className="mr-2 h-4 w-4" />
          {t("nav.createSkill")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
