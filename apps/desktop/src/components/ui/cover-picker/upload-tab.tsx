import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGatewayUrl } from "@/lib/gateway/config";
import { uploadPageAsset } from "@/lib/gateway/modules/pages";

export interface UploadTabProps {
  workspacePath?: string;
  slug?: string;
  onSelect: (url: string) => void;
}

export function UploadTab({ workspacePath, slug, onSelect }: UploadTabProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = !!(workspacePath && slug);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setError(null);

      if (!canUpload) {
        const blobUrl = URL.createObjectURL(file);
        setPreview(blobUrl);
        onSelect(blobUrl);
        return;
      }

      setUploading(true);
      try {
        const baseUrl = getGatewayUrl();
        const result = await uploadPageAsset(baseUrl, workspacePath!, slug!, file);
        if (result.success && result.url) {
          const fullUrl = `${baseUrl}${result.url}`;
          setPreview(fullUrl);
          onSelect(fullUrl);
        } else {
          setError(result.error || t("coverPicker.uploadFailed"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("coverPicker.uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    [canUpload, workspacePath, slug, onSelect]
  );

  return (
    <div className="p-3 space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        className="w-full h-20 border-dashed"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs text-muted-foreground">{t("coverPicker.uploading")}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5" />
            <span className="text-xs text-muted-foreground">{t("coverPicker.clickToUpload")}</span>
          </div>
        )}
      </Button>

      {preview && (
        <div className="rounded-md overflow-hidden border h-16">
          <img src={preview} alt={t("coverPicker.preview")} className="h-full w-full object-cover" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2 text-xs text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
