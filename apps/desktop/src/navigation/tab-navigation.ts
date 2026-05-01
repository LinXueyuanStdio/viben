import { type DesktopLocation, locationToUrl } from "./location";
import { popTo as popBreadcrumbStack, pushStackItem, replaceStackTop } from "./breadcrumb-stack";
import {
  buildViewTarget,
  type BreadcrumbStackItem,
  type PushPageOptions,
  type TabNavigationState,
} from "./view-target";

function ensureItemTarget(
  item: BreadcrumbStackItem,
  location: DesktopLocation
): BreadcrumbStackItem {
  return {
    ...item,
    target:
      item.target ??
      buildViewTarget(location, locationToUrl(location)),
  };
}

export function createTabNavigationState(
  location: DesktopLocation,
  breadcrumbStack: BreadcrumbStackItem[],
  patch?: Partial<TabNavigationState>
): TabNavigationState {
  return {
    location,
    breadcrumbStack,
    activeNodeId: patch?.activeNodeId,
    activeIndexPath: patch?.activeIndexPath,
  };
}

export function replaceLocation(
  state: TabNavigationState,
  location: DesktopLocation,
  patch?: Partial<TabNavigationState>
): TabNavigationState {
  return {
    ...state,
    ...patch,
    location,
    breadcrumbStack: patch?.breadcrumbStack ?? state.breadcrumbStack,
  };
}

export function pushPage(
  state: TabNavigationState,
  item: BreadcrumbStackItem,
  location: DesktopLocation,
  options?: PushPageOptions
): TabNavigationState {
  const nextItem = ensureItemTarget(item, location);
  const nextStack =
    options?.mode === "replace"
      ? replaceStackTop(state.breadcrumbStack, nextItem)
      : pushStackItem(state.breadcrumbStack, nextItem);

  return {
    ...state,
    location,
    breadcrumbStack: nextStack,
  };
}

export function popTo(
  state: TabNavigationState,
  index: number
): TabNavigationState {
  const nextStack = popBreadcrumbStack(state.breadcrumbStack, index);
  const nextTop = nextStack[nextStack.length - 1];

  return {
    ...state,
    location: nextTop?.target?.location ?? state.location,
    breadcrumbStack: nextStack,
  };
}

export function resetStack(next: TabNavigationState): TabNavigationState {
  return next;
}
