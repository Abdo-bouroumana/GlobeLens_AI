"use client";

import React, { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";

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
  bias_lean?: string;
}

interface MapProps {
  events: MapEvent[];
  selectedEvent: MapEvent | null;
  onSelectEvent: (event: MapEvent) => void;
}

// Controller component to smoothly fly map to coordinates
function MapController({ selectedEvent }: { selectedEvent: MapEvent | null }) {
  const map = useMap();

  useEffect(() => {
    if (
      selectedEvent &&
      typeof selectedEvent.latitude === "number" &&
      typeof selectedEvent.longitude === "number"
    ) {
      map.flyTo([selectedEvent.latitude, selectedEvent.longitude], 6, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedEvent, map]);

  return null;
}

// Custom Leaflet DivIcon matching mockups (Standard/Warning/Critical)
const createMarkerIcon = (importanceScore: number) => {
  const size = Math.max(16, Math.min(28, 12 + importanceScore * 1.5));
  
  let pingColor = "bg-secondary/30";
  let dotColor = "bg-secondary";
  
  if (importanceScore >= 7.0) {
    pingColor = "bg-error/45 animate-ping";
    dotColor = "bg-error border-error-container";
  } else if (importanceScore >= 4.0) {
    pingColor = "bg-tertiary/40";
    dotColor = "bg-tertiary border-tertiary-container";
  }

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${size}px; height: ${size}px;">
        <div class="absolute inset-0 rounded-full ${pingColor}"></div>
        <div class="relative w-4 h-4 rounded-full ${dotColor} border border-surface shadow-md shadow-black/50 transition-transform group-hover:scale-110"></div>
      </div>
    `,
    className: "custom-marker-icon-wrapper",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export default function Map({ events, selectedEvent, onSelectEvent }: MapProps) {
  // Center coordinates (geographic center, zoomed out)
  const centerPosition: [number, number] = [20, 0];

  return (
    <div className="w-full h-full relative bg-surface-container-lowest">
      <MapContainer
        center={centerPosition}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        className="w-full h-full z-10"
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        {/* Sleek CartoDB Dark Matter TileLayer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapController selectedEvent={selectedEvent} />

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
