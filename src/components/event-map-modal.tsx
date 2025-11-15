"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";

// Dynamically import React Leaflet components to avoid SSR issues
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

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

export type ParticipantLocation = {
  userName: string;
  latitude: number;
  longitude: number;
  initials: string;
};

interface EventMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantLocation[];
  isEnlarged?: boolean;
  onToggleEnlarge?: () => void;
  eventName?: string;
}

export function EventMapModal({
  isOpen,
  onClose,
  participants,
  isEnlarged = false,
  onToggleEnlarge,
  eventName,
}: EventMapModalProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      // Load Leaflet CSS and library
      void import("leaflet").then((leaflet) => {
        setL(leaflet);
        setLeafletLoaded(true);

        // Fix default marker icon issue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          iconUrl: "/leaflet/marker-icon.png",
          shadowUrl: "/leaflet/marker-shadow.png",
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Group participants by location
  const locationMap = new Map<
    string,
    {
      latitude: number;
      longitude: number;
      count: number;
      names: string[];
      initials: string;
    }
  >();

  participants.forEach((loc) => {
    // Round to 5 decimal places (~1 meter precision) to group nearby locations
    const key = `${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)}`;
    const existing = locationMap.get(key);

    if (existing) {
      existing.count += 1;
      existing.names.push(loc.userName);
    } else {
      locationMap.set(key, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        count: 1,
        names: [loc.userName],
        initials: loc.initials,
      });
    }
  });

  const groupedLocations = Array.from(locationMap.values());

  // Calculate center point from all participants
  const centerLat =
    participants.length > 0
      ? participants.reduce((sum, p) => sum + p.latitude, 0) /
        participants.length
      : 60.1695; // Default to Helsinki
  const centerLng =
    participants.length > 0
      ? participants.reduce((sum, p) => sum + p.longitude, 0) /
        participants.length
      : 24.9354;

  // Create custom marker icons with initials or count
  const createCustomIcon = (display: string, isHighlighted: boolean = false) => {
    if (!L) return undefined;

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="position: relative; width: 40px; height: 40px;">
          <div style="
            position: absolute;
            width: 40px;
            height: 40px;
            background: ${isHighlighted ? '#FFD700' : '#029DE2'};
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
            opacity: 0.6;
          "></div>
          <div style="
            position: relative;
            width: 40px;
            height: 40px;
            background: ${isHighlighted ? '#FFD700' : '#029DE2'};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1;
          ">
            ${display}
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
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  const handleParticipantClick = (userName: string) => {
    setSelectedParticipant(userName === selectedParticipant ? null : userName);
    
    // Find the participant's location
    const participant = participants.find(p => p.userName === userName);
    if (participant && mapInstance) {
      // Center and zoom to the participant
      mapInstance.setView([participant.latitude, participant.longitude], 15, {
        animate: true,
        duration: 0.5,
      });
    }
  };

  const mapContent =
    leafletLoaded && L ? (
      <div className="relative h-full w-full">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={13}
          style={{
            height: "100%",
            width: "100%",
            borderRadius: isEnlarged ? "0" : "12px",
          }}
          ref={setMapInstance}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {groupedLocations.map((location, idx) => {
            const isHighlighted = location.count === 1 && location.names[0] === selectedParticipant;
            return (
              <Marker
                key={idx}
                position={[location.latitude, location.longitude]}
                icon={createCustomIcon(
                  location.count > 1 ? String(location.count) : location.initials,
                  isHighlighted,
                )}
              >
                <Popup>
                  {location.count > 1 ? (
                    <div>
                      <strong>{location.count} participants</strong>
                      <ul className="mt-1 list-disc pl-4">
                        {location.names.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <strong>{location.names[0]}</strong>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Enlarge/Shrink button */}
        {onToggleEnlarge && (
          <button
            onClick={onToggleEnlarge}
            className="absolute top-4 right-4 z-[1000] rounded-lg bg-white px-3 py-2 text-sm font-medium text-[#029DE2] shadow-lg transition-all hover:scale-105 hover:bg-[#029DE2] hover:text-white"
          >
            {isEnlarged ? "📉 Shrink" : "📈 Enlarge"}
          </button>
        )}
      </div>
    ) : (
      <div className="flex h-full items-center justify-center text-[#62748E]">
        Loading map...
      </div>
    );

  if (isEnlarged) {
    // Full screen modal
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-2xl font-semibold text-[#0F172B]">
              {eventName ? `${eventName}'s Event` : 'Participant Locations'}
            </h2>
            <button
              onClick={onClose}
              className="text-2xl text-[#62748E] hover:text-[#0F172B]"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 relative">
            {mapContent}
            {/* Participant list at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-4">
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {participants.map((participant, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleParticipantClick(participant.userName)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedParticipant === participant.userName
                        ? 'bg-[#FFD700] text-white shadow-lg scale-105'
                        : 'bg-[#029DE2] text-white hover:bg-[#0287C3] hover:scale-105'
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/30 text-xs font-bold">
                      {participant.initials}
                    </span>
                    <span>{participant.userName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular modal
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-none bg-white text-slate-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-semibold text-[#0F172B]">
            Participant Locations
          </DialogTitle>
        </DialogHeader>
        <div className="h-[400px] w-full py-4">{mapContent}</div>
        <p className="pb-4 text-center text-sm text-[#62748E]">
          {participants.length} participant
          {participants.length !== 1 ? "s" : ""} shown
        </p>
      </DialogContent>
    </Dialog>
  );
}
