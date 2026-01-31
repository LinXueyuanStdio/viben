import { RefreshCw, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
  source?: string;
}

const logs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-20 14:32:15",
    level: "info",
    message: "MCP Server started on stdio",
    source: "server",
  },
  {
    id: "2",
    timestamp: "2024-01-20 14:32:16",
    level: "info",
    message: "Paper search: 'machine learning' on arxiv, pubmed",
    source: "tool:paper_search",
  },
  {
    id: "3",
    timestamp: "2024-01-20 14:32:18",
    level: "info",
    message: "Found 25 papers from arxiv",
    source: "source:arxiv",
  },
  {
    id: "4",
    timestamp: "2024-01-20 14:32:19",
    level: "warning",
    message: "Rate limit approaching for Semantic Scholar API",
    source: "source:semantic",
  },
];

export function LogsPage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Logs</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Button variant="secondary" size="sm">
          All
        </Button>
        <Button variant="outline" size="sm">
          Info
        </Button>
        <Button variant="outline" size="sm">
          Warnings
        </Button>
        <Button variant="outline" size="sm">
          Errors
        </Button>
      </div>

      {/* Log List */}
      <div className="flex-1 rounded-lg border bg-card overflow-hidden">
        <ScrollArea className="h-full">
          <div className="divide-y">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface LogRowProps {
  log: LogEntry;
}

function LogRow({ log }: LogRowProps) {
  const levelColors = {
    info: "text-blue-600",
    warning: "text-yellow-600",
    error: "text-red-600",
  };

  return (
    <div className="px-4 py-3 hover:bg-muted/50 font-mono text-sm">
      <div className="flex items-start gap-4">
        <span className="text-muted-foreground whitespace-nowrap">
          {log.timestamp}
        </span>
        <span
          className={`uppercase text-xs font-semibold w-16 ${levelColors[log.level]}`}
        >
          {log.level}
        </span>
        {log.source && (
          <span className="text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">
            {log.source}
          </span>
        )}
        <span className="flex-1">{log.message}</span>
      </div>
    </div>
  );
}
