import { useState } from "react";
import { Check, Scissors } from "lucide-react";

import { Badge, Button, StatusMessage, Tabs, TabsContent, TabsList, TabsTrigger } from "@videogpt/ui";

import type { Artifact, Job, Moment, Project } from "../types";
import { clock, MomentPlayer } from "./clip-moment-player";
import { ClipResultGallery } from "./clip-result-gallery";
import { JobPanel } from "./job-panel";

type StudioTab = "moments" | "approved" | "clips";

function score(moment: Moment): number | null {
  if (typeof moment.score !== "number") return null;
  return Math.round(moment.score > 1 ? moment.score : moment.score * 100);
}

function MomentRow({
  moment,
  index,
  focused,
  approved,
  onFocus,
  onToggle,
}: {
  moment: Moment;
  index: number;
  focused: boolean;
  approved: boolean;
  onFocus: () => void;
  onToggle: () => void;
}) {
  const points = score(moment);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        focused ? "border-vui-brand bg-vui-brand/5" : "hover:bg-muted/50"
      }`}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onFocus}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">#{index + 1}</span>
          <span>
            {clock(moment.start)} - {clock(moment.end)}
          </span>
          <span>{Math.round(moment.end - moment.start)}s</span>
          {points !== null ? <span>score {points}</span> : null}
        </div>
        <p dir="auto" className="mt-1 line-clamp-1 text-sm">
          {moment.title || moment.ai_hook || moment.text || "Untitled moment"}
        </p>
      </button>
      <Button
        type="button"
        size="sm"
        variant={approved ? "default" : "outline"}
        aria-pressed={approved}
        onClick={onToggle}
      >
        {approved ? <Check /> : null}
        {approved ? "Approved" : "Approve"}
      </Button>
    </div>
  );
}

function MomentDetail({ moment }: { moment: Moment }) {
  return (
    <div className="grid gap-2">
      {moment.title ? <h3 className="font-semibold">{moment.title}</h3> : null}
      {moment.ai_hook ? (
        <p dir="auto" className="text-sm">
          <span className="text-muted-foreground">Hook: </span>
          {moment.ai_hook}
        </p>
      ) : null}
      {moment.ai_reason ? (
        <p dir="auto" className="text-sm text-muted-foreground">
          {moment.ai_reason}
        </p>
      ) : null}
      {moment.text ? (
        <p dir="auto" className="line-clamp-4 text-sm text-muted-foreground">
          {moment.text}
        </p>
      ) : null}
    </div>
  );
}

export interface ClipStudioProps {
  project: Project;
  moments: Moment[];
  artifacts: Artifact[];
  renderJob: Job | null;
  busy: boolean;
  onRender: (indices: number[]) => void;
}

export function ClipStudio({ project, moments, artifacts, renderJob, busy, onRender }: ClipStudioProps) {
  const [tab, setTab] = useState<StudioTab>(artifacts.length ? "clips" : "moments");
  const [focus, setFocus] = useState(0);
  const [approved, setApproved] = useState<Set<number>>(() => new Set(moments.map((_, index) => index)));
  const chosen = [...approved].sort((a, b) => a - b);
  const visible = tab === "approved" ? chosen : moments.map((_, index) => index);
  const focused = moments[focus] ?? moments[0];

  function toggle(index: number) {
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function render() {
    setTab("clips");
    onRender(chosen);
  }

  const reviewing = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        {focused ? <MomentPlayer project={project} moment={focused} /> : null}
        {focused ? <MomentDetail moment={focused} /> : null}
      </div>
      <div className="grid max-h-[32rem] content-start gap-2 overflow-y-auto pr-1">
        {visible.length ? (
          visible.map((index) => (
            <MomentRow
              key={index}
              moment={moments[index]}
              index={index}
              focused={index === focus}
              approved={approved.has(index)}
              onFocus={() => setFocus(index)}
              onToggle={() => toggle(index)}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No moments approved yet.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)}>
        <TabsList variant="line">
          <TabsTrigger value="moments">
            Moments <Badge variant="secondary">{moments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved <Badge variant="secondary">{chosen.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="clips">
            Clips <Badge variant="secondary">{artifacts.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="moments" className="pt-3">
          {reviewing}
        </TabsContent>
        <TabsContent value="approved" className="pt-3">
          {reviewing}
        </TabsContent>
        <TabsContent value="clips" className="grid gap-4 pt-3">
          {renderJob?.status === "running" ? <JobPanel job={renderJob} /> : null}
          {renderJob?.status === "error" && renderJob.error ? (
            <StatusMessage tone="danger" title="Render failed">
              {renderJob.error}
            </StatusMessage>
          ) : null}
          {renderJob?.status !== "running" ? <ClipResultGallery artifacts={artifacts} /> : null}
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {chosen.length} of {moments.length} approved
        </span>
        <Button type="button" disabled={busy || chosen.length === 0} onClick={render}>
          <Scissors /> {busy ? "Working..." : `Render ${chosen.length} ${chosen.length === 1 ? "clip" : "clips"}`}
        </Button>
      </div>
    </div>
  );
}
