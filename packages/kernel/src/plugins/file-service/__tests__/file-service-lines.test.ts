import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { FileService } from '../file-service.js'

describe('FileService.readTextFileWithRange', () => {
  let tmpDir: string
  let testFile: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'))
    testFile = path.join(tmpDir, 'test.txt')
    fs.writeFileSync(testFile, 'line1\nline2\nline3\nline4\nline5')
  })

  afterAll(() => { fs.rmSync(tmpDir, { recursive: true }) })

  it('reads full file without options', async () => {
    const content = await FileService.readTextFileWithRange(testFile)
    expect(content).toBe('line1\nline2\nline3\nline4\nline5')
  })

  it('reads from specific line (1-indexed)', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 3 })
    expect(content).toBe('line3\nline4\nline5')
  })

  it('reads with limit', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { limit: 2 })
    expect(content).toBe('line1\nline2')
  })

  it('reads with line + limit', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 2, limit: 2 })
    expect(content).toBe('line2\nline3')
  })

  it('handles line beyond file length', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 100 })
    expect(content).toBe('')
  })
})
