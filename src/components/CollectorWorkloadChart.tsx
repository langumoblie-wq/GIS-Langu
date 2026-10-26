import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Filter, 
  ArrowUpDown, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  BarChart3, 
  LayoutList,
  Home,
  UserCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { HouseholdRecord, VILLAGES } from '../types';

interface CollectorWorkloadChartProps {
  records: HouseholdRecord[];
  selectedCollector: string;
  onSelectCollector: (collectorName: string) => void;
  selectedVillageFilter?: string;
  onSelectVillageFilter?: (village: string) => void;
}

export const CollectorWorkloadChart: React.FC<CollectorWorkloadChartProps> = ({
  records,
  selectedCollector,
  onSelectCollector,
  selectedVillageFilter = '',
  onSelectVillageFilter,
}) => {
  // Local filter states for the chart
  const [localVillageFilter, setLocalVillageFilter] = useState<string>(selectedVillageFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'desc' | 'asc' | 'name'>('desc');
  const [viewType, setViewType] = useState<'horizontal' | 'vertical' | 'cards'>('horizontal');

  // Keep in sync if parent village filter changes and user hasn't explicitly set a local filter
  React.useEffect(() => {
    if (selectedVillageFilter !== undefined) {
      setLocalVillageFilter(selectedVillageFilter);
    }
  }, [selectedVillageFilter]);

  // Aggregate collector data
  const { collectorStats, totalAssignedHouseholds, unassignedCount, maxCount, averagePerCollector } = useMemo(() => {
    // Filter records by village if selected
    const targetRecords = localVillageFilter 
      ? records.filter(r => r.village === localVillageFilter)
      : records;

    const statsMap: Record<string, {
      name: string;
      count: number;
      villages: Set<string>;
      totalMembers: number;
      isUnassigned: boolean;
    }> = {};

    let unassigned = 0;
    let assigned = 0;

    targetRecords.forEach(r => {
      const rawName = r.collectorName?.trim();
      const isUnassigned = !rawName;
      const name = isUnassigned ? 'ยังไม่ระบุ อสม.' : rawName;

      if (isUnassigned) {
        unassigned++;
      } else {
        assigned++;
      }

      if (!statsMap[name]) {
        statsMap[name] = {
          name,
          count: 0,
          villages: new Set(),
          totalMembers: 0,
          isUnassigned,
        };
      }

      statsMap[name].count += 1;
      if (r.village) {
        statsMap[name].villages.add(r.village);
      }
      if (typeof r.memberCount === 'number') {
        statsMap[name].totalMembers += r.memberCount;
      }
    });

    const list = Object.values(statsMap).map(item => ({
      name: item.name,
      count: item.count,
      villagesList: Array.from(item.villages),
      villagesSummary: Array.from(item.villages).map(v => v.replace('หมู่ที่ ', 'ม.')).join(', '),
      totalMembers: item.totalMembers,
      isUnassigned: item.isUnassigned,
    }));

    // Filter by search query
    const filtered = list.filter(item => 
      item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    // Sort list
    filtered.sort((a, b) => {
      // Keep "ยังไม่ระบุ อสม." at bottom or top according to sorting
      if (a.isUnassigned && !b.isUnassigned) return 1;
      if (!a.isUnassigned && b.isUnassigned) return -1;

      if (sortBy === 'desc') return b.count - a.count;
      if (sortBy === 'asc') return a.count - b.count;
      return a.name.localeCompare(b.name, 'th');
    });

    const activeCollectors = list.filter(i => !i.isUnassigned);
    const max = list.length > 0 ? Math.max(...list.map(i => i.count)) : 0;
    const avg = activeCollectors.length > 0 
      ? (assigned / activeCollectors.length).toFixed(1)
      : '0';

    return {
      collectorStats: filtered,
      totalAssignedHouseholds: assigned,
      unassignedCount: unassigned,
      maxCount: max,
      averagePerCollector: avg,
    };
  }, [records, localVillageFilter, searchQuery, sortBy]);

  // Dynamic height for horizontal chart based on number of items
  const horizontalChartHeight = Math.max(260, collectorStats.length * 42 + 40);

  const handleVillageChange = (val: string) => {
    setLocalVillageFilter(val);
    if (onSelectVillageFilter) {
      onSelectVillageFilter(val);
    }
  };

  const handleBarClick = (data: any) => {
    if (data && data.name) {
      const name = data.name === 'ยังไม่ระบุ อสม.' ? '__UNASSIGNED__' : data.name;
      onSelectCollector(selectedCollector === name ? '' : name);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E6E4DD] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#3A4D3F] flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#5C7F67]" />
            ภาระงาน อสม. (จำนวนหลังคาเรือนที่รับผิดชอบ)
          </h2>
          <p className="text-xs text-[#7A7E74] mt-0.5">
            แสดงสัดส่วนปริมาณงานของ อสม. แต่ละท่าน เพื่อช่วยติดตามและจัดสรรงานให้สมดุล
          </p>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex items-center bg-[#F4F5F0] p-1 rounded-xl self-start sm:self-auto border border-[#E6E4DD]">
          <button
            type="button"
            onClick={() => setViewType('horizontal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              viewType === 'horizontal'
                ? 'bg-white text-[#5C7F67] shadow-xs'
                : 'text-[#7A7E74] hover:text-[#3A4D3F]'
            }`}
            title="กราฟแนวนอน (อ่านชื่อได้ชัดเจน)"
          >
            <BarChart3 className="h-3.5 w-3.5 rotate-90" />
            <span className="hidden xs:inline">แนวนอน</span>
          </button>
          <button
            type="button"
            onClick={() => setViewType('vertical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              viewType === 'vertical'
                ? 'bg-white text-[#5C7F67] shadow-xs'
                : 'text-[#7A7E74] hover:text-[#3A4D3F]'
            }`}
            title="กราฟแท่งแนวตั้ง"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">แนวตั้ง</span>
          </button>
          <button
            type="button"
            onClick={() => setViewType('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              viewType === 'cards'
                ? 'bg-white text-[#5C7F67] shadow-xs'
                : 'text-[#7A7E74] hover:text-[#3A4D3F]'
            }`}
            title="บัตรรายชื่อและภาระงาน"
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">รายชื่อ</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#F9F9F5] p-3.5 rounded-2xl border border-[#E6E4DD]">
          <span className="text-[10px] font-bold text-[#7A7E74] uppercase tracking-wider block">อสม. ที่มีข้อมูล</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-[#3A4D3F]">
              {collectorStats.filter(c => !c.isUnassigned).length}
            </span>
            <span className="text-xs text-[#7A7E74]">ท่าน</span>
          </div>
        </div>

        <div className="bg-[#F9F9F5] p-3.5 rounded-2xl border border-[#E6E4DD]">
          <span className="text-[10px] font-bold text-[#7A7E74] uppercase tracking-wider block">เฉลี่ยต่อ อสม.</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-[#5C7F67]">
              {averagePerCollector}
            </span>
            <span className="text-xs text-[#7A7E74]">หลัง/คน</span>
          </div>
        </div>

        <div className="bg-[#F9F9F5] p-3.5 rounded-2xl border border-[#E6E4DD]">
          <span className="text-[10px] font-bold text-[#7A7E74] uppercase tracking-wider block">รับผิดชอบสูงสุด</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-[#3A4D3F]">
              {maxCount}
            </span>
            <span className="text-xs text-[#7A7E74]">หลังคาเรือน</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${
          unassignedCount > 0 
            ? 'bg-[#FFF9F5] border-[#E07A5F]/30' 
            : 'bg-[#F9F9F5] border-[#E6E4DD]'
        }`}>
          <span className="text-[10px] font-bold text-[#7A7E74] uppercase tracking-wider block">ยังไม่ระบุ อสม.</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-xl font-bold ${unassignedCount > 0 ? 'text-[#E07A5F]' : 'text-[#7A7E74]'}`}>
              {unassignedCount}
            </span>
            <span className="text-xs text-[#7A7E74]">หลัง</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#F4F5F0] p-4 rounded-2xl border border-[#E6E4DD] space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#5C7F67] flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            ตัวกรองกราฟภาระงาน
          </div>
          {(localVillageFilter || searchQuery || sortBy !== 'desc' || selectedCollector) && (
            <button
              type="button"
              onClick={() => {
                handleVillageChange('');
                setSearchQuery('');
                setSortBy('desc');
                onSelectCollector('');
              }}
              className="text-[11px] text-[#7A7E74] hover:text-[#5C7F67] font-bold underline"
            >
              ล้างเงื่อนไข
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Village Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A7E74] uppercase mb-1">
              เลือกดูรายหมู่บ้าน
            </label>
            <select
              value={localVillageFilter}
              onChange={(e) => handleVillageChange(e.target.value)}
              className="w-full bg-white border border-[#E6E4DD] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#5C7F67] transition-shadow"
            >
              <option value="">ทุกหมู่บ้าน (ทั้งหมด {records.length} หลัง)</option>
              {VILLAGES.map(v => (
                <option key={v} value={v}>
                  {v} ({records.filter(r => r.village === v).length} หลัง)
                </option>
              ))}
            </select>
          </div>

          {/* Search collector */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A7E74] uppercase mb-1">
              ค้นหาชื่อ อสม.
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#A3A69F]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="พิมพ์ชื่อ อสม..."
                className="w-full bg-white border border-[#E6E4DD] rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-[#5C7F67] transition-shadow"
              />
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-[10px] font-bold text-[#7A7E74] uppercase mb-1">
              จัดเรียงข้อมูล
            </label>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#A3A69F]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-[#E6E4DD] rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-[#5C7F67] transition-shadow"
              >
                <option value="desc">ภาระงาน: มาก ➔ น้อย</option>
                <option value="asc">ภาระงาน: น้อย ➔ มาก</option>
                <option value="name">เรียงตามชื่อ อสม. (ก-ฮ)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Notice */}
        {selectedCollector && (
          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#5C7F67]/30 text-xs">
            <span className="text-[#3A4D3F] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#5C7F67]" />
              กำลังกรองรายการข้อมูลเฉพาะ: <strong>{selectedCollector === '__UNASSIGNED__' ? 'ยังไม่ระบุ อสม.' : selectedCollector}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectCollector('')}
              className="text-[#E07A5F] hover:text-red-700 font-bold ml-2 underline text-[11px]"
            >
              ยกเลิกการกรอง
            </button>
          </div>
        )}
      </div>

      {/* Main Chart Body */}
      {collectorStats.length === 0 ? (
        <div className="py-12 text-center text-[#7A7E74]">
          <Users className="mx-auto h-10 w-10 text-[#D6D3C9] mb-2" />
          <p className="text-sm font-medium">ไม่พบข้อมูล อสม. ที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : viewType === 'horizontal' ? (
        /* Horizontal Bars (Best for Thai names readability) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px] text-[#7A7E74] px-1 font-medium">
            <span>คลิกที่ชื่อหรือแท่งกราฟเพื่อกรองรายการบ้านด้านล่าง</span>
            <span>ความยาวแท่งเปรียบเทียบจากสูงสุด ({maxCount} หลัง)</span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {collectorStats.map((item) => {
              const isSelected = item.isUnassigned
                ? selectedCollector === '__UNASSIGNED__'
                : selectedCollector === item.name;
              const percent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

              return (
                <div
                  key={item.name}
                  onClick={() => {
                    const targetName = item.isUnassigned ? '__UNASSIGNED__' : item.name;
                    onSelectCollector(isSelected ? '' : targetName);
                  }}
                  className={`group cursor-pointer p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-[#5C7F67]/10 border-[#5C7F67] shadow-sm'
                      : 'bg-white border-[#E6E4DD] hover:border-[#A3B18A] hover:bg-[#F9F9F5]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.isUnassigned 
                          ? 'bg-[#E07A5F]' 
                          : isSelected 
                            ? 'bg-[#5C7F67]' 
                            : 'bg-[#A3B18A]'
                      }`} />
                      <span className={`font-bold truncate ${
                        item.isUnassigned 
                          ? 'text-[#E07A5F]' 
                          : isSelected 
                            ? 'text-[#5C7F67]' 
                            : 'text-[#3A4D3F]'
                      }`}>
                        {item.name}
                      </span>
                      {item.villagesSummary && (
                        <span className="hidden sm:inline-block text-[10px] text-[#7A7E74] bg-[#F4F5F0] px-2 py-0.5 rounded-full truncate">
                          {item.villagesSummary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-[#7A7E74]">
                        ประชากร {item.totalMembers} คน
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        item.isUnassigned
                          ? 'bg-[#FFF0EB] text-[#E07A5F]'
                          : isSelected
                            ? 'bg-[#5C7F67] text-white'
                            : 'bg-[#F4F5F0] text-[#3A4D3F]'
                      }`}>
                        {item.count} หลัง
                      </span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${
                        isSelected ? 'rotate-90 text-[#5C7F67]' : 'text-[#D6D3C9] group-hover:text-[#5C7F67]'
                      }`} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#EAE8E0] h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isUnassigned
                          ? 'bg-[#E07A5F]'
                          : isSelected
                            ? 'bg-[#5C7F67]'
                            : 'bg-[#A3B18A] group-hover:bg-[#5C7F67]'
                      }`}
                      style={{ width: `${Math.max(6, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewType === 'vertical' ? (
        /* Vertical Bar Chart (Recharts) */
        <div className="space-y-2">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={collectorStats} 
                margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                onClick={(state: any) => {
                  if (state && (state as any).activePayload && (state as any).activePayload.length > 0) {
                    handleBarClick((state as any).activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E4DD" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#7A7E74' }} 
                  axisLine={false} 
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#7A7E74' }} 
                  axisLine={false} 
                  tickLine={false} 
                  allowDecimals={false} 
                />
                <Tooltip 
                  cursor={{ fill: '#F4F5F0' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl border border-[#E6E4DD] shadow-md text-xs space-y-1">
                          <p className="font-bold text-[#3A4D3F]">{data.name}</p>
                          <p className="text-[#5C7F67] font-semibold">
                            รับผิดชอบ: {data.count} หลังคาเรือน
                          </p>
                          <p className="text-[#7A7E74]">
                            ประชากรที่ดูแล: {data.totalMembers} คน
                          </p>
                          {data.villagesSummary && (
                            <p className="text-[#7A7E74] text-[10px]">
                              พื้นที่: {data.villagesSummary}
                            </p>
                          )}
                          <p className="text-[10px] text-[#A3A69F] pt-1 border-t border-[#E6E4DD]">
                            คลิกเพื่อกรองรายการ
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" name="จำนวนหลังคาเรือน" radius={[4, 4, 0, 0]}>
                  {collectorStats.map((entry, index) => {
                    const isSelected = entry.isUnassigned
                      ? selectedCollector === '__UNASSIGNED__'
                      : selectedCollector === entry.name;
                    const fill = entry.isUnassigned 
                      ? '#E07A5F' 
                      : isSelected 
                        ? '#3A4D3F' 
                        : '#5C7F67';
                    return <Cell key={`cell-${index}`} fill={fill} cursor="pointer" />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[11px] text-[#7A7E74]">
            คลิกแท่งกราฟเพื่อกรองรายการบ้านด้านล่าง
          </p>
        </div>
      ) : (
        /* Cards View (Grid of summary cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collectorStats.map((item) => {
            const isSelected = item.isUnassigned
              ? selectedCollector === '__UNASSIGNED__'
              : selectedCollector === item.name;
            return (
              <div
                key={item.name}
                onClick={() => {
                  const targetName = item.isUnassigned ? '__UNASSIGNED__' : item.name;
                  onSelectCollector(isSelected ? '' : targetName);
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#5C7F67]/10 border-[#5C7F67] shadow-sm ring-1 ring-[#5C7F67]'
                    : 'bg-white border-[#E6E4DD] hover:border-[#A3B18A] hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-bold text-sm truncate ${
                      item.isUnassigned ? 'text-[#E07A5F]' : 'text-[#3A4D3F]'
                    }`}>
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-[#7A7E74] mt-0.5 truncate">
                      {item.villagesSummary || 'ไม่ระบุหมู่บ้าน'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 ml-2 ${
                    item.isUnassigned
                      ? 'bg-[#FFF0EB] text-[#E07A5F]'
                      : isSelected
                        ? 'bg-[#5C7F67] text-white'
                        : 'bg-[#F4F5F0] text-[#3A4D3F]'
                  }`}>
                    {item.count} หลัง
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-[#E6E4DD]/60 flex items-center justify-between text-[11px] text-[#7A7E74]">
                  <span>ประชากร {item.totalMembers} คน</span>
                  <span className="text-[#5C7F67] font-semibold flex items-center gap-0.5">
                    {isSelected ? 'เลือกอยู่' : 'คลิกเพื่อดู'} 
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Tips Footer */}
      <div className="pt-2 border-t border-[#E6E4DD] flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-[#7A7E74] gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#5C7F67]" />
          <span>สีเขียว: อสม. ที่มีรายชื่อรับผิดชอบ</span>
          <span className="w-2 h-2 rounded-full bg-[#E07A5F] ml-2" />
          <span>สีส้ม: ยังไม่ระบุ อสม.</span>
        </div>
        <div>
          รวมทั้งหมด <strong>{totalAssignedHouseholds + unassignedCount}</strong> หลังคาเรือน
        </div>
      </div>
    </div>
  );
};
