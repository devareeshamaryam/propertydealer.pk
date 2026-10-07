/**
 * Public agent profile URLs: /agents/ali-properties-65f1a2b3c4d5e6f7a8b9c0d1
 *
 * The id is carried in the slug instead of adding a unique `profileSlug`
 * column to the users collection: no migration, no backfill for the accounts
 * that already exist, and two agents with the same name cannot collide. The
 * readable part is still in the URL, which is what it is for.
 */

const OBJECT_ID = /[0-9a-f]{24}/i;

export interface AgentRef {
  _id?: string;
  name?: string;
  companyName?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The profile path for an agent, or null when there is no id to link to. */
export function agentProfilePath(agent?: AgentRef | string | null): string | null {
  if (!agent) return null;

  if (typeof agent === "string") {
    return OBJECT_ID.test(agent) ? `/agents/${agent}` : null;
  }

  const id = agent._id;
  if (!id || !OBJECT_ID.test(id)) return null;

  const label = slugify(agent.companyName || agent.name || "");
  return label ? `/agents/${label}-${id}` : `/agents/${id}`;
}

/** The id back out of a profile slug. */
export function agentIdFromSlug(slug: string): string | null {
  const match = slug.match(/([0-9a-f]{24})$/i);
  return match ? (match[1] ?? null) : null;
}

export function agentDisplayName(agent?: AgentRef | null): string {
  return agent?.companyName || agent?.name || "Property Dealer";
}
