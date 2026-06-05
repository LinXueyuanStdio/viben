import type { ViewerEntry } from '../viewer-store.js'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Map our language IDs to Monaco language IDs
const MONACO_LANGUAGE: Record<string, string> = {
  typescript: 'typescript', javascript: 'javascript', python: 'python',
  rust: 'rust', go: 'go', java: 'java', kotlin: 'kotlin', ruby: 'ruby',
  php: 'php', c: 'c', cpp: 'cpp', csharp: 'csharp', swift: 'swift',
  bash: 'shell', json: 'json', yaml: 'yaml', toml: 'ini', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', sql: 'sql', markdown: 'markdown',
  dockerfile: 'dockerfile', hcl: 'hcl', plaintext: 'plaintext',
}

function getMonacoLang(lang?: string): string {
  if (!lang) return 'plaintext'
  return MONACO_LANGUAGE[lang] || 'plaintext'
}

/**
 * Render a Monaco-based file viewer HTML page for the given entry.
 *
 * Content is JSON-serialised and injected as a JS variable. `</script>` sequences
 * inside the content are escaped to prevent premature tag closure. The page
 * supports light/dark themes, word wrap, minimap, and markdown preview.
 * URL hash fragments (#L42 or #L42-L55) scroll the editor to the referenced line(s).
 */
export function renderFileViewer(entry: ViewerEntry): string {
  const fileName = entry.filePath || 'untitled'
  const lang = getMonacoLang(entry.language)
  // Escape </script> inside content to prevent premature tag closure
  const safeContent = JSON.stringify(entry.content).replace(/<\//g, '<\\/')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fileName)} - Viben</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1e1e1e; color: #d4d4d4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; height: 100vh; }
    .header { background: #252526; border-bottom: 1px solid #3c3c3c; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; z-index: 10; }
    .file-info { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; }
    .file-icon { font-size: 14px; flex-shrink: 0; }
    .file-path { color: #969696; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-name { color: #e0e0e0; font-weight: 500; flex-shrink: 0; }
    .actions { display: flex; gap: 6px; flex-shrink: 0; }
    .btn { background: #3c3c3c; color: #d4d4d4; border: 1px solid #505050; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.15s; }
    .btn:hover { background: #505050; }
    .btn.active { background: #0e639c; border-color: #1177bb; }
    #editor-container { flex: 1; overflow: hidden; }
    .status-bar { background: #007acc; color: #fff; padding: 2px 16px; font-size: 12px; display: flex; justify-content: space-between; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="file-info">
      <span class="file-icon">📄</span>
      ${formatBreadcrumb(fileName)}
    </div>
    <div class="actions">
      ${lang === 'markdown' ? '<button class="btn" onclick="togglePreview()" id="btn-preview">Preview</button>' : ''}
      <button class="btn" onclick="toggleWordWrap()" id="btn-wrap">Wrap</button>
      <button class="btn" onclick="toggleMinimap()" id="btn-minimap">Minimap</button>
      <button class="btn" onclick="toggleTheme()" id="btn-theme">Light</button>
      <button class="btn" onclick="copyCode()">Copy</button>
    </div>
  </div>
  <div id="editor-container"></div>
  <div id="preview-wrapper" style="display:none; flex:1; overflow-y:auto;">
    <div id="preview-container" style="padding:24px 48px; max-width:900px; margin:0 auto; width:100%;"></div>
  </div>
  <div class="status-bar">
    <span>${escapeHtml(entry.language || 'plaintext')} | ${entry.content.split('\n').length} lines</span>
    <span>Viben Viewer (read-only)</span>
  </div>

  ${lang === 'markdown' ? '<script src="https://cdn.jsdelivr.net/npm/marked@15.0.0/marked.min.js"></script>' : ''}
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js"></script>
  <script>
    function sanitizeHtml(html) {
      let result = html;
      for (let i = 0; i < 3; i++) {
        result = result.replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '');
      }
      result = result.replace(/<\\/?script\\b[^>]*>/gi, '');
      result = result.replace(/\\s+on\\w+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)/gi, '');
      result = result.replace(/(href|src)\\s*=\\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi, '$1=""');
      return result;
    }

    const content = ${safeContent};
    const lang = ${JSON.stringify(lang)};
    let editor;
    let isDark = true;
    let wordWrap = false;
    let minimap = true;

    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    require(['vs/editor/editor.main'], function () {
      editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: content,
        language: lang,
        theme: 'vs-dark',
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        wordWrap: 'off',
        padding: { top: 8 },
      });

      // Handle line range from URL hash: #L42 or #L42-L55
      function highlightFromHash() {
        const hash = location.hash.slice(1);
        const match = hash.match(/^L(\\d+)(?:-L?(\\d+))?$/);
        if (!match) return;
        const startLine = parseInt(match[1], 10);
        const endLine = match[2] ? parseInt(match[2], 10) : startLine;
        editor.revealLineInCenter(startLine);
        editor.setSelection(new monaco.Selection(startLine, 1, endLine + 1, 1));
      }
      highlightFromHash();
      window.addEventListener('hashchange', highlightFromHash);
    });

    function toggleTheme() {
      isDark = !isDark;
      monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
      document.body.style.background = isDark ? '#1e1e1e' : '#ffffff';
      document.querySelector('.header').style.background = isDark ? '#252526' : '#f3f3f3';
      document.querySelector('.header').style.borderColor = isDark ? '#3c3c3c' : '#e0e0e0';
      document.getElementById('btn-theme').textContent = isDark ? 'Light' : 'Dark';
    }

    function toggleWordWrap() {
      wordWrap = !wordWrap;
      editor.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' });
      document.getElementById('btn-wrap').classList.toggle('active', wordWrap);
    }

    function toggleMinimap() {
      minimap = !minimap;
      editor.updateOptions({ minimap: { enabled: minimap } });
      document.getElementById('btn-minimap').classList.toggle('active', !minimap);
    }

    function copyCode() {
      navigator.clipboard.writeText(content).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    }

    let previewMode = false;
    function togglePreview() {
      previewMode = !previewMode;
      const editorEl = document.getElementById('editor-container');
      const wrapperEl = document.getElementById('preview-wrapper');
      const previewEl = document.getElementById('preview-container');
      const btn = document.getElementById('btn-preview');
      if (previewMode) {
        editorEl.style.display = 'none';
        wrapperEl.style.display = 'block';
        if (typeof marked !== 'undefined') {
          const rawHtml = marked.parse(content)
          previewEl.innerHTML = sanitizeHtml(rawHtml)
        } else {
          previewEl.innerHTML = sanitizeHtml(content.replace(/\\n/g, '<br>'));
        }
        previewEl.style.color = isDark ? '#d4d4d4' : '#1e1e1e';
        wrapperEl.style.background = isDark ? '#1e1e1e' : '#ffffff';
        btn.classList.add('active');
        btn.textContent = 'Editor';
      } else {
        editorEl.style.display = 'block';
        wrapperEl.style.display = 'none';
        btn.classList.remove('active');
        btn.textContent = 'Preview';
      }
    }
  </script>
  <style>
    #preview-container { font-size: 15px; line-height: 1.7; }
    #preview-container h1 { font-size: 2em; margin: 0.5em 0 0.3em; border-bottom: 1px solid #3c3c3c; padding-bottom: 0.3em; }
    #preview-container h2 { font-size: 1.5em; margin: 0.5em 0 0.3em; border-bottom: 1px solid #3c3c3c; padding-bottom: 0.2em; }
    #preview-container h3 { font-size: 1.25em; margin: 0.4em 0 0.2em; }
    #preview-container p { margin: 0.5em 0; }
    #preview-container code { background: rgba(128,128,128,0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    #preview-container pre { background: rgba(0,0,0,0.3); padding: 16px; border-radius: 6px; overflow-x: auto; margin: 0.5em 0; }
    #preview-container pre code { background: none; padding: 0; }
    #preview-container blockquote { border-left: 3px solid #505050; padding-left: 16px; margin: 0.5em 0; color: #969696; }
    #preview-container ul, #preview-container ol { padding-left: 24px; margin: 0.5em 0; }
    #preview-container table { border-collapse: collapse; margin: 0.5em 0; width: 100%; }
    #preview-container th, #preview-container td { border: 1px solid #3c3c3c; padding: 6px 12px; text-align: left; }
    #preview-container th { background: rgba(128,128,128,0.15); }
    #preview-container a { color: #3794ff; }
    #preview-container img { max-width: 100%; }
  </style>
</body>
</html>`
}

function formatBreadcrumb(filePath: string): string {
  const parts = filePath.split('/')
  if (parts.length <= 1) return `<span class="file-name">${escapeHtml(filePath)}</span>`
  const dir = parts.slice(0, -1).join(' / ')
  const name = parts[parts.length - 1]
  return `<span class="file-path">${escapeHtml(dir)} /</span> <span class="file-name">${escapeHtml(name)}</span>`
}
