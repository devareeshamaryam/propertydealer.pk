"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, EyeOff, Flag, Loader2, MessageSquareReply, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { loginUrl } from "@/lib/auth-intent";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { cn } from "@/lib/utils";
import reviewApi, { RELATION_LABELS, type AgentReviewRow, type MyReview, type ReviewPage, type ReviewRelation } from "@/lib/api/review.api";

/**
 * Reviews on an agent's profile.
 *
 * Signed-in visitors leave one review per agent (stars, a few words and how
 * they dealt with the agent) and can edit or delete it. The agent — or their
 * agency — answers each review once and can ask the admins to look at one;
 * admins hide a review from here. The first page arrives with the page (for
 * search engines); after that it is fetched live, so a new review shows at once.
 */

const MIN_TEXT = 20;

export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-slate-300" style={{ width: size, height: size }} strokeWidth={1.5} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} strokeWidth={1.5} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

export default function AgentReviews({ agentId, agentName, initial }: { agentId: string; agentName: string; initial: ReviewPage | null }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const admin = user?.role === "ADMIN";
  const isSelf = !!user && user._id === agentId;

  const [data, setData] = useState<ReviewPage | null>(initial);
  const [extra, setExtra] = useState<AgentReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mine, setMine] = useState<MyReview | null>(null);
  // Whether "mine" has been looked up yet — the form must not open empty over an existing review.
  const [mineReady, setMineReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [listingId, setListingId] = useState<string | undefined>();

  const reload = useCallback(async (fresh = true) => {
    try {
      const next = await reviewApi.list(agentId, 1, admin, fresh);
      setData(next);
      setExtra([]);
      setPage(1);
    } catch {
      /* keep what the page came with */
    }
  }, [agentId, admin]);

  // Live after the first paint: the page itself may be a few minutes old.
  useEffect(() => {
    void reload(false);
  }, [reload]);

  useEffect(() => {
    if (!isAuthenticated || isSelf) {
      setMine(null);
      setMineReady(true);
      return;
    }
    setMineReady(false);
    reviewApi
      .mine(agentId)
      .then(setMine)
      .catch(() => setMine(null))
      .finally(() => setMineReady(true));
  }, [agentId, isAuthenticated, isSelf]);

  // "Review this agent" from a listing: /agents/…?review=<listingId>#reviews
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("review");
    if (q === null) return;
    if (/^[0-9a-f]{24}$/i.test(q)) setListingId(q);
    if (isAuthenticated && !isSelf && mineReady) setOpen(true);
  }, [isAuthenticated, isSelf, mineReady]);

  const write = () => {
    if (!isAuthenticated) {
      toast.info("Sign in to write a review", { description: "Reviews come from real accounts, so buyers can trust them." });
      router.push(loginUrl(`${pathname || "/"}?review=${listingId ?? ""}#reviews`));
      return;
    }
    setOpen(true);
  };

  const more = async () => {
    setLoadingMore(true);
    try {
      const next = await reviewApi.list(agentId, page + 1, admin);
      setExtra((e) => [...e, ...next.reviews]);
      setPage(next.page);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load more reviews"));
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = data?.summary ?? { average: 0, count: 0, breakdown: {} };
  const rows = [...(data?.reviews ?? []), ...extra];
  const hasMore = !!data && page < data.pages;

  return (
    <section id="reviews" className="mt-8 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Reviews</h2>
          {summary.count > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[36px] font-extrabold leading-none text-slate-900">{summary.average.toFixed(1)}</span>
              <span>
                <Stars value={summary.average} size={18} />
                <span className="block text-[13px] text-slate-500">
                  {summary.count} {summary.count === 1 ? "review" : "reviews"}
                </span>
              </span>
            </div>
          ) : (
            <p className="mt-1 text-[14px] text-slate-500">No reviews yet. Dealt with {agentName}? Be the first to say how it went.</p>
          )}
        </div>

        {summary.count > 0 && (
          <div className="w-full max-w-xs space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = summary.breakdown[String(s)] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <span className="w-3 text-right">{s}</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${summary.count ? (n / summary.count) * 100 : 0}%` }} />
                  </span>
                  <span className="w-6 text-right tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        )}

        {!isSelf && (
          <button
            type="button"
            onClick={write}
            className="btn-shape inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary/90"
          >
            {mine ? <Pencil className="h-4 w-4" /> : <Star className="h-4 w-4" />}
            {mine ? "Edit your review" : "Write a review"}
          </button>
        )}
      </div>

      {mine && mine.status !== "published" && !admin && (
        <div className={cn("mt-5 rounded-xl border px-4 py-3 text-[14px]", mine.status === "pending" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700")}>
          <p className="font-semibold">{mine.status === "pending" ? "Your review is waiting for approval" : "Your review is not shown on this page"}</p>
          <p className="mt-0.5 text-[13.5px]">
            {mine.status === "pending"
              ? "Our team checks it first — usually within a day. Only you can see this note. You can still edit it."
              : "Our team took it down. You can edit it or write to us if you think this is a mistake."}
          </p>
          <p className="mt-2 line-clamp-2 text-[13px] opacity-80">
            {"★".repeat(mine.rating)}
            {"☆".repeat(5 - mine.rating)} {mine.text}
          </p>
          <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-6 divide-y divide-slate-100">
          {rows.map((r) => (
            <ReviewItem
              key={r._id}
              r={r}
              mine={!!mine && mine._id === r._id}
              canAnswer={!!user && (user._id === agentId || user._id === r.agentId)}
              admin={admin}
              onEdit={() => setOpen(true)}
              onChanged={reload}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => void more()} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-medium text-slate-700 hover:bg-slate-50">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} More reviews
          </button>
        </div>
      )}

      <p className="mt-5 text-[12px] text-slate-400">
        Reviews are written by signed-in PropertyDealer.pk users about their own experience. One review per person per agent; abusive or fake reviews are removed.
      </p>

      {open && (
        <ReviewDialog
          key={mine?._id ?? "new"}
          agentId={agentId}
          agentName={agentName}
          mine={mine}
          listingId={listingId}
          onClose={() => setOpen(false)}
          onSaved={(m) => {
            setMine(m);
            setOpen(false);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function ReviewItem({
  r,
  mine,
  canAnswer,
  admin,
  onEdit,
  onChanged,
}: {
  r: AgentReviewRow;
  mine: boolean;
  canAnswer: boolean;
  admin: boolean;
  onEdit: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply?.text ?? "");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("py-4", r.status === "hidden" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[14px] font-bold text-primary">
          {r.reviewer.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[14.5px] font-semibold text-slate-900">{r.reviewer.name}</span>
            {mine && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Your review</span>}
            {admin && r.status === "hidden" && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">Hidden</span>}
            {admin && r.status === "pending" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Waiting for approval</span>}
            {admin && r.flagged && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">Flagged by agent</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-slate-500">
            <Stars value={r.rating} size={14} />
            <span>{RELATION_LABELS[r.relation] ?? "Dealt with them"}</span>
            <span aria-hidden>·</span>
            <span>
              {when(r.createdAt)}
              {r.edited ? " (edited)" : ""}
            </span>
          </div>
          {r.agentName && <p className="mt-1 text-[12.5px] text-slate-500">About agent {r.agentName}</p>}
          <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-700">{r.text}</p>
          {r.property && (
            <p className="mt-1 text-[12.5px] text-slate-500">
              About{" "}
              <Link href={`/properties/${r.property.slug}`} className="text-primary hover:underline">
                {r.property.title}
              </Link>
            </p>
          )}

          {r.reply && !replying && (
            <div className="mt-3 rounded-xl border-l-4 border-primary/60 bg-slate-50 px-3 py-2">
              <p className="text-[12.5px] font-semibold text-slate-700">Reply from the agent</p>
              <p className="mt-0.5 whitespace-pre-line text-[14px] text-slate-700">{r.reply.text}</p>
            </div>
          )}

          {replying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Answer this review — politely; everyone can read it."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => reviewApi.reply(r._id, reply), reply.trim() ? "Reply posted" : "Reply removed").then(() => setReplying(false))}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[13.5px] font-semibold text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} {reply.trim() ? "Post reply" : "Remove reply"}
                </button>
                <button type="button" onClick={() => setReplying(false)} className="h-9 rounded-lg border px-3 text-[13.5px]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-[12.5px] font-medium">
            {mine && (
              <>
                <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-slate-500 hover:text-primary">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete your review?")) void run(() => reviewApi.remove(r.agentId), "Review deleted");
                  }}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
            {canAnswer && !replying && (
              <>
                <button type="button" onClick={() => setReplying(true)} className="inline-flex items-center gap-1 text-slate-500 hover:text-primary">
                  <MessageSquareReply className="h-3.5 w-3.5" /> {r.reply ? "Edit reply" : "Reply"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const why = window.prompt("Why should our team look at this review? (fake, abusive, not a real client…)");
                    if (why !== null) void run(() => reviewApi.flag(r._id, why), "Sent to our team");
                  }}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
                >
                  <Flag className="h-3.5 w-3.5" /> Report review
                </button>
              </>
            )}
            {admin && r.status !== "published" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => reviewApi.setStatus(r._id, "published"), "Review published")}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
              >
                <Check className="h-3.5 w-3.5" /> {r.status === "pending" ? "Approve" : "Show again"}
              </button>
            )}
            {admin && r.status !== "hidden" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => reviewApi.setStatus(r._id, "hidden"), "Review hidden")}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600"
              >
                <EyeOff className="h-3.5 w-3.5" /> Hide (admin)
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function ReviewDialog({
  agentId,
  agentName,
  mine,
  listingId,
  onClose,
  onSaved,
}: {
  agentId: string;
  agentName: string;
  mine: MyReview | null;
  listingId?: string;
  onClose: () => void;
  onSaved: (m: MyReview) => void;
}) {
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(mine?.text ?? "");
  const [relation, setRelation] = useState<ReviewRelation>(mine?.relation ?? "enquired");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!rating) return toast.error("Choose 1 to 5 stars");
    if (text.trim().length < MIN_TEXT) return toast.error(`Please write at least ${MIN_TEXT} characters`);
    setBusy(true);
    try {
      const saved = await reviewApi.save(agentId, { rating, text: text.trim(), relation, propertyId: listingId });
      if (saved.status === "pending") {
        toast("Thanks! Your review is waiting for approval", { description: saved.message, duration: 8000 });
      } else {
        toast.success(mine ? "Your review is updated and live" : "Thank you — your review is live");
      }
      onSaved(saved);
      void import("@/lib/push-client").then((m) => m.askForPush("review"));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save your review"));
    } finally {
      setBusy(false);
    }
  };

  const labels = ["", "Very bad", "Bad", "OK", "Good", "Excellent"];
  const shown = hover || rating;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative z-10 flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{mine ? "Edit your review" : `Review ${agentName}`}</h3>
          <button type="button" onClick={() => !busy && onClose()} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <p className="text-[13.5px] font-medium text-slate-700">Your rating</p>
          <div className="mt-1.5 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onMouseEnter={() => setHover(s)} onClick={() => setRating(s)} aria-label={`${s} stars`} className="p-0.5">
                <Star className={cn("h-8 w-8", s <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300")} strokeWidth={1.5} />
              </button>
            ))}
            <span className="ml-2 text-[13.5px] font-medium text-slate-600">{labels[shown]}</span>
          </div>
        </div>

        <div>
          <p className="text-[13.5px] font-medium text-slate-700">How did you deal with them?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(Object.keys(RELATION_LABELS) as ReviewRelation[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRelation(k)}
                className={cn("rounded-full border px-3 py-1.5 text-[13px]", relation === k ? "border-primary bg-primary/5 font-semibold text-primary" : "hover:bg-muted")}
              >
                {RELATION_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13.5px] font-medium text-slate-700">Your review</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Was the agent honest about the property and price? Did they respond quickly and handle the paperwork well?"
            className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30"
          />
          <p className={cn("text-right text-[12px]", text.trim().length < MIN_TEXT ? "text-slate-400" : "text-emerald-600")}>
            {text.trim().length < MIN_TEXT ? `${MIN_TEXT - text.trim().length} more characters` : "Looks good"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mine ? "Save changes" : "Post review"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Your first name and last initial are shown with the review. No phone numbers or links, please.</p>
      </div>
    </div>
  );
}
