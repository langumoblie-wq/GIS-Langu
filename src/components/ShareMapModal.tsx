import React, { useState } from 'react';
import { X, Navigation, ExternalLink, Copy, Check, Share2, MapPin, Compass } from 'lucide-react';
import { HouseholdRecord } from '../types';

interface ShareMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: HouseholdRecord | null;
}

export function ShareMapModal({ isOpen, onClose, record }: ShareMapModalProps) {
  const [copiedType, setCopiedType] = useState<'link' | 'coords' | null>(null);

  if (!isOpen || !record) return null;

  const lat = record.latitude;
  const lng = record.longitude;
  const hasCoords = lat != null && lng != null;

  // URLs for direct app opening
  const googleMapsSearchUrl = hasCoords 
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` 
    : '';
  const googleMapsDirectionsUrl = hasCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` 
    : '';
  const appleMapsUrl = hasCoords 
    ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(`บ้านเลขที่ ${record.houseNumber} (${record.headOfHousehold})`)}` 
    : '';

  const shareText = hasCoords
    ? `📍 พิกัดบ้านเลขที่ ${record.houseNumber} ${record.village}\n👤 เจ้าบ้าน: ${record.headOfHousehold}\n🧑‍⚕️ อสม. ผู้รับผิดชอบ: ${record.collectorName || '-'}\n📌 พิกัด GPS: ${lat}, ${lng}\n\nเปิดใน Google Maps: ${googleMapsSearchUrl}\nเปิดใน Apple Maps: ${appleMapsUrl}`
    : `บ้านเลขที่ ${record.houseNumber} ${record.village} (เจ้าบ้าน: ${record.headOfHousehold})`;

  const handleCopyLink = async () => {
    if (!googleMapsSearchUrl) return;
    try {
      await navigator.clipboard.writeText(googleMapsSearchUrl);
      setCopiedType('link');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyCoords = async () => {
    if (!hasCoords) return;
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`);
      setCopiedType('coords');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `พิกัดบ้านเลขที่ ${record.houseNumber} ${record.village}`,
          text: shareText,
          url: googleMapsSearchUrl || undefined,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E6E4DD] relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5C7F67]/10 flex items-center justify-center text-[#5C7F67]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3A4D3F]">เปิดแผนที่ & แชร์พิกัด</h3>
              <p className="text-xs text-[#7A7E74]">บ้านเลขที่ {record.houseNumber} {record.village}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-[#7A7E74] hover:text-[#2D302E] hover:bg-[#F4F5F0] rounded-full transition-colors"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Household Info Summary */}
        <div className="my-4 p-3.5 bg-[#F9F9F5] rounded-2xl border border-[#E6E4DD] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#7A7E74]">เจ้าบ้าน:</span>
            <span className="font-bold text-[#3A4D3F]">{record.headOfHousehold}</span>
          </div>
          {record.houseRegistrationNumber && (
            <div className="flex justify-between">
              <span className="text-[#7A7E74]">เลขทะเบียนบ้าน:</span>
              <span className="font-medium text-[#3A4D3F]">{record.houseRegistrationNumber}</span>
            </div>
          )}
          {record.collectorName && (
            <div className="flex justify-between">
              <span className="text-[#7A7E74]">อสม. ผู้รับผิดชอบ:</span>
              <span className="font-medium text-[#5C7F67]">{record.collectorName}</span>
            </div>
          )}
          {hasCoords ? (
            <div className="flex justify-between items-center pt-1 border-t border-[#E6E4DD]/60">
              <span className="text-[#7A7E74] flex items-center gap-1 font-mono">
                <MapPin className="w-3 h-3 text-[#5C7F67]" /> พิกัด GPS:
              </span>
              <span className="font-mono text-[11px] font-bold text-[#3A4D3F]">
                {lat?.toFixed(6)}, {lng?.toFixed(6)}
              </span>
            </div>
          ) : (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-1.5 mt-2">
              <MapPin className="w-4 h-4 shrink-0 text-amber-600" />
              <span>บ้านหลังนี้ยังไม่มีการบันทึกพิกัด GPS</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {hasCoords ? (
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold text-[#7A7E74] uppercase tracking-wider px-1">
              เลือกเปิดในแอปแผนที่
            </p>

            {/* Google Maps Button */}
            <a
              href={googleMapsSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-2xl transition-all group shadow-sm text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5">
                    Google Maps
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">แนะนำ</span>
                  </div>
                  <p className="text-[11px] text-slate-500">เปิดดูตำแหน่งบนแผนที่ Google Maps</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </a>

            {/* Google Maps Turn-by-Turn Navigation */}
            <a
              href={googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3.5 bg-[#5C7F67]/5 hover:bg-[#5C7F67]/10 border border-[#5C7F67]/30 rounded-2xl transition-all group shadow-sm text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5C7F67] text-white flex items-center justify-center">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#3A4D3F] group-hover:text-[#5C7F67]">
                    เริ่มนำทางทันที (Turn-by-Turn)
                  </div>
                  <p className="text-[11px] text-[#7A7E74]">เปิดระบบนำทางบอกทางเลี้ยวต่อเลี้ยว</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-[#5C7F67]" />
            </a>

            {/* Apple Maps Button */}
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-2xl transition-all group shadow-sm text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Apple Maps
                    <span className="ml-1.5 text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">iOS / Mac</span>
                  </div>
                  <p className="text-[11px] text-slate-500">เปิดแอปแผนที่ของ Apple (iPhone/iPad)</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-neutral-800 transition-colors" />
            </a>

            {/* Share & Copy Section */}
            <p className="text-[11px] font-bold text-[#7A7E74] uppercase tracking-wider px-1 pt-2">
              แชร์ & คัดลอก
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#5C7F67] hover:bg-[#4A6753] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>แชร์พิกัด</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#F4F5F0] border border-[#E6E4DD] text-[#3A4D3F] rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {copiedType === 'link' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#5C7F67]" />
                    <span className="text-[#5C7F67]">คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#7A7E74]" />
                    <span>คัดลอกลิงก์</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyCoords}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#F4F5F0] border border-[#E6E4DD] text-[#3A4D3F] rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {copiedType === 'coords' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#5C7F67]" />
                    <span className="text-[#5C7F67]">คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-[#7A7E74]" />
                    <span>คัดลอกพิกัด</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-[#5C7F67] text-white rounded-xl text-xs font-bold hover:bg-[#4A6753] transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
