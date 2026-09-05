export interface HouseholdRecord {
  id: string;
  houseNumber: string;
  houseRegistrationNumber: string;
  headOfHousehold: string;
  village: string;
  latitude: number | null;
  longitude: number | null;
  memberCount: number | '';
  notes: string;
  timestamp: string;
  rowIndex?: number;
}

export const VILLAGES = [
  "หมู่ที่ 1 บ้านท่าชะมวง",
  "หมู่ที่ 2 บ้านปากละงู",
  "หมู่ที่ 7 บ้านบากันโต๊ะทิด",
  "หมู่ที่ 14 บ้านหลอมปืน",
  "หมู่ที่ 18 บ้านโคกพยอม"
];

declare global {
  const google: any;
}
