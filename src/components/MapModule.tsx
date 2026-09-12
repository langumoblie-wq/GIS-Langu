import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { HouseholdRecord } from '../types';

// Fix Leaflet's default icon path issues with standard React/Vite setups
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapModuleProps {
  records: HouseholdRecord[];
}

// Component to automatically fit the map bounds to show all markers
function MapBounds({ records }: { records: HouseholdRecord[] }) {
  const map = useMap();
  
  useEffect(() => {
    const validRecords = records.filter(r => r.latitude != null && r.longitude != null);
    if (validRecords.length > 0) {
      const bounds = L.latLngBounds(validRecords.map(r => [r.latitude!, r.longitude!]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [records, map]);

  return null;
}

export function MapModule({ records }: MapModuleProps) {
  const validRecords = records.filter(r => r.latitude != null && r.longitude != null);

  if (validRecords.length === 0) {
    return (
      <div className="h-64 w-full bg-[#F4F5F0] rounded-2xl flex items-center justify-center border border-[#E6E4DD]">
        <p className="text-[#7A7E74] text-sm font-medium">ไม่มีข้อมูลพิกัดสำหรับแสดงบนแผนที่</p>
      </div>
    );
  }

  // Default center if bounds fitting somehow fails
  const center: [number, number] = [validRecords[0].latitude!, validRecords[0].longitude!];

  return (
    <div className="h-96 w-full rounded-2xl overflow-hidden border border-[#E6E4DD] shadow-sm relative z-0">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validRecords.map(record => (
          <Marker key={record.id} position={[record.latitude!, record.longitude!]}>
            <Popup>
              <div className="font-sans">
                <p className="font-bold text-[14px] text-[#3A4D3F] mb-1">บ้านเลขที่ {record.houseNumber}</p>
                <p className="text-[12px] text-[#7A7E74] m-0 leading-tight">หมู่บ้าน: <span className="font-medium text-[#3A4D3F]">{record.village}</span></p>
                <p className="text-[12px] text-[#7A7E74] m-0 leading-tight">เจ้าบ้าน: <span className="font-medium text-[#3A4D3F]">{record.headOfHousehold}</span></p>
                {record.collectorName && (
                  <p className="text-[11px] text-[#A3A69F] mt-2 mb-0">เก็บข้อมูลโดย: {record.collectorName}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        <MapBounds records={validRecords} />
      </MapContainer>
    </div>
  );
}
