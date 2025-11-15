"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader } from "@/components/ui/loader";
import type { ParticipantLocation } from "@/components/event-map-modal";

// Type for Leaflet module
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
  }) => unknown;
};

// Dynamically import React Leaflet components
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

type OpinionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantLocation[];
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function OpinionModal({
  isOpen,
  onClose,
  participants,
  children,
  isLoading = false,
}: OpinionModalProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<LeafletModule | null>(null);

  // Load Leaflet
  useEffect(() => {
    if (isOpen) {
      void import("leaflet").then((leafletModule) => {
        const leaflet = (leafletModule.default ??
          leafletModule) as LeafletModule;
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
    }
  }, [isOpen]);

  // Group participants by location
  const groupedLocations = React.useMemo(() => {
    const locationMap = new Map<
      string,
      ParticipantLocation & { count: number }
    >();

    participants.forEach((loc) => {
      const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const existing = locationMap.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        locationMap.set(key, { ...loc, count: 1 });
      }
    });

    return Array.from(locationMap.values());
  }, [participants]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Map Background - z-index 0 */}
      <div className="absolute inset-0 z-0">
        {leafletLoaded && L && participants.length > 0 ? (
          <div className="relative h-full w-full">
            <MapContainer
              center={
                participants.length > 0
                  ? [
                      participants.reduce((sum, p) => sum + p.latitude, 0) /
                        participants.length,
                      participants.reduce((sum, p) => sum + p.longitude, 0) /
                        participants.length,
                    ]
                  : [60.1695, 24.9354]
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
              {groupedLocations.map((loc, idx) => {
                const icon = L.divIcon({
                  className: "custom-marker",
                  html: `
                    <div style="
                      width: 44px;
                      height: 44px;
                      background: white;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-weight: 600;
                      font-size: 14px;
                      color: #029DE2;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                      position: relative;
                    ">
                      ${loc.initials}
                      ${
                        loc.count > 1
                          ? `<div style="
                          position: absolute;
                          top: -4px;
                          right: -4px;
                          background: #029DE2;
                          color: white;
                          border-radius: 50%;
                          width: 20px;
                          height: 20px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 11px;
                          font-weight: 700;
                          border: 2px solid white;
                        ">${loc.count}</div>`
                          : ""
                      }
                    </div>
                  `,
                  iconSize: [44, 44],
                  iconAnchor: [22, 22],
                });

                return (
                  <Marker
                    key={idx}
                    position={[loc.latitude, loc.longitude]}
                    // @ts-expect-error - Leaflet divIcon return type doesn't match react-leaflet's expected type, but works at runtime
                    icon={icon}
                  />
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="h-full w-full bg-slate-200" />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[rgba(0,49,71,0.4)]" />
      </div>

      {/* Close button - top left */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white"
        aria-label="Close"
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
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Content - z-index 10 */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center">
            <Loader />
          </div>
        ) : (
          <div className="w-full max-w-[362px]">{children}</div>
        )}
      </div>
    </div>
  );
}
