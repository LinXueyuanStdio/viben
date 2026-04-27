import * as React from "react";
import { useState, useCallback } from "react";
import { Link, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LinkTabProps {
  onSelect: (url: string) => void;
}

export function LinkTab({ onSelect }: LinkTabProps) {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;

    setError(null);
    setLoading(true);

    // Validate it looks like a URL
    try {
      new URL(url);
    } catch {
      setError("Invalid URL");
      setLoading(false);
      return;
    }

    // Test if image loads
    const img = new Image();
    img.onload = () => {
      setLoading(false);
      setPreview(url);
      onSelect(url);
    };
    img.onerror = () => {
      setLoading(false);
      // Still allow setting it — the URL might work in an img tag with different headers
      setPreview(url);
      onSelect(url);
    };
    img.src = url;
  }, [urlInput, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !loading) {
        handleSubmit();
      }
    },
    [handleSubmit, loading]
  );

  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/cover.jpg"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          className="h-8 px-3"
          onClick={handleSubmit}
          disabled={loading || !urlInput.trim()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {preview && (
        <div className="rounded-md overflow-hidden border h-16">
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
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
