"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "第三方账号授权失败，请重试",
  already_linked: "此账号已被其他用户绑定",
  invalid_state: "请求已过期，请重新操作",
  no_token: "无法获取访问凭证",
  no_email: "未获取到邮箱，请确认 GitHub 账号已设置公开邮箱并在授权时勾选邮箱访问权限",
};

export function UrlErrorToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");

    if (!error) return;

    const providerName =
      provider === "github" ? "GitHub" : provider === "google" ? "Google" : null;

    if (error === "already_linked" && providerName) {
      toast.error(`此 ${providerName} 账号已被其他用户绑定`);
      return;
    }

    const message = ERROR_MESSAGES[error];
    if (message) {
      toast.error(message);
    }
  }, [searchParams]);

  return null;
}
