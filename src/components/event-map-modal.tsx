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

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);

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
}

export function EventMapModal({
  isOpen,
  onClose,
  participants,
  isEnlarged = false,
  onToggleEnlarge,
}: EventMapModalProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<(typeof import("leaflet")) | null>(null);

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

  // Create custom marker icons with initials
  const createCustomIcon = (initials: string) => {
    if (!L) return undefined;

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #029DE2;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          ${initials}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  const mapContent = leafletLoaded && L ? (
    <div className="relative h-full w-full">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{
          height: "100%",
          width: "100%",
          borderRadius: isEnlarged ? "0" : "12px",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {participants.map((participant, idx) => (
          <Marker
            key={idx}
            position={[participant.latitude, participant.longitude]}
            icon={createCustomIcon(participant.initials)}
          >
            <Popup>
              <strong>{participant.userName}</strong>
            </Popup>
          </Marker>
        ))}
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
              Participant Locations
            </h2>
            <button
              onClick={onClose}
              className="text-2xl text-[#62748E] hover:text-[#0F172B]"
            >
              ✕
            </button>
          </div>
          <div className="flex-1">{mapContent}</div>
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
