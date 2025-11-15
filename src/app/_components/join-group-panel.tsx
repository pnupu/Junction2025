"use client";

import { useMemo, useState } from "react";

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

const mockGroup = {
  name: "Lina's City Crew",
  host: "Lina",
  location: "Helsinki",
  vibe: ["Cozy", "Foodie circuit"],
  members: 3,
};

const mockUpdates = [
  "Sauna + cold plunge locked for 19:00",
  "AI suggests sourdough pizza pop-up nearby",
  "Two friends prefer gluten-free → updated routes",
];

type JoinStatus = "idle" | "checking" | "ready";

export function JoinGroupPanel() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<JoinStatus>("idle");

  const isCodeValid = code.trim().length === 3;

  const uppercaseCode = useMemo(() => code.toUpperCase().slice(0, 3), [code]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCodeValid) return;
    setStatus("checking");

    setTimeout(() => {
      setStatus("ready");
    }, 600);
  };

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
            Once the code is validated, we surface core details so you know you’re in the
            right place. Here’s mock data representing what the API will return.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Group name
            </p>
            <h3 className="text-2xl font-semibold text-white">
              {status === "ready" ? mockGroup.name : "— — —"}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
              <span>Host · {status === "ready" ? mockGroup.host : "—"}</span>
              <span>City · {status === "ready" ? mockGroup.location : "—"}</span>
              <span>Members · {status === "ready" ? mockGroup.members : "—"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(status === "ready" ? mockGroup.vibe : ["Invite pending"]).map((tag) => (
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
              {(status === "ready" ? mockUpdates : ["Waiting for code match…"]).map(
                (update) => (
                  <li key={update} className="rounded-lg bg-slate-900/60 px-3 py-2">
                    {update}
                  </li>
                ),
              )}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-800 text-sm text-slate-400">
          Step 03 will mirror the onboarding questions so we can merge everyone’s
          preferences. Future teammates can connect this to tRPC once the API is ready.
        </CardFooter>
      </Card>
    </div>
  );
}

