import { describe, it, expect } from 'vitest'
import { extractFileInfo } from '../plugins/tunnel/extract-file-info.js'

describe('extractFileInfo', () => {
  describe('kind filtering', () => {
    it('returns null for non-file tool kinds', () => {
      expect(extractFileInfo('bash', 'bash', 'output')).toBeNull()
      expect(extractFileInfo('search', 'search', 'results')).toBeNull()
    })

    it('processes read kind', () => {
      const result = extractFileInfo('Read file.ts', 'read', null, { file_path: '/a/b.ts', content: 'code' })
      expect(result).toMatchObject({ filePath: '/a/b.ts', content: 'code' })
    })

    it('processes edit kind', () => {
      const result = extractFileInfo('Edit file.ts', 'edit', null, { file_path: '/a/b.ts', content: 'new' })
      expect(result).toMatchObject({ filePath: '/a/b.ts', content: 'new' })
    })

    it('processes write kind', () => {
      const result = extractFileInfo('Write file.ts', 'write', null, { file_path: '/a/b.ts', content: 'data' })
      expect(result).toMatchObject({ filePath: '/a/b.ts', content: 'data' })
    })

    it('processes events with undefined kind', () => {
      const result = extractFileInfo('Read file.ts', undefined, null, { file_path: '/a/b.ts', content: 'data' })
      expect(result).toMatchObject({ filePath: '/a/b.ts' })
    })
  })

  describe('meta extraction (Claude Code)', () => {
    it('extracts from _meta.claudeCode.toolResponse.file', () => {
      const meta = {
        claudeCode: {
          toolResponse: {
            file: { filePath: '/src/app.ts', content: 'export default {}' },
          },
        },
      }
      const result = extractFileInfo('Read', 'read', null, null, meta)
      expect(result).toMatchObject({
        filePath: '/src/app.ts',
        content: 'export default {}',
      })
    })

    it('extracts from _meta.claudeCode.toolResponse direct fields', () => {
      const meta = {
        claudeCode: {
          toolResponse: {
            filePath: '/src/app.ts',
            content: 'updated',
          },
        },
      }
      const result = extractFileInfo('Write', 'write', null, null, meta)
      expect(result).toMatchObject({
        filePath: '/src/app.ts',
        content: 'updated',
      })
    })
  })

  describe('rawInput extraction', () => {
    it('extracts file_path from rawInput', () => {
      const rawInput = { file_path: '/src/test.ts', content: 'test code' }
      const result = extractFileInfo('Edit', 'edit', null, rawInput)
      expect(result).toMatchObject({ filePath: '/src/test.ts' })
    })

    it('extracts filePath (camelCase) from rawInput', () => {
      const rawInput = { filePath: '/src/test.ts', content: 'data' }
      const result = extractFileInfo('Edit', 'edit', 'data', rawInput)
      expect(result).toMatchObject({ filePath: '/src/test.ts' })
    })

    it('extracts path from rawInput', () => {
      const rawInput = { path: '/src/test.ts', content: 'data' }
      const result = extractFileInfo('Edit', 'edit', 'data', rawInput)
      expect(result).toMatchObject({ filePath: '/src/test.ts' })
    })
  })

  describe('ACP content patterns', () => {
    it('extracts from diff block', () => {
      const content = [{ type: 'diff', path: '/src/app.ts', oldText: 'old', newText: 'new' }]
      const result = extractFileInfo('Edit', 'edit', content)
      expect(result).toMatchObject({
        filePath: '/src/app.ts',
        content: 'new',
        oldContent: 'old',
      })
    })

    it('extracts from content wrapper', () => {
      const content = [{ type: 'content', content: { type: 'text', text: 'hello' } }]
      const result = extractFileInfo('Read test.ts', 'read', content)
      expect(result).toMatchObject({ content: 'hello' })
    })

    it('extracts from text block', () => {
      const content = { type: 'text', text: 'file content', filePath: '/src/test.ts' }
      const result = extractFileInfo('Read', 'read', content)
      expect(result).toMatchObject({
        filePath: '/src/test.ts',
        content: 'file content',
      })
    })

    it('extracts from direct text field', () => {
      const content = { text: 'data', filePath: '/src/file.ts' }
      const result = extractFileInfo('Read', 'read', content)
      expect(result).toMatchObject({
        filePath: '/src/file.ts',
        content: 'data',
      })
    })

    it('extracts from file_path + content object', () => {
      const content = { file_path: '/src/f.ts', content: 'code' }
      const result = extractFileInfo('Edit', 'edit', content)
      expect(result).toMatchObject({
        filePath: '/src/f.ts',
        content: 'code',
      })
    })

    it('extracts from nested input', () => {
      const content = { input: { file_path: '/src/f.ts', content: 'nested' } }
      const result = extractFileInfo('Edit', 'edit', content)
      expect(result).toMatchObject({
        filePath: '/src/f.ts',
        content: 'nested',
      })
    })

    it('extracts from nested output', () => {
      const content = { output: { type: 'text', text: 'output data', filePath: '/src/out.ts' } }
      const result = extractFileInfo('Read', 'read', content)
      expect(result).toMatchObject({
        filePath: '/src/out.ts',
        content: 'output data',
      })
    })

    it('handles string content directly', () => {
      const result = extractFileInfo('Read /src/test.ts', 'read', 'file content')
      expect(result).toMatchObject({
        filePath: '/src/test.ts',
        content: 'file content',
      })
    })

    it('iterates array to find first match', () => {
      const content = [
        { type: 'text', text: '' }, // empty - skip
        { type: 'text', text: 'found', filePath: '/src/f.ts' },
      ]
      const result = extractFileInfo('Read', 'read', content)
      expect(result).toMatchObject({
        filePath: '/src/f.ts',
        content: 'found',
      })
    })
  })

  describe('file path inference from tool name', () => {
    it('infers path from "Read /path/to/file"', () => {
      const result = extractFileInfo('Read /src/test.ts', 'read', 'content')
      expect(result?.filePath).toBe('/src/test.ts')
    })

    it('infers path from "Edit /path/to/file"', () => {
      const result = extractFileInfo('Edit /src/test.ts', 'edit', 'content')
      expect(result?.filePath).toBe('/src/test.ts')
    })

    it('infers path from "Write /path/to/file"', () => {
      const result = extractFileInfo('Write /src/test.ts', 'write', 'content')
      expect(result?.filePath).toBe('/src/test.ts')
    })
  })

  describe('edge cases', () => {
    it('returns null when no content and no rawInput', () => {
      expect(extractFileInfo('Unknown', 'read', null)).toBeNull()
    })

    it('returns null when content has no file path or content', () => {
      expect(extractFileInfo('Tool', 'read', { type: 'unknown' })).toBeNull()
    })

    it('returns null for diff block with no newText', () => {
      const content = [{ type: 'diff', path: '/f.ts', oldText: 'old', newText: null }]
      expect(extractFileInfo('Edit', 'edit', content)).toBeNull()
    })

    it('handles oldContent with old_content key', () => {
      const content = { file_path: '/f.ts', content: 'new', old_content: 'old' }
      const result = extractFileInfo('Edit', 'edit', content)
      expect(result?.oldContent).toBe('old')
    })

    it('handles oldContent with oldText key', () => {
      const content = { filePath: '/f.ts', newText: 'new', oldText: 'old' }
      const result = extractFileInfo('Edit', 'edit', content)
      expect(result).toMatchObject({
        filePath: '/f.ts',
        content: 'new',
        oldContent: 'old',
      })
    })

    it('extracts apply_patch file info from rawOutput metadata files', () => {
      const rawOutput = {
        metadata: {
          files: [
            {
              filePath: '/src/main.ts',
              before: 'const a = 1',
              after: 'const a = 2',
            },
          ],
        },
      }

      const result = extractFileInfo('apply_patch', 'other', null, null, null, rawOutput)
      expect(result).toMatchObject({
        filePath: '/src/main.ts',
        content: 'const a = 2',
        oldContent: 'const a = 1',
      })
    })

    it('returns null for malformed apply_patch rawOutput', () => {
      const rawOutput = {
        metadata: {
          files: [
            { additions: 1, deletions: 1 },
            { filePath: 123, after: 456 },
          ],
        },
      }

      const result = extractFileInfo('apply_patch', 'other', null, null, null, rawOutput)
      expect(result).toBeNull()
    })

    it('extracts apply_patch rawOutput when tool_update name is missing but patchText exists', () => {
      const rawInput = { patchText: '*** Begin Patch\n*** Update File: src/main.ts\n*** End Patch' }
      const rawOutput = {
        metadata: {
          files: [
            {
              filePath: '/src/main.ts',
              before: 'const a = 1',
              after: 'const a = 2',
            },
          ],
        },
      }

      const result = extractFileInfo('', 'other', null, rawInput, null, rawOutput)
      expect(result).toMatchObject({
        filePath: '/src/main.ts',
        content: 'const a = 2',
        oldContent: 'const a = 1',
      })
    })

    it('prefers apply_patch file with largest diff score for viewer target', () => {
      const rawOutput = {
        metadata: {
          files: [
            {
              filePath: '/src/small.ts',
              before: 'a',
              after: 'b',
              additions: 1,
              deletions: 1,
            },
            {
              filePath: '/src/large.ts',
              before: 'x',
              after: 'y',
              additions: 8,
              deletions: 3,
            },
          ],
        },
      }

      const result = extractFileInfo('apply_patch', 'other', null, null, null, rawOutput)
      expect(result).toMatchObject({
        filePath: '/src/large.ts',
        content: 'y',
        oldContent: 'x',
      })
    })
  })
})
