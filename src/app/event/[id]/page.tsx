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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

  // Smart polling: only poll when something is actively happening
  const { data: eventData, refetch } = api.event.get.useQuery(
    isLikelyInviteCode
      ? { inviteCode: eventIdOrCode.toUpperCase() }
      : { id: eventIdOrCode },
    {
      enabled: !!eventIdOrCode,
      // Conditional polling based on event status
      refetchInterval: (query) => {
        const data = query.state.data as { status?: string } | undefined;
        const status = data?.status;

        // Poll frequently when generating recommendations
        if (status === "generating") {
          return 2000; // 2 seconds
        }

        // Poll less frequently when collecting preferences (people might be joining)
        if (
          status === "collecting_preferences" ||
          status === "ready_to_generate"
        ) {
          return 5000; // 5 seconds
        }

        // Poll very infrequently when generated (just in case)
        if (status === "generated") {
          return 30000; // 30 seconds
        }

        // Default: no polling (will refetch on window focus or manual refetch)
        return false;
      },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      // Stale time: data is fresh for 1 second (prevents unnecessary refetches)
      staleTime: 1000,
    },
  );

  const addPreferences = api.event.addPreferences.useMutation({
    onSuccess: () => {
      setHasJoined(true);
      void refetch();
    },
  });

  const autoJoinEvent = useCallback(
    async (profile: UserProfile, sid: string) => {
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
            localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
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
        moneyPreference:
          moneyPreferenceMap[profile.foodPreference] ?? "moderate",
        activityLevel: activityLevelMap[profile.activityPreference] ?? 3,
        latitude,
        longitude,
      });

      localStorage.setItem(`event_${eventIdOrCode}_joined`, "true");
    },
    [eventData, eventIdOrCode, addPreferences, setUserProfile],
  );

  useEffect(() => {
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);

    // Check if already joined
    const joined = localStorage.getItem(`event_${eventIdOrCode}_joined`);
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

    // Replace history state to prevent going back to /create
    if (typeof window !== "undefined" && window.history.state) {
      window.history.replaceState(
        { ...window.history.state, as: `/event/${eventIdOrCode}`, url: `/event/${eventIdOrCode}` },
        "",
        `/event/${eventIdOrCode}`
      );
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
      const joined = localStorage.getItem(`event_${eventIdOrCode}_joined`);
      if (joined !== "true" && sessionId) {
        void autoJoinEvent(userProfile, sessionId);
      }
    }
  }, [
    eventData,
    userProfile,
    hasJoined,
    sessionId,
    eventIdOrCode,
    autoJoinEvent,
  ]);

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
    type PreferenceWithLocation = Preference & {
      latitude: number;
      longitude: number;
    };

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

  // Group participants by location and count
  const groupedLocations = useMemo(() => {
    const locationMap = new Map<
      string,
      ParticipantLocation & { count: number }
    >();

    participantLocations.forEach((loc) => {
      // Round to 4 decimal places (~10 meter precision) to group nearby locations
      const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const existing = locationMap.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        locationMap.set(key, { ...loc, count: 1 });
      }
    });

    return Array.from(locationMap.values());
  }, [participantLocations]);

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
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
        eventName={userProfile?.name ?? "Your"}
      />
      <main className="min-h-screen bg-white">
        {/* Back button */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
            aria-label="Go to home"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Inline Map Preview - Full Width */}
        {participantLocations.length > 0 && leafletLoaded && L ? (
          <div className="relative h-64 w-full overflow-hidden">
            <div
              onClick={() => setShowMapModal(true)}
              className="relative block h-full w-full cursor-pointer"
            >
              {/* Invite button overlay */}
              <div className="absolute top-5 right-5 left-5 z-10 flex justify-center">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInviteModal(true);
                  }}
                  className="h-12 w-full max-w-[500px] rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#0287C3]"
                >
                  Invite friends
                </Button>
              </div>

              {/* Black gradient overlay */}
              <div className="pointer-events-none absolute inset-0 z-2 bg-gradient-to-b from-black/50 to-black/0" />

              <div className="relative z-1 h-full w-full">
                <MapContainer
                  center={
                    participantLocations.length > 0
                      ? [
                          participantLocations.reduce(
                            (sum, p) => sum + p.latitude,
                            0,
                          ) / participantLocations.length,
                          participantLocations.reduce(
                            (sum, p) => sum + p.longitude,
                            0,
                          ) / participantLocations.length,
                        ]
                      : [60.1695, 24.9354] // Default to Helsinki
                  }
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {groupedLocations.map((location, idx) => (
                    <Marker
                      key={idx}
                      position={[location.latitude, location.longitude]}
                      // @ts-expect-error - Leaflet divIcon return type doesn't match react-leaflet's expected type, but works at runtime
                      icon={
                        L
                          ? L.divIcon({
                              className: "custom-marker",
                              html: `
                          <div style="position: relative; width: 32px; height: 32px;">
                            <div style="
                              position: absolute;
                              width: 32px;
                              height: 32px;
                              background: #029DE2;
                              border-radius: 50%;
                              animation: pulse 2s ease-in-out infinite;
                              opacity: 0.6;
                            "></div>
                            <div style="
                              position: relative;
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
                              z-index: 1;
                            ">
                              ${location.count > 1 ? location.count : location.initials}
                            </div>
                          </div>
                          <style>
                            @keyframes pulse {
                              0%, 100% {
                                transform: scale(1);
                                opacity: 0.6;
                              }
                              50% {
                                transform: scale(1.5);
                                opacity: 0;
                              }
                            }
                          </style>
                        `,
                              iconSize: [32, 32],
                              iconAnchor: [16, 32],
                            })
                          : undefined
                      }
                    />
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-64 w-full items-center justify-center bg-slate-100">
            <div className="px-6 text-center">
              <h2 className="mb-4 text-xl font-semibold text-slate-600">
                No locations yet
              </h2>
              <Button
                onClick={() => setShowInviteModal(true)}
                className="h-12 rounded-xl bg-[#029DE2] px-8 text-base font-semibold text-white hover:bg-[#0287C3]"
              >
                Invite friends
              </Button>
            </div>
          </div>
        )}

        {/* Content Container - Max Width on Desktop */}
        <div className="mx-auto max-w-[500px] bg-white px-5 py-5 text-[#0F172B]">
          {/* Event Name and Tabs Section */}
          <div className="mb-4">
            <h1 className="mb-2 text-4xl font-bold text-[#0F172B]">
              {userProfile?.name ?? "Your"}&apos;s Event
            </h1>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button className="flex-1 border-b-2 border-[#029DE2] px-3 py-4 text-base font-semibold text-[#029DE2]">
                Participants ({participantCount})
              </button>
              <button className="flex-1 px-3 py-4 text-base text-[#0F172B]">
                Event ideas (0)
              </button>
            </div>
          </div>

          {/* Invite Modal - Drawer from Top */}
          <Drawer
            open={showInviteModal}
            onOpenChange={setShowInviteModal}
            direction="top"
          >
            <DrawerContent className="fixed inset-x-0 top-0 bottom-auto z-50 mx-auto flex h-auto max-w-[402px] flex-col rounded-b-[24px] border-none bg-[#029DE2]">
              {/* Content */}
              <div className="flex flex-col items-center gap-5 px-16 pt-16 pb-16">
                <DrawerHeader className="w-full p-0">
                  <DrawerTitle className="text-center text-[40px] leading-none font-bold text-white">
                    Invite frends
                  </DrawerTitle>
                </DrawerHeader>

                {/* White Container with QR Code and Event Code */}
                <div className="flex w-full flex-col items-center gap-3 rounded-[24px] bg-white p-4">
                  {/* Event Code */}
                  <div className="text-center">
                    <p className="mb-1 text-xs font-medium tracking-wide text-[#62748E] uppercase">
                      Event Code
                    </p>
                    <code className="text-2xl font-bold tracking-wider text-[#029DE2]">
                      {eventData?.inviteCode ?? eventIdOrCode}
                    </code>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white">
                    <QRCodeSVG
                      value={
                        typeof window !== "undefined"
                          ? window.location.href
                          : ""
                      }
                      size={242}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>

                {/* Copy Link Button */}
                <button
                  onClick={() => void handleCopyLink()}
                  className="w-full rounded-[12px] bg-white px-6 py-3.5 text-base font-semibold text-[#029DE2] transition-colors hover:bg-white/90"
                >
                  Copy link to clipboard
                </button>
              </div>
            </DrawerContent>
          </Drawer>

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
            <>
              <h2 className="mb-4 text-sm font-medium tracking-wide text-white/80 uppercase">
                Participants ({participantCount})
              </h2>
              <div className="space-y-3">
                {participants.map((participant, idx) => {
                  const moodResponses = (
                    participant as { moodResponses?: Record<string, unknown> }
                  ).moodResponses;
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

                // Determine task status circles (3 circles showing progress)
                const isCreatorOfEvent = idx === 0; // First participant is creator

                return (
                  <div
                    key={participant.id ?? participant.sessionId ?? idx}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-3"
                  >
                    <p className="text-base text-[#0F172B]">
                      {isCreatorOfEvent && "👑 "}
                      {participant.userName ?? "Anonymous"}
                    </p>
                    <div className="flex gap-1">
                      {/* Task status indicators - 3 circles */}
                      <div
                        className={`h-3 w-3 rounded-full border-[1.5px] border-[#029DE2] ${
                          hasAnsweredMoodQuestions ? "bg-[#029DE2]" : "bg-white"
                        }`}
                      />
                      <div
                        className={`h-3 w-3 animate-ping rounded-full opacity-75 ${
                          hasAnsweredMoodQuestions
                            ? "bg-green-400"
                            : "bg-yellow-400"
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}

          {/* Mood Questions - Show after user has joined */}
          {hasJoined && eventData?.id && sessionId && !hasMoodResponses && (
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
