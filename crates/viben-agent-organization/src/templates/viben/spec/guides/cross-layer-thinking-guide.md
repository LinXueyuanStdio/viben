# Cross-Layer Thinking Guide

> A systematic approach to changes that span multiple system layers.

---

## When to Use This Guide

Use this guide when your change involves:
- Database schema changes
- API endpoint changes
- Frontend-backend integration
- Changes to shared types/interfaces

---

## Layer Map

| Layer | Description | Common Locations |
|-------|-------------|------------------|
| Database | Data storage | `db/`, `models/`, `schema/` |
| Service | Business logic | `services/`, `lib/`, `core/` |
| API | HTTP interface | `routes/`, `api/`, `handlers/` |
| Frontend | UI layer | `components/`, `pages/`, `views/` |

---

## Pre-Implementation Checklist

Before writing code, answer these questions:

### 1. Data Flow
- [ ] Where does the data originate?
- [ ] What transformations happen at each layer?
- [ ] Where does it end up (display/storage)?

### 2. Type Consistency
- [ ] Are types defined in a shared location?
- [ ] Do all layers use the same type definitions?
- [ ] What happens if types don't match?

### 3. Error Handling
- [ ] How are errors propagated up the stack?
- [ ] What error format does the frontend expect?
- [ ] Are errors logged at appropriate layers?

### 4. Loading/Pending States
- [ ] How does the UI indicate loading?
- [ ] What happens on timeout?
- [ ] Is there optimistic updating?

---

## Implementation Order

For cross-layer features, implement in this order:

1. **Types first** - Define shared types
2. **Database layer** - Schema changes
3. **Service layer** - Business logic
4. **API layer** - Endpoint implementation
5. **Frontend layer** - UI integration

---

## Post-Implementation Checklist

After implementation:

- [ ] Test full data flow (create/read/update/delete)
- [ ] Verify error handling at each boundary
- [ ] Check loading states render correctly
- [ ] Confirm types match across layers
