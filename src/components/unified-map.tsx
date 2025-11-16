"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
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

type MapMode = "inline" | "enlarged" | "opinion" | "hidden";

type UnifiedMapProps = {
  participants: ParticipantLocation[];
  mode: MapMode;
  onInlineClick?: () => void;
  children?: React.ReactNode; // For inline overlay content
};

export function UnifiedMap({
  participants,
  mode,
  onInlineClick,
  children,
}: UnifiedMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<LeafletModule | null>(null);

  // Load Leaflet
  useEffect(() => {
    void import("leaflet").then((leafletModule) => {
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

  // Group participants by location
  const groupedLocations = useMemo(() => {
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

  const center = useMemo(() => {
    if (participants.length > 0) {
      return [
        participants.reduce((sum, p) => sum + p.latitude, 0) /
          participants.length,
        participants.reduce((sum, p) => sum + p.longitude, 0) /
          participants.length,
      ] as [number, number];
    }
    return [60.1695, 24.9354] as [number, number]; // Default to Helsinki
  }, [participants]);

  if (participants.length === 0) return null;

  // Determine container classes based on mode
  const getContainerClasses = () => {
    const baseClasses = "fixed transition-all duration-700 ease-in-out";
    switch (mode) {
      case "inline":
        return `${baseClasses} top-0 left-0 right-0 h-64 z-10`;
      case "enlarged":
        return `${baseClasses} inset-0 z-50 scale-100`;
      case "opinion":
        return `${baseClasses} inset-0 z-40 scale-110`;
      default:
        return baseClasses;
    }
  };

  return (
    <div className={getContainerClasses()}>
      <div
        className={`relative h-full w-full ${mode === "inline" ? "cursor-pointer" : ""}`}
        onClick={mode === "inline" ? onInlineClick : undefined}
      >
        {/* Inline overlay content */}
        {mode === "inline" && children}

        {/* Map content */}
        {leafletLoaded && L ? (
          <div className="relative h-full w-full">
            <MapContainer
              center={center}
              zoom={mode === "inline" ? 13 : 13}
              style={{ height: "100%", width: "100%" }}
              zoomControl={mode === "enlarged"}
              dragging={mode === "enlarged"}
              scrollWheelZoom={mode === "enlarged"}
              doubleClickZoom={mode === "enlarged"}
              touchZoom={mode === "enlarged"}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {groupedLocations.map((location, idx) => {
                // Different marker styles for different modes
                const getMarkerIcon = () => {
                  if (mode === "opinion") {
                    // White circular markers for opinion mode
                    return L.divIcon({
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
                          ${location.initials}
                          ${
                            location.count > 1
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
                            ">${location.count}</div>`
                              : ""
                          }
                        </div>
                      `,
                      iconSize: [44, 44],
                      iconAnchor: [22, 22],
                    });
                  } else {
                    // Blue pulsing markers for inline and enlarged modes
                    return L.divIcon({
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
                    });
                  }
                };

                return (
                  <Marker
                    key={idx}
                    position={[location.latitude, location.longitude]}
                    // @ts-expect-error - Leaflet divIcon return type doesn't match react-leaflet's expected type, but works at runtime
                    icon={getMarkerIcon()}
                  />
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="h-full w-full bg-slate-200" />
        )}

        {/* Overlay for opinion mode */}
        {mode === "opinion" && (
          <div className="absolute inset-0 bg-[rgba(0,49,71,0.4)] pointer-events-none" />
        )}

        {/* Black gradient overlay for inline mode */}
        {mode === "inline" && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 to-black/0" />
        )}
      </div>
    </div>
  );
}
