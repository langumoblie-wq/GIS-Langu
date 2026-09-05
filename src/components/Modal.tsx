import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'success';
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export function Modal({ isOpen, type, title, message, onClose, onConfirm }: ModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          {type === 'alert' && <AlertCircle className="w-12 h-12 text-red-500 mb-3" />}
          {type === 'success' && <CheckCircle className="w-12 h-12 text-[#5C7F67] mb-3" />}
          {type === 'confirm' && <Info className="w-12 h-12 text-[#5C7F67] mb-3" />}
          
          <h3 className="text-xl font-bold text-[#3A4D3F]">{title}</h3>
          <p className="text-[13px] text-[#7A7E74] mt-2 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {type === 'confirm' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#7A7E74] bg-[#F4F5F0] hover:bg-[#E6E4DD] transition-colors text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-[#5C7F67] hover:bg-[#4A6753] transition-colors shadow-md shadow-[#5C7F67]/20 text-sm"
              >
                ยืนยัน
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#5C7F67] hover:bg-[#4A6753] transition-colors shadow-md shadow-[#5C7F67]/20 text-sm"
            >
              ตกลง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
