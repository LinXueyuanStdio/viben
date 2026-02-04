import { Package, Zap, Users, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Browse MCP Platform
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          The AI Tool Platform for discovering, sharing, and managing MCP
          servers and Skills.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6">
            <Package className="h-10 w-10 text-blue-500" />
            <h3 className="font-semibold">MCP Servers</h3>
            <p className="text-sm text-muted-foreground">
              Discover and install Model Context Protocol servers
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6">
            <Zap className="h-10 w-10 text-yellow-500" />
            <h3 className="font-semibold">Skills</h3>
            <p className="text-sm text-muted-foreground">
              Browse reusable AI agent skills and capabilities
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6">
            <Users className="h-10 w-10 text-green-500" />
            <h3 className="font-semibold">Community</h3>
            <p className="text-sm text-muted-foreground">
              Share and collaborate with the AI community
            </p>
          </div>
        </div>

        <div className="mt-12">
          <a
            href="/mcp"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Explore Marketplace
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Platform is under development. Check back soon!
        </p>
      </div>
    </main>
  );
}
