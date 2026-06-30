import { ProfilePageClient } from "./profile-page-client"
import { getSession } from "@/lib/auth/cookies"

export const dynamic = "force-dynamic"

/**
 * Thin server wrapper — 仅读取 session 判断是否登录。
 * session 由 layout 同一次请求中 getSession() 的结果（React.cache 共享），
 * 不存在重复 cookie 读取的风险。
 */
export default async function ProfilePage() {
  const session = await getSession()
  return <ProfilePageClient session={session} />
}
