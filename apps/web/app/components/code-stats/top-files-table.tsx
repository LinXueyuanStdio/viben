'use client';

import { useRef } from 'react';
import { useInView } from '../animated-cards/use-in-view';
import type { FileStat } from './types';

interface TopFilesTableProps {
  files: FileStat[];
}

const EXT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ts: { bg: 'rgba(49, 120, 198, 0.1)', border: 'rgba(49, 120, 198, 0.3)', text: '#3178C6' },
  tsx: { bg: 'rgba(97, 218, 251, 0.1)', border: 'rgba(97, 218, 251, 0.3)', text: '#61DAFB' },
  js: { bg: 'rgba(247, 223, 30, 0.1)', border: 'rgba(247, 223, 30, 0.3)', text: '#F7DF1E' },
  jsx: { bg: 'rgba(97, 218, 251, 0.1)', border: 'rgba(97, 218, 251, 0.3)', text: '#61DAFB' },
  py: { bg: 'rgba(55, 118, 171, 0.1)', border: 'rgba(55, 118, 171, 0.3)', text: '#3776AB' },
  md: { bg: 'rgba(8, 63, 161, 0.1)', border: 'rgba(8, 63, 161, 0.3)', text: '#083FA1' },
  json: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#F59E0B' },
  yaml: { bg: 'rgba(203, 23, 30, 0.1)', border: 'rgba(203, 23, 30, 0.3)', text: '#CB171E' },
  yml: { bg: 'rgba(203, 23, 30, 0.1)', border: 'rgba(203, 23, 30, 0.3)', text: '#CB171E' },
  css: { bg: 'rgba(21, 114, 182, 0.1)', border: 'rgba(21, 114, 182, 0.3)', text: '#1572B6' },
  html: { bg: 'rgba(227, 79, 38, 0.1)', border: 'rgba(227, 79, 38, 0.3)', text: '#E34F26' },
  sh: { bg: 'rgba(137, 224, 81, 0.1)', border: 'rgba(137, 224, 81, 0.3)', text: '#89E051' },
};

function getExtStyle(ext: string) {
  return EXT_COLORS[ext.toLowerCase()] || {
    bg: 'rgba(107, 114, 128, 0.1)',
    border: 'rgba(107, 114, 128, 0.3)',
    text: '#6B7280',
  };
}

function formatPath(path: string): { dir: string; file: string } {
  const parts = path.split('/');
  const file = parts.pop() || '';
  const dir = parts.join('/');
  return { dir: dir ? dir + '/' : '', file };
}

export function TopFilesTable({ files }: TopFilesTableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const maxLines = Math.max(...files.map((f) => f.lines));

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.7s' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">TOP 文件</h3>
          <p className="text-sm text-zinc-500">行数最多的源代码文件</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-300">
          TOP {files.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                #
              </th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                文件路径
              </th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                类型
              </th>
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                行数
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, index) => {
              const { dir, file: fileName } = formatPath(file.path);
              const extStyle = getExtStyle(file.ext);
              const percent = (file.lines / maxLines) * 100;

              return (
                <tr
                  key={file.path}
                  className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                    isInView ? 'animate-fade-in-up' : 'opacity-0'
                  }`}
                  style={{ animationDelay: `${0.8 + index * 0.03}s` }}
                >
                  <td className="py-3 font-mono text-xs text-zinc-500">{index + 1}</td>
                  <td className="py-3 max-w-md">
                    <div className="font-mono text-xs truncate">
                      <span className="text-zinc-500">{dir}</span>
                      <span className="text-amber-300">{fileName}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className="inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold"
                      style={{
                        backgroundColor: extStyle.bg,
                        borderColor: extStyle.border,
                        color: extStyle.text,
                        border: '1px solid',
                      }}
                    >
                      .{file.ext}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-zinc-200 min-w-[50px] text-right">
                        {file.lines.toLocaleString()}
                      </span>
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden min-w-[80px]">
                        <div
                          className="h-full rounded-full bg-amber-300/60 transition-all duration-1000"
                          style={{
                            width: isInView ? `${percent}%` : '0%',
                            transitionDelay: `${0.9 + index * 0.03}s`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
