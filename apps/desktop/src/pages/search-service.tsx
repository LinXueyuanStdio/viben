import { useState } from "react";
import { Play, Square, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMcp } from "@/hooks/use-mcp";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";

export function SearchServicePage() {
  const { status, loading, error, startServer, stopServer, testConnection } = useMcp();
  const { selectedPython, browseMcpInfo } = usePython();
  const {
    mcpTransport,
    setMcpTransport,
    mcpPort,
    setMcpPort,
    downloadPath,
    setDownloadPath,
    getEnabledSourceIds,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const canStart = selectedPython?.is_valid && browseMcpInfo?.installed;

  const handleStart = async () => {
    if (!selectedPython?.path) return;

    try {
      await startServer({
        python_path: selectedPython.path,
        transport: mcpTransport,
        port: mcpTransport !== "stdio" ? mcpPort : undefined,
        download_path: downloadPath,
        enabled_sources: getEnabledSourceIds(),
      });
    } catch (err) {
      console.error("Failed to start server:", err);
    }
  };

  const handleStop = async () => {
    try {
      await stopServer();
    } catch (err) {
      console.error("Failed to stop server:", err);
    }
  };

  const handleTest = async () => {
    if (!selectedPython?.path) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(selectedPython.path);
      setTestResult(result);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const copyConfig = () => {
    const config = generateMcpConfig();
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateMcpConfig = () => {
    if (selectedPython?.path) {
      return {
        "browse-mcp": {
          command: selectedPython.path,
          args: ["-m", "browse_mcp"],
        },
      };
    }
    return {
      "browse-mcp": {
        command: "browse-mcp",
        args: [],
      },
    };
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Search Service</h1>

      {/* Requirements Check */}
      {!canStart && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Requirements Not Met
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                {!selectedPython?.is_valid && (
                  <li>• Python 3.10+ is required</li>
                )}
                {selectedPython?.is_valid && !browseMcpInfo?.installed && (
                  <li>• browse-mcp package is not installed</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Server Status */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">MCP Server Status</h2>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  status.running ? "bg-green-500 animate-pulse" : "bg-muted"
                }`}
              />
              <div>
                <span className="font-medium">
                  {status.running ? "Running" : "Stopped"}
                </span>
                {status.running && status.pid && (
                  <span className="text-sm text-muted-foreground ml-2">
                    PID: {status.pid}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant={status.running ? "destructive" : "default"}
              size="sm"
              onClick={status.running ? handleStop : handleStart}
              disabled={loading || (!status.running && !canStart)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : status.running ? (
                <Square className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {status.running ? "Stop" : "Start"}
            </Button>
          </div>

          {status.running && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Transport: {status.transport}</div>
              {status.port && <div>Port: {status.port}</div>}
            </div>
          )}

          {!status.running && canStart && (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : testResult === true ? (
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                ) : testResult === false ? (
                  <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                ) : null}
                Test Connection
              </Button>
              {testResult === true && (
                <span className="text-sm text-green-600 self-center">
                  browse-mcp is working
                </span>
              )}
              {testResult === false && (
                <span className="text-sm text-destructive self-center">
                  Connection failed
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Transport Protocol
            </label>
            <div className="flex gap-2">
              {(["stdio", "sse", "http"] as const).map((transport) => (
                <Button
                  key={transport}
                  variant={mcpTransport === transport ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMcpTransport(transport)}
                  disabled={status.running}
                >
                  {transport.toUpperCase()}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mcpTransport === "stdio"
                ? "Standard input/output - for MCP clients like Claude Desktop"
                : mcpTransport === "sse"
                ? "Server-Sent Events - for web applications"
                : "HTTP - for REST API access"}
            </p>
          </div>

          {mcpTransport !== "stdio" && (
            <div>
              <label className="text-sm font-medium mb-2 block">Port</label>
              <input
                type="number"
                value={mcpPort}
                onChange={(e) => setMcpPort(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                disabled={status.running}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">
              Download Path
            </label>
            <input
              type="text"
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={status.running}
            />
          </div>
        </div>
      </section>

      {/* MCP Config Example */}
      <section>
        <h2 className="text-lg font-semibold mb-4">MCP Configuration</h2>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Add this to your MCP client config:
            </span>
            <Button variant="ghost" size="sm" onClick={copyConfig}>
              {copied ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
            {JSON.stringify(generateMcpConfig(), null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}
