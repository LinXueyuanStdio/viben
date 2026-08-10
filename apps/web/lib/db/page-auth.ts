import { db, users, teamMembers, publishedPages } from "@/lib/db"
import { eq, and } from "drizzle-orm"

/**
 * 查找 session user 有权访问的 published page。
 * 优先按 userId=session.userId 查，若未命中则检查 page 是否归属 team 且
 * session user 是该 team 成员。
 */
export async function findEditablePage(
  uid: string,
  sessionUserId: string,
  options?: { publishedPageId?: string },
) {
  const pageIdentity = options?.publishedPageId
    ? eq(publishedPages.id, options.publishedPageId)
    : eq(publishedPages.uid, uid)
  let page = await db.query.publishedPages.findFirst({
    where: and(eq(publishedPages.userId, sessionUserId), pageIdentity),
  })

  if (!page) {
    page = await db.query.publishedPages.findFirst({
      where: pageIdentity,
    })
    if (page) {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, page.userId),
        columns: { type: true },
      })
      if (owner?.type === "team") {
        const membership = await db.query.teamMembers.findFirst({
          where: and(eq(teamMembers.teamId, page.userId), eq(teamMembers.userId, sessionUserId)),
          columns: { role: true },
        })
        if (!membership) page = undefined
      } else {
        page = undefined
      }
    }
  }

  return page ?? null
}
