"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

type Recommendation = {
  eventId?: string;
  title: string;
  description: string;
  type: string;
  priceLevel: string;
  duration: string;
  highlights: string[];
  voteCount?: number;
};

type EventPreference = {
  userIcon: string;
  activityLevel: number;
};

type EventDetails = {
  city?: string | null;
  preferences: EventPreference[];
};

function isEventDetails(data: unknown): data is EventDetails {
  if (!data || typeof data !== "object") return false;
  const candidate = data as {
    preferences?: unknown;
    city?: unknown;
  };

  if (!Array.isArray(candidate.preferences)) {
    return false;
  }

  const prefsAreValid = candidate.preferences.every((pref) => {
    if (!pref || typeof pref !== "object") return false;
    const prefCandidate = pref as {
      userIcon?: unknown;
      activityLevel?: unknown;
    };
    return (
      typeof prefCandidate.userIcon === "string" &&
      typeof prefCandidate.activityLevel === "number"
    );
  });

  if (!prefsAreValid) {
    return false;
  }

  return (
    candidate.city === undefined ||
    candidate.city === null ||
    typeof candidate.city === "string"
  );
}

export default function EventResultsPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [groupStats, setGroupStats] = useState<{
    participantCount: number;
    avgActivityLevel: number;
    popularMoneyPreference: string;
  } | null>(null);
  const [showQRDialog, setShowQRDialog] = useState<boolean>(false);
  const [loadingDots, setLoadingDots] = useState(".");
  const [sessionId, setSessionId] = useState<string>("");
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());

  const eventQuery = api.event.get.useQuery(
    { id: groupId },
    {
      enabled: !!groupId,
      // Only poll when generating, otherwise rely on manual refetch
      refetchInterval: (query) => {
        const data = query.state.data as { status?: string } | undefined;
        const status = data?.status;

        // Poll frequently when generating
        if (status === "generating") {
          return 2000; // 2 seconds
        }

        // No polling when generated (data won't change)
        return false;
      },
      refetchOnWindowFocus: true,
      staleTime: 1000,
    },
  );
  const rawEventData: unknown = eventQuery.data;
  const eventData = isEventDetails(rawEventData) ? rawEventData : undefined;

  // Get sessionId from localStorage
  useEffect(() => {
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);
  }, []);

  // Load recommendations from database if already generated
  const eventStatus = (eventData as { status?: string })?.status;
  const recommendationsQuery = api.event.getRecommendations.useQuery(
    { groupId },
    {
      enabled: !!groupId && eventStatus === "generated",
      staleTime: 10000, // Reduced cache time to show updated vote counts
      refetchInterval: 5000, // Poll every 5 seconds to update vote counts
    },
  );

  // Get user's votes
  const myVotesQuery = api.event.getMyVotes.useQuery(
    { groupId, sessionId },
    {
      enabled: !!groupId && !!sessionId && eventStatus === "generated",
      staleTime: 10000,
    },
  );

  // Update myVotes when query data changes
  useEffect(() => {
    if (myVotesQuery.data) {
      setMyVotes(new Set(myVotesQuery.data));
    }
  }, [myVotesQuery.data]);

  const generateRecommendations = api.event.generateRecommendations.useMutation(
    {
      onSuccess: (data) => {
        setRecommendations(data.recommendations as unknown as Recommendation[]);
        setGroupStats(data.groupStats);
        // Invalidate recommendations query to refetch from DB
        void recommendationsQuery.refetch();
      },
    },
  );
  const { mutate: runRecommendations, isPending: isGenerating } =
    generateRecommendations;

  // Vote mutation
  const voteMutation = api.event.vote.useMutation({
    onSuccess: (data, variables) => {
      // Update local vote count
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.eventId === variables.eventId
            ? { ...rec, voteCount: data.voteCount }
            : rec,
        ),
      );
      // Refetch my votes to update UI
      void myVotesQuery.refetch();
      // Refetch recommendations to get updated counts
      void recommendationsQuery.refetch();
    },
  });

  const handleVote = (eventId: string) => {
    if (!sessionId || !eventId) return;
    voteMutation.mutate({
      groupId,
      eventId,
      sessionId,
    });
  };

  // Load recommendations from database when available
  useEffect(() => {
    if (recommendationsQuery.data && eventStatus === "generated") {
      setRecommendations(
        recommendationsQuery.data
          .recommendations as unknown as Recommendation[],
      );
      setGroupStats(recommendationsQuery.data.groupStats);
    }
  }, [recommendationsQuery.data, eventStatus]);

  // Animate loading dots when generating
  useEffect(() => {
    const status = (eventData as { status?: string })?.status;
    const isCurrentlyGenerating = isGenerating || status === "generating";

    if (isCurrentlyGenerating) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === ".") return "..";
          if (prev === "..") return "...";
          return ".";
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setLoadingDots(".");
    }
  }, [isGenerating, eventData]);

  useEffect(() => {
    // Check if already generated or generating
    const status = (eventData as { status?: string })?.status;
    const isAlreadyGenerated = status === "generated";
    const isAlreadyGenerating = status === "generating";

    // Only start generation if not already generating/generated and we have no recommendations
    // Also check if recommendations query has no data (meaning they don't exist in DB)
    if (
      groupId &&
      !isGenerating &&
      recommendations.length === 0 &&
      !isAlreadyGenerated &&
      !isAlreadyGenerating &&
      !recommendationsQuery.isLoading &&
      !recommendationsQuery.data
    ) {
      runRecommendations({ groupId });
    }
  }, [
    groupId,
    isGenerating,
    recommendations.length,
    runRecommendations,
    eventData,
    recommendationsQuery.isLoading,
    recommendationsQuery.data,
  ]);

  const handleCopyLink = () => {
    const url = window.location.origin + `/event/${groupId}`;
    void navigator.clipboard.writeText(url);
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case "active":
        return "🏃";
      case "relaxed":
        return "🧘";
      case "balanced":
        return "⚖️";
      default:
        return "✨";
    }
  };

  const getPriceLevelEmoji = (level: string) => {
    switch (level) {
      case "budget":
        return "💰";
      case "moderate":
        return "💵";
      case "premium":
        return "💎";
      default:
        return "💵";
    }
  };

  // Show loading if generating or if status is "generating" but we don't have recommendations yet
  const shouldShowLoading =
    isGenerating ||
    (eventStatus === "generating" && recommendations.length === 0);

  if (shouldShowLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎨</div>
          <h2 className="mb-2 text-2xl font-semibold text-slate-900">
            Generating recommendations{loadingDots}
          </h2>
          <p className="text-slate-600">Analyzing preferences</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-1 text-3xl font-semibold text-slate-900">
                Your Event Options
              </h1>
              <p className="text-slate-600">
                {eventData?.city && `${eventData.city} • `}
                {groupStats?.participantCount}{" "}
                {groupStats?.participantCount === 1
                  ? "participant"
                  : "participants"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowQRDialog(true)}
                variant="outline"
                className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              >
                📄 QR Code
              </Button>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              >
                📋 Share
              </Button>
            </div>
          </div>

          {/* QR Code Dialog */}
          <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
            <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-slate-900">
                  Invite More People
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="rounded-2xl bg-white p-6 shadow-lg">
                  <QRCodeSVG
                    value={
                      typeof window !== "undefined"
                        ? window.location.origin + `/event/${groupId}`
                        : ""
                    }
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-center text-sm text-slate-600">
                  Scan to join and add preferences to this event
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Group Stats */}
          {groupStats && (
            <div className="grid grid-cols-3 gap-4 rounded-2xl bg-slate-50 p-6 backdrop-blur">
              <div className="text-center">
                <div className="mb-1 text-3xl">👥</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {groupStats.participantCount}
                </div>
                <div className="text-xs text-slate-600">Participants</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-3xl">
                  {groupStats.avgActivityLevel >= 4
                    ? "🏃"
                    : groupStats.avgActivityLevel >= 3
                      ? "⚖️"
                      : "🧘"}
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {groupStats.avgActivityLevel.toFixed(1)}
                </div>
                <div className="text-xs text-slate-600">Avg Activity</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-3xl">
                  {getPriceLevelEmoji(groupStats.popularMoneyPreference)}
                </div>
                <div className="text-2xl font-semibold text-slate-900 capitalize">
                  {groupStats.popularMoneyPreference}
                </div>
                <div className="text-xs text-slate-600">Budget</div>
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Recommended for your group
          </h2>
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="group overflow-hidden rounded-3xl bg-slate-50 backdrop-blur transition-all hover:scale-[1.02]"
            >
              <div className="p-8">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-4xl">{getTypeEmoji(rec.type)}</span>
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {rec.title}
                      </h3>
                    </div>
                    <p className="mb-4 text-slate-700">{rec.description}</p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="text-3xl">
                      {getPriceLevelEmoji(rec.priceLevel)}
                    </span>
                    <span className="text-sm text-slate-600">
                      {rec.duration}
                    </span>
                  </div>
                </div>

                {/* Highlights */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {rec.highlights.map((highlight, hIdx) => (
                    <span
                      key={hIdx}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                {/* Vote Section */}
                <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => rec.eventId && handleVote(rec.eventId)}
                      disabled={!rec.eventId || voteMutation.isPending}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                        rec.eventId && myVotes.has(rec.eventId)
                          ? "bg-[#029DE2] text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      } disabled:opacity-50`}
                    >
                      <span className="text-xl">
                        {rec.eventId && myVotes.has(rec.eventId) ? "✓" : "↑"}
                      </span>
                      <span className="font-medium">
                        {rec.eventId && myVotes.has(rec.eventId)
                          ? "Voted"
                          : "Vote"}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span className="text-lg">👥</span>
                      <span className="font-semibold">
                        {rec.voteCount ?? 0}
                      </span>
                      <span className="text-sm">
                        {rec.voteCount === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  className="w-full rounded-xl bg-[#029DE2] text-white transition-all group-hover:scale-105 hover:bg-[#029DE2]/90"
                  size="lg"
                >
                  Select This Option
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Participants Preview */}
        {eventData?.preferences && eventData.preferences.length > 0 && (
          <div className="mt-8 rounded-2xl bg-slate-50 p-6 backdrop-blur">
            <h3 className="mb-4 text-sm font-medium text-slate-600">
              Based on preferences from:
            </h3>
            <div className="flex gap-3">
              {eventData.preferences.map((pref, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-2xl">
                    {pref.userIcon}
                  </div>
                  <span className="text-xs text-slate-600">
                    {pref.activityLevel}/5
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dev Tools */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-600">
          <div className="mb-2 text-slate-500">Dev Tools:</div>
          <div>Group ID: {groupId}</div>
          <div>Recommendations: {recommendations.length}</div>
          <div>Status: Generated (Mock Data)</div>
          {groupStats && (
            <>
              <div>Avg Activity: {groupStats.avgActivityLevel}</div>
              <div>Popular Budget: {groupStats.popularMoneyPreference}</div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
