/**
 * Custom event tracking for Vercel Analytics.
 * Uses window.va.track() which is injected by @vercel/analytics.
 */
type TrackEventName =
  | "drawer_open"
  | "drawer_tab_switch"
  | "immersive_enter"
  | "immersive_exit"
  | "read_tab_switch"
  | "read_more_menu_open"
  | "report_dialog_open"
  | "feedback_dialog_open"

interface TrackProperties {
  page_id?: string
  tab?: string
  user_is_author?: boolean
  [key: string]: string | number | boolean | undefined
}

export function trackAnalytics(event: TrackEventName, properties?: TrackProperties) {
  if (typeof window === "undefined") return

  try {
    window.va?.("event", {
      name: event,
      data: properties ?? {},
    })
  } catch {
    // analytics should never break the app
  }
}
