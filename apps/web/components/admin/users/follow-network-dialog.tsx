'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface FollowEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  notifyLevel: 'all' | 'major' | 'none';
  createdAt: string;
}

const NOTIFY_LEVEL_LABELS: Record<string, string> = {
  all: '全部通知',
  major: '重要通知',
  none: '不通知',
};

const NOTIFY_LEVEL_COLORS: Record<string, string> = {
  all: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  major: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface FollowNetworkDialogProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FollowNetworkDialog({ userId, isOpen, onClose }: FollowNetworkDialogProps) {
  const [followers, setFollowers] = useState<FollowEntry[]>([]);
  const [followees, setFollowees] = useState<FollowEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFollows = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [followersRes, followeesRes] = await Promise.all([
        fetch(`/api/admin/users/${id}/follows?type=followers`),
        fetch(`/api/admin/users/${id}/follows?type=followees`),
      ]);

      if (!followersRes.ok) {
        const errData = await followersRes.json().catch(() => null);
        throw new Error(errData?.error || '获取粉丝列表失败');
      }
      if (!followeesRes.ok) {
        const errData = await followeesRes.json().catch(() => null);
        throw new Error(errData?.error || '获取关注列表失败');
      }

      const followersData = await followersRes.json();
      const followeesData = await followeesRes.json();

      setFollowers(followersData.follows ?? []);
      setFollowees(followeesData.follows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载关注网络失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchFollows(userId);
    } else {
      setFollowers([]);
      setFollowees([]);
      setError(null);
    }
  }, [isOpen, userId, fetchFollows]);

  const handleClose = () => {
    onClose();
  };

  function renderTable(entries: FollowEntry[]) {
    if (entries.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          暂无数据
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户</TableHead>
            <TableHead>通知级别</TableHead>
            <TableHead>关注时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.userId}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={entry.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(entry.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{entry.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      @{entry.username}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={NOTIFY_LEVEL_COLORS[entry.notifyLevel] || ''}
                >
                  {NOTIFY_LEVEL_LABELS[entry.notifyLevel] || entry.notifyLevel}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(entry.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>关注网络</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{error}</div>
        ) : (
          <Tabs defaultValue="followers" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="followers" className="flex-1">
                粉丝 ({followers.length})
              </TabsTrigger>
              <TabsTrigger value="followees" className="flex-1">
                关注 ({followees.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="followers" className="max-h-[50vh] overflow-auto">
              {renderTable(followers)}
            </TabsContent>
            <TabsContent value="followees" className="max-h-[50vh] overflow-auto">
              {renderTable(followees)}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
