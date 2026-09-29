import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import {
  ClipCreateLayout,
  SegmentWorkspace,
  StatusMessage,
  type ClipDraft,
  type ClipSourceKind,
  type ClipStepSlug,
} from "@videogpt/ui";

import { ClipMomentsReview } from "../components/clip-moments-review";
import { ClipResultGallery } from "../components/clip-result-gallery";
import { ClipSourcePanel } from "../components/clip-source-panel";
import { JobPanel } from "../components/job-panel";
import { PageError, PageLoading } from "../components/page-state";
import { useStudio } from "../studio-context";
import { normalizeKind } from "../types";
import { useProject, type ProjectSnapshot } from "../use-project";

const STEP_BY_VIEW: Record<string, ClipStepSlug> = {
  source: "source",
  settings: "find-moments",
  results: "generate",
};

const VIEW_BY_STEP: Record<ClipStepSlug, string> = {
  source: "source",
  "find-moments": "settings",
  generate: "results",
};

const DEFAULT_DRAFT: ClipDraft = {
  url: "",
  hasFile: false,
  clips: 10,
  minLength: 20,
  maxLength: 60,
  formats: "9:16",
  whisper: "base",
  minInterest: 0.3,
  captions: true,
  momentFinder: "auto",
  momentProvider: "",
  momentModel: "",
};

function readDraft(form: HTMLFormElement, previous: ClipDraft, hasFile: boolean): ClipDraft {
  const data = new FormData(form);
  return {
    ...previous,
    hasFile,
    clips: Number(data.get("clips")) || previous.clips,
    minLength: Number(data.get("min_length")) || previous.minLength,
    maxLength: Number(data.get("max_length")) || previous.maxLength,
    formats: String(data.get("formats") || previous.formats),
    whisper: String(data.get("whisper_model") || previous.whisper),
    minInterest: Number(data.get("min_interest") ?? previous.minInterest),
    captions: data.has("captions"),
    momentFinder: String(data.get("moment_finder") || previous.momentFinder),
    momentProvider: String(data.get("moment_provider") || previous.momentProvider),
    momentModel: String(data.get("moment_model") ?? previous.momentModel),
  };
}

export function ClipProjectPage({ initial }: { initial?: ProjectSnapshot }) {
  const { projectId, view = "source" } = useParams();
  const navigate = useNavigate();
  const { providers, segment } = useStudio();
  const definition = segment("clips");
  const { project, job, loading, uploading, busy, error, startJob, upload, fetchUrl, renderClips } =
    useProject(projectId, initial);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<ClipSourceKind>("url");
  const formRef = useRef<HTMLFormElement>(null);
  const hydratedRef = useRef<string | null>(null);
  const step = STEP_BY_VIEW[view] ?? "source";
  const providerOptions = useMemo(() => {
    const available = Array.from(
      new Set(
        providers
          .filter((item) => item.kind === "text" && item.provider?.trim())
          .map((item) => item.provider.trim()),
      ),
    ).map((provider) => ({ value: provider, label: provider }));
    if (!available.length) {
      return [{ value: "", label: "No AI provider available", disabled: true }];
    }
    return available;
  }, [providers]);

  useEffect(() => {
    if (!project || hydratedRef.current === project.id) return;
    const options = project.clip_options ?? {};
    const formats = Array.isArray(options.formats) ? options.formats.join(",") : DEFAULT_DRAFT.formats;
    setDraft({
      ...DEFAULT_DRAFT,
      url: project.source_url ?? "",
      hasFile: Boolean(project.source),
      clips: Number(options.clip_count) || DEFAULT_DRAFT.clips,
      minLength: Number(options.min_length) || DEFAULT_DRAFT.minLength,
      maxLength: Number(options.max_length) || DEFAULT_DRAFT.maxLength,
      formats,
      whisper: String(options.whisper_model || DEFAULT_DRAFT.whisper),
      minInterest: Number(options.min_interest_score ?? DEFAULT_DRAFT.minInterest),
      captions: options.generate_captions === undefined ? DEFAULT_DRAFT.captions : Boolean(options.generate_captions),
      momentFinder: String(options.moment_finder || DEFAULT_DRAFT.momentFinder),
      momentProvider: String(options.moment_provider || DEFAULT_DRAFT.momentProvider),
      momentModel: String(options.moment_model || DEFAULT_DRAFT.momentModel),
    });
    setSourceKind(project.source_url ? "url" : "file");
    hydratedRef.current = project.id;
  }, [project]);

  const artifacts = project?.last_result?.artifacts ?? [];
  const moments = project?.moments ?? [];
  const hasSource = Boolean(project?.source || project?.source_url);
  const furthest =
    project?.last_result || moments.length || job?.kind === "clips" ? 2 : hasSource ? 1 : 0;
  const resultError = project?.last_result?.error;

  const after = useMemo(
    () =>
      step === "generate" ? (
        <div className="mt-5 grid gap-4">
          {job?.status === "running" ? <JobPanel job={job} /> : null}
          {resultError ? <StatusMessage tone="danger" title="Clip generation failed">{resultError}</StatusMessage> : null}
          {!busy && project && moments.length ? (
            <ClipMomentsReview
              project={project}
              moments={moments}
              busy={busy}
              onRender={(indices) => void renderClips(indices)}
            />
          ) : null}
          {!busy && artifacts.length ? <ClipResultGallery artifacts={artifacts} /> : null}
        </div>
      ) : step === "source" && job?.kind === "url" ? (
        <div className="mt-5"><JobPanel job={job} /></div>
      ) : job?.status === "running" ? (
        <div className="mt-5"><JobPanel job={job} /></div>
      ) : null,
    [artifacts, busy, job, moments, project, renderClips, resultError, step],
  );

  if (loading) return <PageLoading />;
  if (error && !project) return <PageError message={error} />;
  if (!project) return <PageError message="Project not found." />;
  if (normalizeKind(project.kind) !== "clips") return <PageError message="This is not a Clips project." />;
  if (!definition) return <PageError message="The Clips workflow is not available from the local engine." />;

  function go(next: ClipStepSlug) {
    if (formRef.current) setDraft((current) => readDraft(formRef.current!, current, Boolean(project?.source)));
    navigate(`/clips/${projectId}/${VIEW_BY_STEP[next]}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSource) return;
    const data = new FormData(event.currentTarget);
    const next = readDraft(event.currentTarget, draft, true);
    setDraft(next);
    if (next.minLength >= next.maxLength) {
      setFormError("Min length must be less than max length.");
      return;
    }
    setFormError(null);
    const momentProvider = next.momentProvider.trim();
    const momentModel = next.momentModel.trim();
    if (next.momentFinder === "ai" && (!momentProvider || !momentModel)) {
      setFormError("Pick an AI provider and enter a model id, or switch the finder to Offline.");
      return;
    }
    setFormError(null);
    navigate(`/clips/${projectId}/results`);
    await startJob(`/api/projects/${projectId}/clips`, {
      clip_count: next.clips,
      min_length: next.minLength,
      max_length: next.maxLength,
      formats: next.formats.split(",").filter(Boolean),
      quality: String(data.get("quality") || ""),
      language: String(data.get("language") || "").trim(),
      transcript_source: String(data.get("transcript_source") || ""),
      whisper_model: next.whisper,
      min_interest_score: next.minInterest,
      generate_captions: next.captions,
      moment_finder: next.momentFinder,
      moment_provider: momentProvider,
      moment_model: momentModel,
    });
  }

  return (
    <SegmentWorkspace
      segment={definition}
      eyebrow="Clip project"
      actions={<span className="max-w-64 truncate text-sm font-medium">{project.title}</span>}
      contentClassName="xl:grid-cols-1"
      inspector={false}
    >
      <ClipCreateLayout
        step={step}
        furthest={furthest}
        draft={draft}
        source={sourceKind}
        defaults={{
          count: draft.clips,
          min_length: draft.minLength,
          max_length: draft.maxLength,
          formats: draft.formats.split(",").filter(Boolean),
          captions: draft.captions,
        }}
        limits={{ maxClips: 50, minLengthSeconds: 5, maxLengthSeconds: 180, whisperModel: "base", minInterest: 0.3 }}
        whisper={draft.whisper}
        minInterest={draft.minInterest}
        providerOptions={providerOptions}
        submitting={busy && job?.kind === "clips"}
        submitDisabled={!hasSource || busy}
        blocker={step === "source" && !hasSource ? "Add a source video or URL before continuing." : undefined}
        error={formError || error}
        copy={{
          submit: moments.length || artifacts.length ? "Find again" : "Find moments",
          submitting: "Finding moments...",
        }}
        classNames={{ root: "max-w-4xl" }}
        slots={{
          source: (
            <ClipSourcePanel
              project={project}
              uploading={uploading}
              busy={busy}
              error={error}
              onUpload={(file) => void upload(file)}
              onFetch={(url) => {
                void fetchUrl(url).then((ok) => {
                  if (ok) navigate(`/clips/${projectId}/settings`);
                });
              }}
            />
          ),
          after,
        }}
        renderForm={({ children, className }) => (
          <form
            ref={formRef}
            className={className}
            onSubmit={submit}
            onInput={(event) => {
              const form = event.currentTarget;
              setDraft((current) => readDraft(form, current, Boolean(project.source)));
            }}
          >
            {children}
          </form>
        )}
        onStepChange={go}
        onSourceChange={setSourceKind}
        onWhisperChange={(whisper) => setDraft((current) => ({ ...current, whisper }))}
        onMinInterestChange={(minInterest) => setDraft((current) => ({ ...current, minInterest }))}
      />
    </SegmentWorkspace>
  );
}
