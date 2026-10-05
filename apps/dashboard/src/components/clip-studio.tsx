import { useState } from "react";

import { ClipStudioLayout, StatusMessage, type ClipStudioMoment, type ClipStudioTab } from "@videogpt/ui";

import type { Artifact, Job, Moment, Project } from "../types";
import { clock, MomentPlayer } from "./clip-moment-player";
import { ClipResultGallery } from "./clip-result-gallery";
import { JobPanel } from "./job-panel";

class StudioMoments {
  static view(moment: Moment, index: number): ClipStudioMoment {
    return {
      key: String(index),
      label: `#${index + 1}`,
      range: `${clock(moment.start)} - ${clock(moment.end)}`,
      duration: `${Math.round(moment.end - moment.start)}s`,
      score: StudioMoments.score(moment),
      title: moment.title || moment.ai_hook || moment.text || "Untitled moment",
      hook: moment.ai_hook,
      reason: moment.ai_reason,
      text: moment.text,
    };
  }

  private static score(moment: Moment): number | null {
    if (typeof moment.score !== "number") return null;
    return Math.round(moment.score > 1 ? moment.score : moment.score * 100);
  }
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
  const [tab, setTab] = useState<ClipStudioTab>(artifacts.length ? "clips" : "moments");
  const [focused, setFocused] = useState("0");
  const [approved, setApproved] = useState<string[]>(() => moments.map((_, index) => String(index)));
  const focusedMoment = moments[Number(focused)] ?? moments[0];
  const running = renderJob?.status === "running";

  function toggle(key: string) {
    setApproved((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <ClipStudioLayout
      moments={moments.map(StudioMoments.view)}
      approved={approved}
      focused={focused}
      tab={tab}
      player={focusedMoment ? <MomentPlayer project={project} moment={focusedMoment} /> : null}
      clips={
        <>
          {running && renderJob ? <JobPanel job={renderJob} /> : null}
          {renderJob?.status === "error" && renderJob.error ? (
            <StatusMessage tone="danger" title="Render failed">
              {renderJob.error}
            </StatusMessage>
          ) : null}
          {running ? null : <ClipResultGallery artifacts={artifacts} />}
        </>
      }
      clipCount={artifacts.length}
      renderLabel={busy ? "Working..." : `Render ${approved.length} ${approved.length === 1 ? "clip" : "clips"}`}
      renderDisabled={busy}
      onFocus={setFocused}
      onToggle={toggle}
      onTabChange={setTab}
      onRender={() => {
        setTab("clips");
        onRender(approved.map(Number).sort((a, b) => a - b));
      }}
    />
  );
}
