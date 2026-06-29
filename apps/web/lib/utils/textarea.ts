/**
 * 在 textarea 光标位置插入文本，如果存在选区则替换选区。
 */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);

  textarea.value = before + text + after;

  // 恢复焦点并将光标移到插入文本之后
  const newCursor = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(newCursor, newCursor);

  // 触发 input 事件以适配 React 受控组件
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
}
