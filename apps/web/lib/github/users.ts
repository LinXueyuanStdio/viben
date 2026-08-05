import "server-only";
import { getUserGitHubToken } from "./token";

export interface GitHubUserProfile {
  username: string;
  externalUserId: string;
}

// Stub: requires Better Auth accounts table — not available in viben
export async function hasGitHubAccount(_userId: string): Promise<boolean> {
  return false;
}

export async function getGitHubUsername(userId: string): Promise<string | null> {
  const token = await getUserGitHubToken(userId);
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
  const token = await getUserGitHubToken(userId);
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

export async function getGitHubAccountId(_userId: string): Promise<string | null> {
  return null;
}

export async function deleteGitHubAccountLink(_userId: string): Promise<void> {}

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
