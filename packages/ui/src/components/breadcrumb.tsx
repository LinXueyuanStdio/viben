import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  className?: string;
  renderLink?: (props: { href: string; children: React.ReactNode; className?: string }) => React.ReactNode;
}

const defaultRenderLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

export function Breadcrumb({
  items,
  separator,
  maxItems = 4,
  className,
  renderLink = defaultRenderLink,
}: BreadcrumbProps) {
  const separatorElement = separator ?? (
    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
  );

  const displayItems = React.useMemo(() => {
    if (items.length <= maxItems) return items;

    const first = items[0];
    const lastTwo = items.slice(-2);
    return [
      first,
      { label: "...", href: undefined, icon: MoreHorizontal } as BreadcrumbItem,
      ...lastTwo,
    ];
  }, [items, maxItems]);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm", className)}
    >
      <ol className="flex items-center gap-1.5">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && separatorElement}
              {item.href && !isLast ? (
                renderLink({
                  href: item.href,
                  className: cn(
                    "flex items-center gap-1.5 text-muted-foreground",
                    "hover:text-foreground transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  ),
                  children: (
                    <>
                      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                      <span className="truncate max-w-[150px]">{item.label}</span>
                    </>
                  ),
                })
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumb.displayName = "Breadcrumb";
