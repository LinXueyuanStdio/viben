import type { InstallableSkill, SkillDetailItem } from "./types";

export function formatSkillCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function getInstallableSkillId(skill: InstallableSkill): string {
  return skill.data.id;
}

export function getSkillTitle(skill: SkillDetailItem): string {
  return skill.data.name;
}

export function getSkillSlug(skill: SkillDetailItem): string {
  return skill.data.slug;
}

export function toInstallableSkill(skill: SkillDetailItem): InstallableSkill {
  return skill;
}

export function getSkillInitials(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "?";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}
