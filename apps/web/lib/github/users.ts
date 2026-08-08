import "server-only";
import { db, githubConnections, oauthConnections } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGithubOAuthToken } from "./token";

export interface GitHubUserProfile {
  username: string;
  externalUserId: string;
}

export async function hasGitHubAccount(userId: string): Promise<boolean> {
  const [ghConn, oauthConn] = await Promise.all([
    db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, userId),
      columns: { id: true },
    }),
    db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.userId, userId),
      columns: { id: true },
    }),
  ]);
  return ghConn !== undefined || oauthConn !== undefined;
}

export async function getGitHubUsername(userId: string): Promise<string | null> {
  const token = await getGithubOAuthToken(userId);
  if (!token) return null;

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { login?: string };
    return user.login ?? null;
  } catch { return null; }
}

export async function getGitHubUserProfile(userId: string): Promise<GitHubUserProfile | null> {
  const token = await getGithubOAuthToken(userId);
  if (!token) return null;

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: number; login?: string };
    if (!user.login || !user.id) return null;
    return { username: user.login, externalUserId: `${user.id}` };
  } catch { return null; }
}

export async function getGitHubAccountId(userId: string): Promise<string | null> {
  const [ghConn, oauthConn] = await Promise.all([
    db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, userId),
      columns: { githubUserId: true },
    }),
    db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.userId, userId),
      columns: { providerId: true },
    }),
  ]);
  return ghConn?.githubUserId ?? oauthConn?.providerId ?? null;
}

export async function deleteGitHubAccountLink(userId: string): Promise<void> {
  await Promise.all([
    db.delete(githubConnections).where(eq(githubConnections.userId, userId)),
    db.delete(oauthConnections).where(eq(oauthConnections.userId, userId)),
  ]);
}

interface GitHubUser { login: string; name: string | null; avatar_url: string; }
interface GitHubOrg { login: string; avatar_url: string; }

export async function fetchGitHubUser(token: string) {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as GitHubUser;
    return { login: user.login, name: user.name, avatar_url: user.avatar_url };
  } catch { return null; }
}

export async function fetchGitHubOrgs(token: string) {
  try {
    const response = await fetch("https://api.github.com/user/orgs?per_page=100", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) return null;
    const orgs = (await response.json()) as GitHubOrg[];
    return orgs.map((org) => ({ login: org.login, name: org.login, avatar_url: org.avatar_url }));
  } catch { return null; }
}
