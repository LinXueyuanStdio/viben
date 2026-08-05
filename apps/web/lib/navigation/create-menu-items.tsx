import { FilePlus2, MessageSquareText, Package, Users, Wand } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface CreateMenuItem {
  icon: LucideIcon
  labelKey: string
  href: string
}

export const CREATE_MENU_ITEMS: CreateMenuItem[] = [
  { icon: MessageSquareText, labelKey: "nav.postMoment", href: "/moment" },
  { icon: FilePlus2, labelKey: "nav.createPage", href: "/pages/new" },
  { icon: Package, labelKey: "nav.publishMcp", href: "/publish?type=mcp" },
  { icon: Wand, labelKey: "nav.createSkill", href: "/publish?type=skill" },
]

export const CREATE_TEAM_ITEM: CreateMenuItem = {
  icon: Users,
  labelKey: "nav.createTeam",
  href: "/account/teams/new",
}
