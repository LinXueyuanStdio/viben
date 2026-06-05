# UI Dashboard Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React + Vite UI project with routing, layout, theme toggle, API client, and SSE hook — ready for page development.

**Architecture:** Standalone `ui/` directory with its own `package.json`. Vite builds to `ui/dist/`, which the backend `StaticServer` auto-detects and serves. Vite dev server proxies `/api/*` to the backend.

**Tech Stack:** React 19, Vite, React Router v7 (library mode), Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-23-ui-dashboard-design.md`

---

### Task 1: Vite + React Project Setup

Scaffold the `ui/` project with all dependencies.

**Files:**
- Create: `ui/package.json`
- Create: `ui/tsconfig.json`
- Create: `ui/vite.config.ts`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/app.css`

- [ ] **Step 1: Create ui/package.json**

```json
{
  "name": "@viben/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create ui/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:21420' },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 4: Create ui/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Viben Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create ui/src/app.css (Tailwind v4)**

```css
@import "tailwindcss";

@variant dark (&:where(.dark *));

@theme {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
}
```

- [ ] **Step 6: Create ui/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ThemeProvider } from './contexts/theme-context'
import { App } from './App'
import './app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 7: Create ui/src/App.tsx (placeholder)**

```tsx
import { Routes, Route } from 'react-router'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Dashboard — coming soon</div>} />
      <Route path="/sessions" element={<div>Sessions — coming soon</div>} />
      <Route path="/sessions/:id" element={<div>Session Detail — coming soon</div>} />
      <Route path="/agents" element={<div>Agents — coming soon</div>} />
      <Route path="/config" element={<div>Config — coming soon</div>} />
      <Route path="/topics" element={<div>Topics — coming soon</div>} />
    </Routes>
  )
}
```

- [ ] **Step 8: Install dependencies and verify dev server starts**

```bash
cd ui && pnpm install
pnpm dev  # Should start on port 5173
# Ctrl+C to stop
```

- [ ] **Step 9: Verify build works**

```bash
cd ui && pnpm build
ls dist/index.html  # Should exist
```

- [ ] **Step 10: Add ui/ to root .gitignore**

Add to `.gitignore`:
```
ui/node_modules/
ui/dist/
```

- [ ] **Step 11: Add build:ui script to root package.json**

Add to root `package.json` scripts:
```json
"build:ui": "cd ui && pnpm install --frozen-lockfile && pnpm build"
```

- [ ] **Step 12: Commit**

```bash
git add ui/ .gitignore package.json
git commit -m "feat(ui): scaffold React + Vite project with Tailwind v4"
```

---

### Task 2: Theme System

Dark/light toggle with localStorage persistence.

**Files:**
- Create: `ui/src/contexts/theme-context.tsx`
- Create: `ui/src/hooks/use-theme.ts`
- Create: `ui/src/lib/theme.ts`

- [ ] **Step 1: Create ui/src/lib/theme.ts**

```typescript
const STORAGE_KEY = 'viben-theme'

export type Theme = 'light' | 'dark'

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
```

- [ ] **Step 2: Create ui/src/contexts/theme-context.tsx**

```tsx
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { getInitialTheme, persistTheme, applyTheme, type Theme } from '../lib/theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      persistTheme(next)
      return next
    })
  }, [])

  return (
    <ThemeContext value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext>
  )
}
```

- [ ] **Step 3: Create ui/src/hooks/use-theme.ts**

```typescript
import { useContext } from 'react'
import { ThemeContext } from '../contexts/theme-context'

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 4: Verify build**

```bash
cd ui && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/contexts/ ui/src/hooks/ ui/src/lib/
git commit -m "feat(ui): add dark/light theme system with localStorage persistence"
```

---

### Task 3: API Client

Typed fetch wrapper for backend API.

**Files:**
- Create: `ui/src/api/client.ts`
- Create: `ui/src/api/types.ts`

- [ ] **Step 1: Create ui/src/api/types.ts**

```typescript
export type SessionStatus = 'initializing' | 'active' | 'cancelled' | 'finished' | 'error'

export interface SessionSummary {
  id: string
  agent: string
  status: SessionStatus
  name: string | null
  workspace: string
  createdAt: string
  dangerousMode: boolean
  queueDepth: number
  promptRunning: boolean
  lastActiveAt: string | null
}

export interface SessionDetail {
  id: string
  agent: string
  status: SessionStatus
  name: string | null
  workspace: string
  createdAt: string
  dangerousMode: boolean
  queueDepth: number
  promptRunning: boolean
  threadId: string
  channelId: string
  agentSessionId: string
}

export interface AgentInfo {
  name: string
  command: string
  args: string[]
  workingDirectory?: string
  capabilities: string[]
}

export interface HealthData {
  status: string
  uptime: number
  version: string
  memory: { rss: number; heapUsed: number; heapTotal: number }
  sessions: { active: number; total: number }
  adapters: string[]
  tunnel: { enabled: boolean; url?: string }
}

export interface ConfigField {
  path: string
  displayName: string
  group: string
  type: string
  options?: string[]
  value: unknown
  hotReload: boolean
}

export interface TopicInfo {
  sessionId: string
  name: string
  status: string
  createdAt: string
}
```

- [ ] **Step 2: Create ui/src/api/client.ts**

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('viben-token')
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 3: Verify build**

```bash
cd ui && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/api/
git commit -m "feat(ui): add typed API client with auth support"
```

---

### Task 4: SSE Hook

Custom React hook for EventSource with auto-reconnect.

**Files:**
- Create: `ui/src/api/use-event-stream.ts`

- [ ] **Step 1: Create ui/src/api/use-event-stream.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

type EventHandler = (data: unknown) => void

export function useEventStream(sessionId?: string) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const sourceRef = useRef<EventSource | null>(null)
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map())
  const retryRef = useRef(1000)

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set())
    }
    handlersRef.current.get(event)!.add(handler)

    return () => {
      handlersRef.current.get(event)?.delete(handler)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return

      const token = sessionStorage.getItem('viben-token')
      const params = new URLSearchParams()
      if (sessionId) params.set('sessionId', sessionId)
      if (token) params.set('token', token)
      const qs = params.toString()
      const url = `/api/events${qs ? `?${qs}` : ''}`

      setStatus('connecting')
      const source = new EventSource(url)
      sourceRef.current = source

      source.onopen = () => {
        if (cancelled) return
        setStatus('connected')
        retryRef.current = 1000
      }

      source.onerror = () => {
        if (cancelled) return
        source.close()
        sourceRef.current = null
        setStatus('disconnected')
        const delay = Math.min(retryRef.current, 30000)
        retryRef.current = delay * 2
        setTimeout(connect, delay)
      }

      // Listen for all known event types
      const events = [
        'session:created', 'session:updated', 'session:deleted',
        'agent:event', 'permission:request', 'health',
      ]
      for (const eventName of events) {
        source.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            const handlers = handlersRef.current.get(eventName)
            if (handlers) {
              for (const handler of handlers) handler(data)
            }
          } catch { /* ignore parse errors */ }
        })
      }
    }

    connect()

    return () => {
      cancelled = true
      sourceRef.current?.close()
      sourceRef.current = null
    }
  }, [sessionId])

  return { status, subscribe }
}
```

- [ ] **Step 2: Verify build**

```bash
cd ui && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/use-event-stream.ts
git commit -m "feat(ui): add SSE hook with auto-reconnect and event subscription"
```

---

### Task 5: Layout Components

Sidebar, header, and theme toggle.

**Files:**
- Create: `ui/src/components/layout/Sidebar.tsx`
- Create: `ui/src/components/layout/Header.tsx`
- Create: `ui/src/components/layout/Layout.tsx`
- Modify: `ui/src/App.tsx` (wrap routes in Layout)

- [ ] **Step 1: Create ui/src/components/layout/Sidebar.tsx**

```tsx
import { NavLink } from 'react-router'
import { useEventStream } from '../../api/use-event-stream'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/sessions', label: 'Sessions', icon: '◎' },
  { to: '/agents', label: 'Agents', icon: '◎' },
  { to: '/config', label: 'Config', icon: '◎' },
  { to: '/topics', label: 'Topics', icon: '◎' },
]

export function Sidebar({ connectionStatus }: { connectionStatus: string }) {
  return (
    <aside className="flex flex-col w-56 h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      <div className="p-4 text-lg font-bold text-zinc-900 dark:text-white">
        Viben
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
          {connectionStatus === 'connected' ? 'Online' :
           connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create ui/src/components/layout/Header.tsx**

```tsx
import { useTheme } from '../../hooks/use-theme'

export function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex items-center justify-end h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </header>
  )
}
```

- [ ] **Step 3: Create ui/src/components/layout/Layout.tsx**

```tsx
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useEventStream } from '../../api/use-event-stream'

export function Layout() {
  const { status } = useEventStream()

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar connectionStatus={status} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update ui/src/App.tsx**

```tsx
import { Routes, Route } from 'react-router'
import { Layout } from './components/layout/Layout'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<div className="text-xl">Dashboard — coming soon</div>} />
        <Route path="/sessions" element={<div className="text-xl">Sessions — coming soon</div>} />
        <Route path="/sessions/:id" element={<div className="text-xl">Session Detail — coming soon</div>} />
        <Route path="/agents" element={<div className="text-xl">Agents — coming soon</div>} />
        <Route path="/config" element={<div className="text-xl">Config — coming soon</div>} />
        <Route path="/topics" element={<div className="text-xl">Topics — coming soon</div>} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 5: Verify build and dev server**

```bash
cd ui && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/ ui/src/App.tsx
git commit -m "feat(ui): add sidebar layout with navigation and theme toggle"
```

---

### Task 6: Shared Components

Basic reusable UI components.

**Files:**
- Create: `ui/src/components/shared/StatusBadge.tsx`
- Create: `ui/src/components/shared/Card.tsx`
- Create: `ui/src/components/shared/Button.tsx`
- Create: `ui/src/components/shared/Modal.tsx`
- Create: `ui/src/components/shared/Toggle.tsx`

- [ ] **Step 1: Create StatusBadge**

```tsx
// ui/src/components/shared/StatusBadge.tsx
import type { SessionStatus } from '../../api/types'

const STATUS_COLORS: Record<SessionStatus, string> = {
  initializing: 'bg-yellow-500',
  active: 'bg-green-500',
  cancelled: 'bg-zinc-400',
  finished: 'bg-blue-500',
  error: 'bg-red-500',
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Create Card**

```tsx
// ui/src/components/shared/Card.tsx
import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create Button**

```tsx
// ui/src/components/shared/Button.tsx
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md'
}

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700',
  danger: 'bg-red-500 text-white hover:bg-red-600',
}

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Create Modal**

```tsx
// ui/src/components/shared/Modal.tsx
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create Toggle**

```tsx
// ui/src/components/shared/Toggle.tsx
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : ''
        }`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
cd ui && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/shared/
git commit -m "feat(ui): add shared components — StatusBadge, Card, Button, Modal, Toggle"
```

---

### Task 7: Format Utilities

Helper functions for formatting durations, bytes, and dates.

**Files:**
- Create: `ui/src/lib/format.ts`

- [ ] **Step 1: Create ui/src/lib/format.ts**

```typescript
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}
```

- [ ] **Step 2: Verify build**

```bash
cd ui && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/lib/format.ts
git commit -m "feat(ui): add format utilities for duration, bytes, and dates"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full build**

```bash
cd ui && pnpm build
```

- [ ] **Step 2: Verify backend serves UI**

```bash
# From project root
pnpm build
pnpm start &
sleep 2
curl -s http://localhost:21420/ | head -5  # Should return HTML
kill %1
```

- [ ] **Step 3: Commit any remaining changes**
