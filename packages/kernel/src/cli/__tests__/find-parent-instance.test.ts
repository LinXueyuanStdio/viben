import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { findParentInstance } from '../instance-prompt.js'

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'viben-prompt-test-'))
}

describe('findParentInstance', () => {
  const dirs: string[] = []

  function makeTmp() {
    const d = tmpDir()
    dirs.push(d)
    return d
  }

  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
    dirs.length = 0
  })

  it('finds .viben in parent directory', () => {
    const root = makeTmp()
    const instance = path.join(root, '.viben')
    fs.mkdirSync(instance)
    fs.writeFileSync(path.join(instance, 'config.json'), '{}')
    const nested = path.join(root, 'project', 'src')
    fs.mkdirSync(nested, { recursive: true })

    expect(findParentInstance(nested, '/fake/global')).toBe(instance)
  })

  it('finds nearest parent when multiple exist', () => {
    const root = makeTmp()
    const rootInstance = path.join(root, '.viben')
    fs.mkdirSync(rootInstance)
    fs.writeFileSync(path.join(rootInstance, 'config.json'), '{}')
    const child = path.join(root, 'workspace')
    const childInstance = path.join(child, '.viben')
    fs.mkdirSync(childInstance, { recursive: true })
    fs.writeFileSync(path.join(childInstance, 'config.json'), '{}')
    const nested = path.join(child, 'project', 'src')
    fs.mkdirSync(nested, { recursive: true })

    expect(findParentInstance(nested, '/fake/global')).toBe(childInstance)
  })

  it('skips global root', () => {
    const root = makeTmp()
    const instance = path.join(root, '.viben')
    fs.mkdirSync(instance)
    fs.writeFileSync(path.join(instance, 'config.json'), '{}')
    const nested = path.join(root, 'src')
    fs.mkdirSync(nested, { recursive: true })

    // When the found instance IS the global root, skip it
    expect(findParentInstance(nested, instance)).toBeNull()
  })

  it('returns null when no parent instance exists', () => {
    const root = makeTmp()
    const nested = path.join(root, 'deep', 'path')
    fs.mkdirSync(nested, { recursive: true })

    expect(findParentInstance(nested, '/fake/global')).toBeNull()
  })

  it('does not check exact CWD', () => {
    const root = makeTmp()
    // .viben is at exact CWD, not parent
    fs.mkdirSync(path.join(root, '.viben'))

    expect(findParentInstance(root, '/fake/global')).toBeNull()
  })
})
