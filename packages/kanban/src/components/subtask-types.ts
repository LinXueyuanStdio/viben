export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: string;
}

export interface SubtaskCallbacks {
  onToggle?: (id: string, completed: boolean) => void;
  onCreate?: (title: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, title: string) => void;
}
