import { useEffect, useRef } from "react";

import { fileUrl } from "../api";
import type { Moment, Project } from "../types";

function youtubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

export function clock(seconds: number): string {
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

export function MomentPlayer({ project, moment }: { project: Project; moment: Moment }) {
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
