import { useEffect, useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { DrawerProvider } from "./drawer-context"
import { ReadDrawer } from "./read-drawer"
import type { ReadDrawerTab } from "./read-drawer"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/content/page-meta", () => ({
  PageMeta: () => <div>Details</div>,
}))

vi.mock("@/components/content/comments-panel", () => ({
  CommentsPanel: () => <div>Comments panel</div>,
}))

vi.mock("@/components/content/notes-panel", () => ({
  NotesPanel: () => <div>Notes panel</div>,
}))

vi.mock("@/components/content/report-dialog", () => ({
  ReportDialog: () => null,
}))

vi.mock("@/components/content/feedback-dialog", () => ({
  FeedbackDialog: () => null,
}))

let pageAssistantMounts = 0

function MockPageAssistantPanel() {
  const [draft, setDraft] = useState("")
  useEffect(() => {
    pageAssistantMounts += 1
  }, [])
  return (
    <div data-testid="page-assistant-panel">
      <input
        aria-label="Assistant draft"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
    </div>
  )
}

vi.mock(
  "@/components/pages/page-assistant-panel",
  () => ({
    PageAssistantPanel: MockPageAssistantPanel,
  }),
  { virtual: true },
)

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: unknown }>) => {
    const loaderSource = loader.toString()
    function DynamicComponent(props: object) {
      if (loaderSource.includes("page-assistant-panel")) {
        return <MockPageAssistantPanel {...props} />
      }
      if (loaderSource.includes("page-meta")) return <div>Details</div>
      if (loaderSource.includes("comments-panel")) return <div>Comments panel</div>
      if (loaderSource.includes("notes-panel")) return <div>Notes panel</div>
      return null
    }
    return DynamicComponent
  },
}))

const tabsWithAssistant: ReadDrawerTab[] = [
  {
    value: "details",
    label: "Read",
    type: "meta",
    pageMeta: {},
  },
  {
    value: "comments",
    label: "Comments",
    type: "comments",
    communityEntityId: "entity-1",
    pageDbId: "page-db-1",
    isAuthenticated: true,
    initialComments: [],
    initialNextCursor: null,
  },
  {
    value: "notes",
    label: "Notes",
    type: "notes",
    entityType: "published_page",
    entityId: "page-1",
  },
  {
    value: "assistant",
    label: "Assistant",
    type: "assistant",
    pageDbId: "page-db-1",
    userSlug: "alice",
    pageSlug: "guide",
  },
]

function renderDrawer() {
  document.body.innerHTML = '<div id="viben-drawer-slot"></div>'
  return render(
    <DrawerProvider>
      <ReadDrawer
        tabs={tabsWithAssistant}
        defaultTab="comments"
        pageId="page-1"
      />
    </DrawerProvider>,
  )
}

describe("ReadDrawer assistant tab", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    pageAssistantMounts = 0
    document.body.innerHTML = ""
  })

  test("does not mount the assistant before its first selection", () => {
    renderDrawer()

    expect(screen.queryByTestId("page-assistant-panel")).not.toBeInTheDocument()
    expect(pageAssistantMounts).toBe(0)
  })

  test("mounts once on first visit and keeps the instance while hidden", async () => {
    renderDrawer()

    fireEvent.click(screen.getByRole("tab", { name: "Assistant" }))
    const input = await screen.findByLabelText("Assistant draft")
    expect(pageAssistantMounts).toBe(1)
    fireEvent.change(input, { target: { value: "unfinished" } })
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }))
    fireEvent.click(screen.getByRole("tab", { name: "Assistant" }))

    expect(pageAssistantMounts).toBe(1)
    expect(screen.getByDisplayValue("unfinished")).toBeVisible()
  })

  test("uses an isolated non-scrolling shell for assistant content", async () => {
    renderDrawer()

    fireEvent.click(screen.getByRole("tab", { name: "Assistant" }))
    await screen.findByTestId("page-assistant-panel")

    expect(screen.getByTestId("assistant-tab-host")).toHaveClass(
      "min-h-0",
      "overflow-hidden",
    )
    expect(screen.getByTestId("regular-tab-host")).toHaveClass(
      "overflow-auto",
      "p-3",
    )
  })
})
