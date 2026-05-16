// ============================================================
// Skills manager factory — discovers, loads, and manages
// AI skill definitions from SKILL.md files on disk.
// Uses gray-matter for YAML frontmatter parsing.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { SkillsManagerAPI } from '../api/index.js';
import type { Skill, SkillFrontmatter } from '../types/skill.types.js';
import { generateTypedId } from '../utils/id.js';

const SKILL_FILE = 'SKILL.md';

function parseFrontmatter(raw: Record<string, unknown>): SkillFrontmatter {
  return {
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    version: raw.version ? String(raw.version) : undefined,
    author: raw.author ? String(raw.author) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    requires: Array.isArray(raw.requires) ? raw.requires.map(String) : undefined,
  };
}

function readSkillFile(filePath: string): Skill | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    const frontmatter = parseFrontmatter(data as Record<string, unknown>);

    if (!frontmatter.name) {
      return null;
    }

    const stats = fs.statSync(filePath);

    return {
      id: generateTypedId('skill'),
      source: 'custom',
      name: frontmatter.name,
      description: frontmatter.description,
      path: filePath,
      frontmatter,
      enabled: true,
      installedAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export function createSkillsManager(_dataDir: string): SkillsManagerAPI {
  const skills = new Map<string, Skill>();

  const api: SkillsManagerAPI = {
    async listSkills(): Promise<Skill[]> {
      return [...skills.values()];
    },

    async enableSkill(id: string): Promise<void> {
      const skill = skills.get(id);
      if (skill) {
        skill.enabled = true;
      }
    },

    async disableSkill(id: string): Promise<void> {
      const skill = skills.get(id);
      if (skill) {
        skill.enabled = false;
      }
    },

    async addSkill(filePath: string): Promise<Skill> {
      const skill = readSkillFile(filePath);
      if (!skill) {
        throw new Error(`Invalid or missing SKILL.md in ${filePath}`);
      }
      skills.set(skill.id, skill);
      return skill;
    },

    async removeSkill(id: string): Promise<void> {
      skills.delete(id);
    },

    async scanDirectory(dir: string): Promise<Skill[]> {
      const found: Skill[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = path.join(dir, entry.name, SKILL_FILE);
            if (fs.existsSync(skillPath)) {
              const skill = readSkillFile(skillPath);
              if (skill) {
                const existing = skills.get(skill.id);
                if (existing) {
                  Object.assign(existing, skill);
                } else {
                  skills.set(skill.id, skill);
                }
                found.push(skill);
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist or isn't readable
      }
      return found;
    },
  };

  return api;
}
