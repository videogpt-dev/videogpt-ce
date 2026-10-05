import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { Field, FieldDescription, FieldLabel, Input, SegmentWorkspace, SeriesCreateLayout, StatusMessage, type SeriesDraft } from "@videogpt/ui";

import { api } from "../api";
import { useStudio } from "../studio-context";

const DEFAULT_DRAFT: SeriesDraft = {
  name: "",
  premise: "",
  style: "",
  engine: "storyboard",
  aspectRatio: "9:16",
  language: "",
  resolution: 720,
  mature: false,
};

export function SeriesNewPage() {
  const navigate = useNavigate();
  const { createProject, segment } = useStudio();
  const definition = segment("series");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [episodeCount, setEpisodeCount] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.premise.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject("series", draft.name.trim());
      await api<{ job_id: string }>(`/api/projects/${project.id}/series`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          premise: draft.premise,
          style: draft.style,
          aspect_ratio: draft.aspectRatio,
          language: draft.language,
          engine: draft.engine,
          resolution: draft.resolution,
          mature: draft.mature,
          count: episodeCount,
        }),
      });
      navigate(`/series/${project.id}/episodes`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start the series.");
      setSubmitting(false);
    }
  }

  if (!definition) {
    return <StatusMessage tone="danger" title="Series is unavailable">The engine did not report the Series workflow.</StatusMessage>;
  }

  return (
    <SegmentWorkspace segment={definition} eyebrow="New project">
      <SeriesCreateLayout
        draft={draft}
        submitting={submitting}
        submitDisabled={!draft.name.trim() || !draft.premise.trim()}
        error={error}
        slots={{
          extraFields: (
            <Field>
              <FieldLabel htmlFor="series-episode-count">Episodes to plan</FieldLabel>
              <Input
                id="series-episode-count"
                type="number"
                min={1}
                max={12}
                value={episodeCount}
                onChange={(event) => setEpisodeCount(Number(event.target.value) || 6)}
              />
              <FieldDescription>You can generate each proposed episode separately.</FieldDescription>
            </Field>
          ),
        }}
        renderForm={({ children, className }) => <form className={className} onSubmit={submit}>{children}</form>}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />
    </SegmentWorkspace>
  );
}
