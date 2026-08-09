"use client";

import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import type { ToolRendererProps } from "@/lib/render-tool";
import { ToolLayout } from "../tool-layout";

export function FetchRenderer({
  part,
  state,
  onApprove,
  onDeny,
}: ToolRendererProps<"tool-web_fetch">) {
  const { t } = useTranslation();
  const input = part.input;
  const url = input?.url ?? t("assistant.toolCall.placeholder");
  const method = input?.method ?? "GET";

  const output = part.state === "output-available" ? part.output : undefined;
  const status = output?.success === true ? output.status : undefined;
  const outputError =
    output?.success === false
      ? (output.error ?? t("assistant.toolCall.fetchFailed"))
      : undefined;

  const mergedState = outputError
    ? { ...state, error: state.error ?? outputError }
    : state;

  const displayUrl = url.length > 60 ? `${url.slice(0, 57)}...` : url;
  const summary = method === "GET" ? displayUrl : `${method} ${displayUrl}`;

  const meta = status !== undefined ? `${status}` : undefined;

  return (
    <ToolLayout
      name={t("assistant.toolCall.toolFetch")}
      icon={<Globe className="h-3.5 w-3.5" />}
      summary={summary}
      summaryClassName="font-mono"
      meta={meta}
      state={mergedState}
      onApprove={onApprove}
      onDeny={onDeny}
    />
  );
}
