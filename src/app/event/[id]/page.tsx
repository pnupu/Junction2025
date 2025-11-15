"use client";

import { useParams, useRouter } from "next/navigation";
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
import {
  ProfileModal,
  getUserProfile,
  type UserProfile,
} from "@/components/profile-modal";

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventIdOrCode = params.id as string;

  const [sessionId, setSessionId] = useState<string>("");
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [showQRDialog, setShowQRDialog] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Try to get event by invite code first (if it looks like a code), otherwise by ID
  const isLikelyInviteCode =
    eventIdOrCode.length <= 10 && /^[A-Z0-9]+$/i.test(eventIdOrCode);

  const { data: eventData, refetch } = api.event.get.useQuery(
    isLikelyInviteCode
      ? { inviteCode: eventIdOrCode.toUpperCase() }
      : { id: eventIdOrCode },
    { enabled: !!eventIdOrCode, refetchInterval: 3000 },
  );

  const addPreferences = api.event.addPreferences.useMutation({
    onSuccess: () => {
      setHasJoined(true);
      void refetch();
    },
  });

  const autoJoinEvent = (profile: UserProfile, sid: string) => {
    if (!eventData?.id) {
      console.error("Cannot join event: eventData not loaded");
      return;
    }

    // Map preferences to API format
    const activityLevelMap: Record<string, number> = {
      chill: 1,
      celebratory: 3,
      active: 5,
    };

    const moneyPreferenceMap: Record<
      string,
      "budget" | "moderate" | "premium"
    > = {
      "no-limit": "premium",
      veg: "moderate",
      gluten: "moderate",
    };

    addPreferences.mutate({
      groupId: eventData.id, // Use the actual database ID
      sessionId: sid,
      userName: profile.name,
      userIcon: "👤",
      moneyPreference: moneyPreferenceMap[profile.foodPreference] ?? "moderate",
      activityLevel: activityLevelMap[profile.activityPreference] ?? 3,
    });

    sessionStorage.setItem(`event_${eventIdOrCode}_joined`, "true");
  };

  useEffect(() => {
    let sid = sessionStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);

    const creatorId = sessionStorage.getItem(`event_${eventIdOrCode}_creator`);
    if (!creatorId) {
      sessionStorage.setItem(`event_${eventIdOrCode}_creator`, sid);
      setIsCreator(true);
    } else if (creatorId === sid) {
      setIsCreator(true);
    }

    // Check if already joined
    const joined = sessionStorage.getItem(`event_${eventIdOrCode}_joined`);
    if (joined === "true") {
      setHasJoined(true);
    }

    // Check for user profile
    const profile = getUserProfile();
    if (profile) {
      setUserProfile(profile);
    } else if (joined !== "true") {
      // Show profile modal if no profile exists and haven't joined yet
      setShowProfileModal(true);
    }
  }, [eventIdOrCode]);

  // Auto-join when eventData is loaded and we have a profile but haven't joined yet
  useEffect(() => {
    if (eventData && userProfile && !hasJoined) {
      const joined = sessionStorage.getItem(`event_${eventIdOrCode}_joined`);
      if (joined !== "true" && sessionId) {
        autoJoinEvent(userProfile, sessionId);
      }
    }
  }, [eventData, userProfile, hasJoined, sessionId, eventIdOrCode]);

  const handleProfileSave = (profile: UserProfile) => {
    setUserProfile(profile);
    setShowProfileModal(false);
    // The auto-join effect will handle joining once eventData is ready
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setShowInviteModal(false);
  };

  const handleCopyCode = async () => {
    if (eventData?.inviteCode) {
      await navigator.clipboard.writeText(eventData.inviteCode);
    }
  };

  const handleGenerateEvent = () => {
    if (eventData?.id) {
      router.push(`/event/${eventData.id}/results`);
    }
  };

  if (!eventData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-slate-900">Loading...</div>
      </div>
    );
  }

  const participants = eventData.preferences;
  const participantCount = participants.length;

  return (
    <>
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          // Don't allow closing without saving
          if (!userProfile) return;
          setShowProfileModal(false);
        }}
        onSave={handleProfileSave}
        showAsModal={false}
      />
      <main className="min-h-screen bg-[#029DE2]">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-4xl font-bold text-white">Wolt Events</h1>
            <p className="text-white/80">
              {participantCount} {participantCount === 1 ? "person" : "people"}
            </p>
          </div>

          {/* Invite Section */}
          <div className="mb-6">
            <Button
              onClick={() => setShowInviteModal(true)}
              className="h-14 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90"
            >
              📨 Invite Friends
            </Button>
          </div>

          {/* Invite Modal */}
          <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
            <DialogContent className="border-none bg-white text-slate-900 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-semibold text-[#0F172B]">
                  Invite Friends
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-6 py-6">
                {/* Event Code Section */}
                <div className="w-full rounded-xl border-2 border-[#029DE2] bg-[#EDF7FF] p-4">
                  <p className="mb-2 text-center text-xs font-medium tracking-wide text-[#62748E] uppercase">
                    Event Code
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="rounded-lg bg-white px-4 py-2 text-center text-2xl font-bold tracking-wider text-[#029DE2]">
                      {eventData?.inviteCode ?? eventIdOrCode}
                    </code>
                  </div>
                  <button
                    onClick={() => void handleCopyCode()}
                    className="mt-3 w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#029DE2] transition-colors hover:bg-[#029DE2] hover:text-white"
                  >
                    📋 Copy Code
                  </button>
                </div>

                {/* Divider */}
                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-[#CAD5E2]"></div>
                  <span className="text-xs text-[#62748E]">or</span>
                  <div className="h-px flex-1 bg-[#CAD5E2]"></div>
                </div>

                {/* QR Code Section */}
                <div className="rounded-2xl bg-white p-6 shadow-lg">
                  <QRCodeSVG
                    value={
                      typeof window !== "undefined" ? window.location.href : ""
                    }
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-center text-sm text-[#62748E]">
                  Scan QR code or share the link
                </p>
                <Button
                  onClick={() => void handleCopyLink()}
                  className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#029DE2]/90"
                >
                  📋 Copy Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* QR Code Dialog (enlarged) */}
          <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
            <DialogContent className="border-none bg-white text-slate-900 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-semibold text-[#0F172B]">
                  Scan to Join Event
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="rounded-2xl bg-white p-6 shadow-lg">
                  <QRCodeSVG
                    value={
                      typeof window !== "undefined" ? window.location.href : ""
                    }
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Participants List */}
          {participantCount > 0 && (
            <div className="mb-6 rounded-2xl bg-white/10 p-6 backdrop-blur">
              <h2 className="mb-4 text-sm font-medium tracking-wide text-white/80 uppercase">
                Participants
              </h2>
              <div className="space-y-3">
                {participants.map(
                  (
                    participant: {
                      userName?: string | null;
                      activityLevel: number;
                    },
                    idx: number,
                  ) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-white/20 p-4 backdrop-blur"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 text-2xl backdrop-blur">
                          👤
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {participant.userName ?? "Anonymous"}
                          </div>
                          <div className="text-xs text-white/70">
                            Activity level: {participant.activityLevel}/5
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span className="text-xs font-medium text-white">
                          Joined
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Creator Action Button */}
          {isCreator && hasJoined && (
            <div className="mt-8">
              <Button
                onClick={handleGenerateEvent}
                disabled={participantCount === 0}
                className="h-16 w-full rounded-xl bg-white text-lg font-bold text-[#029DE2] hover:scale-105 hover:bg-white/90 disabled:opacity-50 disabled:hover:scale-100"
              >
                🎉 Let&apos;s cook some events!
              </Button>
              {participantCount === 0 && (
                <p className="mt-2 text-center text-sm text-white/70">
                  Wait for at least one participant to join
                </p>
              )}
            </div>
          )}

          {/* Waiting message for non-creators */}
          {!isCreator && hasJoined && (
            <div className="mt-8 rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
              <div className="mb-3 text-4xl">⏳</div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                Waiting for the host
              </h3>
              <p className="text-white/80">
                The event creator will generate activities when ready
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
