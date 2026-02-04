import * as React from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LoginDialog } from "./login-dialog";
import { Button } from "@/components/ui/button";

interface AuthGuardProps {
  /** Content to render when authenticated */
  children: React.ReactNode;
  /** Custom fallback when not authenticated. If not provided, shows default login prompt */
  fallback?: React.ReactNode;
  /** Whether to redirect to a login page instead of showing inline fallback */
  redirectTo?: string;
  /** Loading component while checking auth state */
  loadingComponent?: React.ReactNode;
}

/**
 * AuthGuard component for protecting routes.
 *
 * Features:
 * - Shows loading state while checking authentication
 * - Redirects to login page if `redirectTo` is provided
 * - Shows inline login prompt if no `redirectTo`
 * - Renders children when authenticated
 *
 * @example
 * ```tsx
 * // Basic usage - shows inline login prompt
 * <AuthGuard>
 *   <ProtectedContent />
 * </AuthGuard>
 *
 * // With redirect
 * <AuthGuard redirectTo="/login">
 *   <ProtectedContent />
 * </AuthGuard>
 *
 * // With custom fallback
 * <AuthGuard fallback={<CustomLoginComponent />}>
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo,
  loadingComponent,
}: AuthGuardProps) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      loadingComponent || (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  // User is authenticated, render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Redirect to login page if redirectTo is provided
  if (redirectTo) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default inline login prompt
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="font-serif text-2xl font-semibold">
            {t("auth.signInRequired")}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {t("auth.signInRequiredDescription")}
          </p>
        </div>
      </div>
      <LoginDialog
        trigger={<Button size="lg">{t("auth.signIn")}</Button>}
        onSuccess={() => {
          // Page will re-render automatically when auth state changes
        }}
      />
    </div>
  );
}

/**
 * Hook to check if user is authenticated.
 * Useful for conditional rendering without wrapping.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isAuthed = useIsAuthenticated();
 *
 *   return (
 *     <div>
 *       {isAuthed ? <AuthedContent /> : <PublicContent />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}
