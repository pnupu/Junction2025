"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import {
  EventMapModal,
  type ParticipantLocation,
} from "@/components/event-map-modal";
import nextDynamic from "next/dynamic";

// Type for Leaflet module (only what we need)
type LeafletModule = {
  divIcon: (options: {
    className: string;
    html: string;
    iconSize: [number, number];
    iconAnchor: [number, number];
  }) => HTMLElement;
};

// Force dynamic rendering - prevent static generation
export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Dynamically import React Leaflet components for inline map
const MapContainer = nextDynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);

const TileLayer = nextDynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

const Marker = nextDynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

export default function EventResultsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [showMapModal, setShowMapModal] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<LeafletModule | null>(null);
  const [boughtAddOns, setBoughtAddOns] = useState<Set<string>>(new Set());
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [isMainBookingClicked, setIsMainBookingClicked] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [isCreator, setIsCreator] = useState<boolean>(false);

  // Get sessionId
  useEffect(() => {
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("sessionId", sid);
    }
    setSessionId(sid);
  }, []);

  // Load Leaflet
  useEffect(() => {
    if (typeof window !== "undefined") {
      void import("leaflet").then((leaflet) => {
        setL(leaflet.default as unknown as LeafletModule);
        setLeafletLoaded(true);
      });
    }
  }, []);

  const eventQuery = api.event.get.useQuery(
    { id: groupId },
    {
      enabled: !!groupId,
      refetchOnWindowFocus: true,
      staleTime: 1000,
    },
  );

  const eventData = eventQuery.data;
  const eventStatus = (eventData as { status?: string } | undefined)?.status;
  const isVotingClosed = eventStatus === "completed";

  // Determine if current user is the creator (leader)
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

  // Load recommendations
  const recommendationsQuery = api.event.getRecommendations.useQuery(
    { groupId },
    {
      enabled: !!groupId && (eventStatus === "generated" || eventStatus === "completed"),
      staleTime: 10000,
    },
  );

  // Filter participants with location data
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
        initials: "MM",
      }));
  }, [eventData]);

  // Group participants by location
  const groupedLocations = useMemo(() => {
    const locationMap = new Map<
      string,
      ParticipantLocation & { count: number }
    >();

    participantLocations.forEach((loc) => {
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

  const participants = [...(eventData?.preferences ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const participantCount = participants.length;

  // Get user profile name
  const userProfile = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("userProfile");
      return stored ? (JSON.parse(stored) as { name?: string } | null) : null;
    } catch {
      return null;
    }
  }, []);

  // Show loading state
  if (eventQuery.isLoading || recommendationsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎨</div>
          <h2 className="mb-2 text-2xl font-semibold text-slate-900">
            Loading...
          </h2>
        </div>
      </div>
    );
  }

  // Show results to everyone, but only creator can see booking/add-ons

  return (
    <main className="min-h-screen bg-white">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => router.push("/")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white"
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
          </div>
        </div>
      )}

      {/* Content Container - Max Width on Desktop */}
      <div className="mx-auto max-w-[500px] bg-white px-5 py-5 text-[#0F172B]">
        {/* Event Name */}
        <div className="mb-4">
          <h1 className="mb-2 text-4xl font-bold text-[#0F172B]">
            {userProfile?.name ?? "Your"}&apos;s Event
          </h1>
          <p className="text-sm text-[#0F172B]/60">
            {participantCount} {participantCount === 1 ? "participant" : "participants"}
          </p>
        </div>

        {/* Recommendations Section */}
        {recommendationsQuery.data?.recommendations.length ? (
          <>
            {/* Banner when voting is closed */}
            {isVotingClosed && (
              <div className="mb-4 rounded-xl border-2 border-[#029DE2] bg-[#029DE2]/10 p-4">
                <div className="text-center">
                  <h3 className="mb-1 text-lg font-semibold text-[#0F172B]">
                    🎉 Ready to book!
                  </h3>
                  <p className="text-sm text-[#0F172B]/80">
                    Your group&apos;s choice is ready to reserve.
                  </p>
                </div>
              </div>
            )}

            {/* Find the winner (highest vote count) */}
            {(() => {
              const recommendations = recommendationsQuery.data.recommendations;
              
              // Find winner - highest vote count, or first one if no votes
              const winner = recommendations.reduce((prev, current) => {
                const prevVotes = (prev as unknown as { voteCount?: number }).voteCount ?? 0;
                const currentVotes = (current as unknown as { voteCount?: number }).voteCount ?? 0;
                return currentVotes > prevVotes ? current : prev;
              }, recommendations[0]);

              if (!winner) return null;

              const rec = winner;
              const voteCount = (rec as unknown as { voteCount?: number }).voteCount ?? 0;
                  // Get price level as € symbols
                  const getPriceSymbols = (level: string) => {
                    switch (level) {
                      case "budget":
                        return "€";
                      case "moderate":
                        return "€€";
                      case "premium":
                        return "€€€";
                      default:
                        return "€€";
                    }
                  };

              // Extract booking/CTA data
              const booking = (rec as unknown as { booking?: unknown }).booking as
                | {
                    provider?: string;
                    link?: string;
                    qrPayload?: string;
                    leadTimeMinutes?: number;
                    supportsGroupPaymentSplit?: boolean;
                  }
                | undefined;

              const availability = (rec as unknown as {
                availability?: unknown;
              }).availability as
                | Array<{
                    label?: string;
                    start?: string;
                    end?: string;
                    priceTotal?: number;
                    pricePerPerson?: number;
                    currency?: string;
                    capacity?: number;
                    status?: string;
                    bookingLink?: string;
                  }>
                | undefined;

              const addOns = (rec as unknown as { addOns?: unknown }).addOns as
                | string[]
                | undefined;

              return (
                <div className="overflow-hidden rounded-2xl bg-white border-2 border-[#029DE2] p-4">
                  {/* Winner Badge */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#029DE2] text-sm font-bold text-white">
                        🏆
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#0F172B]">
                          {rec.title}
                        </h3>
                        {voteCount > 0 && (
                          <p className="text-xs text-[#0F172B]/60">
                            {voteCount} {voteCount === 1 ? "vote" : "votes"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mb-3 text-sm text-[#0F172B]/70">
                    {rec.description}
                  </p>

                  {/* Price and Duration Row */}
                  <div className="mb-3 flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {getPriceSymbols(rec.priceLevel)
                        .split("")
                        .map((symbol, i) => (
                          <div
                            key={i}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-xs font-semibold text-yellow-700"
                          >
                            {symbol}
                          </div>
                        ))}
                    </div>
                    <span className="text-sm text-[#0F172B]/60">
                      {rec.duration}
                    </span>
                  </div>

                  {/* Add-ons Section - Only visible to creator */}
                  {isCreator && addOns && addOns.length > 0 && (
                    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h4 className="mb-2 text-xs font-semibold text-slate-900">
                        Available add-ons
                      </h4>
                      <div className="space-y-2">
                        {addOns.map((addOn, addOnIdx) => (
                          <div
                            key={addOnIdx}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2"
                          >
                            <span className="text-xs text-slate-700">{addOn}</span>
                            <Button
                              size="sm"
                              className="h-6 bg-[#029DE2] px-3 text-xs text-white hover:bg-[#0287C3] disabled:bg-green-600 disabled:opacity-100"
                              disabled={boughtAddOns.has(addOn)}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setBoughtAddOns((prev) => new Set(prev).add(addOn));
                                toast.success(`${addOn} added to cart`, {
                                  description: "You can review your selections before booking.",
                                });
                              }}
                            >
                              {boughtAddOns.has(addOn) ? "Added" : "Buy"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA Section - Only visible to creator when voting is closed */}
                  {isVotingClosed && isCreator && (
                        <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                          {/* Availability Slots - show as compact list if multiple */}
                          {availability && availability.length > 1 && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <h4 className="mb-2 text-xs font-semibold text-slate-900">
                                Choose a time slot
                              </h4>
                              <div className="space-y-2">
                                {availability.map((slot, slotIdx) => (
                                  <div
                                    key={slotIdx}
                                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 transition-all hover:border-[#029DE2] hover:bg-[#029DE2]/5"
                                  >
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-slate-900">
                                        {slot.label ?? `${slot.start ?? ""} - ${slot.end ?? ""}`}
                                      </div>
                                      {slot.pricePerPerson && (
                                        <div className="mt-0.5 text-xs text-slate-600">
                                          {slot.currency ?? "EUR"}{" "}
                                          {slot.pricePerPerson.toFixed(2)}/person
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      className="ml-2 h-7 bg-[#029DE2] text-xs text-white hover:bg-[#029DE2]/90 disabled:bg-green-600 disabled:opacity-100"
                                      disabled={bookedSlots.has(slot.label ?? `${slot.start}-${slot.end}`)}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const slotKey = slot.label ?? `${slot.start}-${slot.end}`;
                                        setBookedSlots((prev) => new Set(prev).add(slotKey));
                                        toast.success("Booking initiated", {
                                          description: `Reserving ${slot.label ?? "this time slot"}...`,
                                        });
                                      }}
                                    >
                                      {bookedSlots.has(slot.label ?? `${slot.start}-${slot.end}`) ? "Booked" : "Book"}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Single availability slot - show inline */}
                          {availability?.[0] && availability.length === 1 && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-medium text-slate-900">
                                    {availability[0].label ??
                                      `${availability[0].start ?? ""} - ${availability[0].end ?? ""}`}
                                  </div>
                                  {availability[0].pricePerPerson && (
                                    <div className="mt-0.5 text-xs text-slate-600">
                                      {availability[0].currency ?? "EUR"}{" "}
                                      {availability[0].pricePerPerson.toFixed(2)}/person
                                    </div>
                                  )}
                                </div>
                                {availability[0].status && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      availability[0].status === "available"
                                        ? "bg-green-100 text-green-700"
                                        : availability[0].status === "limited"
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {availability[0].status}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Main Booking CTA Button */}
                          {booking?.link && (
                            <Button
                              className="w-full rounded-xl bg-[#029DE2] py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#0287C3] hover:shadow-xl active:scale-[0.98] disabled:bg-green-600 disabled:opacity-100 disabled:cursor-not-allowed"
                              size="lg"
                              disabled={isMainBookingClicked}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsMainBookingClicked(true);
                                const buttonText = (() => {
                                  if (availability?.[0] && availability.length === 1) {
                                    const slot = availability[0];
                                    if (slot.label?.toLowerCase().includes("table")) {
                                      return "Reserve table";
                                    }
                                    return "Reserve now";
                                  }
                                  if (availability && availability.length > 1) {
                                    return "View All Options";
                                  }
                                  if (
                                    rec.type?.toLowerCase().includes("dining") ||
                                    rec.type?.toLowerCase().includes("restaurant") ||
                                    rec.type?.toLowerCase().includes("cafe")
                                  ) {
                                    return "Reserve table";
                                  }
                                  return booking?.provider
                                    ? `Reserve via ${booking.provider}`
                                    : "Reserve table";
                                })();
                                
                                toast.success("Booking initiated", {
                                  description: `${buttonText} for ${rec.title}`,
                                });
                              }}
                            >
                              {(() => {
                                if (isMainBookingClicked) {
                                  return "Booked";
                                }
                                if (availability?.[0] && availability.length === 1) {
                                  const slot = availability[0];
                                  if (slot.label?.toLowerCase().includes("table")) {
                                    return "Reserve table";
                                  }
                                  return "Reserve now";
                                }
                                if (availability && availability.length > 1) {
                                  return "View All Options";
                                }
                                if (
                                  rec.type?.toLowerCase().includes("dining") ||
                                  rec.type?.toLowerCase().includes("restaurant") ||
                                  rec.type?.toLowerCase().includes("cafe")
                                ) {
                                  return "Reserve table";
                                }
                                return booking?.provider
                                  ? `Reserve via ${booking.provider}`
                                  : "Reserve table";
                              })()}
                            </Button>
                          )}

                          {/* Fallback if no booking link */}
                          {!booking?.link && !availability && (
                            <Button
                              className="w-full rounded-xl bg-slate-200 py-4 text-base font-semibold text-slate-700"
                              size="lg"
                              disabled
                            >
                              Booking information coming soon
                            </Button>
                          )}
                      </div>
                    )}
                  </div>
                );
            })()}
          </>
        ) : (
          <div className="rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
            <div className="mb-3 text-4xl">✨</div>
            <h3 className="mb-2 text-xl font-semibold text-white">
              No recommendations yet
            </h3>
            <p className="text-white/80">
              Recommendations will appear here once generated.
            </p>
          </div>
        )}
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <EventMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          participants={participantLocations}
        />
      )}
    </main>
  );
}
