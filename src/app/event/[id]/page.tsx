"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
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
import {
  EventMapModal,
  type ParticipantLocation,
} from "@/components/event-map-modal";
import { MoodQuestions } from "@/components/mood-questions";
import dynamic from "next/dynamic";

// Type for Leaflet module (only what we need)
type LeafletModule = {
  Icon: {
    Default: {
      prototype: { _getIconUrl?: unknown };
      mergeOptions: (options: {
        iconRetinaUrl: string;
        iconUrl: string;
        shadowUrl: string;
      }) => void;
    };
  };
  divIcon: (options: {
    className: string;
    html: string;
    iconSize: [number, number];
    iconAnchor: [number, number];
  }) => {
    // DivIcon type - simplified for our use case
    options: unknown;
  };
};

// Dynamically import React Leaflet components for inline map
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

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
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<LeafletModule | null>(null);

  // Try to get event by invite code first (if it looks like a code), otherwise by ID
  const isLikelyInviteCode =
    eventIdOrCode.length <= 10 && /^[A-Z0-9]+$/i.test(eventIdOrCode);

  const { data: eventData, refetch } = api.event.get.useQuery(
    isLikelyInviteCode
      ? { inviteCode: eventIdOrCode.toUpperCase() }
      : { id: eventIdOrCode },
    {
      enabled: !!eventIdOrCode,
      refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  const addPreferences = api.event.addPreferences.useMutation({
    onSuccess: () => {
      setHasJoined(true);
      void refetch();
    },
  });

  const autoJoinEvent = useCallback(async (profile: UserProfile, sid: string) => {
    if (!eventData?.id) {
      console.error("Cannot join event: eventData not loaded");
      return;
    }

    // Get location if not already in profile
    let latitude = profile.latitude;
    let longitude = profile.longitude;

    if (!latitude || !longitude) {
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                enableHighAccuracy: false,
              });
            },
          );
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;

          // Update stored profile with location
          const updatedProfile = { ...profile, latitude, longitude };
          sessionStorage.setItem("userProfile", JSON.stringify(updatedProfile));
          setUserProfile(updatedProfile);
        } catch (error) {
          console.log("Location permission denied or unavailable", error);
          // Continue without location
        }
      }
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
      latitude,
      longitude,
    });

    sessionStorage.setItem(`event_${eventIdOrCode}_joined`, "true");
  }, [eventData, eventIdOrCode, addPreferences, setUserProfile]);

  useEffect(() => {
    let sid = sessionStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);

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

  // Determine if current user is the creator based on event data
  useEffect(() => {
    if (eventData && sessionId) {
      // Creator is the first person who joined (first preference by createdAt)
      const sortedPreferences = [...(eventData.preferences ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const firstPreference = sortedPreferences[0];
      setIsCreator(firstPreference?.sessionId === sessionId);
    }
  }, [eventData, sessionId]);

  // Auto-join when eventData is loaded and we have a profile but haven't joined yet
  useEffect(() => {
    if (eventData && userProfile && !hasJoined) {
      const joined = sessionStorage.getItem(`event_${eventIdOrCode}_joined`);
      if (joined !== "true" && sessionId) {
        void autoJoinEvent(userProfile, sessionId);
      }
    }
  }, [eventData, userProfile, hasJoined, sessionId, eventIdOrCode, autoJoinEvent]);

  // Load Leaflet for inline map
  useEffect(() => {
    void import("leaflet").then((leafletModule) => {
      // Handle both default export and named exports
      const leaflet = (leafletModule.default ?? leafletModule) as LeafletModule;
      setL(leaflet);
      setLeafletLoaded(true);

      // Fix default marker icon issue
      delete leaflet.Icon.Default.prototype._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });
    });
  }, []);

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

  // Filter participants with location data and create ParticipantLocation objects
  const participantLocations: ParticipantLocation[] = useMemo(() => {
    if (!eventData?.preferences) return [];

    type Preference = (typeof eventData.preferences)[number];
    type PreferenceWithLocation = Preference & { latitude: number; longitude: number };
    
    return eventData.preferences
      .filter(
        (p: Preference): p is PreferenceWithLocation =>
          p.latitude != null && p.longitude != null,
      )
      .map((p: PreferenceWithLocation) => ({
        userName: p.userName ?? "Anonymous",
        latitude: p.latitude,
        longitude: p.longitude,
        initials: (p.userName ?? "A")
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
      }));
  }, [eventData]);

  // Check if recommendations are being generated or have been generated, and redirect
  useEffect(() => {
    if (eventData) {
      const status = (eventData as { status?: string }).status;
      const isGenerated =
        (eventData as { isGenerated?: boolean }).isGenerated ??
        status === "generated";
      const isGenerating = status === "generating";
      
      // Redirect to results page if generating or generated
      if ((isGenerating || isGenerated) && eventData.id) {
        router.push(`/event/${eventData.id}/results`);
      }
    }
  }, [eventData, router]);

  if (!eventData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-slate-900">Loading...</div>
      </div>
    );
  }

  // Sort participants by createdAt to ensure consistent ordering
  const participants = [...(eventData.preferences ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const participantCount = participants.length;

  // Find current user's preference to check if they've answered mood questions
  const currentUserPreference = participants.find(
    (p) => p.sessionId === sessionId,
  );
  const hasMoodResponses =
    currentUserPreference &&
    (currentUserPreference as { moodResponses?: Record<string, unknown> })
      .moodResponses &&
    Object.keys(
      (currentUserPreference as { moodResponses?: Record<string, unknown> })
        .moodResponses ?? {},
    ).length > 0;

    console.log("currentUserPreference", currentUserPreference);

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
      <EventMapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        participants={participantLocations}
        isEnlarged={true}
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

          {/* Inline Map Preview */}
          {participantLocations.length > 0 && leafletLoaded && L && (
            <div className="mb-6 overflow-hidden rounded-2xl bg-white/10 backdrop-blur">
              <button
                onClick={() => setShowMapModal(true)}
                className="relative block h-64 w-full cursor-pointer transition-all hover:opacity-90"
              >
                <MapContainer
                  center={[
                    participantLocations.reduce((sum, p) => sum + p.latitude, 0) /
                      participantLocations.length,
                    participantLocations.reduce((sum, p) => sum + p.longitude, 0) /
                      participantLocations.length,
                  ]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {participantLocations.map((participant, idx) => (
                    <Marker
                      key={idx}
                      position={[participant.latitude, participant.longitude]}
                      // @ts-expect-error - Leaflet divIcon return type doesn't match react-leaflet's expected type, but works at runtime
                      icon={
                        L
                          ? L.divIcon({
                              className: "custom-marker",
                              html: `
                          <div style="
                            width: 32px;
                            height: 32px;
                            background: #029DE2;
                            border: 2px solid white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 12px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                          ">
                            ${participant.initials}
                          </div>
                        `,
                              iconSize: [32, 32],
                              iconAnchor: [16, 32],
                            })
                          : undefined
                      }
                    />
                  ))}
                </MapContainer>
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all hover:bg-black/10">
                  <div className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-[#029DE2] shadow-lg backdrop-blur">
                    🗺️ Click to expand map
                  </div>
                </div>
              </button>
            </div>
          )}

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
                {participants.map((participant, idx) => {
                  const moodResponses =
                    (participant as { moodResponses?: Record<string, unknown> })
                      .moodResponses;
                  const currentEnergy =
                    moodResponses &&
                    typeof moodResponses === "object" &&
                    !Array.isArray(moodResponses)
                      ? moodResponses.currentEnergy
                      : undefined;
                  const energyDisplay =
                    typeof currentEnergy === "string"
                      ? currentEnergy
                      : `Activity level: ${participant.activityLevel}/5`;

                  // Check if participant has answered mood questions
                  const hasAnsweredMoodQuestions =
                    moodResponses &&
                    typeof moodResponses === "object" &&
                    !Array.isArray(moodResponses) &&
                    Object.keys(moodResponses).length > 0;

                  return (
                    <div
                      key={participant.id ?? participant.sessionId ?? idx}
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
                            {energyDisplay}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`h-3 w-3 rounded-full ${
                          hasAnsweredMoodQuestions
                            ? "bg-green-400"
                            : "bg-yellow-400"
                        }`}
                      ></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mood Questions - Show after user has joined */}
          {hasJoined &&
            eventData?.id &&
            sessionId &&
            !hasMoodResponses && (
              <MoodQuestions
                key={`mood-${eventData.id}-${sessionId}`}
                groupId={eventData.id}
                sessionId={sessionId}
                participantName={userProfile?.name}
                onComplete={() => {
                  void refetch();
                }}
              />
            )}

          {/* Creator Action Button - Only visible to event creator */}
          {isCreator && hasJoined ? (
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
          ) : null}

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
