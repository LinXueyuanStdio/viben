/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSidebarContent } from "./settings-sidebar-content";

const openSettings = vi.fn();
const openPath = vi.fn();
const syncChannels = vi.fn();

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-desktop-routing", () => ({
  useDesktopRouting: () => ({
    openSettings,
    openPath,
  }),
}));

vi.mock("@/hooks", () => ({
  syncChannels: () => syncChannels(),
}));

describe("SettingsSidebarContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates settings sections with replace stack mode", () => {
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <SettingsSidebarContent collapsed={false} showExpanded />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "settings.sections.gateway" }),
    );

    expect(openSettings).toHaveBeenCalledWith("gateway", {
      stackMode: "replace",
    });
  });

  it("preloads channel data when opening the channels section", () => {
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <SettingsSidebarContent collapsed={false} showExpanded />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "settings.sections.channels" }),
    );

    expect(openSettings).toHaveBeenCalledWith("channels", {
      stackMode: "replace",
    });
    expect(syncChannels).toHaveBeenCalledOnce();
  });

  it("uses collapsed icon buttons when the sidebar is collapsed", () => {
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <SettingsSidebarContent collapsed showExpanded={false} />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "settings.sections.model" }),
    );

    expect(openSettings).toHaveBeenCalledWith("model", {
      stackMode: "replace",
    });
  });
});
