import { ArrowLeft, ArrowRight, FilePlus2, GitFork, type LucideIcon } from "lucide-react";
import { type InputEvent, type PropsWithChildren, type SubmitEvent, useRef, useState } from "react";

import { Composer } from "@/components/chat/composer";
import { Button } from "@/components/ui/button";
import { type GitRepository, parseGitHubRepository } from "@/lib/github";

type StartMode = "choose" | "empty" | "github";

type SessionStartProps = {
  readonly onImport: (repository: GitRepository) => void;
  readonly onStart: (message: string) => void;
};

function StartOption({
  description,
  icon: Icon,
  onClick,
  title,
}: {
  readonly description: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  readonly title: string;
}) {
  return (
    <button
      className="group flex min-h-32 flex-col items-start rounded-xl border border-border/60 bg-muted p-4 text-left outline-none transition-colors hover:border-ring/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={onClick}
      type="button"
    >
      <span className="mb-6 flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon aria-hidden="true" />
      </span>
      <span className="font-medium">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function StartBack({ onClick }: { readonly onClick: () => void }) {
  return (
    <Button className="mb-4 self-center text-muted-foreground" onClick={onClick} variant="ghost">
      <ArrowLeft aria-hidden="true" />
      Back
    </Button>
  );
}

function StartContent({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}

function StartChoice({
  onEmpty,
  onGitHub,
}: {
  readonly onEmpty: () => void;
  readonly onGitHub: () => void;
}) {
  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-medium tracking-tight">What should we build?</h2>
      <p className="mt-1 text-muted-foreground">Choose a starting point for this session.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StartOption
          description="Start with an empty workspace"
          icon={FilePlus2}
          onClick={onEmpty}
          title="Empty project"
        />
        <StartOption
          description="Clone a public repository"
          icon={GitFork}
          onClick={onGitHub}
          title="GitHub repository"
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        This is a public demo. Requests may be rate limited.
      </p>
    </div>
  );
}

function GitHubStart({
  onBack,
  onImport,
}: {
  readonly onBack: () => void;
  readonly onImport: (repository: GitRepository) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const repository = parseGitHubRepository(input.value.trim());
    if (!repository) {
      input.setCustomValidity("Enter owner/repository or a GitHub repository URL.");
      input.reportValidity();
      return;
    }
    onImport(repository);
  }

  function clearError(event: InputEvent<HTMLInputElement>): void {
    event.currentTarget.setCustomValidity("");
  }

  return (
    <div className="flex w-full max-w-xl flex-col">
      <StartBack onClick={onBack} />
      <h2 className="text-2xl font-medium tracking-tight">Import from GitHub</h2>
      <p className="mt-1 text-muted-foreground">Clone a public repository into this session.</p>
      <form
        className="mt-6 rounded-xl border border-border/40 bg-muted p-2 text-left focus-within:border-ring/50"
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor="github-repository">
          GitHub repository
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md bg-background px-3">
            <GitFork aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoComplete="off"
              // biome-ignore lint/a11y/noAutofocus: Repository entry is this screen's primary action.
              autoFocus
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              id="github-repository"
              onInput={clearError}
              placeholder="owner/repository or GitHub URL"
              ref={inputRef}
            />
          </div>
          <Button className="h-10 px-4" type="submit">
            Import
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <p className="px-2 pt-2 pb-1 text-sm text-muted-foreground">Public repositories only</p>
      </form>
    </div>
  );
}

function EmptyStart({
  onBack,
  onStart,
}: {
  readonly onBack: () => void;
  readonly onStart: (message: string) => void;
}) {
  return (
    <>
      <StartContent>
        <div className="flex flex-col">
          <StartBack onClick={onBack} />
          <h2 className="text-2xl font-medium tracking-tight">What should we build?</h2>
        </div>
      </StartContent>
      <div className="shrink-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <Composer disabled={false} isGenerating={false} onSend={onStart} />
      </div>
    </>
  );
}

export function SessionStart({ onImport, onStart }: SessionStartProps) {
  const [mode, setMode] = useState<StartMode>("choose");

  if (mode === "empty") {
    return <EmptyStart onBack={() => setMode("choose")} onStart={onStart} />;
  }

  if (mode === "github") {
    return (
      <StartContent>
        <GitHubStart onBack={() => setMode("choose")} onImport={onImport} />
      </StartContent>
    );
  }

  return (
    <StartContent>
      <StartChoice onEmpty={() => setMode("empty")} onGitHub={() => setMode("github")} />
    </StartContent>
  );
}
