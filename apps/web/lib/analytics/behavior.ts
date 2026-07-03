/**
 * Lightweight user behavior journey tracking.
 * Captures navigation flow, engagement depth, and interaction sequences.
 * All events logged via console.log([perf] behavior, ...) for Vercel Logs capture.
 */

// ---- Session ----

const SESSION_KEY = "viben_analytics_session"

interface Session {
  id: string
  started_at: number
  page_count: number
  read_page_count: number
  user_slug: string | null
}

function getOrCreateSession(): Session {
  if (typeof window === "undefined") {
    return { id: "ssr", started_at: 0, page_count: 0, read_page_count: 0, user_slug: null }
  }
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) return JSON.parse(stored) as Session
  } catch { /* ignore */ }

  const session: Session = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    started_at: Date.now(),
    page_count: 0,
    read_page_count: 0,
    user_slug: null,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

function updateSession(updates: Partial<Session>) {
  const session = { ...getOrCreateSession(), ...updates }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  return session
}

// ---- User identity ----

let currentUserSlug: string | null = null

/** Set the current user for all subsequent tracking events. Call when session becomes available. */
export function setUserSlug(userSlug: string | null) {
  currentUserSlug = userSlug
  if (userSlug) {
    updateSession({ user_slug: userSlug })
  }
}

function getUserSlug(): string | null {
  if (currentUserSlug) return currentUserSlug
  return getOrCreateSession().user_slug
}

// ---- Navigation tracking ----

let previousPage: string | null = null
let pageEnteredAt: number = 0

export function trackPageView(pathname: string, pageType: "read" | "dashboard" | "landing" | "other") {
  if (typeof window === "undefined") return

  const session = updateSession({
    page_count: getOrCreateSession().page_count + 1,
    read_page_count:
      getOrCreateSession().read_page_count + (pageType === "read" ? 1 : 0),
  })

  const now = Date.now()
  const timeOnPreviousPage = pageEnteredAt ? now - pageEnteredAt : 0
  const userSlug = getUserSlug()

  const payload: Record<string, unknown> = {
    event: "page_view",
    session_id: session.id,
    pathname,
    page_type: pageType,
    previous_page: previousPage,
    time_on_previous_ms: timeOnPreviousPage,
    session_page_count: session.page_count,
    session_read_count: session.read_page_count,
    referrer: document.referrer || null,
    timestamp: now,
  }
  if (userSlug) payload.user_slug = userSlug

  console.log("[perf] behavior", JSON.stringify(payload))

  previousPage = pathname
  pageEnteredAt = now
}

// ---- Engagement tracking ----

const engagementEvents: Array<{ event: string; time: number }> = []
let engagementFlushed = false

export function trackEngagement(event: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return

  const session = getOrCreateSession()
  const now = Date.now()
  const timeOnPage = pageEnteredAt ? now - pageEnteredAt : 0
  const userSlug = getUserSlug()

  engagementEvents.push({ event, time: now })

  const payload: Record<string, unknown> = {
    event: "engagement",
    session_id: session.id,
    action: event,
    time_on_page_ms: timeOnPage,
    interaction_sequence: engagementEvents.length,
    interaction_history: engagementEvents.slice(-10).map(e => e.event),
    ...metadata,
    timestamp: now,
  }
  if (userSlug) payload.user_slug = userSlug

  console.log("[perf] behavior", JSON.stringify(payload))
}

// ---- Page leave ----

function flushPageLeave() {
  if (engagementFlushed || typeof window === "undefined") return
  engagementFlushed = true

  const session = getOrCreateSession()
  const timeOnPage = pageEnteredAt ? Date.now() - pageEnteredAt : 0
  const userSlug = getUserSlug()

  const payload: Record<string, unknown> = {
    event: "page_leave",
    session_id: session.id,
    pathname: window.location.pathname,
    time_on_page_ms: timeOnPage,
    total_interactions: engagementEvents.length,
    interaction_timeline: engagementEvents.map(e => ({
      event: e.event,
      offset_ms: e.time - pageEnteredAt,
    })),
    timestamp: Date.now(),
  }
  if (userSlug) payload.user_slug = userSlug

  console.log("[perf] behavior", JSON.stringify(payload))
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPageLeave)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPageLeave()
  })
}

// ---- Read progress (estimated) ----

export function trackReadProgress(progressPercent: number) {
  if (typeof window === "undefined") return

  const session = getOrCreateSession()
  const userSlug = getUserSlug()

  const payload: Record<string, unknown> = {
    event: "read_progress",
    session_id: session.id,
    pathname: window.location.pathname,
    progress_pct: Math.round(progressPercent),
    time_on_page_ms: pageEnteredAt ? Date.now() - pageEnteredAt : 0,
    timestamp: Date.now(),
  }
  if (userSlug) payload.user_slug = userSlug

  console.log("[perf] behavior", JSON.stringify(payload))
}
