"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Play,
  Share2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

/**
 * The listing gallery.
 *
 * One scroll-snapping track rather than a carousel library: swiping on a phone
 * is then the browser's own scrolling — no jank, no touch handlers fighting the
 * page — and the desktop arrows and thumbnails just scroll it to a slide.
 *
 * Photos are letterboxed onto a blurred copy of themselves instead of grey
 * bars, because property photos arrive in every shape a phone can produce.
 *
 * The walkthrough video is the last slide. Reaching it starts it playing,
 * muted, the way a reel does; scrolling away pauses it so a buyer never has
 * audio following them down the page.
 */

interface GalleryItem {
  type: "image" | "video";
  url: string;
  alt: string;
  poster?: string;
}

interface PropertyGalleryProps {
  images: string[];
  title: string;
  alts?: string[];
  videoUrl?: string | null;
  videoPoster?: string | null;
  /** Rendered over the top-left corner, e.g. "For Sale". */
  badge?: string;
}

export default function PropertyGallery({
  images,
  title,
  alts = [],
  videoUrl,
  videoPoster,
  badge,
}: PropertyGalleryProps) {
  /*
   * Memoised because the autoplay effect below depends on it — rebuilt every
   * render, that effect would re-run constantly and restart the video.
   */
  const items: GalleryItem[] = useMemo(
    () => [
      ...images.map((url, index) => ({
        type: "image" as const,
        url,
        alt: alts[index] || `${title} — photo ${index + 1}`,
      })),
      ...(videoUrl
        ? [
            {
              type: "video" as const,
              url: videoUrl,
              alt: `${title} — walkthrough video`,
              poster: videoPoster || undefined,
            },
          ]
        : []),
    ],
    [images, alts, title, videoUrl, videoPoster],
  );

  const total = items.length;

  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [muted, setMuted] = useState(true);

  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeRef = useRef(0);
  const programmatic = useRef(false);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);
  const dragged = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /** Keep the thumbnail strip centred on the current slide. */
  useEffect(() => {
    const strip = thumbsRef.current;
    const child = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !child) return;
    strip.scrollTo({
      left: child.offsetLeft - (strip.clientWidth - child.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  /*
   * Autoplay the video when it is the slide being looked at, and pause it the
   * moment it is not. Muted, because a browser will refuse to autoplay with
   * sound and a buyer scrolling a listing has not asked for any.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (items[active]?.type === "video" && !lightbox) {
      video.muted = muted;
      video.play().catch(() => {
        // Autoplay refused (data saver, low power mode). The controls are there.
      });
    } else {
      video.pause();
    }
  }, [active, lightbox, muted, items]);

  const scrollToSlide = useCallback(
    (index: number) => {
      if (total === 0) return;
      const target = (index + total) % total;
      activeRef.current = target;
      setActive(target);

      const track = trackRef.current;
      if (!track) return;

      programmatic.current = true;
      const child = track.children[target] as HTMLElement | undefined;
      if (child?.scrollIntoView) {
        child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      } else {
        track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
      }
      setTimeout(() => {
        programmatic.current = false;
      }, 450);
    },
    [total],
  );

  const go = useCallback(
    (delta: number) => scrollToSlide(activeRef.current + delta),
    [scrollToSlide],
  );

  /** The track is the source of truth while a finger is on it. */
  const onTrackScroll = useCallback(() => {
    const track = trackRef.current;
    if (programmatic.current || !track || track.clientWidth <= 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index >= 0 && index < total && index !== activeRef.current) {
      activeRef.current = index;
      setActive(index);
    }
  }, [total]);

  /* Desktop drag-to-pan, and a click that opens the lightbox. */
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging.current = true;
    dragged.current = false;
    dragStartX.current = event.clientX;
    dragStartScroll.current = trackRef.current?.scrollLeft ?? 0;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const track = trackRef.current;
    if (!dragging.current || !track) return;
    const dx = event.clientX - dragStartX.current;
    if (Math.abs(dx) > 6) {
      dragged.current = true;
      if (event.pointerType === "mouse") {
        track.style.scrollSnapType = "none";
        track.style.scrollBehavior = "auto";
        track.scrollLeft = dragStartScroll.current - dx;
      }
    }
  };

  const onPointerUp = (event: React.PointerEvent, type: GalleryItem["type"]) => {
    const track = trackRef.current;
    if (!dragging.current) return;
    dragging.current = false;

    const dx = event.clientX - dragStartX.current;

    if (track && event.pointerType === "mouse") {
      track.style.scrollSnapType = "x mandatory";
      track.style.scrollBehavior = "smooth";
    }

    if (!dragged.current && Math.abs(dx) < 8) {
      // A tap on the video is for its own controls, not for the lightbox.
      if (type !== "video") setLightbox(true);
      return;
    }

    if (event.pointerType === "mouse" && dragged.current) {
      if (dx < -40) go(1);
      else if (dx > 40) go(-1);
      else scrollToSlide(activeRef.current);
    }
  };

  /* Lightbox: keyboard, and no scrolling the page underneath. */
  useEffect(() => {
    if (!lightbox) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    };

    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox, go]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // The share sheet was dismissed.
    }
  };

  if (total === 0) return null;

  const current = items[active] ?? items[0];

  return (
    <>
      <div className="flex flex-col gap-2 md:gap-3">
        {/* The stage. 5:4 on phones; a sane fixed band on desktop. */}
        <div className="group relative aspect-[5/4] select-none overflow-hidden bg-slate-100 md:aspect-auto md:h-[clamp(320px,58vh,560px)] md:rounded-xl md:border md:border-border">
          <div
            ref={trackRef}
            onScroll={onTrackScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => onPointerUp(event, current?.type ?? "image")}
            onPointerCancel={() => {
              dragging.current = false;
            }}
            className="hide-scrollbar absolute inset-0 flex cursor-grab touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth select-none active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {items.map((item, index) => (
              <div
                key={`${item.type}-${item.url}`}
                className="relative flex h-full w-full min-w-full flex-shrink-0 snap-center snap-always select-none items-center justify-center overflow-hidden bg-slate-100"
              >
                {item.type === "video" ? (
                  <>
                    <video
                      ref={videoRef}
                      src={item.url}
                      poster={item.poster}
                      controls
                      loop
                      muted={muted}
                      playsInline
                      preload="metadata"
                      className="h-full w-full bg-black object-contain"
                      onClick={(event) => event.stopPropagation()}
                    />
                    {/* Sound is off for autoplay; this is how you turn it on. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMuted((previous) => !previous);
                      }}
                      className="absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform active:scale-90"
                      aria-label={muted ? "Turn sound on" : "Mute"}
                    >
                      {muted ? (
                        <VolumeX className="h-4.5 w-4.5" />
                      ) : (
                        <Volume2 className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {/* A blurred copy fills the letterbox. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      aria-hidden
                      draggable={false}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt}
                      draggable={false}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="pointer-events-none relative h-full w-full object-contain"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {badge && (
            <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
              {badge}
            </span>
          )}

          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <button
              type="button"
              onClick={share}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-slate-800 shadow-md transition-transform hover:bg-white active:scale-90"
              aria-label="Share this listing"
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
          </div>

          {current?.type !== "video" && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 md:flex">
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Click to enlarge</span>
            </div>
          )}

          {total > 1 && (
            <span className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-md">
              {active + 1} / {total}
            </span>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-800 opacity-0 shadow-md transition-all hover:bg-white focus-visible:opacity-100 active:scale-95 group-hover:opacity-100 md:grid"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-800 opacity-0 shadow-md transition-all hover:bg-white focus-visible:opacity-100 active:scale-95 group-hover:opacity-100 md:grid"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails: below the photo, never on top of it. */}
        {total > 1 && (
          <div
            ref={thumbsRef}
            className="hide-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-3 pb-0.5 md:px-0"
          >
            {items.map((item, index) => {
              const on = index === active;
              return (
                <button
                  key={`thumb-${item.type}-${item.url}`}
                  type="button"
                  onClick={() => scrollToSlide(index)}
                  aria-current={on}
                  aria-label={
                    item.type === "video" ? "Play the walkthrough video" : `View photo ${index + 1}`
                  }
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all md:h-16 ${
                    on ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {item.type === "video" ? (
                    <span className="grid h-full w-full place-items-center bg-slate-900 text-white">
                      {item.poster && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.poster}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-60"
                        />
                      )}
                      <Play className="relative h-4 w-4 fill-white" />
                    </span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.url}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex select-none flex-col justify-between bg-black/95">
          <div className="z-10 flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90 tabular-nums">
              <span>{active + 1}</span>
              <span className="text-white/40">/</span>
              <span>{total}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={share}
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Share"
              >
                <Share2 className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
            {total > 1 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-lg border border-white/15 bg-black/60 text-white transition-all hover:bg-black/90 sm:grid"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <div className="relative flex h-full max-h-[82vh] w-full max-w-5xl items-center justify-center">
              {current?.type === "video" ? (
                <video
                  ref={lightboxVideoRef}
                  key={current.url}
                  src={current.url}
                  poster={current.poster}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[80vh] w-auto max-w-full rounded-lg bg-black object-contain shadow-2xl"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={current?.url}
                  alt={current?.alt}
                  className="max-h-[82vh] w-auto max-w-full object-contain"
                />
              )}
            </div>

            {total > 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-lg border border-white/15 bg-black/60 text-white transition-all hover:bg-black/90 sm:grid"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {total > 1 && (
            <div className="hide-scrollbar flex items-center justify-center gap-2 overflow-x-auto border-t border-white/10 bg-black/70 px-4 py-2.5 backdrop-blur-md">
              {items.map((item, index) => (
                <button
                  key={`lb-${item.type}-${item.url}`}
                  type="button"
                  onClick={() => scrollToSlide(index)}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition-all sm:h-14 sm:w-14 ${
                    index === active
                      ? "scale-105 border-primary shadow-md"
                      : "border-white/20 opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`Slide ${index + 1}`}
                >
                  {item.type === "video" ? (
                    <span className="grid h-full w-full place-items-center bg-slate-900 text-white">
                      <Play className="h-5 w-5 fill-white" />
                    </span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
