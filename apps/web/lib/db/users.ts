// Assistant: user queries adapted for viben users table
import { eq } from "drizzle-orm";
import { users } from "./schema";
import { db } from "./client";

export async function getUserById(id: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByUsername(username: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0] ?? null;
}
