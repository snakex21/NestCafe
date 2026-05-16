// ============================================================
// Skill domain types — reusable AI skill definitions
// that extend agent capabilities with specialized instructions.
// ============================================================

export type SkillSource = 'official' | 'community' | 'custom';

export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  requires?: string[];
}

export interface Skill {
  id: string;
  source: SkillSource;
  name: string;
  description: string;
  path: string;
  frontmatter: SkillFrontmatter;
  enabled: boolean;
  installedAt: string;
  updatedAt?: string;
}
