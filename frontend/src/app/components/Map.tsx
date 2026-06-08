"use client";

import React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker } from "react-leaflet";

interface MapEvent {
  id: string;
  title: string;
  summary: string;
  topic: string;
  country: string;
  latitude: number;
  longitude: number;
  importance_score: number;
  source_count: number;
}

interface MapProps {
  events: MapEvent[];
  onSelectEvent: (event: MapEvent) => void;
}

// Custom pulsing blue dot markers using Leaflet's divIcon.
const createMarkerIcon = (importanceScore: number) => {
  const size = Math.max(12, Math.min(24, 10 + importanceScore * 1.5));
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <span class="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60 animate-ping"></span>
        <span class="relative inline-flex rounded-full bg-blue-600 border border-slate-900 shadow-md shadow-blue-500/50" style="height: ${size}px; width: ${size}px;"></span>
      </div>
    `,
    className: "custom-marker-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export default function Map({ events, onSelectEvent }: MapProps) {
  // Center coordinates (geographic center, zoomed out)
  const centerPosition: [number, number] = [20, 0];

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950">
      <MapContainer
        center={centerPosition}
        zoom={2}
        minZoom={2}
        className="w-full h-full z-10"
        style={{ height: "100%", width: "100%" }}
      >
        {/* Sleek CartoDB Dark Matter TileLayer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {events.map((event) => {
          if (
            typeof event.latitude !== "number" ||
            typeof event.longitude !== "number"
          ) {
            return null;
          }
          return (
            <Marker
              key={event.id}
              position={[event.latitude, event.longitude]}
              icon={createMarkerIcon(event.importance_score)}
              eventHandlers={{
                click: () => onSelectEvent(event),
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
