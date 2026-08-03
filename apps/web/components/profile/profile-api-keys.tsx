'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Copy, Trash2, Loader2, Terminal, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ProfileApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/api-keys');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      toast.error(t('profile.apiKeys.toast.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function createKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/users/me/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scopes: ['read', 'write'] }),
      });

      if (!res.ok) throw new Error('Failed to create');

      const data = await res.json();
      setNewKeyValue(data.key);
      // Only add the new key if it's valid
      if (data.apiKey && data.apiKey.id) {
        setKeys((prev) => [data.apiKey, ...prev]);
      }
      setNewKeyName('');
      toast.success(t('profile.apiKeys.toast.created'));
    } catch {
      toast.error(t('profile.apiKeys.toast.failedToCreate'));
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(keyId: string) {
    try {
      const res = await fetch(`/api/users/me/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success(t('profile.apiKeys.toast.deleted'));
    } catch {
      toast.error(t('profile.apiKeys.toast.failedToDelete'));
    }
  }

  function copyKey() {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      toast.success(t('profile.apiKeys.toast.copied'));
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('profile.apiKeys.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('profile.apiKeys.description')}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setCopied(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setNewKeyValue(null)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('profile.apiKeys.createApiKey')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKeyValue ? t('profile.apiKeys.apiKeyCreated') : t('profile.apiKeys.createApiKey')}
              </DialogTitle>
              <DialogDescription>
                {newKeyValue
                  ? t('profile.apiKeys.copyKeyNow')
                  : t('profile.apiKeys.giveKeyName')}
              </DialogDescription>
            </DialogHeader>

            {newKeyValue ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input value={newKeyValue} readOnly className="font-mono text-sm" />
                  <Button
                    variant={copied ? "default" : "secondary"}
                    size="default"
                    onClick={copyKey}
                    className="shrink-0 min-w-[100px]"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {t('profile.apiKeys.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        {t('profile.apiKeys.copyKey')}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('profile.apiKeys.copyHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">{t('profile.apiKeys.keyName')}</Label>
                  <Input
                    id="keyName"
                    placeholder={t('profile.apiKeys.keyNamePlaceholder')}
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {newKeyValue ? (
                <Button onClick={() => setShowDialog(false)}>{t('profile.apiKeys.done')}</Button>
              ) : (
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('profile.apiKeys.createKey')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="bg-muted/50">
        <Terminal className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <span className="font-medium">{t('profile.apiKeys.cliTip')}</span>
          <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            viben login
          </code>
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
        <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          API Key 可用于 MCP 客户端（Claude Code、Codex、Cursor 等）连接 Viben MCP 服务。
        </span>
        <Link
          href="/docs/mcp/v1"
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline hover:no-underline"
        >
          MCP 文档 <ExternalLink size={11} />
        </Link>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">{t('profile.apiKeys.noApiKeysYet')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('profile.apiKeys.tableName')}</TableHead>
              <TableHead>{t('profile.apiKeys.tableKey')}</TableHead>
              <TableHead>{t('profile.apiKeys.tableScopes')}</TableHead>
              <TableHead>{t('profile.apiKeys.tableLastUsed')}</TableHead>
              <TableHead>{t('profile.apiKeys.tableCreated')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.filter((key) => key && key.id).map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-sm">
                  {key.keyPrefix}...
                </TableCell>
                <TableCell>{key.scopes.join(', ')}</TableCell>
                <TableCell>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : t('profile.apiKeys.never')}
                </TableCell>
                <TableCell>
                  {new Date(key.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
