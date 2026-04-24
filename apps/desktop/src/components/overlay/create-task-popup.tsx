import type { ReactElement } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, Play, FolderTree, Loader2, Command, Bot, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { useUiStore } from '@/stores/ui-store';
import { useWorkspaceStore } from '@/stores';
import { useTaskActions, type CreateTaskData } from '@/components/workspace/kanban/hooks/use-task-actions';
import { useAgents } from '@/hooks/use-workspace-resources';
import { useModels } from '@/hooks/use-models';
import { filterModelsByExecutor } from '@/lib/executor-constraints';
import { toast } from '@/hooks/use-toast';
import type { AgentInfo, WorkspaceModel } from '@/lib/gateway';

const POPUP_CONFIG = {
  maxWidth: 560,
  triggerHeight: 20,
  triggerWidth: 300,
  bottomOffset: 24, // 距离底部的距离
};

type TriggerSource = 'hover' | 'click' | null;

/**
 * 底部创建任务浮层
 * - 鼠标移入底部检测区域时滑出
 * - 点击【创建任务】按钮也可唤出
 * - hover 唤出：鼠标移出自动关闭
 * - click 唤出：点击外部关闭
 */
export function CreateTaskPopup(): ReactElement {
  const { t } = useTranslation();
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspacePath = activeWorkspace?.path;
  const { isCreateTaskPopupOpen, closeCreateTaskPopup } = useUiStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectOpenRef = useRef(false); // 追踪 Select 是否打开

  // 显示状态
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // 用于动画
  const [triggerSource, setTriggerSource] = useState<TriggerSource>(null);

  // 表单状态（持久化，不随 popup 关闭而重置）
  const [formState, setFormState] = useState({
    content: '',
    agentId: '',
    modelId: '',
    autoStart: true,
    worktree: false,
    cursorPosition: 0, // 光标位置
  });

  // 解构表单状态便于使用
  const { content, agentId, modelId, autoStart, worktree } = formState;

  // 更新表单字段
  const updateForm = useCallback(<K extends keyof typeof formState>(
    field: K,
    value: typeof formState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  // 加载 agents 和 models
  const { agents, loading: isLoadingAgents } = useAgents({ workspacePath });
  const { models, loading: isLoadingModels } = useModels();
  const isLoadingOptions = isLoadingAgents || isLoadingModels;

  // 选中的 agent 和 model
  const selectedAgent = agents.find((a: AgentInfo) => a.id === agentId);
  const filteredModels = filterModelsByExecutor(
    models.filter((m: WorkspaceModel) => m.is_available).map((m: WorkspaceModel) => ({
      id: m.id,
      name: m.name,
      provider: m.provider_id,
      provider_id: m.provider_id,
    })),
    selectedAgent?.executor_type
  );

  // 自动选择默认 agent 和 model
  useEffect(() => {
    if (isOpen && agents.length > 0 && !agentId) {
      updateForm('agentId', agents[0].id);
    }
  }, [isOpen, agents, agentId, updateForm]);

  useEffect(() => {
    if (filteredModels.length > 0) {
      const currentModelValid = filteredModels.some((m) => m.id === modelId);
      if (!currentModelValid) {
        updateForm('modelId', filteredModels[0].id);
      }
    }
  }, [filteredModels, modelId, updateForm]);

  // 恢复光标位置
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      const pos = formState.cursorPosition;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    }
  }, [isVisible, formState.cursorPosition]);

  // 任务操作
  const taskActions = useTaskActions({
    workspacePath,
    onSuccess: (msg) => toast.success(msg),
    onError: (msg) => toast.error(msg),
  });

  // 处理外部点击打开（通过 ui-store）
  useEffect(() => {
    if (isCreateTaskPopupOpen && !isOpen) {
      setIsOpen(true);
      setTriggerSource('click');
      // 延迟设置 visible 以触发动画
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [isCreateTaskPopupOpen, isOpen]);

  // 清除延迟关闭
  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // 保存光标位置
  const saveCursorPosition = useCallback(() => {
    if (textareaRef.current) {
      updateForm('cursorPosition', textareaRef.current.selectionStart);
    }
  }, [updateForm]);

  // 重置表单（提交成功后调用）
  const resetForm = useCallback(() => {
    setFormState({
      content: '',
      agentId: '',
      modelId: '',
      autoStart: true,
      worktree: false,
      cursorPosition: 0,
    });
  }, []);

  // 关闭弹窗（保留输入状态）
  const handleClose = useCallback(() => {
    clearCloseTimeout();
    // 保存光标位置
    saveCursorPosition();
    // 先触发关闭动画
    setIsVisible(false);
    // 等动画完成后再隐藏
    setTimeout(() => {
      setIsOpen(false);
      setTriggerSource(null);
      // 不清空表单状态，保留用户输入
      closeCreateTaskPopup();
    }, 300); // 与动画时长匹配
  }, [closeCreateTaskPopup, clearCloseTimeout, saveCursorPosition]);

  // 延迟关闭（用于 hover 模式）
  const scheduleClose = useCallback(() => {
    // 如果 Select 打开，不关闭
    if (selectOpenRef.current) return;

    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      if (!selectOpenRef.current) {
        handleClose();
      }
    }, 200);
  }, [handleClose, clearCloseTimeout]);

  // 鼠标进入触发区域
  const handleTriggerMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (!isOpen) {
      setIsOpen(true);
      setTriggerSource('hover');
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [isOpen, clearCloseTimeout]);

  // 鼠标离开触发区域
  const handleTriggerMouseLeave = useCallback(() => {
    if (triggerSource === 'hover') {
      scheduleClose();
    }
  }, [triggerSource, scheduleClose]);

  // 鼠标进入弹窗
  const handleContentMouseEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  // 鼠标离开弹窗
  const handleContentMouseLeave = useCallback(() => {
    if (triggerSource === 'hover') {
      scheduleClose();
    }
  }, [triggerSource, scheduleClose]);

  // 点击外部关闭（仅 click 模式）
  useEffect(() => {
    if (!isOpen || triggerSource !== 'click') return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 检查是否点击了 Select 下拉内容
      if (
        target.closest('[data-radix-select-viewport]') ||
        target.closest('[data-radix-select-content]') ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="option"]') ||
        target.hasAttribute('data-radix-focus-guard')
      ) {
        return;
      }

      // 检查是否点击了弹窗内部
      if (containerRef.current && !containerRef.current.contains(target)) {
        handleClose();
      }
    };

    // 延迟添加监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, triggerSource, handleClose]);

  // 解析内容为标题和描述
  const parseContent = useCallback((text: string) => {
    const lines = text.split('\n');
    const title = lines[0]?.trim() || '';
    const description = lines.slice(1).join('\n').trim() || undefined;
    return { title, description };
  }, []);

  // 提交任务
  const handleSubmit = useCallback(async () => {
    const { title, description } = parseContent(content);
    if (!title) return;

    const data: CreateTaskData = {
      title,
      description,
      agentId,
      modelId,
      autoStart,
      worktree,
    };

    try {
      await taskActions.createTask(data, 'backlog');
      resetForm(); // 提交成功后清空表单
      handleClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }, [content, parseContent, agentId, modelId, autoStart, worktree, taskActions, handleClose, resetForm]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleSubmit, handleClose]);

  // Select 打开/关闭时追踪状态
  const handleSelectOpenChange = useCallback((open: boolean) => {
    selectOpenRef.current = open;
    if (open) {
      clearCloseTimeout();
    }
  }, [clearCloseTimeout]);

  const { title } = parseContent(content);
  const canSubmit = !!title && !taskActions.isCreating;

  // 底部触发区域（始终渲染）
  const trigger = (
    <div
      ref={triggerRef}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[9998]"
      style={{
        width: POPUP_CONFIG.triggerWidth,
        height: POPUP_CONFIG.triggerHeight,
        // 调试时可取消注释查看区域
        // backgroundColor: 'rgba(255, 0, 0, 0.2)',
      }}
    />
  );

  // 弹窗内容
  const popup = isOpen ? (
    <div
      ref={containerRef}
      onMouseEnter={handleContentMouseEnter}
      onMouseLeave={handleContentMouseLeave}
      onKeyDown={handleKeyDown}
      className={cn(
        'fixed z-[10000] left-1/2',
        'bg-popover border border-border',
        'rounded-xl shadow-2xl',
        'transition-all duration-300 ease-out',
        'w-[90vw]',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      )}
      style={{
        maxWidth: POPUP_CONFIG.maxWidth,
        bottom: POPUP_CONFIG.bottomOffset,
        transform: `translateX(-50%) translateY(${isVisible ? '0' : '100%'})`,
      }}
    >
      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-t-xl" />
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('workspace.createTaskDialog.title', '创建任务')}</span>
          </div>
          {/* Input */}
          <Textarea
            ref={textareaRef}
            placeholder={t('workspace.createTaskDialog.combinedPlaceholder', '描述你想要完成的任务...')}
            value={content}
            onChange={(e) => updateForm('content', e.target.value)}
            className="min-h-[100px] resize-none text-sm rounded-lg bg-muted/40 border-border/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 placeholder:text-muted-foreground/40"
          />
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            {t('workspace.createTaskDialog.contentHint', '描述你的任务 - 我会立即开始')}
          </p>
        </div>
      </div>

      {/* Agent & Model Selectors */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('workspace.createTaskDialog.agent', 'Agent')} & {t('workspace.createTaskDialog.model', 'Model')}
          </span>
        </div>
        {isLoadingOptions ? (
          <div className="flex items-center justify-center h-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t('common.loading', 'Loading...')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Agent Selector */}
            <Select
              value={agentId}
              onValueChange={(v) => updateForm('agentId', v)}
              disabled={agents.length === 0}
              onOpenChange={handleSelectOpenChange}
            >
              <SelectTrigger className={cn(
                "h-10 bg-muted/40 border-border/40 hover:bg-muted/60 transition-colors",
                agents.length === 0 && "opacity-60"
              )}>
                <div className="flex items-center gap-2 text-sm truncate">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {agents.length === 0 ? (
                    <span className="text-muted-foreground">{t('chat.noAgents', 'No agents')}</span>
                  ) : (
                    <span className="truncate">{selectedAgent?.name || t('workspace.createTaskDialog.selectAgent', 'Select agent')}</span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                {agents.map((agent: AgentInfo) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex flex-col">
                      <span>{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {agent.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Model Selector */}
            <Select
              value={modelId}
              onValueChange={(v) => updateForm('modelId', v)}
              disabled={filteredModels.length === 0}
              onOpenChange={handleSelectOpenChange}
            >
              <SelectTrigger className={cn(
                "h-10 bg-muted/40 border-border/40 hover:bg-muted/60 transition-colors",
                filteredModels.length === 0 && "opacity-60"
              )}>
                <div className="flex items-center gap-2 text-sm truncate">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {filteredModels.length === 0 ? (
                    <span className="text-muted-foreground">{t('chat.noModels', 'No models')}</span>
                  ) : (
                    <span className="truncate">{filteredModels.find(m => m.id === modelId)?.name || t('workspace.createTaskDialog.selectModel', 'Select model')}</span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                {filteredModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span>{model.name}</span>
                      {model.provider && (
                        <span className="text-xs text-muted-foreground">{model.provider}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20 rounded-b-xl">
        {/* Left: Options */}
        <div className="flex items-center gap-3">
          {/* Worktree toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="popup-worktree"
              checked={worktree}
              onCheckedChange={(v) => updateForm('worktree', v)}
              className="data-[state=checked]:bg-blue-500"
            />
            <Label
              htmlFor="popup-worktree"
              className={cn(
                'text-sm cursor-pointer flex items-center gap-1.5 transition-colors',
                worktree ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {t('workspace.createTaskDialog.worktree', 'Worktree')}
            </Label>
          </div>
        </div>

        {/* Right: Auto-start + Create */}
        <div className="flex items-center gap-3">
          {/* Auto-start toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="popup-auto-start"
              checked={autoStart}
              onCheckedChange={(v) => updateForm('autoStart', v)}
              className="data-[state=checked]:bg-green-500"
            />
            <Label
              htmlFor="popup-auto-start"
              className={cn(
                'text-sm cursor-pointer flex items-center gap-1.5 transition-colors',
                autoStart ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              <Play className="h-3.5 w-3.5" />
              {t('workspace.createTaskDialog.autoStart', '立即开始')}
            </Label>
          </div>

          {/* Create button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 gap-2"
          >
            {taskActions.isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('workspace.createTaskDialog.creating', '创建中...')}
              </>
            ) : (
              <>
                {t('workspace.createTaskDialog.create', '创建任务')}
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-primary-foreground/20 rounded">
                  <Command className="h-2.5 w-2.5" />
                  <span>↵</span>
                </kbd>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {popup && createPortal(popup, document.body)}
    </>
  );
}

/**
 * 创建任务浮层 Layer - 用于 OverlayRoot
 */
export function CreateTaskLayer(): ReactElement {
  return <CreateTaskPopup />;
}
