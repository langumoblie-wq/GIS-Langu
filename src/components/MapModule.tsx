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
                  <p className="text-[11px] text-[#A3A69F] mt-1 mb-0">เก็บข้อมูลโดย: {record.collectorName}</p>
                )}
                {Boolean(
                  (record.bedriddenCount && record.bedriddenCount > 0) ||
                  (record.homeboundCount && record.homeboundCount > 0) ||
                  (record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) ||
                  (record.elderlyCount && record.elderlyCount > 0) ||
                  (record.diabetesCount && record.diabetesCount > 0) ||
                  (record.hypertensionCount && record.hypertensionCount > 0) ||
                  (record.disabledCount && record.disabledCount > 0)
                ) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] space-y-0.5">
                    <p className="font-bold text-[#3A4D3F] mb-1">กลุ่มเปราะบาง:</p>
                    {Boolean(record.bedriddenCount && record.bedriddenCount > 0) && (
                      <p className="text-rose-600 m-0">• ผู้ป่วยติดเตียง: {record.bedriddenCount} คน</p>
                    )}
                    {Boolean(record.homeboundCount && record.homeboundCount > 0) && (
                      <p className="text-amber-700 m-0">• ผู้ป่วยติดบ้าน: {record.homeboundCount} คน</p>
                    )}
                    {Boolean(record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) && (
                      <p className="text-pink-600 m-0">• หญิงครรภ์ &gt; 36w: {record.pregnantOver36WeeksCount} คน</p>
                    )}
                    {Boolean(record.elderlyCount && record.elderlyCount > 0) && (
                      <p className="text-amber-800 m-0">• ผู้สูงอายุ: {record.elderlyCount} คน</p>
                    )}
                    {Boolean(record.diabetesCount && record.diabetesCount > 0) && (
                      <p className="text-blue-600 m-0">• เบาหวาน (DM): {record.diabetesCount} คน</p>
                    )}
                    {Boolean(record.hypertensionCount && record.hypertensionCount > 0) && (
                      <p className="text-indigo-600 m-0">• ความดันโลหิตสูง (HT): {record.hypertensionCount} คน</p>
                    )}
                    {Boolean(record.disabledCount && record.disabledCount > 0) && (
                      <p className="text-purple-700 m-0">• ผู้พิการ: {record.disabledCount} คน</p>
                    )}
                  </div>
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
