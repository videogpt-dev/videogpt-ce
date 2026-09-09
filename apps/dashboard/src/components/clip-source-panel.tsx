import { useRef, useState, type DragEvent } from "react";
import { FileVideo, Link2, Upload, Video } from "lucide-react";

import { Button, CardTitle, Input, StatusMessage } from "@videogpt/ui";

import { fileUrl } from "../api";
import type { Project } from "../types";

export interface ClipSourcePanelProps {
  project: Project;
  uploading: boolean;
  busy: boolean;
  error?: string | null;
  onUpload: (file: File) => void;
  onFetch: (url: string) => void;
}

export function ClipSourcePanel({
  project,
  uploading,
  busy,
  error,
  onUpload,
  onFetch,
}: ClipSourcePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(project.source_url ?? "");
  const [dragging, setDragging] = useState(false);
  const source = fileUrl(project.source);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file?.type.startsWith("video/")) onUpload(file);
  }

  return (
    <div className="grid gap-5">
      <div>
        <CardTitle>Bring a video</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload from this device or fetch a public video URL.
        </p>
      </div>

      {project.source ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/35 p-4 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-vui-success/10 text-vui-success">
            <FileVideo className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Source ready</p>
            <p className="truncate text-xs text-muted-foreground">
              {project.source_url ?? project.source}
            </p>
          </div>
          {source ? (
            <Button asChild size="sm" variant="outline">
              <a href={source} target="_blank" rel="noreferrer">
                Preview
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed p-6 text-center transition-colors ${dragging ? "border-vui-brand bg-vui-brand/5" : "hover:bg-muted/35"}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) =>
          (event.key === "Enter" || event.key === " ") && inputRef.current?.click()
        }
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <div>
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Upload className="size-4" />
          </span>
          <p className="mt-3 text-sm font-medium">
            {uploading
              ? "Uploading video..."
              : project.source
                ? "Replace with another video"
                : "Drop a video here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">or click to browse this device</p>
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        or fetch by URL
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="pl-9"
            type="url"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !url.trim()}
          onClick={() => onFetch(url.trim())}
        >
          <Video /> {busy && !uploading ? "Fetching..." : "Fetch video"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        YouTube and other sites supported by yt-dlp work here. The downloaded source stays in your
        local data volume.
      </p>
      {error ? (
        <StatusMessage tone="danger" title="Could not add this source">
          {error}
        </StatusMessage>
      ) : null}
    </div>
  );
}
