import { ExternalLink, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AboutPage() {
  const appVersion = "0.1.0";
  const updateAvailable = false;

  return (
    <div className="p-6 max-w-lg">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            B
          </div>
        </div>
        <h1 className="text-2xl font-bold">Browse MCP</h1>
        <p className="text-muted-foreground">Version {appVersion}</p>
      </div>

      {/* Update */}
      <section className="mb-6">
        <div className="rounded-lg border bg-card p-4">
          {updateAvailable ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Update Available</p>
                <p className="text-sm text-muted-foreground">
                  Version 0.2.0 is ready to install
                </p>
              </div>
              <Button size="sm">Update Now</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                You're up to date!
              </p>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Updates
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Links */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          LINKS
        </h2>
        <div className="space-y-2">
          <LinkButton
            icon={Github}
            label="GitHub Repository"
            href="https://github.com/LinXueyuanStdio/browse-mcp"
          />
          <LinkButton
            icon={ExternalLink}
            label="Documentation"
            href="https://github.com/LinXueyuanStdio/browse-mcp#readme"
          />
          <LinkButton
            icon={ExternalLink}
            label="Report an Issue"
            href="https://github.com/LinXueyuanStdio/browse-mcp/issues"
          />
        </div>
      </section>

      {/* Credits */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          CREDITS
        </h2>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="mb-2">
            Built with Tauri, React, and the Model Context Protocol.
          </p>
          <p>
            Academic paper search powered by arXiv, PubMed, Semantic Scholar,
            and other open access databases.
          </p>
        </div>
      </section>
    </div>
  );
}

interface LinkButtonProps {
  icon: React.ElementType;
  label: string;
  href: string;
}

function LinkButton({ icon: Icon, label, href }: LinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
