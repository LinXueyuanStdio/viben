import { useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillFileEntry } from "@/types";

interface FileTreeProps {
  files: SkillFileEntry[];
  selectedPath: string | null;
  onSelectFile: (entry: SkillFileEntry) => void;
  className?: string;
}

export function FileTree({ files, selectedPath, onSelectFile, className }: FileTreeProps) {
  return (
    <div className={cn("text-sm", className)}>
      {files.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  entry: SkillFileEntry;
  selectedPath: string | null;
  onSelectFile: (entry: SkillFileEntry) => void;
  depth: number;
}

function FileTreeNode({ entry, selectedPath, onSelectFile, depth }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2); // Auto-expand first 2 levels
  const isSelected = selectedPath === entry.path;
  const hasChildren = entry.is_directory && entry.children && entry.children.length > 0;

  const handleClick = () => {
    if (entry.is_directory) {
      setIsOpen(!isOpen);
    }
    onSelectFile(entry);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
        return <File className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <File className="h-4 w-4 text-yellow-500" />;
      case 'ts':
      case 'tsx':
        return <File className="h-4 w-4 text-blue-600" />;
      case 'js':
      case 'jsx':
        return <File className="h-4 w-4 text-yellow-600" />;
      case 'py':
        return <File className="h-4 w-4 text-green-500" />;
      case 'rs':
        return <File className="h-4 w-4 text-orange-500" />;
      case 'yaml':
      case 'yml':
        return <File className="h-4 w-4 text-red-400" />;
      case 'toml':
        return <File className="h-4 w-4 text-gray-500" />;
      case 'sh':
      case 'bash':
        return <File className="h-4 w-4 text-green-600" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1 px-2 py-1 rounded-md text-left",
          "hover:bg-accent transition-colors",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {entry.is_directory ? (
          <>
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            {getFileIcon(entry.name)}
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>

      {entry.is_directory && isOpen && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FileTree;
