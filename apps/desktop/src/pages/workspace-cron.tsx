/**
 * Workspace Cron Jobs Management Page
 *
 * Provides UI for managing scheduled tasks (cron jobs) in a workspace.
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Clock,
  Plus,
  Loader2,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import {
  useLocalWorkspaces,
  useCronJobs,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
  useEnableCronJob,
  useDisableCronJob,
  useRunCronJob,
} from "@/hooks";
import { useTranslation } from "react-i18next";
import type { CronJob, CreateCronJob, UpdateCronJob } from "@/types/cron";

type ScheduleType = "cron" | "interval";

interface JobFormData {
  name: string;
  message: string;
  scheduleType: ScheduleType;
  cronExpression: string;
  intervalSeconds: number;
  agent: string;
  channel: string;
  enabled: boolean;
}

const defaultFormData: JobFormData = {
  name: "",
  message: "",
  scheduleType: "interval",
  cronExpression: "0 9 * * *",
  intervalSeconds: 3600,
  agent: "main",
  channel: "",
  enabled: true,
};

// Common cron presets
const CRON_PRESETS = [
  { label: "cron.presets.everyMinute", value: "* * * * *" },
  { label: "cron.presets.every5Minutes", value: "*/5 * * * *" },
  { label: "cron.presets.every15Minutes", value: "*/15 * * * *" },
  { label: "cron.presets.everyHour", value: "0 * * * *" },
  { label: "cron.presets.everyDay9AM", value: "0 9 * * *" },
  { label: "cron.presets.everyMonday9AM", value: "0 9 * * 1" },
  { label: "cron.presets.firstOfMonth", value: "0 0 1 * *" },
];

// Interval presets in seconds
const INTERVAL_PRESETS = [
  { label: "cron.intervals.1minute", value: 60 },
  { label: "cron.intervals.5minutes", value: 300 },
  { label: "cron.intervals.15minutes", value: 900 },
  { label: "cron.intervals.30minutes", value: 1800 },
  { label: "cron.intervals.1hour", value: 3600 },
  { label: "cron.intervals.6hours", value: 21600 },
  { label: "cron.intervals.12hours", value: 43200 },
  { label: "cron.intervals.24hours", value: 86400 },
];

export function WorkspaceCronPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Cron job hooks
  const { jobs, loading: loadingJobs, error: jobsError, refresh: refreshJobs } = useCronJobs();
  const { createJob, loading: creating } = useCreateCronJob();
  const { updateJob, loading: updating } = useUpdateCronJob();
  const { deleteJob } = useDeleteCronJob();
  const { enableJob } = useEnableCronJob();
  const { disableJob } = useDisableCronJob();
  const { runJob } = useRunCronJob();

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const loading = loadingJobs || isLoadingWorkspaces;

  // Reset form when dialog closes
  useEffect(() => {
    if (!createDialogOpen && !editingJob) {
      setFormData(defaultFormData);
    }
  }, [createDialogOpen, editingJob]);

  // Populate form when editing
  useEffect(() => {
    if (editingJob) {
      setFormData({
        name: editingJob.name,
        message: editingJob.message,
        scheduleType: editingJob.cron ? "cron" : "interval",
        cronExpression: editingJob.cron || "0 9 * * *",
        intervalSeconds: editingJob.every || 3600,
        agent: editingJob.agent || "main",
        channel: editingJob.channel || "",
        enabled: editingJob.enabled,
      });
    }
  }, [editingJob]);

  const handleCreateOrUpdate = async () => {
    const data: CreateCronJob | UpdateCronJob = {
      name: formData.name.trim(),
      message: formData.message.trim(),
      agent: formData.agent || undefined,
      channel: formData.channel || undefined,
      enabled: formData.enabled,
      ...(formData.scheduleType === "cron"
        ? { cron: formData.cronExpression }
        : { every: formData.intervalSeconds }),
    };

    if (editingJob) {
      const result = await updateJob(editingJob.id, data as UpdateCronJob);
      if (result) {
        setEditingJob(null);
        refreshJobs();
      }
    } else {
      const result = await createJob(data as CreateCronJob);
      if (result) {
        setCreateDialogOpen(false);
        refreshJobs();
      }
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(t("cron.deleteConfirm", { name: job.name }))) return;
    const result = await deleteJob(job.id);
    if (result) {
      refreshJobs();
    }
  };

  const handleToggleEnabled = async (job: CronJob) => {
    if (job.enabled) {
      await disableJob(job.id);
    } else {
      await enableJob(job.id);
    }
    refreshJobs();
  };

  const handleRunNow = async (job: CronJob) => {
    setRunningJobId(job.id);
    await runJob(job.id);
    setRunningJobId(null);
    refreshJobs();
  };

  const formatSchedule = (job: CronJob): string => {
    if (job.cron) {
      return job.cron;
    }
    if (job.every) {
      if (job.every < 60) return `${job.every}s`;
      if (job.every < 3600) return `${Math.floor(job.every / 60)}m`;
      if (job.every < 86400) return `${Math.floor(job.every / 3600)}h`;
      return `${Math.floor(job.every / 86400)}d`;
    }
    return "-";
  };

  const formatNextRun = (timestamp?: number): string => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = timestamp - now.getTime();

    if (diff < 0) return t("cron.overdue");
    if (diff < 60000) return t("cron.inLessThanMinute");
    if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t("cron.minutesShort")}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t("cron.hoursShort")}`;

    return date.toLocaleString();
  };

  const formatLastRun = (timestamp?: number): string => {
    if (!timestamp) return t("cron.never");
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusBadge = (job: CronJob) => {
    if (!job.enabled) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Pause className="h-3 w-3 mr-1" />
          {t("common.disabled")}
        </Badge>
      );
    }
    if (job.last_status === "running") {
      return (
        <Badge variant="default" className="text-xs bg-blue-500">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t("common.running")}
        </Badge>
      );
    }
    if (job.last_status === "success") {
      return (
        <Badge variant="default" className="text-xs bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("logs.success")}
        </Badge>
      );
    }
    if (job.last_status === "failure") {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          {t("logs.failed")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        {t("cron.pending")}
      </Badge>
    );
  };

  // Loading state
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback loading
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[
          { label: t("cron.title"), href: `/workspace/${workspaceId}/cron` },
        ]}
        onRefresh={refreshJobs}
        isRefreshing={loadingJobs}
        showRemove={false}
        rightContent={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("cron.createJob")}
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
        {jobsError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-semibold mb-2">{t("common.error")}</h3>
              <p className="text-sm text-muted-foreground mb-4">{jobsError}</p>
              <Button onClick={refreshJobs} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("common.refresh")}
              </Button>
            </CardContent>
          </Card>
        ) : loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t("cron.noJobs")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("cron.noJobsDesc")}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("cron.createJob")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">{t("common.name")}</TableHead>
                  <TableHead className="w-[100px]">{t("common.status")}</TableHead>
                  <TableHead className="w-[120px]">{t("cron.schedule")}</TableHead>
                  <TableHead className="w-[150px]">{t("cron.nextRun")}</TableHead>
                  <TableHead className="w-[150px]">{t("cron.lastRun")}</TableHead>
                  <TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {job.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {formatSchedule(job)}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatNextRun(job.next_run)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastRun(job.last_run)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRunNow(job)}
                          disabled={runningJobId === job.id}
                          title={t("cron.runNow")}
                        >
                          {runningJobId === job.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50">
                            <DropdownMenuItem onClick={() => setEditingJob(job)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleEnabled(job)}>
                              {job.enabled ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  {t("common.disable")}
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  {t("common.enable")}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(job)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || !!editingJob}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingJob(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? t("cron.editJob") : t("cron.createJob")}
            </DialogTitle>
            <DialogDescription>
              {editingJob ? t("cron.editJobDesc") : t("cron.createJobDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="job-name">{t("common.name")} *</Label>
              <Input
                id="job-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("cron.namePlaceholder")}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="job-message">{t("cron.message")} *</Label>
              <Textarea
                id="job-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={t("cron.messagePlaceholder")}
                className="min-h-[80px]"
              />
            </div>

            {/* Schedule Type */}
            <div className="space-y-2">
              <Label>{t("cron.scheduleType")}</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="interval"
                    checked={formData.scheduleType === "interval"}
                    onChange={() => setFormData({ ...formData, scheduleType: "interval" })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t("cron.interval")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="cron"
                    checked={formData.scheduleType === "cron"}
                    onChange={() => setFormData({ ...formData, scheduleType: "cron" })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t("cron.cronExpression")}</span>
                </label>
              </div>
            </div>

            {/* Interval or Cron Expression */}
            {formData.scheduleType === "interval" ? (
              <div className="space-y-2">
                <Label htmlFor="job-interval">{t("cron.intervalLabel")}</Label>
                <Select
                  value={formData.intervalSeconds.toString()}
                  onValueChange={(val) =>
                    setFormData({ ...formData, intervalSeconds: parseInt(val) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("cron.selectInterval")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value.toString()}>
                        {t(preset.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="job-cron">{t("cron.cronExpressionLabel")}</Label>
                <div className="space-y-2">
                  <Input
                    id="job-cron"
                    value={formData.cronExpression}
                    onChange={(e) =>
                      setFormData({ ...formData, cronExpression: e.target.value })
                    }
                    placeholder="0 9 * * *"
                    className="font-mono"
                  />
                  <Select
                    value=""
                    onValueChange={(val) =>
                      setFormData({ ...formData, cronExpression: val })
                    }
                  >
                    <SelectTrigger className="text-muted-foreground">
                      <SelectValue placeholder={t("cron.selectPreset")} />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <span className="font-mono mr-2">{preset.value}</span>
                          <span className="text-muted-foreground">
                            ({t(preset.label)})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Agent */}
            <div className="space-y-2">
              <Label htmlFor="job-agent">{t("cron.agent")}</Label>
              <Input
                id="job-agent"
                value={formData.agent}
                onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
                placeholder="main"
              />
              <p className="text-xs text-muted-foreground">
                {t("cron.agentHint")}
              </p>
            </div>

            {/* Channel (optional) */}
            <div className="space-y-2">
              <Label htmlFor="job-channel">
                {t("cron.channel")} ({t("common.optional")})
              </Label>
              <Input
                id="job-channel"
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                placeholder={t("cron.channelPlaceholder")}
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <Label htmlFor="job-enabled">{t("cron.enabled")}</Label>
              <Switch
                id="job-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingJob(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreateOrUpdate}
              disabled={
                !formData.name.trim() ||
                !formData.message.trim() ||
                creating ||
                updating
              }
            >
              {(creating || updating) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingJob ? t("common.update") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
