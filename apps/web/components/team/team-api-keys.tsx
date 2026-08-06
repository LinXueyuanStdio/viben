'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Copy, Trash2, Loader2, Check, Key } from 'lucide-react'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface TeamApiKeysProps {
  teamSlug: string
}

export function TeamApiKeys({ teamSlug }: TeamApiKeysProps) {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamSlug}/api-keys`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setKeys(data.keys || [])
    } catch {
      toast.error(t('team.apiKeys.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [teamSlug, t])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function createKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/teams/${teamSlug}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scopes: ['read', 'write'] }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      setNewKeyValue(data.key)
      if (data.apiKey?.id) setKeys((prev) => [data.apiKey, ...prev])
      setNewKeyName('')
      toast.success(t('team.apiKeys.toast.created'))
    } catch {
      toast.error(t('team.apiKeys.toast.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(keyId: string) {
    try {
      const res = await fetch(`/api/teams/${teamSlug}/api-keys/${keyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast.success(t('team.apiKeys.toast.revoked'))
    } catch {
      toast.error(t('team.apiKeys.toast.revokeFailed'))
    }
  }

  function copyKey() {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue)
      setCopied(true)
      toast.success(t('team.apiKeys.toast.copied'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('team.apiKeys.title')}</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('team.apiKeys.title')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t('team.apiKeys.description')}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) setCopied(false)
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setNewKeyValue(null)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {t('team.apiKeys.create')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKeyValue ? t('team.apiKeys.created') : t('team.apiKeys.createTitle')}
              </DialogTitle>
              <DialogDescription>
                {newKeyValue
                  ? t('team.apiKeys.copyWarning')
                  : t('team.apiKeys.createDesc')}
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
                      <><Check className="mr-2 h-4 w-4" />{t('team.apiKeys.copied')}</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" />{t('team.apiKeys.copy')}</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">{t('team.apiKeys.keyName')}</Label>
                  <Input
                    id="keyName"
                    placeholder={t('team.apiKeys.keyNamePlaceholder')}
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {newKeyValue ? (
                <Button onClick={() => setShowDialog(false)}>{t('team.apiKeys.done')}</Button>
              ) : (
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('team.apiKeys.createKey')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Key className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">{t('team.apiKeys.empty')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('team.apiKeys.table.name')}</TableHead>
                <TableHead>{t('team.apiKeys.table.key')}</TableHead>
                <TableHead>{t('team.apiKeys.table.scopes')}</TableHead>
                <TableHead>{t('team.apiKeys.table.lastUsed')}</TableHead>
                <TableHead>{t('team.apiKeys.table.created')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.filter((key) => key?.id).map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">{key.keyPrefix}...</TableCell>
                  <TableCell>{key.scopes.join(', ')}</TableCell>
                  <TableCell>
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : t('team.apiKeys.never')}
                  </TableCell>
                  <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteKey(key.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
