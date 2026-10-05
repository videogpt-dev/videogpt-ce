import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import {
  Field,
  FieldLabel,
  SegmentWorkspace,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusMessage,
  StoryCreateLayout,
  type StoryDraft,
} from "@videogpt/ui";

import { api } from "../api";
import { useStudio } from "../studio-context";

const DEFAULT_DRAFT: StoryDraft = {
  title: "",
  description: "",
  sceneCount: 6,
  language: "",
  aspectRatio: "9:16",
  genre: "",
  engine: "storyboard",
  agentId: "community",
  mature: false,
  enhance: false,
};

// Visual-style presets. The value is the phrase appended to every scene's image prompt
// ("Visual style: <value>"); an empty value lets the screenwriter choose the look.
const AUTO_STYLE = "auto"; // sentinel: Radix Select forbids an empty-string item value.
const STYLE_PRESETS: { value: string; label: string }[] = [
  { value: AUTO_STYLE, label: "Auto (writer decides)" },
  { value: "cinematic film still, dramatic lighting, shallow depth of field, subtle film grain", label: "Cinematic" },
  { value: "claymation, stop-motion clay characters, tactile handmade textures", label: "Claymation" },
  { value: "anime, cel-shaded, clean linework, vibrant colors", label: "Anime" },
  { value: "watercolor illustration, soft color washes, visible paper texture", label: "Watercolor" },
  { value: "3D animated film, soft global illumination, stylized characters", label: "3D animated" },
  { value: "comic book art, bold ink outlines, halftone shading", label: "Comic book" },
  { value: "black-and-white film noir, high contrast, deep shadows", label: "Film noir" },
  { value: "photorealistic, natural lighting, highly detailed", label: "Photoreal" },
];

export function StoryNewPage() {
  const navigate = useNavigate();
  const { createProject, segment } = useStudio();
  const definition = segment("story");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [style, setStyle] = useState(AUTO_STYLE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject("story", draft.title.trim());
      await api<{ job_id: string }>(`/api/projects/${project.id}/story`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: draft.description,
          scene_count: draft.sceneCount,
          language: draft.language,
          aspect_ratio: draft.aspectRatio,
          genre: draft.genre,
          engine: draft.engine,
          mature: draft.mature,
          style: style === AUTO_STYLE ? "" : style,
        }),
      });
      navigate(`/story/${project.id}/story`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start the story.");
      setSubmitting(false);
    }
  }

  if (!definition) {
    return <StatusMessage tone="danger" title="Story is unavailable">The engine did not report the Story workflow.</StatusMessage>;
  }

  return (
    <SegmentWorkspace segment={definition} eyebrow="New project">
      <StoryCreateLayout
        draft={draft}
        submitting={submitting}
        submitDisabled={!draft.title.trim()}
        error={error}
        renderForm={({ children, className }) => <form className={className} onSubmit={submit}>{children}</form>}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        slots={{
          extraFields: (
            <Field>
              <FieldLabel htmlFor="story-style">Visual style</FieldLabel>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger id="story-style" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_PRESETS.map((preset) => (
                    <SelectItem key={preset.label} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ),
        }}
      />
    </SegmentWorkspace>
  );
}
