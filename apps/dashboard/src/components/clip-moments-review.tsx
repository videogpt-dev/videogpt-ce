import { useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";

import { Badge, Button } from "@videogpt/ui";

import { fileUrl } from "../api";
import type { Moment, Project } from "../types";

function youtubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The plain YouTube embed's `end=` param is unreliable and often plays past the cut. The IFrame
// Player API is the only way to actually stop at the end, so load it once and share it.
let ytApi: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((resolve) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return ytApi;
}

function YouTubeClip({ videoId, start, end }: { videoId: string; start: number; end: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: { start, end, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (event: any) => {
            if (event.data !== YT.PlayerState.PLAYING) {
              clearTimer();
              return;
            }
            clearTimer();
            timerRef.current = window.setInterval(() => {
              const player = playerRef.current;
              if (player && player.getCurrentTime() >= end) {
                player.pauseVideo();
                player.seekTo(start, true); // back to the cut start, ready to replay
                clearTimer();
              }
            }, 200);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimer();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, start, end]);

  // YT replaces this inner node with its iframe; the wrapper stays React-owned.
  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}

function MomentPreview({ project, moment }: { project: Project; moment: Moment }) {
  const start = Math.floor(moment.start);
  const end = Math.ceil(moment.end);
  const ytId = youtubeId(project.source_url);
  const local = ytId ? null : fileUrl(project.source);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
      {ytId ? (
        <YouTubeClip videoId={ytId} start={start} end={end} />
      ) : local ? (
        <video
          className="absolute inset-0 h-full w-full"
          src={`${local}#t=${start},${end}`}
          controls
          preload="metadata"
        />
      ) : null}
      <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-xs font-medium text-white">
        {clock(moment.start)} - {clock(moment.end)}
      </span>
    </div>
  );
}

export interface ClipMomentsReviewProps {
  project: Project;
  moments: Moment[];
  busy: boolean;
  onRender: (indices: number[]) => void;
}

export function ClipMomentsReview({ project, moments, busy, onRender }: ClipMomentsReviewProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(moments.map((_, index) => index)),
  );

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const chosen = [...selected].sort((a, b) => a - b);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Review moments</h3>
          <p className="text-sm text-muted-foreground">
            Preview each moment, then render only the ones you approve. Nothing is cut until you do.
          </p>
        </div>
        <Button type="button" disabled={busy || chosen.length === 0} onClick={() => onRender(chosen)}>
          <Scissors /> {busy ? "Rendering..." : `Render selected (${chosen.length})`}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {moments.map((moment, index) => {
          const active = selected.has(index);
          return (
            <div
              key={index}
              className={`grid gap-3 rounded-xl border p-4 transition-colors ${active ? "border-vui-brand bg-vui-brand/5" : ""}`}
            >
              <MomentPreview project={project} moment={moment} />

              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Clip {index + 1}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{Math.round(moment.end - moment.start)}s</Badge>
                  {typeof moment.score === "number" ? (
                    <Badge variant="secondary">score {moment.score.toFixed(2)}</Badge>
                  ) : null}
                </div>
              </div>

              {moment.text ? (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Transcript
                  </span>
                  <p dir="auto" className="line-clamp-3 text-sm text-muted-foreground">
                    {moment.text}
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                variant={active ? "default" : "outline"}
                onClick={() => toggle(index)}
              >
                {active ? "Approved for render" : "Approve"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
