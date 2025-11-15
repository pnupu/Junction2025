"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Recommendation = {
  title: string;
  description: string;
  type: string;
  priceLevel: string;
  duration: string;
  highlights: string[];
};

export default function EventResultsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [groupStats, setGroupStats] = useState<{
    participantCount: number;
    avgActivityLevel: number;
    popularMoneyPreference: string;
  } | null>(null);

  const { data: eventData } = api.event.get.useQuery(
    { id: eventId },
    { enabled: !!eventId },
  );

  const generateRecommendations = api.event.generateRecommendations.useMutation({
    onSuccess: (data) => {
      setRecommendations(data.recommendations as Recommendation[]);
      setGroupStats(data.groupStats);
    },
  });

  useEffect(() => {
    if (eventId && !generateRecommendations.isPending && recommendations.length === 0) {
      generateRecommendations.mutate({ groupId: eventId });
    }
  }, [eventId]);

  const handleCopyLink = () => {
    const url = window.location.origin + `/event/${eventId}`;
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

  if (generateRecommendations.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎨</div>
          <h2 className="mb-2 text-2xl font-semibold text-white">
            Generating recommendations...
          </h2>
          <p className="text-slate-400">Analyzing preferences</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-3xl font-semibold text-white">
                Your Event Options
              </h1>
              <p className="text-slate-400">
                {eventData?.city && `${eventData.city} • `}
                {groupStats?.participantCount}{" "}
                {groupStats?.participantCount === 1 ? "participant" : "participants"}
              </p>
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="border-slate-700 bg-slate-800/50 text-white hover:bg-slate-700"
            >
              📋 Share
            </Button>
          </div>

          {/* Group Stats */}
          {groupStats && (
            <div className="grid grid-cols-3 gap-4 rounded-2xl bg-slate-900/50 p-6 backdrop-blur">
              <div className="text-center">
                <div className="mb-1 text-3xl">👥</div>
                <div className="text-2xl font-semibold text-white">
                  {groupStats.participantCount}
                </div>
                <div className="text-xs text-slate-400">Participants</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-3xl">
                  {groupStats.avgActivityLevel >= 4
                    ? "🏃"
                    : groupStats.avgActivityLevel >= 3
                      ? "⚖️"
                      : "🧘"}
                </div>
                <div className="text-2xl font-semibold text-white">
                  {groupStats.avgActivityLevel.toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">Avg Activity</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-3xl">{getPriceLevelEmoji(groupStats.popularMoneyPreference)}</div>
                <div className="text-2xl font-semibold capitalize text-white">
                  {groupStats.popularMoneyPreference}
                </div>
                <div className="text-xs text-slate-400">Budget</div>
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">
            Recommended for your group
          </h2>
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="group overflow-hidden rounded-3xl bg-slate-900/50 backdrop-blur transition-all hover:scale-[1.02]"
            >
              <div className="p-8">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-4xl">{getTypeEmoji(rec.type)}</span>
                      <h3 className="text-2xl font-semibold text-white">{rec.title}</h3>
                    </div>
                    <p className="mb-4 text-slate-300">{rec.description}</p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="text-3xl">{getPriceLevelEmoji(rec.priceLevel)}</span>
                    <span className="text-sm text-slate-400">{rec.duration}</span>
                  </div>
                </div>

                {/* Highlights */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {rec.highlights.map((highlight, hIdx) => (
                    <span
                      key={hIdx}
                      className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                <Button
                  className="w-full rounded-full bg-white text-slate-950 transition-all hover:bg-white/90 group-hover:scale-105"
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
          <div className="mt-8 rounded-2xl bg-slate-900/50 p-6 backdrop-blur">
            <h3 className="mb-4 text-sm font-medium text-slate-400">
              Based on preferences from:
            </h3>
            <div className="flex gap-3">
              {eventData.preferences.map((pref, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-2xl">
                    {pref.userIcon}
                  </div>
                  <span className="text-xs text-slate-400">
                    {pref.activityLevel}/5
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dev Tools */}
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-4 font-mono text-xs text-slate-400">
          <div className="mb-2 text-slate-500">Dev Tools:</div>
          <div>Event ID: {eventId}</div>
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
