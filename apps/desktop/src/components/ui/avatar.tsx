import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  [
    "relative flex shrink-0 overflow-hidden rounded-full",
    "bg-muted",
  ],
  {
    variants: {
      size: {
        sm: "h-6 w-6 text-xs",
        default: "h-8 w-8 text-sm",
        lg: "h-10 w-10 text-base",
        xl: "h-12 w-12 text-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size, className }))}
        {...props}
      />
    );
  }
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (hasError || !props.src) {
      return null;
    }

    return (
      <img
        ref={ref}
        className={cn("aspect-square h-full w-full object-cover", className)}
        alt={alt}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage";

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full",
          "bg-primary/10 text-primary font-medium",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback, avatarVariants };
