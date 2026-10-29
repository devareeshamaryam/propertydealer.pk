import api from "../api";

export type ReviewRelation = "bought" | "sold" | "rented" | "let" | "enquired";

export const RELATION_LABELS: Record<ReviewRelation, string> = {
  bought: "Bought a property",
  sold: "Sold a property",
  rented: "Rented a property",
  let: "Let out a property",
  enquired: "Enquired / visited",
};

export interface ReviewSummary {
  average: number;
  count: number;
  breakdown: Record<string, number>;
}

export interface AgentReviewRow {
  _id: string;
  rating: number;
  text: string;
  relation: ReviewRelation;
  createdAt: string;
  edited?: boolean;
  reviewer: { name: string };
  reply: { text: string; at: string } | null;
  property: { title: string; slug: string } | null;
  /** On an agency's page: the agent the review is about. */
  agentName: string | null;
  agentId: string;
  /** Admin view only. */
  status?: ReviewStatus;
  flagged?: boolean;
}

export interface ReviewPage {
  summary: ReviewSummary;
  reviews: AgentReviewRow[];
  page: number;
  pages: number;
  total: number;
}

export type ReviewStatus = "published" | "pending" | "hidden";

export interface MyReview {
  _id: string;
  rating: number;
  text: string;
  relation: ReviewRelation;
  status: ReviewStatus;
  /** After saving: what happened, in plain words. */
  message?: string;
}

/** A row of the admin's approval queue. */
export interface QueueRow {
  _id: string;
  rating: number;
  text: string;
  relation: ReviewRelation;
  status: ReviewStatus;
  holdReasons?: string[];
  flagged?: boolean;
  flagReason?: string;
  createdAt: string;
  reviewer?: { _id: string; name?: string; email?: string } | null;
  agent?: { _id: string; name?: string; companyName?: string } | null;
  property?: { title: string; slug: string } | null;
}

export const reviewApi = {
  /** `fresh`: skip the browser's short cache — right after the visitor changed something. */
  list: async (agentId: string, page = 1, admin = false, fresh = false): Promise<ReviewPage> =>
    (await api.get(`/agents/${agentId}/reviews${admin ? "/all" : ""}`, { params: { page, ...(fresh ? { t: Date.now() } : {}) } })).data,
  summary: async (agentId: string): Promise<ReviewSummary> => (await api.get(`/agents/${agentId}/reviews/summary`)).data,
  mine: async (agentId: string): Promise<MyReview | null> => (await api.get(`/agents/${agentId}/reviews/mine`)).data || null,
  save: async (agentId: string, body: { rating: number; text: string; relation: ReviewRelation; propertyId?: string }) =>
    (await api.put(`/agents/${agentId}/reviews/mine`, body)).data as MyReview,
  remove: async (agentId: string) => (await api.delete(`/agents/${agentId}/reviews/mine`)).data,
  reply: async (reviewId: string, text: string) => (await api.post(`/reviews/${reviewId}/reply`, { text })).data,
  flag: async (reviewId: string, reason: string) => (await api.post(`/reviews/${reviewId}/flag`, { reason })).data,
  queue: async (status: string, page = 1): Promise<{ reviews: QueueRow[]; total: number; page: number; pages: number; counts: Record<string, number> }> =>
    (await api.get("/reviews", { params: { status, page } })).data,
  setStatus: async (reviewId: string, status: "published" | "hidden") => (await api.patch(`/reviews/${reviewId}`, { status })).data,
};

export default reviewApi;
