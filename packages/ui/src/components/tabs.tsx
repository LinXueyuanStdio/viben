import * as React from "react";
import { useContext } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  defaultValue?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn("flex flex-col", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const tabsListVariants = cva(
  [
    "inline-flex items-center",
    "border-b border-border",
  ],
  {
    variants: {
      variant: {
        default: "gap-1",
        pills: "gap-2 border-0 bg-muted p-1 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(tabsListVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
TabsList.displayName = "TabsList";

const tabsTriggerVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap",
    "px-4 py-2 text-sm font-medium",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-b-2 border-transparent -mb-px",
          "text-muted-foreground hover:text-foreground",
          "data-[state=active]:border-primary data-[state=active]:text-primary",
        ],
        pills: [
          "rounded-md",
          "text-muted-foreground hover:text-foreground hover:bg-background/50",
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, variant, value, children, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = useTabsContext();
    const isSelected = selectedValue === value;

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        aria-selected={isSelected}
        data-state={isSelected ? "active" : "inactive"}
        onClick={() => onValueChange(value)}
        className={cn(tabsTriggerVariants({ variant, className }))}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, forceMount, children, ...props }, ref) => {
    const { value: selectedValue } = useTabsContext();
    const isSelected = selectedValue === value;

    if (!isSelected && !forceMount) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={isSelected ? "active" : "inactive"}
        hidden={!isSelected}
        tabIndex={0}
        className={cn(
          "mt-4 focus-visible:outline-none",
          !isSelected && "hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
