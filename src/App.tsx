import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Save, Download, Trash2, Home, Users, FileText, AlertCircle, Map, Navigation, Loader2, Edit2, X, BarChart as BarChartIcon, Filter, AlertTriangle, Share2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { HouseholdRecord, VILLAGES } from './types';
import { fetchRecordsFromGAS, addRecordToGAS, deleteRecordFromGAS, updateRecordInGAS } from './gas';
import { Modal } from './components/Modal';
import { MapModule } from './components/MapModule';

export default function App() {
  const [records, setRecords] = useState<HouseholdRecord[]>([]);
  const [formData, setFormData] = useState<Partial<HouseholdRecord>>({
    village: VILLAGES[0],
    houseRegistrationNumber: '',
    memberCount: '',
    collectorName: '',
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'incomplete'>('form');

  const [isSyncing, setIsSyncing] = useState(false);
  const [gasUrl, setGasUrl] = useState(import.meta.env.VITE_GAS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbxCGURRM4ltH4rvZDKNTZ6bOZOwCfZgU_U1ozFr_QRFLDw6I6NK-jfZ6r1E0IlUVA/exec');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterVillage, setFilterVillage] = useState<string>('');
  const [filterCollector, setFilterCollector] = useState<string>('');
  const [filterHouseNumber, setFilterHouseNumber] = useState<string>('');

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'success';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (title: string, message: string, type: 'alert' | 'success' = 'alert') => {
    setModal({ isOpen: true, type, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  useEffect(() => {
    if (!isConfiguring && gasUrl) {
      loadData();
    }
  }, [isConfiguring, gasUrl]);

  const loadData = async () => {
    // 1. Load from cache first for instant display
    const cachedData = localStorage.getItem('household_records_cache');
    if (cachedData) {
      try {
        setRecords(JSON.parse(cachedData));
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }

    // 2. Fetch fresh data in the background
    setIsSyncing(true);
    try {
      const data = await fetchRecordsFromGAS(gasUrl);
      setRecords(data);
      // Save fresh data to cache
      localStorage.setItem('household_records_cache', JSON.stringify(data));
    } catch (err: any) {
      console.error(err);
      if (!cachedData) {
        showAlert('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถดึงข้อมูลได้ โปรดตรวจสอบ Web App URL หรือการตั้งค่า CORS');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getLocation = () => {
    setIsLocating(true);
    setLocationError('');
    
    if (!navigator.geolocation) {
      setLocationError('บราวเซอร์ของคุณไม่รองรับการระบุตำแหน่ง');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location)');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('ไม่สามารถระบุตำแหน่งได้');
            break;
          case error.TIMEOUT:
            setLocationError('หมดเวลารอการระบุตำแหน่ง');
            break;
          default:
            setLocationError('เกิดข้อผิดพลาดในการระบุตำแหน่ง');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gasUrl) {
      showAlert('แจ้งเตือน', 'กรุณาตั้งค่า Web App URL ก่อนบันทึกข้อมูล');
      setIsConfiguring(true);
      return;
    }
    if (!formData.houseNumber || !formData.headOfHousehold || formData.latitude === undefined || formData.latitude === '' || formData.latitude === null) {
      showAlert('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน และระบุพิกัดตำแหน่ง (กดดึงพิกัด หรือกรอกเอง)');
      return;
    }

    const newRecord: HouseholdRecord = {
      id: editingId || crypto.randomUUID(),
      houseNumber: formData.houseNumber?.trim() || '',
      houseRegistrationNumber: formData.houseRegistrationNumber?.trim() || '',
      headOfHousehold: formData.headOfHousehold?.trim() || '',
      village: formData.village?.trim() || VILLAGES[0],
      latitude: formData.latitude !== undefined && formData.latitude !== null && formData.latitude !== '' ? Number(formData.latitude) : null,
      longitude: formData.longitude !== undefined && formData.longitude !== null && formData.longitude !== '' ? Number(formData.longitude) : null,
      memberCount: formData.memberCount === '' ? 0 : Number(formData.memberCount),
      notes: formData.notes?.trim() || '',
      collectorName: formData.collectorName?.trim() || '',
      timestamp: editingId ? (records.find(r => r.id === editingId)?.timestamp || new Date().toISOString()) : new Date().toISOString(),
    };

    setIsSyncing(true);
    try {
      if (editingId) {
        await updateRecordInGAS(gasUrl, newRecord);
      } else {
        await addRecordToGAS(gasUrl, newRecord);
      }
      await loadData();
      
      setFormData({
        village: formData.village,
        houseNumber: '',
        houseRegistrationNumber: '',
        headOfHousehold: '',
        memberCount: '',
        notes: '',
        collectorName: formData.collectorName, // Keep the collector name for next entry
        latitude: undefined,
        longitude: undefined,
      });
      setEditingId(null);
      showAlert('สำเร็จ', editingId ? 'อัปเดตข้อมูลลง Google Sheets สำเร็จ' : 'บันทึกข้อมูลลง Google Sheets สำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      showAlert('ผิดพลาด', editingId ? 'อัปเดตข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      setIsSyncing(false);
    }
  };

  const handleEdit = (record: HouseholdRecord) => {
    setFormData({
      houseNumber: record.houseNumber,
      houseRegistrationNumber: record.houseRegistrationNumber || '',
      headOfHousehold: record.headOfHousehold,
      memberCount: record.memberCount.toString(),
      village: record.village,
      notes: record.notes || '',
      collectorName: record.collectorName || '',
      latitude: record.latitude || undefined,
      longitude: record.longitude || undefined,
    });
    setEditingId(record.id);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setFormData({
      houseNumber: '',
      houseRegistrationNumber: '',
      headOfHousehold: '',
      memberCount: '',
      village: VILLAGES[0],
      notes: '',
      collectorName: '',
      latitude: undefined,
      longitude: undefined,
    });
    setEditingId(null);
  };

  const deleteRecord = (record: HouseholdRecord) => {
    if (!gasUrl) return;
    
    showConfirm('ยืนยันการลบข้อมูล', `คุณต้องการลบข้อมูลบ้านเลขที่ ${record.houseNumber} ใช่หรือไม่?`, async () => {
      setIsSyncing(true);
      try {
        await deleteRecordFromGAS(gasUrl, record.id);
        await loadData();
        showAlert('สำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว', 'success');
      } catch (err) {
        console.error(err);
        showAlert('ผิดพลาด', 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setIsSyncing(false);
      }
    });
  };

  const handleShareLocation = async (record: HouseholdRecord) => {
    if (!record.latitude || !record.longitude) {
      showAlert('แจ้งเตือน', 'บ้านหลังนี้ยังไม่มีข้อมูลพิกัด GPS');
      return;
    }

    const mapsUrl = `https://www.google.com/maps?q=${record.latitude},${record.longitude}`;
    const shareText = `พิกัดบ้านเลขที่ ${record.houseNumber} ${record.village} (เจ้าบ้าน: ${record.headOfHousehold})\nผู้เก็บข้อมูล: ${record.collectorName}\n${mapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `พิกัดบ้านเลขที่ ${record.houseNumber}`,
          text: shareText,
          url: mapsUrl
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        showAlert('สำเร็จ', 'คัดลอกลิงก์แผนที่ลงในคลิปบอร์ดเรียบร้อยแล้ว', 'success');
      } catch (err) {
        showAlert('แจ้งเตือน', 'ไม่สามารถคัดลอกลิงก์ได้ กรุณาคัดลอกพิกัดด้วยตัวเอง');
      }
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      showAlert('แจ้งเตือน', 'ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'วันที่บันทึก', 'หมู่บ้าน', 'บ้านเลขที่', 'เลขทะเบียนบ้าน', 'ชื่อเจ้าบ้าน', 'จำนวนสมาชิก', 'ละติจูด (Lat)', 'ลองจิจูด (Lng)', 'อสม./ผู้เก็บข้อมูล', 'หมายเหตุ'];
    
    // Export only filtered records if a filter is active, otherwise all
    const recordsToExport = filteredRecords.length > 0 ? filteredRecords : records;

    const csvContent = [
      // Add BOM for Excel UTF-8 compatibility
      '\uFEFF' + headers.join(','),
      ...recordsToExport.map((r, index) => {
        const date = new Date(r.timestamp).toLocaleString('th-TH');
        return [
          recordsToExport.length - index,
          `"${date}"`,
          `"${r.village}"`,
          `"${r.houseNumber}"`,
          `"${r.houseRegistrationNumber || ''}"`,
          `"${r.headOfHousehold}"`,
          r.memberCount,
          r.latitude,
          r.longitude,
          `"${r.collectorName || ''}"`,
          `"${r.notes?.replace(/"/g, '""') || ''}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ข้อมูลหลังคาเรือน_รพสต_ละงู_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Data processing for filters and charts
  const availableCollectors = useMemo(() => {
    const colls = new Set(records
      .filter(r => !filterVillage || r.village === filterVillage)
      .map(r => r.collectorName)
      .filter(Boolean)
    );
    return Array.from(colls).sort();
  }, [records, filterVillage]);

  const availableHouseNumbers = useMemo(() => {
    const houses = new Set(records
      .filter(r => !filterVillage || r.village === filterVillage)
      .map(r => r.houseNumber)
      .filter(Boolean)
    );
    return Array.from(houses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records, filterVillage]);

  // Data processing for the form (autocomplete)
  const formAvailableCollectors = useMemo(() => {
    const colls = new Set(records
      .filter(r => r.village === formData.village)
      .map(r => r.collectorName)
      .filter(Boolean)
    );
    return Array.from(colls).sort();
  }, [records, formData.village]);

  // When village filter changes, reset dependent filters if the selected value is no longer available
  useEffect(() => {
    if (filterCollector && !availableCollectors.includes(filterCollector)) setFilterCollector('');
    if (filterHouseNumber && !availableHouseNumbers.includes(filterHouseNumber)) setFilterHouseNumber('');
  }, [filterVillage, availableCollectors, availableHouseNumbers]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchVillage = !filterVillage || r.village === filterVillage;
      const matchCollector = !filterCollector || r.collectorName === filterCollector;
      const matchHouseNumber = !filterHouseNumber || r.houseNumber === filterHouseNumber;
      return matchVillage && matchCollector && matchHouseNumber;
    });
  }, [records, filterVillage, filterCollector, filterHouseNumber]);

  const groupedRecords = useMemo(() => {
    return filteredRecords.reduce((acc, record) => {
      if (!acc[record.village]) acc[record.village] = [];
      acc[record.village].push(record);
      return acc;
    }, {} as Record<string, HouseholdRecord[]>);
  }, [filteredRecords]);

  const chartData = useMemo(() => {
    return VILLAGES.map(v => ({
      name: v.replace('หมู่ที่ ', 'ม.'),
      count: records.filter(r => r.village === v).length
    }));
  }, [records]);

  const incompleteRecords = useMemo(() => {
    return records.filter(r => !r.latitude || !r.longitude || !r.houseRegistrationNumber || r.houseRegistrationNumber.trim() === '');
  }, [records]);

  const groupedIncompleteRecords = useMemo(() => {
    return incompleteRecords.reduce((acc, record) => {
      if (!acc[record.village]) acc[record.village] = [];
      acc[record.village].push(record);
      return acc;
    }, {} as Record<string, HouseholdRecord[]>);
  }, [incompleteRecords]);

  return (
    <div className="min-h-screen bg-[#FDFCF8] font-sans text-[#2D302E]">
      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={modal.onConfirm}
      />

      {/* Header */}
      <header className="bg-white border-b border-[#E6E4DD] shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#5C7F67] flex items-center justify-center text-white shrink-0">
                <Map className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold leading-tight text-[#3A4D3F]">พิกัดหลังคาเรือน</h1>
                <p className="text-[10px] sm:text-xs text-[#7A7E74] uppercase tracking-wider">อสม. รพ.สต.ละงู</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-start w-full sm:w-auto">
            <button 
              onClick={() => setIsConfiguring(!isConfiguring)} 
              className="w-full sm:w-auto px-4 py-2 bg-white border border-[#5C7F67] text-[#5C7F67] rounded-full text-[11px] font-bold hover:bg-[#F4F5F0] transition-colors uppercase tracking-wider shadow-sm flex justify-center items-center gap-2"
            >
              ตั้งค่าฐานข้อมูล (GAS)
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex border-t border-[#E6E4DD] overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('form')}
            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'form' ? 'bg-[#F9F9F5] text-[#5C7F67] border-b-2 border-[#5C7F67]' : 'bg-white text-[#7A7E74] hover:bg-[#F9F9F5]'}`}
          >
            บันทึกข้อมูล
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors flex justify-center items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-[#F9F9F5] text-[#5C7F67] border-b-2 border-[#5C7F67]' : 'bg-white text-[#7A7E74] hover:bg-[#F9F9F5]'}`}
          >
            รายการที่บันทึก
            <span className="bg-[#5C7F67] text-white text-[10px] py-0.5 px-2 rounded-full">{records.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('incomplete')}
            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors flex justify-center items-center gap-2 whitespace-nowrap ${activeTab === 'incomplete' ? 'bg-[#F9F9F5] text-[#E07A5F] border-b-2 border-[#E07A5F]' : 'bg-white text-[#7A7E74] hover:bg-[#F9F9F5]'}`}
          >
            ต้องติดตาม
            {incompleteRecords.length > 0 && (
              <span className="bg-[#E07A5F] text-white text-[10px] py-0.5 px-2 rounded-full">{incompleteRecords.length}</span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        
        {isConfiguring && (
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD] mb-6">
            <h2 className="text-lg font-bold text-[#3A4D3F] mb-4">การตั้งค่า Google Apps Script Web App URL</h2>
            <p className="text-sm text-[#7A7E74] mb-4">
              กรุณานำ Web App URL ที่ได้จากการ Deploy สคริปต์ใน Google Sheets มาใส่ในช่องด้านล่าง
            </p>
            <input 
              type="text" 
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow mb-4 font-mono text-[12px]"
            />
            <button 
              onClick={() => {
                if(gasUrl) {
                  setIsConfiguring(false);
                  loadData();
                } else {
                  showAlert('แจ้งเตือน', 'กรุณากรอก Web App URL ก่อน');
                }
              }}
              className="px-6 py-2 bg-[#5C7F67] text-white rounded-full text-[12px] font-bold hover:bg-[#4A6753]"
            >
              บันทึกและเชื่อมต่อ
            </button>
          </div>
        )}

        {activeTab === 'form' ? (
          /* Form Section */
          <div className="bg-white rounded-[2rem] shadow-sm border border-[#E6E4DD] overflow-hidden relative">
            {isSyncing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#5C7F67] animate-spin" />
              </div>
            )}
            <div className="px-6 py-5 border-b border-[#E6E4DD]">
              <h2 className="text-xl font-bold text-[#3A4D3F] flex items-center gap-2">
                <span className="w-2 h-6 bg-[#A3B18A] rounded-full"></span>
                บันทึกข้อมูลใหม่
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="space-y-5">
                <div>
                  <label htmlFor="village" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">หมู่บ้าน <span className="text-red-500">*</span></label>
                  <select
                    id="village"
                    name="village"
                    value={formData.village || ''}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                  >
                    {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="houseNumber" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">บ้านเลขที่ <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      id="houseNumber"
                      name="houseNumber"
                      value={formData.houseNumber || ''}
                      onChange={handleInputChange}
                      placeholder="เช่น 123/4"
                      required
                      className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                    />
                  </div>
                  <div>
                    <label htmlFor="houseRegistrationNumber" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">เลขทะเบียนบ้าน</label>
                    <input
                      type="text"
                      id="houseRegistrationNumber"
                      name="houseRegistrationNumber"
                      value={formData.houseRegistrationNumber || ''}
                      onChange={handleInputChange}
                      placeholder="เช่น 1234-567890-1"
                      className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="headOfHousehold" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">ชื่อ-สกุล เจ้าบ้าน <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-[#A3A69F]" />
                  </div>
                  <input
                    type="text"
                    id="headOfHousehold"
                    name="headOfHousehold"
                    value={formData.headOfHousehold || ''}
                    onChange={handleInputChange}
                    placeholder="นาย/นาง/นางสาว..."
                    required
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="memberCount" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">จำนวนสมาชิกในบ้าน (คน)</label>
                <input
                  type="number"
                  id="memberCount"
                  name="memberCount"
                  min="0"
                  value={formData.memberCount}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="collectorName" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">อสม.ที่รับผิดชอบ / ผู้เก็บข้อมูล <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-[#A3A69F]" />
                  </div>
                  <input
                    type="text"
                    id="collectorName"
                    name="collectorName"
                    list="collector-list"
                    value={formData.collectorName || ''}
                    onChange={handleInputChange}
                    placeholder="ชื่อผู้เก็บข้อมูล"
                    required
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                  />
                  <datalist id="collector-list">
                    {formAvailableCollectors.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Geolocation Section */}
              <div className="bg-[#F4F5F0] rounded-2xl p-4 border border-dashed border-[#A3B18A]">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-[#5C7F67] uppercase">พิกัดปัจจุบัน (GPS) <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={isLocating}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-[10px] font-bold rounded-full shadow-sm text-white bg-[#5C7F67] hover:bg-[#4A6753] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5C7F67] disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider"
                  >
                    {isLocating ? (
                      <>
                        <div className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white border-2 border-t-transparent border-white rounded-full"></div>
                        AUTOMATIC...
                      </>
                    ) : (
                      <>
                        AUTOMATIC
                      </>
                    )}
                  </button>
                </div>
                
                {locationError && (
                  <div className="mb-3 flex items-start gap-2 text-[11px] font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{locationError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="latitude" className="block text-[10px] font-bold text-[#7A7E74] uppercase mb-1">ละติจูด (Lat)</label>
                    <input
                      type="number"
                      step="any"
                      id="latitude"
                      name="latitude"
                      value={formData.latitude === undefined || formData.latitude === null ? '' : formData.latitude}
                      onChange={handleInputChange}
                      placeholder="เช่น 13.7563"
                      className="w-full bg-white border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-[13px] text-[#3A4D3F] font-mono shadow-sm focus:outline-none focus:border-[#5C7F67]"
                    />
                  </div>
                  <div>
                    <label htmlFor="longitude" className="block text-[10px] font-bold text-[#7A7E74] uppercase mb-1">ลองจิจูด (Lng)</label>
                    <input
                      type="number"
                      step="any"
                      id="longitude"
                      name="longitude"
                      value={formData.longitude === undefined || formData.longitude === null ? '' : formData.longitude}
                      onChange={handleInputChange}
                      placeholder="เช่น 100.5018"
                      className="w-full bg-white border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-[13px] text-[#3A4D3F] font-mono shadow-sm focus:outline-none focus:border-[#5C7F67]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-[11px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">บันทึกสุขภาพ / การเฝ้าระวัง (ถ้ามี)</label>
                <div className="relative">
                  <div className="absolute top-3.5 left-4 flex items-start pointer-events-none">
                    <FileText className="h-4 w-4 text-[#A3A69F]" />
                  </div>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    value={formData.notes || ''}
                    onChange={handleInputChange}
                    placeholder="ระบุสถานะสุขภาพ เช่น มีผู้ป่วยติดเตียง..."
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSyncing}
                    className="w-full sm:w-1/3 bg-[#F4F5F0] text-[#7A7E74] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#E6E4DD] transition-colors disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                    ยกเลิก
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!gasUrl || isSyncing}
                  className={`${editingId ? 'w-full sm:w-2/3' : 'w-full'} bg-[#5C7F67] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#5C7F67]/20 flex items-center justify-center gap-2 hover:bg-[#4A6753] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Save className="h-5 w-5" />
                  {editingId ? 'อัปเดตข้อมูลครัวเรือน' : 'บันทึกข้อมูลครัวเรือน'}
                </button>
              </div>
            </form>
          </div>
        ) : activeTab === 'list' ? (
          /* List Section */
          <div className="space-y-6 relative">
            {isSyncing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-[2rem]">
                <Loader2 className="w-8 h-8 text-[#5C7F67] animate-spin" />
              </div>
            )}

            {/* Dashboard / Charts */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <h2 className="text-lg font-bold text-[#3A4D3F] mb-6 flex items-center gap-2">
                <BarChartIcon className="h-5 w-5 text-[#5C7F67]" />
                ผลการดำเนินงานแยกรายหมู่บ้าน
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E4DD" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7A7E74' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#7A7E74' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: '#F4F5F0' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E6E4DD', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" name="จำนวน (หลังคาเรือน)" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#5C7F67' : '#D6D3C9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Map Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <h2 className="text-lg font-bold text-[#3A4D3F] mb-4 flex items-center gap-2">
                <Map className="h-5 w-5 text-[#5C7F67]" />
                แผนที่พิกัดหลังคาเรือน
              </h2>
              <MapModule records={filteredRecords} />
            </div>

            {/* Filters Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-bold text-[#3A4D3F] flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#5C7F67]" />
                  ตัวกรองข้อมูล
                </h2>
                <button
                  onClick={() => {
                    setFilterVillage('');
                    setFilterCollector('');
                    setFilterHouseNumber('');
                  }}
                  className="text-[11px] text-[#7A7E74] hover:text-[#5C7F67] font-bold underline"
                >
                  ล้างตัวกรอง
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">หมู่บ้าน</label>
                  <select
                    value={filterVillage}
                    onChange={(e) => setFilterVillage(e.target.value)}
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                  >
                    <option value="">ทั้งหมด</option>
                    {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">อสม.ที่รับผิดชอบ</label>
                  <select
                    value={filterCollector}
                    onChange={(e) => setFilterCollector(e.target.value)}
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow disabled:opacity-50"
                    disabled={availableCollectors.length === 0}
                  >
                    <option value="">ทั้งหมด</option>
                    {availableCollectors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">บ้านเลขที่</label>
                  <select
                    value={filterHouseNumber}
                    onChange={(e) => setFilterHouseNumber(e.target.value)}
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow disabled:opacity-50"
                    disabled={availableHouseNumbers.length === 0}
                  >
                    <option value="">ทั้งหมด</option>
                    {availableHouseNumbers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <h2 className="text-lg font-bold text-[#3A4D3F] flex items-center gap-2">
                <span className="w-2 h-6 bg-[#A3B18A] rounded-full"></span>
                ข้อมูลที่ค้นพบ ({filteredRecords.length})
              </h2>
              <button
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
                className="inline-flex items-center px-4 py-2 bg-white border border-[#5C7F67] text-[#5C7F67] rounded-full text-[11px] font-bold hover:bg-[#F4F5F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider shadow-sm"
              >
                <Download className="-ml-0.5 mr-1.5 h-3.5 w-3.5" />
                Export CSV (ที่กรอง)
              </button>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-[2rem] shadow-sm border border-[#E6E4DD] p-12 text-center text-[#7A7E74]">
                <MapPin className="mx-auto h-12 w-12 text-[#D6D3C9] mb-4" />
                <p className="font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.keys(groupedRecords).sort().map(village => (
                  <div key={village} className="space-y-3">
                    <h3 className="text-[14px] font-bold text-[#5C7F67] px-2 flex items-center gap-2">
                      {village} 
                      <span className="bg-[#A3B18A]/20 text-[#3A4D3F] px-2 py-0.5 rounded-full text-[11px]">
                        {groupedRecords[village].length} หลัง
                      </span>
                    </h3>
                    {groupedRecords[village].map((record, idx) => (
                      <div key={record.id} className="flex flex-col bg-white rounded-2xl border border-[#E6E4DD] p-5 hover:shadow-sm transition-all relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-[15px] font-bold text-[#3A4D3F]">บ้านเลขที่ {record.houseNumber}</h3>
                            {record.houseRegistrationNumber && (
                              <p className="text-[#7A7E74] text-[13px] font-medium mt-1">เลขทะเบียน: <span className="text-[#3A4D3F]">{record.houseRegistrationNumber}</span></p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleShareLocation(record)}
                              className="text-[#5C7F67] hover:text-[#4A6753] p-2 rounded-xl hover:bg-[#5C7F67]/10 transition-colors"
                              title="แชร์พิกัด"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(record)}
                              className="text-[#5C7F67] hover:text-[#4A6753] p-2 rounded-xl hover:bg-[#5C7F67]/10 transition-colors"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteRecord(record)}
                              className="text-[#7A7E74] hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors"
                              title="ลบข้อมูล"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-[13px] text-[#7A7E74] mt-2">
                          <p><span className="text-[#A3A69F] font-medium text-[11px] uppercase tracking-wider mr-1">เจ้าบ้าน:</span> {record.headOfHousehold}</p>
                          <p><span className="text-[#A3A69F] font-medium text-[11px] uppercase tracking-wider mr-1">สมาชิก:</span> <span className="font-medium text-[#3A4D3F]">{record.memberCount}</span> คน</p>
                          {record.collectorName && (
                            <p className="sm:col-span-2"><span className="text-[#A3A69F] font-medium text-[11px] uppercase tracking-wider mr-1">อสม./ผู้เก็บข้อมูล:</span> <span className="text-[#3A4D3F]">{record.collectorName}</span></p>
                          )}
                          <div className="sm:col-span-2 flex items-center gap-2 mt-2 text-[11px] font-mono bg-[#F9F9F5] p-2.5 rounded-xl border border-[#E6E4DD]">
                            <div className="bg-[#A3B18A]/20 p-1 rounded-md text-[#5C7F67]">
                              <MapPin className="h-3 w-3 shrink-0" />
                            </div>
                            <span className="text-[#3A4D3F] break-all">{record.latitude?.toFixed(6)}, {record.longitude?.toFixed(6)}</span>
                          </div>
                          {record.notes && (
                            <p className="sm:col-span-2 mt-2 text-[12px] text-[#5C7F67] bg-[#F4F5F0] p-3 rounded-xl border border-dashed border-[#A3B18A] flex items-start gap-2 leading-relaxed">
                              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {record.notes}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 pt-3 border-t border-[#E6E4DD] flex justify-between items-center text-[10px] text-[#A3A69F] font-medium">
                          <span className="uppercase">Record #{records.length - records.indexOf(record)}</span>
                          <span>บันทึกเมื่อ: {new Date(record.timestamp).toLocaleString('th-TH')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Incomplete Records Section */
          <div className="space-y-6 relative">
            {isSyncing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-[2rem]">
                <Loader2 className="w-8 h-8 text-[#5C7F67] animate-spin" />
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD] gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#E07A5F] flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  รายชื่อบ้านที่ต้องติดตามข้อมูล
                </h2>
                <p className="text-[#7A7E74] text-xs mt-1">บ้านที่ยังขาดพิกัด GPS หรือ ขาดเลขทะเบียนบ้าน</p>
              </div>
              <div className="bg-[#FDFCF8] border border-[#E07A5F]/30 text-[#E07A5F] font-bold px-4 py-2 rounded-xl text-sm">
                ต้องติดตามทั้งหมด {incompleteRecords.length} หลัง
              </div>
            </div>

            {incompleteRecords.length === 0 ? (
              <div className="bg-white rounded-[2rem] shadow-sm border border-[#E6E4DD] p-12 text-center text-[#7A7E74]">
                <div className="mx-auto h-16 w-16 bg-[#5C7F67]/10 rounded-full flex items-center justify-center mb-4">
                  <Save className="h-8 w-8 text-[#5C7F67]" />
                </div>
                <p className="font-medium text-[#3A4D3F]">ยอดเยี่ยม!</p>
                <p className="text-sm mt-1">ข้อมูลทุกหลังคาเรือนสมบูรณ์ครบถ้วนแล้ว</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.keys(groupedIncompleteRecords).sort().map(village => (
                  <div key={village} className="space-y-3">
                    <h3 className="text-[14px] font-bold text-[#E07A5F] px-2 flex items-center gap-2">
                      {village} 
                      <span className="bg-[#E07A5F]/10 text-[#E07A5F] px-2 py-0.5 rounded-full text-[11px]">
                        {groupedIncompleteRecords[village].length} หลัง
                      </span>
                    </h3>
                    {groupedIncompleteRecords[village].map((record) => (
                      <div key={record.id} className="flex flex-col bg-white rounded-2xl border border-[#E6E4DD] p-5 hover:border-[#E07A5F]/50 transition-all relative overflow-hidden group shadow-sm">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="text-[16px] font-bold text-[#3A4D3F]">บ้านเลขที่ {record.houseNumber}</h3>
                            <p className="text-[#7A7E74] text-[13px] font-medium mt-1"><span className="text-[#A3A69F]">เจ้าบ้าน:</span> {record.headOfHousehold}</p>
                            {record.collectorName && (
                              <p className="text-[#7A7E74] text-[13px] font-medium"><span className="text-[#A3A69F]">อสม.ผู้รับผิดชอบ:</span> <span className="text-[#3A4D3F]">{record.collectorName}</span></p>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                            {(!record.latitude || !record.longitude) && (
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-lg text-[11px] font-bold">
                                <MapPin className="h-3 w-3" /> ขาดพิกัด GPS
                              </span>
                            )}
                            {(!record.houseRegistrationNumber || record.houseRegistrationNumber.trim() === '') && (
                              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-lg text-[11px] font-bold">
                                <FileText className="h-3 w-3" /> ขาดเลขทะเบียนบ้าน
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-[#E6E4DD]">
                          <button
                            onClick={() => handleEdit(record)}
                            className="w-full flex items-center justify-center gap-2 bg-[#F9F9F5] hover:bg-[#5C7F67] text-[#5C7F67] hover:text-white border border-[#E6E4DD] hover:border-[#5C7F67] py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                            อัปเดตข้อมูล
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

