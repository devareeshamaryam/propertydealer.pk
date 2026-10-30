import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PushEventsService } from '../push/push-events.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentReview, AgentReviewDocument, REVIEW_RELATIONS, type ReviewRelation } from '@rent-ghar/db/schemas/agent-review.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { AgencyService } from '../agency/agency.service';
import { holdMessage, judgeReview, type HoldKind } from './review-brain';

const PAGE = 10;
const MIN_TEXT = 20;
const MAX_TEXT = 2000;

export interface ReviewInput {
  rating?: number;
  text?: string;
  relation?: string;
  propertyId?: string;
}

/** "Muhammad Ali Khan" → "Muhammad K." — a real person, not a full name on the internet. */
function shortName(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PropertyDealer user';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(AgentReview.name) private readonly reviews: Model<AgentReviewDocument>,
    @InjectModel(User.name) private readonly users: Model<any>,
    @InjectModel(Property.name) private readonly properties: Model<any>,
    private readonly discord: DiscordService,
    @Optional() private readonly pushEvents?: PushEventsService,
  ) {}

  private oid(id: string, what = 'agent'): Types.ObjectId {
    if (!id || !Types.ObjectId.isValid(id)) throw new BadRequestException(`Which ${what}?`);
    return new Types.ObjectId(id);
  }

  /**
   * Whose reviews a page shows: an agent's own, and for an agency its own
   * plus its agents' — buyers judge the office, and Zillow shows team reviews
   * the same way.
   */
  private async scope(agentId: string): Promise<{ ids: Types.ObjectId[]; team: Map<string, string> }> {
    const id = this.oid(agentId);
    const team = await this.users
      .find({ agencyId: { $in: AgencyService.anyIds([agentId]) } })
      .select('_id name')
      .lean()
      .exec();
    const names = new Map<string, string>(team.map((m: any) => [String(m._id), String(m.name || 'Agent')]));
    return { ids: [id, ...team.map((m: any) => m._id as Types.ObjectId)], team: names };
  }

  /** Average, count and 5→1 breakdown of published reviews. */
  private async summaryOf(ids: Types.ObjectId[]) {
    const rows = await this.reviews
      .aggregate<{ _id: number; n: number }>([
        { $match: { agent: { $in: ids }, status: 'published' } },
        { $group: { _id: '$rating', n: { $sum: 1 } } },
      ])
      .exec();
    const breakdown: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let count = 0;
    let sum = 0;
    for (const r of rows) {
      breakdown[String(r._id)] = r.n;
      count += r.n;
      sum += r._id * r.n;
    }
    return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, breakdown };
  }

  private shape(r: any, team: Map<string, string>, agentId: string) {
    const about = String(r.agent);
    return {
      _id: String(r._id),
      rating: r.rating,
      text: r.text,
      relation: r.relation,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      edited: r.updatedAt && r.createdAt && new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 60_000,
      reviewer: { name: shortName(r.reviewer?.name) },
      reviewerId: r.reviewer?._id ? String(r.reviewer._id) : undefined,
      reply: r.reply?.text ? { text: r.reply.text, at: r.reply.at } : null,
      property: r.property?.slug ? { title: r.property.title, slug: r.property.slug } : null,
      /** On an agency's page: which of its agents the review is about. */
      agentName: about !== agentId ? team.get(about) ?? null : null,
      agentId: about,
      status: r.status,
      flagged: !!r.flagged,
    };
  }

  /** The public list. An admin also sees hidden ones, marked. */
  async list(agentId: string, page = 1, viewer?: { userId?: string; role?: string }) {
    const { ids, team } = await this.scope(agentId);
    const admin = viewer?.role === 'ADMIN';
    const filter: Record<string, unknown> = { agent: { $in: ids }, ...(admin ? {} : { status: 'published' }) };
    const p = Math.max(1, Math.min(100, Number(page) || 1));
    const [rows, total, summary] = await Promise.all([
      this.reviews
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * PAGE)
        .limit(PAGE)
        .populate('reviewer', 'name')
        .populate('property', 'title slug')
        .lean()
        .exec(),
      this.reviews.countDocuments(filter),
      this.summaryOf(ids),
    ]);
    return {
      summary,
      reviews: rows.map((r) => {
        const s = this.shape(r, team, agentId);
        // Who wrote it stays private; the page only needs to know "is it mine".
        const mine = viewer?.userId && s.reviewerId === viewer.userId;
        return { ...s, reviewerId: undefined, mine: !!mine, ...(admin ? {} : { status: undefined, flagged: undefined }) };
      }),
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      total,
    };
  }

  async summary(agentId: string) {
    const { ids } = await this.scope(agentId);
    return this.summaryOf(ids);
  }

  /**
   * Who may not review this agent: the agent, their agency and its agents,
   * and an agency reviewing its own agents. Otherwise any signed-in account.
   */
  private async assertMayReview(agentId: string, reviewerId: string) {
    if (agentId === reviewerId) throw new ForbiddenException('You cannot review yourself');
    const [agent, me] = await Promise.all([
      this.users.findById(agentId).select('name companyName agencyId role isActive').lean().exec() as Promise<any>,
      this.users.findById(reviewerId).select('name agencyId isActive').lean().exec() as Promise<any>,
    ]);
    if (!agent) throw new NotFoundException('Agent not found');
    if (!me || me.isActive === false) throw new ForbiddenException('Your account cannot post reviews');
    const agencyOf = (u: any) => (u?.agencyId ? String(u.agencyId) : null);
    const sameOffice =
      agencyOf(agent) === reviewerId || // the agency reviewing its agent
      agencyOf(me) === agentId || // an agent reviewing their agency
      (agencyOf(agent) && agencyOf(agent) === agencyOf(me)); // two agents of one agency
    if (sameOffice) throw new ForbiddenException('You cannot review your own agency or its agents');
    return { agent, me };
  }

  /** The signed-in user's review of this agent, to edit. */
  async mine(agentId: string, reviewerId: string) {
    const r: any = await this.reviews
      .findOne({ agent: this.oid(agentId), reviewer: this.oid(reviewerId, 'user') })
      .lean()
      .exec();
    return r ? { _id: String(r._id), rating: r.rating, text: r.text, relation: r.relation, status: r.status } : null;
  }

  /** Admin queue: waiting first, then the rest, with who wrote it and about whom. */
  async queue(status = 'pending', page = 1) {
    const filter: Record<string, unknown> = status === 'all' ? {} : status === 'flagged' ? { flagged: true } : { status };
    const p = Math.max(1, Number(page) || 1);
    const [rows, total, counts] = await Promise.all([
      this.reviews
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * 50)
        .limit(50)
        .populate('reviewer', 'name email')
        .populate('agent', 'name companyName')
        .populate('property', 'title slug')
        .lean()
        .exec(),
      this.reviews.countDocuments(filter),
      this.reviews.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]).exec(),
    ]);
    const byStatus: Record<string, number> = { pending: 0, published: 0, hidden: 0 };
    for (const c of counts) byStatus[c._id] = c.n;
    byStatus.flagged = await this.reviews.countDocuments({ flagged: true });
    return { reviews: rows, total, page: p, pages: Math.max(1, Math.ceil(total / 50)), counts: byStatus };
  }

  /** Write or update — one review per person per agent. */
  async upsert(agentId: string, reviewerId: string, input: ReviewInput) {
    const rating = Math.round(Number(input.rating));
    if (!(rating >= 1 && rating <= 5)) throw new BadRequestException('Choose 1 to 5 stars');
    const text = String(input.text || '').replace(/\s+\n/g, '\n').trim().slice(0, MAX_TEXT);
    if (text.length < MIN_TEXT) throw new BadRequestException(`Tell others a little about your experience (at least ${MIN_TEXT} characters)`);
    const relation = (REVIEW_RELATIONS as readonly string[]).includes(String(input.relation)) ? (input.relation as ReviewRelation) : 'enquired';
    const { agent, me } = await this.assertMayReview(agentId, reviewerId);

    let property: Types.ObjectId | undefined;
    if (input.propertyId && Types.ObjectId.isValid(input.propertyId)) {
      const p: any = await this.properties.findById(input.propertyId).select('owner').lean().exec();
      if (p && String(p.owner) === agentId) property = p._id;
    }

    const before: any = await this.reviews.findOne({ agent: agent._id, reviewer: me._id }).select('_id status').lean().exec();

    // The review brain: live at once, or held for an admin — decided here, before the reply goes back.
    const verdict = judgeReview(text);
    const kinds: HoldKind[] = [...verdict.kinds];
    const reasons = [...verdict.reasons];
    const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const [others, today] = await Promise.all([
      this.reviews.find({ reviewer: me._id, agent: { $ne: agent._id } }).select('text').lean().exec(),
      this.reviews.countDocuments({ reviewer: me._id, agent: { $ne: agent._id }, createdAt: { $gt: new Date(Date.now() - 86_400_000) } }),
    ]);
    if (others.some((o: any) => squash(String(o.text || '')) === squash(text))) {
      kinds.push('repeat');
      reasons.push('Same text as their review of another agent');
    }
    if (!before && today >= 5) {
      kinds.push('burst');
      reasons.push(`${today + 1} reviews from this account in 24 hours`);
    }
    // An admin's "hidden" stands through edits; otherwise the brain decides again on every save.
    const status = before?.status === 'hidden' ? 'hidden' : kinds.length ? 'pending' : 'published';

    const doc = await this.reviews
      .findOneAndUpdate(
        { agent: agent._id, reviewer: me._id },
        { $set: { rating, text, relation, status, holdReasons: reasons, ...(property ? { property } : {}) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    const name = agent.companyName || agent.name || 'Agent';
    this.discord.send({
      title:
        status === 'pending'
          ? `⏳ Review waiting for approval: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
          : `${before ? '✏️ Review edited' : '⭐ New review'}: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      description: text.slice(0, 400),
      color: status === 'pending' ? DISCORD_COLORS.review : rating <= 2 ? DISCORD_COLORS.report : DISCORD_COLORS.approved,
      url: status === 'pending' ? '/dashboard/reviews' : `/agents/${agentId}#reviews`,
      category: 'Reports',
      who: [
        { label: '🎯 Agent', id: agentId },
        { label: '🙋 Reviewer', id: reviewerId },
      ],
      fields: [
        { name: 'Agent', value: String(name) },
        { name: 'Dealt with them', value: relation },
        ...(reasons.length ? [{ name: 'Held because', value: reasons.join(', '), inline: false }] : []),
      ],
      ...(status === 'pending' ? { links: [{ label: 'Approve or hide', url: '/dashboard/reviews' }] } : {}),
    });
    // A new review that went live: tell the agent (not on every edit). Held: tell the admins.
    if (doc.status === 'published' && (!before || before.status !== 'published')) {
      this.pushEvents?.reviewLive({ agentId, reviewerName: me.name, rating, text, agentPath: `/agents/${agentId}` });
    } else if (doc.status === 'pending' && before?.status !== 'pending') {
      this.pushEvents?.reviewHeld({ agentId, reasons });
    }
    return {
      _id: String(doc._id),
      rating,
      text,
      relation,
      status: doc.status,
      /** What the writer is told, in plain words. */
      message: doc.status === 'pending' ? holdMessage(kinds) : doc.status === 'hidden' ? 'Saved. This review is not shown on the page.' : 'Your review is live.',
    };
  }

  async remove(agentId: string, reviewerId: string) {
    await this.reviews.deleteOne({ agent: this.oid(agentId), reviewer: this.oid(reviewerId, 'user') }).exec();
    return { ok: true };
  }

  /** The agent — or their agency — may answer each review once (and edit or clear the answer). */
  private async ownReview(reviewId: string, userId: string) {
    const r: any = await this.reviews.findById(this.oid(reviewId, 'review')).lean().exec();
    if (!r) throw new NotFoundException('Review not found');
    const agentId = String(r.agent);
    if (agentId !== userId) {
      const agent: any = await this.users.findById(agentId).select('agencyId').lean().exec();
      if (!agent?.agencyId || String(agent.agencyId) !== userId) throw new ForbiddenException('Only the agent can do this');
    }
    return r;
  }

  async reply(reviewId: string, userId: string, text?: string) {
    const r = await this.ownReview(reviewId, userId);
    const t = String(text || '').trim().slice(0, 1000);
    await this.reviews
      .updateOne({ _id: reviewId }, t ? { $set: { reply: { text: t, at: new Date() } } } : { $unset: { reply: 1 } })
      .exec();
    if (t && !r.reply?.text) this.pushEvents?.reviewReply({ reviewerId: String(r.reviewer), agentId: String(r.agent), reply: t, agentPath: `/agents/${String(r.agent)}` });
    return { ok: true, reply: t ? { text: t, at: new Date() } : null };
  }

  /** The agent thinks a review is fake or abusive: the admins look. It stays up until they decide. */
  async flag(reviewId: string, userId: string, reason?: string) {
    const r = await this.ownReview(reviewId, userId);
    const why = String(reason || '').trim().slice(0, 500);
    await this.reviews.updateOne({ _id: r._id }, { $set: { flagged: true, flagReason: why } }).exec();
    this.discord.send({
      title: '🚩 Review flagged by the agent',
      description: String(r.text || '').slice(0, 400),
      color: DISCORD_COLORS.report,
      url: `/agents/${String(r.agent)}#reviews`,
      category: 'Reports',
      who: [
        { label: '🎯 Agent', id: String(r.agent) },
        { label: '🙋 Reviewer', id: String(r.reviewer) },
      ],
      fields: [
        { name: 'Stars', value: String(r.rating) },
        { name: 'Why', value: why || '—', inline: false },
      ],
    });
    return { ok: true };
  }

  /** Admin: hide a review (off the page and out of the rating) or put it back. */
  async setStatus(reviewId: string, status: 'published' | 'hidden') {
    // Approving or hiding settles it: the "waiting" reasons and the agent's flag are done with.
    const r: any = await this.reviews
      .findByIdAndUpdate(this.oid(reviewId, 'review'), { $set: { status, flagged: false } }, { new: false })
      .populate('reviewer', 'name')
      .lean()
      .exec();
    if (!r) throw new NotFoundException('Review not found');
    // An admin approved a held review: the reviewer hears it is live, the agent hears about the review.
    if (status === 'published' && r.status === 'pending') {
      const agentId = String(r.agent);
      this.pushEvents?.reviewApproved({ reviewerId: String(r.reviewer?._id ?? r.reviewer), agentId, agentPath: `/agents/${agentId}` });
      this.pushEvents?.reviewLive({ agentId, reviewerName: r.reviewer?.name, rating: r.rating, text: String(r.text || ''), agentPath: `/agents/${agentId}` });
    }
    return { ok: true, status };
  }
}
