"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const userIcons = [
  { emoji: "🐱", name: "Cat with a Hat" },
  { emoji: "🦊", name: "Clever Fox" },
  { emoji: "🐻", name: "Busy Bear" },
  { emoji: "🐼", name: "Chill Panda" },
  { emoji: "🐨", name: "Koala Cool" },
  { emoji: "🦁", name: "Brave Lion" },
  { emoji: "🐸", name: "Happy Frog" },
  { emoji: "🦉", name: "Wise Owl" },
];

const moneyPreferences = [
  { id: "budget", label: "Budget", emoji: "💰" },
  { id: "moderate", label: "Moderate", emoji: "💵" },
  { id: "premium", label: "Premium", emoji: "💎" },
];

const activityLabels = ["Laidback", "Relaxed", "Balanced", "Active", "Very Active"];

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [sessionId, setSessionId] = useState<string>("");
  const [step, setStep] = useState<"icon" | "preferences" | "complete">("icon");
  const [selectedIcon, setSelectedIcon] = useState<{ emoji: string; name: string } | null>(null);
  const [moneyPreference, setMoneyPreference] = useState<"budget" | "moderate" | "premium" | null>(null);
  const [activityLevel, setActivityLevel] = useState<number>(3);
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const { data: eventData, refetch } = api.event.get.useQuery(
    { id: eventId },
    { enabled: !!eventId, refetchInterval: hasSubmitted ? 3000 : false },
  );

  const addPreferences = api.event.addPreferences.useMutation({
    onSuccess: () => {
      setStep("complete");
      setHasSubmitted(true);
      void refetch();
    },
  });

  useEffect(() => {
    let sid = sessionStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);

    const creatorId = sessionStorage.getItem(`event_${eventId}_creator`);
    if (!creatorId) {
      sessionStorage.setItem(`event_${eventId}_creator`, sid);
      setIsCreator(true);
    } else if (creatorId === sid) {
      setIsCreator(true);
    }

    // Check if already submitted
    const submitted = sessionStorage.getItem(`event_${eventId}_submitted`);
    if (submitted === "true") {
      setHasSubmitted(true);
      setStep("complete");
    }
  }, [eventId]);

  const handleIconSelect = (icon: { emoji: string; name: string }) => {
    setSelectedIcon(icon);
    setStep("preferences");
  };

  const handleSubmitPreferences = () => {
    if (!selectedIcon || !moneyPreference || !sessionId) return;

    addPreferences.mutate({
      groupId: eventId,
      sessionId,
      userName: selectedIcon.name,
      userIcon: selectedIcon.emoji,
      moneyPreference,
      activityLevel,
    });

    sessionStorage.setItem(`event_${eventId}_submitted`, "true");
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    // Optional: Add toast notification
  };

  const handleGenerateEvent = () => {
    router.push(`/event/${eventId}/results`);
  };

  if (!eventData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const completedCount = eventData.preferences.length;
  const myPreference = eventData.preferences.find(p => p.sessionId === sessionId);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header with Copy Link */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Event Planning</h1>
            <p className="text-sm text-slate-400">
              {completedCount} {completedCount === 1 ? "person" : "people"} answered
            </p>
          </div>
          <Button
            onClick={() => void handleCopyLink()}
            variant="outline"
            className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700"
          >
            📋 Copy Link
          </Button>
        </div>

        {/* Participants List */}
        {completedCount > 0 && (
          <div className="mb-8 rounded-2xl bg-slate-900/50 p-6 backdrop-blur">
            <h2 className="mb-4 text-sm font-medium text-slate-400">Participants</h2>
            <div className="space-y-3">
              {eventData.preferences.map((pref, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-2xl">
                      {pref.userIcon}
                    </div>
                    <div>
                      <div className="font-medium text-white">{pref.userName || "Anonymous"}</div>
                      <div className="text-xs text-slate-400">
                        {pref.moneyPreference} • Activity: {pref.activityLevel}/5
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-green-400"></div>
                    <span className="text-xs font-medium text-green-300">Complete</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Icon Selection */}
        {step === "icon" && !hasSubmitted && (
          <div className="rounded-3xl bg-slate-900/50 p-8 backdrop-blur">
            <h2 className="mb-2 text-center text-3xl font-semibold text-white">
              Choose your character
            </h2>
            <p className="mb-8 text-center text-slate-400">
              Pick an icon to represent you
            </p>
            <div className="grid grid-cols-2 gap-4">
              {userIcons.map((icon) => (
                <button
                  key={icon.emoji}
                  onClick={() => handleIconSelect(icon)}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-800/50 p-6 transition-all hover:scale-105 hover:border-white hover:bg-slate-700"
                >
                  <span className="text-5xl">{icon.emoji}</span>
                  <span className="text-sm font-medium text-white">{icon.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preferences Survey */}
        {step === "preferences" && selectedIcon && !hasSubmitted && (
          <div className="space-y-6 rounded-3xl bg-slate-900/50 p-8 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-4xl">
                {selectedIcon.emoji}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">{selectedIcon.name}</h2>
                <p className="text-sm text-slate-400">Set your preferences</p>
              </div>
            </div>

            {/* Money Preference */}
            <div>
              <h3 className="mb-3 text-lg font-medium text-white">Budget</h3>
              <div className="grid grid-cols-3 gap-3">
                {moneyPreferences.map((pref) => (
                  <button
                    key={pref.id}
                    onClick={() => setMoneyPreference(pref.id as "budget" | "moderate" | "premium")}
                    className={`
                      flex flex-col items-center justify-center rounded-2xl border-2 p-6 transition-all
                      ${
                        moneyPreference === pref.id
                          ? "scale-105 border-white bg-white/10"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                      }
                    `}
                  >
                    <span className="mb-2 text-3xl">{pref.emoji}</span>
                    <span className="text-sm font-medium text-white">{pref.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <h3 className="mb-3 text-lg font-medium text-white">Activity Level</h3>
              <div className="space-y-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700"
                  style={{
                    background: `linear-gradient(to right, white ${(activityLevel - 1) * 25}%, rgb(51 65 85) ${(activityLevel - 1) * 25}%)`,
                  }}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Laidback</span>
                  <span className="font-medium text-white">
                    {activityLabels[activityLevel - 1]}
                  </span>
                  <span className="text-slate-400">Active</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmitPreferences}
              disabled={!moneyPreference || addPreferences.isPending}
              className="h-14 w-full rounded-full bg-white text-lg font-semibold text-slate-950 transition-all hover:scale-105 hover:bg-white/90 disabled:opacity-40 disabled:hover:scale-100"
            >
              {addPreferences.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        )}

        {/* Complete State */}
        {step === "complete" && hasSubmitted && (
          <div className="rounded-3xl bg-slate-900/50 p-12 text-center backdrop-blur">
            <div className="mb-4 text-6xl">
              {myPreference?.userIcon || selectedIcon?.emoji || "✓"}
            </div>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              Preferences Submitted!
            </h2>
            <p className="mb-6 text-slate-400">
              {isCreator
                ? "You can generate recommendations when ready"
                : "Waiting for the event creator to generate options"}
            </p>
            
            {isCreator && (
              <Button
                onClick={handleGenerateEvent}
                className="h-14 w-full max-w-xs rounded-full bg-white text-lg font-semibold text-slate-950 transition-all hover:scale-105 hover:bg-white/90"
              >
                Generate Event Options
              </Button>
            )}
            
            {!isCreator && (
              <Button
                onClick={() => void refetch()}
                variant="outline"
                className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700"
              >
                Refresh
              </Button>
            )}
          </div>
        )}

        {/* Dev Tools */}
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-4 font-mono text-xs text-slate-400">
          <div className="mb-2 text-slate-500">Dev Tools:</div>
          <div>Event ID: {eventId}</div>
          <div>Session ID: {sessionId}</div>
          <div>Is Creator: {isCreator ? "Yes" : "No"}</div>
          <div>Step: {step}</div>
          <div>Has Submitted: {hasSubmitted ? "Yes" : "No"}</div>
          <div>Participants: {completedCount}</div>
          <div>Status: {eventData.status}</div>
        </div>
      </div>
    </main>
  );
}
