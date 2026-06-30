/**
 * Quick script to create an admin user.
 *
 * Run: npx tsx lib/db/create-admin.ts
 *
 * Set environment variables or edit the values below:
 *   ADMIN_EMAIL    (default: admin@viben.local)
 *   ADMIN_USERNAME (default: admin)
 *   ADMIN_PASSWORD (default: admin123)
 *   ADMIN_NAME     (default: Admin)
 */

import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "../auth/password";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@viben.local";
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const displayName = process.env.ADMIN_NAME || "Admin";

  console.log(`Creating admin user: ${username} <${email}>`);

  // Check if user already exists
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);

  if (existing) {
    console.log(`  User "${existing.username}" already exists (role: ${existing.role}).`);
    if (existing.role !== "super_admin") {
      console.log(`  Updating role from "${existing.role}" to "super_admin"...`);
      await db
        .update(users)
        .set({ role: "super_admin" })
        .where(eq(users.id, existing.id));
      console.log("  Done! Role updated to super_admin.");
    }
    return;
  }

  const now = new Date();
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    email,
    username,
    userSlug: username,
    displayName,
    passwordHash,
    role: "super_admin",
    emailVerified: true,
    followersCount: 0,
    pageCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`  ✅ Admin user created successfully!`);
  console.log(`     ID:       ${id}`);
  console.log(`     Username: ${username}`);
  console.log(`     Email:    ${email}`);
  console.log(`     Password: ${password}`);
  console.log(`     Role:     super_admin`);
}

createAdmin()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
