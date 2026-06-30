---
sidebar_position: 1
title: Web Module Specifications
description: Frontend module development specifications for Viben Web application
---

# Web Module Specifications

> Frontend module development specification documents for Viben Web application (apps/web).

---

## Overview

This directory contains frontend development specifications for various functional modules of the Viben Web application, covering core modules such as UI Shell, authentication, user profile, and admin dashboard.

---

## Module Index

| Module | Description | Status |
|--------|-------------|--------|
| [UI Shell](./ui-shell.md) | Application shell: layout, navigation, theming | Complete |
| [Auth UI](./auth-ui.md) | Authentication UI: login, registration, OAuth | Complete |
| [Profile UI](./profile-ui.md) | User profile: settings, API key management | Complete |
| [Admin UI](./admin-ui.md) | Admin dashboard: content moderation, user management | Complete |

---

## Architecture Decisions

### Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework, App Router |
| shadcn/ui | UI component library |
| Tailwind CSS | Styling system |
| Zustand | Client-side state management |
| react-hook-form | Form handling |
| zod | Form validation |

### Design Principles

1. **Server Components First**: Use server components for data fetching
2. **Progressive Enhancement**: Use client components for forms and interactions
3. **Type Safety**: TypeScript throughout, zod validation
4. **Consistent Experience**: Follow Viben Design System

---

## Related Documentation

- [Design System](../design-system.md) - Design system specifications
- [Components](../components.md) - Component development guide
