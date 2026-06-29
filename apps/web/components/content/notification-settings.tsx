"use client"

import { useState } from "react"
import { toast } from "sonner"

export function NotificationSettings() {
  const [settings, setSettings] = useState({
    pageUpdate: true,
    commentReply: true,
  })

  const toggle = async (key: "pageUpdate" | "commentReply") => {
    const newValue = !settings[key]
    setSettings((prev) => ({ ...prev, [key]: newValue }))

    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key === "pageUpdate" ? "page_update" : "comment_reply"]: newValue }),
      })
      if (!res.ok) {
        setSettings((prev) => ({ ...prev, [key]: !newValue }))
        toast.error("设置保存失败")
      }
    } catch {
      setSettings((prev) => ({ ...prev, [key]: !newValue }))
      toast.error("设置保存失败")
    }
  }

  return (
    <div className="rounded-[10px] border border-border p-2.5 grid gap-2">
      <div className="font-bold text-sm">通知设置</div>
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={settings.pageUpdate}
          onChange={() => toggle("pageUpdate")}
          className="rounded"
        />
        页面更新
      </label>
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={settings.commentReply}
          onChange={() => toggle("commentReply")}
          className="rounded"
        />
        评论回复
      </label>
    </div>
  )
}
