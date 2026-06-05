# Remote Identity Claim — Server Design

**Date:** 2026-04-14
**Scope:** Core (`src/plugins/api-server/auth/token-store.ts`, `src/plugins/api-server/auth/types.ts`, `src/plugins/api-server/index.ts`, `src/plugins/identity/routes/setup.ts`)

## Problem

1. `POST /identity/setup` has no reconnect path — no way to silently re-link a new token to an existing user when the old token has expired beyond the refresh deadline.
2. The previous candidate for re-link credential (`tokenId`) equals the JWT `sub` claim, which is base64-decodable by anyone who has the JWT. A dedicated `identitySecret` is required.

## Change 1: Add `identitySecret` to `StoredToken`

`identitySecret` is a random 32-char hex string generated at token creation time. It is:
- Never embedded in the JWT (not in `sub`, payload, or anywhere)
- Returned once to the caller at exchange/creation time
- Stored in `StoredToken` for server-side lookup
- Used exclusively as a re-link credential

### `StoredToken` (types.ts)

Add field:
```typescript
identitySecret: string  // random 32-char hex, generated at creation, never in JWT
```

### `TokenStore` (token-store.ts)

1. `create()` — generate `identitySecret = randomBytes(16).toString('hex')` and store it.
2. New method: `getByIdentitySecret(secret: string): StoredToken | undefined` — linear scan over non-revoked tokens, returns match or undefined.

### Exchange response (index.ts)

Return `identitySecret` alongside the existing fields:
```typescript
return {
  accessToken,
  tokenId: stored.id,
  expiresAt,
  refreshDeadline: stored.refreshDeadline,
  identitySecret: stored.identitySecret,  // ← new
}
```

Same for `POST /auth/tokens` (manual token creation via secret auth) — also return `identitySecret`.

## Change 2: Extend `POST /identity/setup` with `identitySecret` path

### Updated request body (all paths)

```typescript
// Path 1 (new user):
{ displayName: string; username?: string }

// Path 2 (link-code, unchanged):
{ linkCode: string }

// Path 3 (reconnect, new):
{ identitySecret: string }
```

### Handler logic (priority order)

```
1. Token already linked (idempotent)       → return existing user
2. body.identitySecret present             → re-link path
3. body.linkCode present                   → existing link-code path (unchanged)
4. body.displayName present                → new user path
5. else                                    → 400 Bad Request
```

### Re-link path implementation

```typescript
if (body?.identitySecret) {
  const oldToken = tokenStore?.getByIdentitySecret(body.identitySecret as string)
  if (!oldToken) {
    return reply.status(401).send({ error: 'Invalid identity secret' })
  }
  const userId = tokenStore?.getUserId(oldToken.id)
  if (!userId) {
    return reply.status(401).send({ error: 'No identity linked to this secret' })
  }
  await service.createIdentity(userId, {
    source: 'api',
    platformId: auth.tokenId as string,
  })
  tokenStore?.setUserId(auth.tokenId as string, userId)
  return service.getUser(userId)
}
```

## Change 3: Path 1 (new user) — add `username`

```typescript
const { user } = await service.createUserWithIdentity({
  displayName: body.displayName as string,
  username: body.username as string | undefined,  // ← add this
  source: 'api',
  platformId: auth.tokenId as string,
})
```

`IdentityServiceImpl.createUserWithIdentity` already accepts `username` — no service changes needed.

## Security

| Property | Detail |
|---|---|
| Not in JWT | `identitySecret` never appears in the JWT payload, only in `StoredToken` |
| Unguessable | 32-char hex = 128 bits entropy, cryptographically random |
| Single use context | Used only for identity re-linking — no other privilege |
| Bounded exposure | Revoked tokens retain their `identitySecret` but `getByIdentitySecret` only matches non-revoked tokens, so re-linking after revocation is rejected |

## Storage Migration

`identitySecret` is a new field on `StoredToken`. Existing tokens in `tokens.json` will not have it. On load, tokens without `identitySecret` silently get one generated and the file is re-persisted. This ensures backward compatibility — existing tokens continue to work for auth; they simply gain re-link capability after the first server restart.

## Summary of Files Changed

| File | Change |
|---|---|
| `auth/types.ts` | Add `identitySecret: string` to `StoredToken` |
| `auth/token-store.ts` | Generate secret in `create()`, add `getByIdentitySecret()`, migrate on load |
| `index.ts` | Return `identitySecret` in exchange response |
| `routes/auth.ts` | Return `identitySecret` in `POST /tokens` response |
| `identity/routes/setup.ts` | Add `identitySecret` re-link path + `username` to new-user path |
