import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@/stores/connection-store";
import { getGatewayUrl } from "@/lib/gateway/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Monitor, Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function MobileChatPage() {
  const { t } = useTranslation();
  const active = useConnectionStore((s) => s.getActive());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const baseUrl = getGatewayUrl();
      const res = await fetch(`${baseUrl}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response ?? data.message ?? JSON.stringify(data),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${t("mobile.chat.error", "Error")}: ${err instanceof Error ? err.message : t("mobile.chat.failedToSend", "Failed to send")}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, t]);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-6">
        <Monitor className="h-12 w-12" />
        <p>{t("mobile.chat.connectToStart", "Connect to a Gateway to start chatting")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-8">
            {t("mobile.chat.sendMessage", { name: active.name, defaultValue: "Send a message to the agent on {{name}}" })}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("mobile.chat.placeholder", "Type a message...")}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={sending}
        />
        <Button size="icon" onClick={sendMessage} disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
