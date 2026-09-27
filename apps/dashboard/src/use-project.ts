import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import { useStudio } from "./studio-context";
import type { Job, Project } from "./types";

export type ProjectSnapshot = {
  project: Project;
  jobs: Job[];
};

export function useProject(projectId?: string, initial?: ProjectSnapshot) {
  const { refreshProjects } = useStudio();
  const initialJob = initial?.jobs.find((item) => item.status === "running") ?? initial?.jobs[0] ?? null;
  const [project, setProject] = useState<Project | null>(initial?.project ?? null);
  const [job, setJob] = useState<Job | null>(initialJob);
  const [loading, setLoading] = useState(!initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadProject = useCallback(async () => {
    if (!projectId) return null;
    const next = await api<Project>(`/api/projects/${projectId}`);
    setProject(next);
    return next;
  }, [projectId]);

  const finishJob = useCallback(async () => {
    await Promise.all([loadProject(), refreshProjects()]);
  }, [loadProject, refreshProjects]);

  const watch = useCallback(
    (jobId: string) => {
      stopPolling();
      // Poll with backoff: quick first checks, then ease off so a long find/render pass
      // is not hammered every second. Each poll is scheduled only after the previous
      // response, so slow requests never stack up.
      const MIN_DELAY = 2000;
      const MAX_DELAY = 8000;
      let delay = MIN_DELAY;
      const tick = async () => {
        try {
          const next = await api<Job>(`/api/jobs/${jobId}`);
          setJob(next);
          if (next.status !== "running") {
            stopPolling();
            await finishJob();
            return;
          }
          pollRef.current = window.setTimeout(() => void tick(), delay);
          delay = Math.min(delay * 1.5, MAX_DELAY);
        } catch (nextError) {
          stopPolling();
          setError(nextError instanceof Error ? nextError.message : "Could not read job status.");
        }
      };
      void tick();
    },
    [finishJob, stopPolling],
  );

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      await loadProject();
      const jobs = await api<Job[]>(`/api/projects/${projectId}/jobs`);
      const running = jobs.find((item) => item.status === "running");
      if (running) watch(running.id);
      else setJob(jobs[0] ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load this project.");
    } finally {
      setLoading(false);
    }
  }, [loadProject, projectId, watch]);

  useEffect(() => {
    if (initial && initial.project.id === projectId) {
      setProject(initial.project);
      setJob(initialJob);
      setLoading(false);
      if (initialJob?.status === "running") watch(initialJob.id);
    } else {
      void load();
    }
    return stopPolling;
  }, [initial, initialJob, load, projectId, stopPolling, watch]);

  const startJob = useCallback(
    async (path: string, body?: unknown) => {
      setError(null);
      try {
        const result = await api<{ job_id?: string }>(path, {
          method: "POST",
          headers: body === undefined ? undefined : { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (result.job_id) watch(result.job_id);
        return result.job_id ?? null;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "The job could not be started.");
        return null;
      }
    },
    [watch],
  );

  const renderClips = useCallback(
    async (indices: number[]) => {
      if (!projectId) return null;
      return startJob(`/api/projects/${projectId}/clips/render`, { indices });
    },
    [projectId, startJob],
  );

  const upload = useCallback(
    async (file: File) => {
      if (!projectId) return false;
      setUploading(true);
      setError(null);
      const body = new FormData();
      body.append("file", file);
      try {
        await api(`/api/projects/${projectId}/source`, { method: "POST", body });
        await finishJob();
        return true;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "The upload failed.");
        return false;
      } finally {
        setUploading(false);
      }
    },
    [finishJob, projectId],
  );

  const fetchUrl = useCallback(
    async (url: string) => {
      if (!projectId) return false;
      setError(null);
      try {
        // Source-light: this just records the URL (no download). Reload so the project shows
        // it as the source and the step can advance.
        await api(`/api/projects/${projectId}/source-url`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });
        await finishJob();
        return true;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not add this URL.");
        return false;
      }
    },
    [finishJob, projectId],
  );

  return {
    project,
    job,
    loading,
    uploading,
    error,
    busy: uploading || job?.status === "running",
    reload: load,
    startJob,
    upload,
    fetchUrl,
    renderClips,
    clearError: () => setError(null),
  };
}
