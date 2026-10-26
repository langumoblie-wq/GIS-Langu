import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Save, Download, Trash2, Home, Users, FileText, AlertCircle, Map, Navigation, Loader2, Edit2, X, BarChart as BarChartIcon, Filter, AlertTriangle, Share2, UserCheck, Plus, Minus, Heart, Activity, Baby, ShieldAlert, Settings, Database, Accessibility } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { HouseholdRecord, VILLAGES } from './types';
import { fetchRecordsFromGAS, addRecordToGAS, deleteRecordFromGAS, updateRecordInGAS } from './gas';
import { Modal } from './components/Modal';
import { MapModule } from './components/MapModule';
import { CollectorWorkloadChart } from './components/CollectorWorkloadChart';

export default function App() {
  const [records, setRecords] = useState<HouseholdRecord[]>([]);
  const [formData, setFormData] = useState<Partial<HouseholdRecord>>({
    village: VILLAGES[0],
    houseRegistrationNumber: '',
    memberCount: '',
    collectorName: '',
    bedriddenCount: 0,
    pregnantOver36WeeksCount: 0,
    elderlyCount: 0,
    diabetesCount: 0,
    hypertensionCount: 0,
    disabledCount: 0,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'incomplete'>('form');

  const [isSyncing, setIsSyncing] = useState(false);
  const [gasUrl, setGasUrl] = useState((import.meta as any).env?.VITE_GAS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbxCGURRM4ltH4rvZDKNTZ6bOZOwCfZgU_U1ozFr_QRFLDw6I6NK-jfZ6r1E0IlUVA/exec');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterVillage, setFilterVillage] = useState<string>('');
  const [filterCollector, setFilterCollector] = useState<string>('');
  const [filterHouseNumber, setFilterHouseNumber] = useState<string>('');
  const [filterVulnerable, setFilterVulnerable] = useState<string>('');

  // Dashboard chart tab view
  const [chartView, setChartView] = useState<'collector' | 'village' | 'both'>('collector');

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
      bedriddenCount: Math.max(0, Number(formData.bedriddenCount) || 0),
      pregnantOver36WeeksCount: Math.max(0, Number(formData.pregnantOver36WeeksCount) || 0),
      elderlyCount: Math.max(0, Number(formData.elderlyCount) || 0),
      diabetesCount: Math.max(0, Number(formData.diabetesCount) || 0),
      hypertensionCount: Math.max(0, Number(formData.hypertensionCount) || 0),
      disabledCount: Math.max(0, Number(formData.disabledCount) || 0),
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
        bedriddenCount: 0,
        pregnantOver36WeeksCount: 0,
        elderlyCount: 0,
        diabetesCount: 0,
        hypertensionCount: 0,
        disabledCount: 0,
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
      bedriddenCount: record.bedriddenCount || 0,
      pregnantOver36WeeksCount: record.pregnantOver36WeeksCount || 0,
      elderlyCount: record.elderlyCount || 0,
      diabetesCount: record.diabetesCount || 0,
      hypertensionCount: record.hypertensionCount || 0,
      disabledCount: record.disabledCount || 0,
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
      bedriddenCount: 0,
      pregnantOver36WeeksCount: 0,
      elderlyCount: 0,
      diabetesCount: 0,
      hypertensionCount: 0,
      disabledCount: 0,
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

    const headers = [
      'ลำดับ',
      'วันที่บันทึก',
      'หมู่บ้าน',
      'บ้านเลขที่',
      'เลขทะเบียนบ้าน',
      'ชื่อเจ้าบ้าน',
      'จำนวนสมาชิก',
      'ผู้ป่วยติดเตียง',
      'หญิงตั้งครรภ์>36สัปดาห์',
      'ผู้สูงอายุ',
      'เบาหวาน (NCDs)',
      'ความดันโลหิตสูง (NCDs)',
      'ผู้พิการ',
      'ละติจูด (Lat)',
      'ลองจิจูด (Lng)',
      'อสม./ผู้เก็บข้อมูล',
      'หมายเหตุ'
    ];
    
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
          r.bedriddenCount || 0,
          r.pregnantOver36WeeksCount || 0,
          r.elderlyCount || 0,
          r.diabetesCount || 0,
          r.hypertensionCount || 0,
          r.disabledCount || 0,
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

  const exportToJSON = () => {
    if (records.length === 0) {
      showAlert('แจ้งเตือน', 'ไม่มีข้อมูลสำหรับสำรอง');
      return;
    }

    const backupData = {
      appName: 'ระบบบันทึกพิกัดหลังคาเรือน รพ.สต.ละงู',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedAtThai: new Date().toLocaleString('th-TH'),
      totalRecords: records.length,
      records: records,
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ข้อมูลสำรอง_รพสต_ละงู_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('สำเร็จ', `ดาวน์โหลดไฟล์สำรองข้อมูล (${records.length} หลังคาเรือน) เรียบร้อยแล้ว`, 'success');
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
    const houses = new Set<string>(records
      .filter(r => !filterVillage || r.village === filterVillage)
      .map(r => r.houseNumber)
      .filter(Boolean)
    );
    return Array.from(houses).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
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
    if (filterCollector && filterCollector !== '__UNASSIGNED__' && !availableCollectors.includes(filterCollector)) {
      setFilterCollector('');
    }
    if (filterHouseNumber && !availableHouseNumbers.includes(filterHouseNumber)) {
      setFilterHouseNumber('');
    }
  }, [filterVillage, availableCollectors, availableHouseNumbers, filterCollector, filterHouseNumber]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchVillage = !filterVillage || r.village === filterVillage;
      let matchCollector = true;
      if (filterCollector === '__UNASSIGNED__') {
        matchCollector = !r.collectorName || r.collectorName.trim() === '';
      } else if (filterCollector) {
        matchCollector = r.collectorName === filterCollector;
      }
      const matchHouseNumber = !filterHouseNumber || r.houseNumber === filterHouseNumber;

      let matchVulnerable = true;
      if (filterVulnerable === 'ANY') {
        matchVulnerable = Boolean(
          (r.bedriddenCount && r.bedriddenCount > 0) ||
          (r.pregnantOver36WeeksCount && r.pregnantOver36WeeksCount > 0) ||
          (r.elderlyCount && r.elderlyCount > 0) ||
          (r.diabetesCount && r.diabetesCount > 0) ||
          (r.hypertensionCount && r.hypertensionCount > 0) ||
          (r.disabledCount && r.disabledCount > 0)
        );
      } else if (filterVulnerable === 'BEDRIDDEN') {
        matchVulnerable = Boolean(r.bedriddenCount && r.bedriddenCount > 0);
      } else if (filterVulnerable === 'PREGNANT') {
        matchVulnerable = Boolean(r.pregnantOver36WeeksCount && r.pregnantOver36WeeksCount > 0);
      } else if (filterVulnerable === 'ELDERLY') {
        matchVulnerable = Boolean(r.elderlyCount && r.elderlyCount > 0);
      } else if (filterVulnerable === 'DIABETES') {
        matchVulnerable = Boolean(r.diabetesCount && r.diabetesCount > 0);
      } else if (filterVulnerable === 'HYPERTENSION') {
        matchVulnerable = Boolean(r.hypertensionCount && r.hypertensionCount > 0);
      } else if (filterVulnerable === 'DISABLED') {
        matchVulnerable = Boolean(r.disabledCount && r.disabledCount > 0);
      }

      return matchVillage && matchCollector && matchHouseNumber && matchVulnerable;
    });
  }, [records, filterVillage, filterCollector, filterHouseNumber, filterVulnerable]);

  const vulnerableStats = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      acc.bedridden += r.bedriddenCount || 0;
      acc.pregnant += r.pregnantOver36WeeksCount || 0;
      acc.elderly += r.elderlyCount || 0;
      acc.diabetes += r.diabetesCount || 0;
      acc.hypertension += r.hypertensionCount || 0;
      acc.disabled += r.disabledCount || 0;
      if (
        (r.bedriddenCount && r.bedriddenCount > 0) ||
        (r.pregnantOver36WeeksCount && r.pregnantOver36WeeksCount > 0) ||
        (r.elderlyCount && r.elderlyCount > 0) ||
        (r.diabetesCount && r.diabetesCount > 0) ||
        (r.hypertensionCount && r.hypertensionCount > 0) ||
        (r.disabledCount && r.disabledCount > 0)
      ) {
        acc.totalHouseholds += 1;
      }
      return acc;
    }, { bedridden: 0, pregnant: 0, elderly: 0, diabetes: 0, hypertension: 0, disabled: 0, totalHouseholds: 0 });
  }, [filteredRecords]);

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
              className={`w-full sm:w-auto px-4 py-2 border rounded-full text-[11px] font-bold transition-colors uppercase tracking-wider shadow-sm flex justify-center items-center gap-2 ${
                isConfiguring 
                  ? 'bg-[#5C7F67] text-white border-[#5C7F67]' 
                  : 'bg-white border-[#5C7F67] text-[#5C7F67] hover:bg-[#F4F5F0]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              ตั้งค่า / สำรองข้อมูล
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
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD] mb-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
              <h2 className="text-lg font-bold text-[#3A4D3F] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#5C7F67]" />
                ตั้งค่าระบบและสำรองข้อมูล
              </h2>
              <button
                onClick={() => setIsConfiguring(false)}
                className="text-xs text-[#7A7E74] hover:text-[#3A4D3F] p-1.5 rounded-full hover:bg-[#F9F9F5] transition-colors"
                title="ปิดหน้าต่างตั้งค่า"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Google Apps Script Connection */}
            <div>
              <h3 className="text-sm font-bold text-[#3A4D3F] mb-1 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#5C7F67]" />
                การเชื่อมต่อ Google Apps Script Web App URL
              </h3>
              <p className="text-xs text-[#7A7E74] mb-3">
                กรุณานำ Web App URL ที่ได้จากการ Deploy สคริปต์ใน Google Sheets มาใส่ในช่องด้านล่าง
              </p>
              <input 
                type="text" 
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#5C7F67] transition-shadow mb-3 font-mono"
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
                className="px-6 py-2.5 bg-[#5C7F67] text-white rounded-full text-xs font-bold hover:bg-[#4A6753] transition-colors shadow-sm"
              >
                บันทึกและเชื่อมต่อ
              </button>
            </div>

            {/* Data Backup Section */}
            <div className="border-t border-[#E6E4DD] pt-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-[#3A4D3F] flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#5C7F67]" />
                  สำรองข้อมูลดิบ (Backup Data)
                </h3>
                <span className="text-[11px] font-bold text-[#5C7F67] bg-[#F4F5F0] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  {records.length > 0 ? `พร้อมสำรอง ${records.length} หลังคาเรือน` : 'ยังไม่มีข้อมูลในระบบ'}
                </span>
              </div>
              <p className="text-xs text-[#7A7E74] mb-4 leading-relaxed">
                อสม. และเจ้าหน้าที่สามารถดาวน์โหลดสำเนาข้อมูลดิบทั้งหมดของ รพ.สต.ละงู เป็นไฟล์ JSON เก็บไว้ในอุปกรณ์ เพื่อความปลอดภัย ป้องกันข้อมูลสูญหาย และสามารถใช้เป็นไฟล์สำรองฉุกเฉินได้ตลอดเวลา
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={exportToJSON}
                  disabled={records.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3A4D3F] hover:bg-[#2D3C31] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลดไฟล์สำรองข้อมูล (JSON)
                </button>
                {records.length > 0 && (
                  <span className="text-[11px] text-[#7A7E74]">
                    ขนาดสำรอง: {records.length} รายการ (JSON format)
                  </span>
                )}
              </div>
            </div>
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

              {/* กลุ่มเปราะบางในครัวเรือน */}
              <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E6E4DD]">
                  <div>
                    <h3 className="text-sm font-bold text-[#3A4D3F] flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-[#E07A5F]" />
                      ข้อมูลกลุ่มเปราะบางในครัวเรือน
                    </h3>
                    <p className="text-[11px] text-[#7A7E74] mt-0.5">ระบุจำนวนคนในแต่ละกลุ่ม (กดปุ่ม + / - หรือกรอกตัวเลข หากไม่มีให้เป็น 0)</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {/* 1. ผู้ป่วยติดเตียง */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                    <div className="flex items-center gap-3 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#3A4D3F] block">1. ผู้ป่วยติดเตียง</span>
                        <span className="text-[10px] text-[#7A7E74]">ผู้ป่วยช่วยเหลือตนเองไม่ได้</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, bedriddenCount: Math.max(0, (Number(prev.bedriddenCount) || 0) - 1) }))}
                        disabled={!formData.bedriddenCount || Number(formData.bedriddenCount) <= 0}
                        className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                        title="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        id="bedriddenCount"
                        name="bedriddenCount"
                        value={formData.bedriddenCount ? formData.bedriddenCount : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFormData(prev => ({ ...prev, bedriddenCount: val }));
                        }}
                        placeholder="0"
                        className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, bedriddenCount: (Number(prev.bedriddenCount) || 0) + 1 }))}
                        className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                        title="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 2. หญิงตั้งครรภ์ อายุครรภ์มากกว่า 36 สัปดาห์ */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                    <div className="flex items-center gap-3 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                        <Baby className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#3A4D3F] block">2. หญิงตั้งครรภ์ (อายุครรภ์ &gt; 36 สัปดาห์)</span>
                        <span className="text-[10px] text-[#7A7E74]">ระยะใกล้คลอด เฝ้าระวังส่งต่อคลอด</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, pregnantOver36WeeksCount: Math.max(0, (Number(prev.pregnantOver36WeeksCount) || 0) - 1) }))}
                        disabled={!formData.pregnantOver36WeeksCount || Number(formData.pregnantOver36WeeksCount) <= 0}
                        className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                        title="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        id="pregnantOver36WeeksCount"
                        name="pregnantOver36WeeksCount"
                        value={formData.pregnantOver36WeeksCount ? formData.pregnantOver36WeeksCount : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFormData(prev => ({ ...prev, pregnantOver36WeeksCount: val }));
                        }}
                        placeholder="0"
                        className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, pregnantOver36WeeksCount: (Number(prev.pregnantOver36WeeksCount) || 0) + 1 }))}
                        className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                        title="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3. ผู้สูงอายุ */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                    <div className="flex items-center gap-3 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#3A4D3F] block">3. ผู้สูงอายุ</span>
                        <span className="text-[10px] text-[#7A7E74]">อายุ 60 ปีขึ้นไป</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, elderlyCount: Math.max(0, (Number(prev.elderlyCount) || 0) - 1) }))}
                        disabled={!formData.elderlyCount || Number(formData.elderlyCount) <= 0}
                        className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                        title="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        id="elderlyCount"
                        name="elderlyCount"
                        value={formData.elderlyCount ? formData.elderlyCount : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFormData(prev => ({ ...prev, elderlyCount: val }));
                        }}
                        placeholder="0"
                        className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, elderlyCount: (Number(prev.elderlyCount) || 0) + 1 }))}
                        className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                        title="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4. ผู้ป่วยโรคไม่ติดต่อเรื้อรัง (NCDs) */}
                  <div className="pt-2">
                    <p className="text-[11px] font-bold text-[#5C7F67] uppercase tracking-wider mb-2 ml-1 flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-[#5C7F67]" />
                      4. ผู้ป่วยโรคไม่ติดต่อเรื้อรัง (NCDs)
                    </p>
                    <div className="space-y-2">
                      {/* โรคเบาหวาน */}
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                        <div className="flex items-center gap-3 pr-2">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Heart className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#3A4D3F] block">โรคเบาหวาน (DM)</span>
                            <span className="text-[10px] text-[#7A7E74]">ผู้ป่วยเบาหวานในครัวเรือน</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, diabetesCount: Math.max(0, (Number(prev.diabetesCount) || 0) - 1) }))}
                            disabled={!formData.diabetesCount || Number(formData.diabetesCount) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                            title="ลดจำนวน"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            id="diabetesCount"
                            name="diabetesCount"
                            value={formData.diabetesCount ? formData.diabetesCount : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                              setFormData(prev => ({ ...prev, diabetesCount: val }));
                            }}
                            placeholder="0"
                            className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, diabetesCount: (Number(prev.diabetesCount) || 0) + 1 }))}
                            className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                            title="เพิ่มจำนวน"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* โรคความดันโลหิตสูง */}
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                        <div className="flex items-center gap-3 pr-2">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#3A4D3F] block">โรคความดันโลหิตสูง (HT)</span>
                            <span className="text-[10px] text-[#7A7E74]">ผู้ป่วยความดันโลหิตสูงในครัวเรือน</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, hypertensionCount: Math.max(0, (Number(prev.hypertensionCount) || 0) - 1) }))}
                            disabled={!formData.hypertensionCount || Number(formData.hypertensionCount) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                            title="ลดจำนวน"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            id="hypertensionCount"
                            name="hypertensionCount"
                            value={formData.hypertensionCount ? formData.hypertensionCount : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                              setFormData(prev => ({ ...prev, hypertensionCount: val }));
                            }}
                            placeholder="0"
                            className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, hypertensionCount: (Number(prev.hypertensionCount) || 0) + 1 }))}
                            className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                            title="เพิ่มจำนวน"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. ผู้พิการ */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6E4DD] hover:border-[#5C7F67]/50 transition-colors">
                    <div className="flex items-center gap-3 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Accessibility className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#3A4D3F] block">5. ผู้พิการ</span>
                        <span className="text-[10px] text-[#7A7E74]">ผู้มีความบกพร่องทางการเคลื่อนไหว ร่างกาย หรือการสื่อสาร</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, disabledCount: Math.max(0, (Number(prev.disabledCount) || 0) - 1) }))}
                        disabled={!formData.disabledCount || Number(formData.disabledCount) <= 0}
                        className="w-8 h-8 rounded-lg bg-[#F4F5F0] hover:bg-[#E6E4DD] disabled:opacity-30 disabled:hover:bg-[#F4F5F0] flex items-center justify-center text-[#3A4D3F] font-bold text-sm transition-colors"
                        title="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        id="disabledCount"
                        name="disabledCount"
                        value={formData.disabledCount ? formData.disabledCount : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFormData(prev => ({ ...prev, disabledCount: val }));
                        }}
                        placeholder="0"
                        className="w-12 h-8 text-center bg-[#F9F9F5] border border-[#E6E4DD] rounded-lg text-xs font-bold text-[#3A4D3F] focus:outline-none focus:border-[#5C7F67]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, disabledCount: (Number(prev.disabledCount) || 0) + 1 }))}
                        className="w-8 h-8 rounded-lg bg-[#5C7F67] hover:bg-[#4A6753] text-white flex items-center justify-center font-bold text-sm transition-colors shadow-xs"
                        title="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
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

            {/* Dashboard / Analytics View Selector */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#E6E4DD] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 px-1">
                <BarChartIcon className="h-4 w-4 text-[#5C7F67]" />
                <span className="text-xs font-bold text-[#3A4D3F]">แผนภูมิและสถิติ:</span>
              </div>
              <div className="inline-flex bg-[#F4F5F0] p-1 rounded-xl border border-[#E6E4DD] self-stretch sm:self-auto justify-center">
                <button
                  type="button"
                  onClick={() => setChartView('collector')}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    chartView === 'collector'
                      ? 'bg-white text-[#5C7F67] shadow-xs'
                      : 'text-[#7A7E74] hover:text-[#3A4D3F]'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  ภาระงาน อสม.
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('village')}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    chartView === 'village'
                      ? 'bg-white text-[#5C7F67] shadow-xs'
                      : 'text-[#7A7E74] hover:text-[#3A4D3F]'
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  แยกตามหมู่บ้าน
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('both')}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    chartView === 'both'
                      ? 'bg-white text-[#5C7F67] shadow-xs'
                      : 'text-[#7A7E74] hover:text-[#3A4D3F]'
                  }`}
                >
                  <BarChartIcon className="h-3.5 w-3.5" />
                  แสดงทั้ง 2 กราฟ
                </button>
              </div>
            </div>

            {/* Collector Workload Chart */}
            {(chartView === 'collector' || chartView === 'both') && (
              <CollectorWorkloadChart
                records={records}
                selectedCollector={filterCollector}
                onSelectCollector={(collectorName) => {
                  setFilterCollector(collectorName);
                  if (collectorName) {
                    const el = document.getElementById('records-list-section');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                selectedVillageFilter={filterVillage}
                onSelectVillageFilter={(village) => {
                  setFilterVillage(village);
                }}
              />
            )}

            {/* Village Distribution Chart */}
            {(chartView === 'village' || chartView === 'both') && (
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
            )}

            {/* Map Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <h2 className="text-lg font-bold text-[#3A4D3F] mb-4 flex items-center gap-2">
                <Map className="h-5 w-5 text-[#5C7F67]" />
                แผนที่พิกัดหลังคาเรือน
              </h2>
              <MapModule records={filteredRecords} />
            </div>

            {/* Filters Section */}
            <div id="records-list-section" className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
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
                    setFilterVulnerable('');
                  }}
                  className="text-[11px] text-[#7A7E74] hover:text-[#5C7F67] font-bold underline"
                >
                  ล้างตัวกรอง
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="__UNASSIGNED__">(ยังไม่ระบุ อสม.)</option>
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
                <div>
                  <label className="block text-[10px] font-bold text-[#7A7E74] uppercase ml-1 mb-1">กลุ่มเปราะบาง</label>
                  <select
                    value={filterVulnerable}
                    onChange={(e) => setFilterVulnerable(e.target.value)}
                    className="w-full bg-[#F9F9F5] border border-[#E6E4DD] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5C7F67] transition-shadow"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="ANY">มีกลุ่มเปราะบาง (ใดก็ได้)</option>
                    <option value="BEDRIDDEN">ผู้ป่วยติดเตียง</option>
                    <option value="PREGNANT">หญิงตั้งครรภ์ &gt; 36 สัปดาห์</option>
                    <option value="ELDERLY">ผู้สูงอายุ (60 ปีขึ้นไป)</option>
                    <option value="DIABETES">ผู้ป่วยโรคเบาหวาน</option>
                    <option value="HYPERTENSION">ผู้ป่วยโรคความดันโลหิตสูง</option>
                    <option value="DISABLED">ผู้พิการ</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Vulnerable Groups Summary Card */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-[#E6E4DD]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold text-[#3A4D3F] uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#E07A5F]" />
                  สรุปข้อมูลกลุ่มเปราะบาง
                </h3>
                <span className="text-[11px] font-bold text-[#5C7F67] bg-[#F4F5F0] px-2.5 py-1 rounded-full self-start sm:self-auto">
                  มีกลุ่มเปราะบาง {vulnerableStats.totalHouseholds} หลังคาเรือน
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="bg-rose-50/70 border border-rose-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> ผู้ป่วยติดเตียง
                  </p>
                  <p className="text-lg font-bold text-rose-900 mt-1">{vulnerableStats.bedridden} <span className="text-xs font-normal text-rose-700">คน</span></p>
                </div>
                <div className="bg-pink-50/70 border border-pink-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-pink-700 flex items-center gap-1">
                    <Baby className="h-3 w-3" /> หญิงครรภ์ &gt;36w
                  </p>
                  <p className="text-lg font-bold text-pink-900 mt-1">{vulnerableStats.pregnant} <span className="text-xs font-normal text-pink-700">คน</span></p>
                </div>
                <div className="bg-amber-50/70 border border-amber-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                    <Users className="h-3 w-3" /> ผู้สูงอายุ
                  </p>
                  <p className="text-lg font-bold text-amber-950 mt-1">{vulnerableStats.elderly} <span className="text-xs font-normal text-amber-800">คน</span></p>
                </div>
                <div className="bg-blue-50/70 border border-blue-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                    <Heart className="h-3 w-3" /> โรคเบาหวาน
                  </p>
                  <p className="text-lg font-bold text-blue-900 mt-1">{vulnerableStats.diabetes} <span className="text-xs font-normal text-blue-700">คน</span></p>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> ความดันโลหิตสูง
                  </p>
                  <p className="text-lg font-bold text-indigo-900 mt-1">{vulnerableStats.hypertension} <span className="text-xs font-normal text-indigo-700">คน</span></p>
                </div>
                <div className="bg-purple-50/70 border border-purple-100 p-2.5 rounded-xl">
                  <p className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                    <Accessibility className="h-3 w-3" /> ผู้พิการ
                  </p>
                  <p className="text-lg font-bold text-purple-900 mt-1">{vulnerableStats.disabled} <span className="text-xs font-normal text-purple-700">คน</span></p>
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
                          {Boolean(
                            (record.bedriddenCount && record.bedriddenCount > 0) ||
                            (record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) ||
                            (record.elderlyCount && record.elderlyCount > 0) ||
                            (record.diabetesCount && record.diabetesCount > 0) ||
                            (record.hypertensionCount && record.hypertensionCount > 0) ||
                            (record.disabledCount && record.disabledCount > 0)
                          ) && (
                            <div className="sm:col-span-2 pt-1 flex flex-wrap gap-1.5">
                              {Boolean(record.bedriddenCount && record.bedriddenCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Activity className="h-3 w-3 shrink-0" />
                                  ผู้ป่วยติดเตียง {record.bedriddenCount} คน
                                </span>
                              )}
                              {Boolean(record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Baby className="h-3 w-3 shrink-0" />
                                  หญิงครรภ์ &gt; 36w: {record.pregnantOver36WeeksCount} คน
                                </span>
                              )}
                              {Boolean(record.elderlyCount && record.elderlyCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Users className="h-3 w-3 shrink-0" />
                                  ผู้สูงอายุ {record.elderlyCount} คน
                                </span>
                              )}
                              {Boolean(record.diabetesCount && record.diabetesCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Heart className="h-3 w-3 shrink-0" />
                                  เบาหวาน {record.diabetesCount} คน
                                </span>
                              )}
                              {Boolean(record.hypertensionCount && record.hypertensionCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Activity className="h-3 w-3 shrink-0" />
                                  ความดันฯ {record.hypertensionCount} คน
                                </span>
                              )}
                              {Boolean(record.disabledCount && record.disabledCount > 0) && (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                  <Accessibility className="h-3 w-3 shrink-0" />
                                  ผู้พิการ {record.disabledCount} คน
                                </span>
                              )}
                            </div>
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
                            {Boolean(
                              (record.bedriddenCount && record.bedriddenCount > 0) ||
                              (record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) ||
                              (record.elderlyCount && record.elderlyCount > 0) ||
                              (record.diabetesCount && record.diabetesCount > 0) ||
                              (record.hypertensionCount && record.hypertensionCount > 0) ||
                              (record.disabledCount && record.disabledCount > 0)
                            ) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {Boolean(record.bedriddenCount && record.bedriddenCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Activity className="h-3 w-3 shrink-0" />
                                    ติดเตียง {record.bedriddenCount}
                                  </span>
                                )}
                                {Boolean(record.pregnantOver36WeeksCount && record.pregnantOver36WeeksCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Baby className="h-3 w-3 shrink-0" />
                                    หญิงครรภ์ &gt; 36w: {record.pregnantOver36WeeksCount}
                                  </span>
                                )}
                                {Boolean(record.elderlyCount && record.elderlyCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Users className="h-3 w-3 shrink-0" />
                                    สูงอายุ {record.elderlyCount}
                                  </span>
                                )}
                                {Boolean(record.diabetesCount && record.diabetesCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Heart className="h-3 w-3 shrink-0" />
                                    เบาหวาน {record.diabetesCount}
                                  </span>
                                )}
                                {Boolean(record.hypertensionCount && record.hypertensionCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Activity className="h-3 w-3 shrink-0" />
                                    ความดันฯ {record.hypertensionCount}
                                  </span>
                                )}
                                {Boolean(record.disabledCount && record.disabledCount > 0) && (
                                  <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <Accessibility className="h-3 w-3 shrink-0" />
                                    ผู้พิการ {record.disabledCount}
                                  </span>
                                )}
                              </div>
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

