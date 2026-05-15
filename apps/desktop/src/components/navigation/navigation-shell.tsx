import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DesktopBreadcrumbBar } from "./desktop-breadcrumb-bar";
import { useActiveTabState } from "@/hooks/use-page-tabs";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import type { DesktopBreadcrumbSegment } from "@/navigation/page-index";
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";
import type { Workspace } from "@/types";

interface NavigationShellHeaderState {
  workspace?: Workspace;
  segments?: DesktopBreadcrumbSegment[];
  className?: string;
}

interface RegisteredNavigationShellHeader extends NavigationShellHeaderState {
  ownerId: string;
}

interface NavigationShellActionsContextValue {
  setHeader: (ownerId: string, next: NavigationShellHeaderState) => void;
  clearHeader: (ownerId: string) => void;
  setCenterContent: (ownerId: string, content: ReactNode | null) => void;
  setRightContent: (ownerId: string, content: ReactNode | null) => void;
  clearSlotContent: (ownerId: string) => void;
}

interface NavigationShellSlotsContextValue {
  centerHost: HTMLDivElement | null;
  rightHost: HTMLDivElement | null;
  setCenterHost: (node: HTMLDivElement | null) => void;
  setRightHost: (node: HTMLDivElement | null) => void;
  centerContent: ReactNode | null;
  rightContent: ReactNode | null;
}

const NavigationShellHeaderContext =
  createContext<RegisteredNavigationShellHeader | null>(null);
const NavigationShellActionsContext =
  createContext<NavigationShellActionsContextValue | null>(null);
const NavigationShellSlotsContext =
  createContext<NavigationShellSlotsContextValue | null>(null);

const EMPTY_SEGMENTS: DesktopBreadcrumbSegment[] = [];

function areHeadersEqual(
  current: RegisteredNavigationShellHeader | null,
  ownerId: string,
  next: NavigationShellHeaderState
): boolean {
  const currentWorkspaceId = current?.workspace?.id;
  const nextWorkspaceId = next.workspace?.id;
  const currentSegments = JSON.stringify(current?.segments ?? []);
  const nextSegments = JSON.stringify(next.segments ?? []);

  return (
    current?.ownerId === ownerId &&
    currentWorkspaceId === nextWorkspaceId &&
    currentSegments === nextSegments &&
    current.className === next.className
  );
}

function mapStackItemToSegment(
  item: BreadcrumbStackItem
): DesktopBreadcrumbSegment {
  return {
    id: item.id,
    label: item.label,
    titleKey: item.titleKey,
    href: item.href,
    icon: item.icon,
    descriptorId: item.descriptorId,
    meta: item.meta,
  };
}

function buildDerivedHeader(
  stack: BreadcrumbStackItem[] | undefined,
  workspaces: Workspace[]
): NavigationShellHeaderState | null {
  if (!stack?.length) {
    return null;
  }

  const [root, ...rest] = stack;
  if (root.descriptorId === "workspace" && root.meta?.workspaceId) {
    const workspace = workspaces.find(
      (item) => item.id === root.meta?.workspaceId
    );

    if (workspace) {
      return {
        workspace,
        segments: rest.map(mapStackItemToSegment),
      };
    }
  }

  return {
    segments: stack.map(mapStackItemToSegment),
  };
}

export function resolveNavigationShellHeader(
  registeredHeader: RegisteredNavigationShellHeader | null,
  derivedHeader: NavigationShellHeaderState | null
): NavigationShellHeaderState | null {
  if (derivedHeader) {
    return {
      workspace: derivedHeader.workspace,
      segments: derivedHeader.segments ?? EMPTY_SEGMENTS,
      className: registeredHeader?.className,
    };
  }

  if (!registeredHeader) {
    return null;
  }

  return {
    workspace: registeredHeader.workspace,
    segments: registeredHeader.segments ?? EMPTY_SEGMENTS,
    className: registeredHeader.className,
  };
}

export function NavigationShellProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [header, setHeaderState] =
    useState<RegisteredNavigationShellHeader | null>(null);
  const [centerContent, setCenterContentState] = useState<ReactNode | null>(null);
  const [rightContent, setRightContentState] = useState<ReactNode | null>(null);
  const [centerHost, setCenterHost] = useState<HTMLDivElement | null>(null);
  const [rightHost, setRightHost] = useState<HTMLDivElement | null>(null);
  const slotOwnerRef = useRef<string | null>(null);

  const setHeader = useCallback(
    (ownerId: string, next: NavigationShellHeaderState) => {
      setHeaderState((current) => {
        if (areHeadersEqual(current, ownerId, next)) {
          return current;
        }

        return {
          ownerId,
          ...next,
        };
      });
    },
    []
  );

  const clearHeader = useCallback((ownerId: string) => {
    setHeaderState((current) =>
      current?.ownerId === ownerId ? null : current
    );
  }, []);

  const setCenterContent = useCallback((ownerId: string, content: ReactNode | null) => {
    slotOwnerRef.current = ownerId;
    setCenterContentState(content);
  }, []);

  const setRightContent = useCallback((ownerId: string, content: ReactNode | null) => {
    slotOwnerRef.current = ownerId;
    setRightContentState(content);
  }, []);

  const clearSlotContent = useCallback((ownerId: string) => {
    if (slotOwnerRef.current !== ownerId) {
      return;
    }

    slotOwnerRef.current = null;
    setCenterContentState(null);
    setRightContentState(null);
  }, []);

  const actionsValue = useMemo(
    () => ({
      setHeader,
      clearHeader,
      setCenterContent,
      setRightContent,
      clearSlotContent,
    }),
    [clearHeader, clearSlotContent, setCenterContent, setHeader, setRightContent]
  );
  const slotsValue = useMemo(
    () => ({
      centerHost,
      rightHost,
      setCenterHost,
      setRightHost,
      centerContent,
      rightContent,
    }),
    [centerContent, centerHost, rightContent, rightHost]
  );

  return (
    <NavigationShellActionsContext.Provider value={actionsValue}>
      <NavigationShellSlotsContext.Provider value={slotsValue}>
        <NavigationShellHeaderContext.Provider value={header}>
          {children}
        </NavigationShellHeaderContext.Provider>
      </NavigationShellSlotsContext.Provider>
    </NavigationShellActionsContext.Provider>
  );
}

export function useOptionalNavigationShell() {
  return useContext(NavigationShellActionsContext);
}

export function useNavigationShellHeaderState() {
  return useContext(NavigationShellHeaderContext);
}

export function useNavigationShellSlots() {
  return useContext(NavigationShellSlotsContext);
}

export function GlobalBreadcrumbShell() {
  const registeredHeader = useContext(NavigationShellHeaderContext);
  const slots = useContext(NavigationShellSlotsContext);
  const { currentNavigationState } = useActiveTabState();
  const { workspaces } = useLocalWorkspaces();

  const derivedHeader = useMemo(
    () => buildDerivedHeader(currentNavigationState?.breadcrumbStack, workspaces),
    [currentNavigationState?.breadcrumbStack, workspaces]
  );

  const resolvedHeader = useMemo(() => {
    return resolveNavigationShellHeader(registeredHeader, derivedHeader);
  }, [derivedHeader, registeredHeader]);

  const handleCenterHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      slots?.setCenterHost(node);
    },
    [slots]
  );

  const handleRightHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      slots?.setRightHost(node);
    },
    [slots]
  );

  if (!resolvedHeader) {
    return null;
  }

  return (
    <DesktopBreadcrumbBar
      workspace={resolvedHeader.workspace}
      segments={resolvedHeader.segments}
      className={resolvedHeader.className}
      centerSlot={
        <div
          ref={handleCenterHostRef}
          className="flex min-w-0 items-center justify-center"
        >
          {slots?.centerContent}
        </div>
      }
      rightSlot={
        <div
          ref={handleRightHostRef}
          className="flex items-center gap-2"
        >
          {slots?.rightContent}
        </div>
      }
    />
  );
}
