"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type RouterOutputs } from "@/trpc/react";

type JoinStatus = "idle" | "checking" | "ready";
type ResolvedInvite = RouterOutputs["onboarding"]["resolveInvite"];

type JoinGroupPanelProps = {
  prefillCode?: string;
};

export function JoinGroupPanel({ prefillCode }: JoinGroupPanelProps) {
  const [code, setCode] = useState(prefillCode ?? "");
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedGroup, setResolvedGroup] = useState<ResolvedInvite | null>(null);
  const [prefillAttempted, setPrefillAttempted] = useState(false);

  const uppercaseCode = useMemo(
    () => code.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3),
    [code],
  );
  const isCodeValid = uppercaseCode.length === 3;

  const resolveInvite = api.onboarding.resolveInvite.useMutation();

  const attemptResolve = useCallback(
    async (inviteCode: string) => {
      setStatus("checking");
      setErrorMessage(null);
      setResolvedGroup(null);
      try {
        const payload = await resolveInvite.mutateAsync({ code: inviteCode });
        setResolvedGroup(payload);
        setStatus("ready");
      } catch (error) {
        setStatus("idle");
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to find an invite with that code.",
        );
      }
    },
    [resolveInvite],
  );

  useEffect(() => {
    if (!prefillCode || prefillAttempted) return;
    const cleaned = prefillCode.toUpperCase();
    setCode(cleaned);
    setPrefillAttempted(true);
    if (cleaned.length === 3) void attemptResolve(cleaned);
  }, [attemptResolve, prefillCode, prefillAttempted]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCodeValid) return;
    void attemptResolve(uppercaseCode);
  };

  const preferenceTags =
    resolvedGroup?.selectionSnapshot &&
    Object.values(resolvedGroup.selectionSnapshot ?? {})
      .flat()
      .filter(Boolean)
      .slice(0, 4);

  const liveUpdates = resolvedGroup
    ? [
        `${resolvedGroup.hostName} hosting · ${resolvedGroup.memberCount} members`,
        resolvedGroup.selectionSnapshot.focus?.length
          ? `Focus: ${resolvedGroup.selectionSnapshot.focus.join(", ")}`
          : null,
        resolvedGroup.selectionSnapshot.vibe?.length
          ? `Vibe: ${resolvedGroup.selectionSnapshot.vibe.join(", ")}`
          : null,
      ].filter(Boolean)
    : ["Waiting for code match…"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-900/50 text-slate-100">
        <CardHeader>
          <CardDescription className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Step 01
          </CardDescription>
          <CardTitle>Enter the 3-letter code</CardTitle>
          <CardDescription>
            Codes live on receipts, QR screens, and chat shares. Enter it to join the crew,
            answer the onboarding questions, and unlock recommended experiences.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="code">Invite code</Label>
              <Input
                id="code"
                value={uppercaseCode}
                onChange={(event) => setCode(event.target.value)}
                placeholder="e.g. RPL"
                maxLength={3}
                className="border-slate-700 bg-slate-900 text-2xl uppercase tracking-[0.3em]"
                aria-describedby="code-help"
              />
              <p id="code-help" className="text-sm text-slate-400">
                Accepts letters only. Example: <span className="font-mono">WLT</span>
              </p>
              {errorMessage && (
                <p className="text-sm text-red-300" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Or scan</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-32 w-32 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-600">
                  QR
                </div>
                <div className="text-sm text-slate-400">
                  QR poster drops in restaurants, offices, and Wolt Market lockers. Scan to
                  open the same join link. This is a placeholder for the actual QR render.
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              You’ll preview the group before committing.
            </p>
            <Button
              type="submit"
              disabled={!isCodeValid || status === "checking"}
              className="bg-blue-500 text-white hover:bg-blue-500/90"
            >
              {status === "checking" ? "Checking…" : "Join group"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
        <CardHeader>
          <CardDescription className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Step 02
          </CardDescription>
          <CardTitle>Preview the crew</CardTitle>
          <CardDescription>
            Once the code is validated, we surface core details straight from the database so
            you know you’re in the right place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Group name
            </p>
            <h3 className="text-2xl font-semibold text-white">
              {resolvedGroup?.groupName ?? "— — —"}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
              <span>Host · {resolvedGroup?.hostName ?? "—"}</span>
              <span>Members · {resolvedGroup?.memberCount ?? "—"}</span>
              <span>Code · {resolvedGroup?.joinCode ?? "—"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(preferenceTags && preferenceTags.length > 0
                ? preferenceTags
                : ["Invite pending"]
              ).map((tag) => (
                <Badge key={tag} className="bg-slate-800 text-slate-200">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Live updates
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {liveUpdates.map((update) => (
                <li key={update ?? "empty"} className="rounded-lg bg-slate-900/60 px-3 py-2">
                  {update}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-800 text-sm text-slate-400">
          Step 03 mirrors onboarding so everyone can submit their vibe. This will hook into
          tRPC once we wire the shared group state.
        </CardFooter>
      </Card>
    </div>
  );
}

