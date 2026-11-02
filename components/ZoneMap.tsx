'use client';
// Leaflet map of zones. Loaded only in the browser (see DemandMap, next/dynamic with ssr: false).
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Circle, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { City } from '@/lib/demand';
import { CITY_VIEW, type Zone } from '@/lib/geo';

// CARTO basemaps need a free key (https://carto.com/basemaps/apikey/). Without it, plain OpenStreetMap tiles are used.
const CARTO_KEY = process.env.MAP_TILE_KEY;

export interface Cell { zone: Zone; color: string; radius: number; label: string }

function FlyTo({ city }: { city: City }) {
  const map = useMap();
  useEffect(() => {
    const v = CITY_VIEW[city];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo(v.center, v.zoom, { duration: reduce ? 0 : 1.1 });
  }, [city, map]);
  return null;
}

export default function ZoneMap({ city, cells, selected, onSelect }: { city: City; cells: Cell[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const v = CITY_VIEW[city];
  return (
    <MapContainer center={v.center} zoom={v.zoom} minZoom={10} maxZoom={14} scrollWheelZoom={false} className="zone-map h-full w-full" attributionControl>
      {CARTO_KEY ? (
        <TileLayer
          url={`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
      ) : (
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      )}
      <FlyTo city={city} />
      {cells.map((c) => {
        const on = selected === c.zone.id;
        return (
          <Circle key={c.zone.id} center={[c.zone.lat, c.zone.lng]} radius={c.radius}
            pathOptions={{ color: on ? '#171A26' : '#FFFFFF', weight: on ? 3 : 1.5, fillColor: c.color, fillOpacity: 0.78 }}
            eventHandlers={{ click: () => onSelect(on ? null : c.zone.id) }}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1} className="zone-tip">
              <b>{c.zone.name}</b><br />{c.label}
            </Tooltip>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
