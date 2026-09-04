import { useConvexMutation, useConvexPaginatedQuery } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { AlignLeft, PanelLeft, SquarePen, X } from "lucide-react";
import { useState } from "react";
import { href, useNavigate } from "react-router";

import { SessionListItem, type SessionSummary } from "@/components/session-list-item";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { clearSessionRuntime } from "@/lib/session-runtime";
import { cn } from "@/lib/utils";

type DeleteSessionDialogProps = {
  readonly onClose: () => void;
  readonly onDeleted: (sessionId: string) => void;
  readonly target?: SessionSummary;
};

function DeleteSessionDialog({ onClose, onDeleted, target }: DeleteSessionDialogProps) {
  const removeSession = useMutation({ mutationFn: useConvexMutation(api.sessions.remove) });

  function remove(): void {
    if (!target) return;
    removeSession.mutate(
      { sessionId: target.sessionId },
      {
        onSuccess: () => {
          clearSessionRuntime(target.sessionId);
          onDeleted(target.sessionId);
          document.querySelector<HTMLDialogElement>("#delete-session-dialog")?.close();
        },
      },
    );
  }

  return (
    <dialog
      aria-describedby="delete-session-description"
      aria-labelledby="delete-session-title"
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border bg-card p-5 text-card-foreground shadow-2xl backdrop:bg-black/70"
      id="delete-session-dialog"
      onCancel={(event) => removeSession.isPending && event.preventDefault()}
      onClose={() => {
        removeSession.reset();
        onClose();
      }}
    >
      <h2 className="font-medium" id="delete-session-title">
        Delete session permanently?
      </h2>
      <p className="mt-2 text-muted-foreground" id="delete-session-description">
        “{target?.name}” and its history cannot be recovered.
      </p>
      {removeSession.isError && (
        <Alert className="mt-4" variant="destructive">
          Could not delete this session.
        </Alert>
      )}
      <form className="mt-5 flex justify-end gap-2" method="dialog">
        <Button disabled={removeSession.isPending} type="submit" variant="outline">
          Cancel
        </Button>
        <Button disabled={removeSession.isPending} onClick={remove} variant="destructive">
          Delete
        </Button>
      </form>
    </dialog>
  );
}

type AppSidebarProps = {
  readonly isCollapsed: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onNewSession: () => void;
  readonly onToggle: () => void;
  readonly selectedSessionId: string | null;
};

export function AppSidebar({
  isCollapsed,
  isOpen,
  onClose,
  onNewSession,
  onToggle,
  selectedSessionId,
}: AppSidebarProps) {
  const {
    loadMore,
    results: sessions,
    status,
  } = useConvexPaginatedQuery(api.sessions.list, {}, { initialNumItems: 50 });
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary>();

  function openDelete(session: SessionSummary): void {
    setDeleteTarget(session);
    document.querySelector<HTMLDialogElement>("#delete-session-dialog")?.showModal();
  }

  function sessionDeleted(sessionId: string): void {
    if (selectedSessionId !== sessionId) return;
    onClose();
    void navigate(href("/"));
  }

  return (
    <>
      <button
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 z-40 bg-black/50 opacity-0 transition-opacity md:hidden",
          isOpen && "pointer-events-auto opacity-100",
        )}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        id="session-sidebar"
        inert={isCollapsed}
        className={cn(
          "invisible fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] -translate-x-full flex-col overflow-hidden border-r bg-sidebar p-3 text-sidebar-foreground shadow-2xl transition-[width,transform,padding] md:visible md:static md:z-auto md:w-72 md:translate-x-0 md:p-2 md:shadow-none",
          isOpen && "visible translate-x-0",
          isCollapsed && "md:w-0 md:border-r-0 md:p-0",
        )}
      >
        <div className="flex h-10 shrink-0 items-center justify-between px-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <AlignLeft aria-hidden="true" className="text-muted-foreground" />
            <span className="truncate">Mojo Code</span>
          </div>
          <Button
            aria-label="Close sessions"
            className="text-muted-foreground md:hidden"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            aria-controls="session-sidebar"
            aria-expanded="true"
            aria-label="Collapse sessions"
            className="hidden text-muted-foreground md:inline-flex"
            onClick={onToggle}
            size="icon"
            variant="ghost"
          >
            <PanelLeft aria-hidden="true" />
          </Button>
        </div>
        <button
          className="mt-4 flex h-9 w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors hover:bg-sidebar-hover focus-visible:bg-sidebar-hover md:h-7"
          onClick={onNewSession}
          type="button"
        >
          <SquarePen aria-hidden="true" className="text-muted-foreground" />
          New session
        </button>
        <nav
          aria-label="Sessions"
          className="app-scrollbar scroll-fade -mr-3 mt-4 min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-gutter:stable] md:-mr-2 md:pr-2"
        >
          <p className="px-2 pb-1.5 text-sm font-medium text-muted-foreground">Sessions</p>
          {sessions.map((session) => (
            <SessionListItem
              isSelected={selectedSessionId === session.sessionId}
              key={session.sessionId}
              onDelete={openDelete}
              onNavigate={onClose}
              session={session}
            />
          ))}
          {status === "CanLoadMore" && (
            <Button className="mt-3 w-full" onClick={() => loadMore(50)} size="sm" variant="ghost">
              Load older sessions
            </Button>
          )}
        </nav>
      </aside>
      <DeleteSessionDialog
        onClose={() => setDeleteTarget(undefined)}
        onDeleted={sessionDeleted}
        target={deleteTarget}
      />
    </>
  );
}
