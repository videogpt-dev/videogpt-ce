import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";

import { Button, Card, CardContent, Field, FieldDescription, FieldLabel, Input, SegmentWorkspace, StatusMessage } from "@videogpt/ui";

import { useStudio } from "../studio-context";

export function ClipNewPage() {
  const navigate = useNavigate();
  const { createProject, segment } = useStudio();
  const definition = segment("clips");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject("clips", title.trim());
      navigate(`/clips/${project.id}/source`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create the project.");
      setSubmitting(false);
    }
  }

  if (!definition) {
    return <StatusMessage tone="danger" title="Clips is unavailable">The engine did not report the Clips workflow.</StatusMessage>;
  }

  return (
    <SegmentWorkspace segment={definition} eyebrow="New project">
      <Card className="mx-auto max-w-xl gap-0 py-0">
        <CardContent className="p-5 sm:p-6">
          <form className="grid gap-5" onSubmit={submit}>
            <div>
              <h2 className="text-lg font-semibold">Name this clip project</h2>
              <p className="mt-1 text-sm text-muted-foreground">Next, you will add the source video and choose how moments should be found.</p>
            </div>
            <Field>
              <FieldLabel htmlFor="clip-project-title">Project name</FieldLabel>
              <Input
                id="clip-project-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Highlights from my interview"
              />
              <FieldDescription>Stored locally. You can use any name.</FieldDescription>
            </Field>
            {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={!title.trim() || submitting}>
                {submitting ? "Creating..." : "Continue"} <ArrowRight />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SegmentWorkspace>
  );
}
