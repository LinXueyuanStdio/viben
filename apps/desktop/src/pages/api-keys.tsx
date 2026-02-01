import { Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
}

const apiKeys: ApiKey[] = [
  {
    id: "1",
    name: "Development",
    prefix: "bm_dev_****",
    createdAt: "2024-01-15",
    lastUsed: "2024-01-20",
  },
];

export function ApiKeysPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage API keys for external access to the search service
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">No API keys created yet</p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create your first API key
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {apiKeys.map((key) => (
            <div key={key.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{key.name}</p>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <code className="bg-muted px-2 py-0.5 rounded">
                    {key.prefix}
                  </code>
                  <span>Created {key.createdAt}</span>
                  {key.lastUsed && <span>Last used {key.lastUsed}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
