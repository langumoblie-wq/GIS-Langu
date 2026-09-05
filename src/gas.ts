import { HouseholdRecord } from './types';

// We can remove the constant to ensure the URL is always passed
export async function fetchRecordsFromGAS(url: string): Promise<HouseholdRecord[]> {
  if (!url) {
    console.warn('GAS Web App URL is not set');
    return [];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getRecords'
    })
  });
  
  if (!res.ok) {
    // Fallback to GET for backwards compatibility with old script deployments
    const getRes = await fetch(`${url}?action=getRecords`);
    if (!getRes.ok) {
      throw new Error(`Failed to fetch records from GAS (Status: ${getRes.status}). Please check if the URL is correct and deployed as "Anyone".`);
    }
    const getData = await getRes.json();
    if (getData.status !== 'success') {
      throw new Error(getData.message || 'Error fetching records');
    }
    return processGASData(getData);
  }
  
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Failed to parse response. The URL might be incorrect or not deployed as a Web App.');
  }

  if (data.status !== 'success') {
    // If it's an invalid action error, it means the script hasn't been updated to support POST getRecords
    if (data.message === 'Invalid action') {
      const getRes = await fetch(`${url}?action=getRecords`);
      if (!getRes.ok) throw new Error(`Failed to fetch records from GAS (Status: ${getRes.status}).`);
      const getData = await getRes.json();
      return processGASData(getData);
    }
    throw new Error(data.message || 'Error fetching records');
  }

  return processGASData(data);
}

function processGASData(data: any): HouseholdRecord[] {
  const values = data.data || [];
  const records: HouseholdRecord[] = [];
  
  // Assuming the GAS script returns an array of objects
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row.id) continue; 
    records.push({
      id: row.id,
      timestamp: row.timestamp || '',
      village: row.village || '',
      houseNumber: row.houseNumber || '',
      houseRegistrationNumber: row.houseRegistrationNumber || '',
      headOfHousehold: row.headOfHousehold || '',
      memberCount: row.memberCount ? Number(row.memberCount) : '',
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      notes: row.notes || '',
    });
  }
  return records.reverse();
}

export async function addRecordToGAS(url: string, record: HouseholdRecord) {
  if (!url) {
    throw new Error('GAS Web App URL is not set');
  }

  // Use URLSearchParams or send as text/plain to avoid CORS preflight failures
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'addRecord',
      data: record
    })
  });
  
  if (!res.ok) throw new Error('Failed to add record');
  
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Error adding record');
  }
}

export async function deleteRecordFromGAS(url: string, id: string) {
  if (!url) {
    throw new Error('GAS Web App URL is not set');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'deleteRecord',
      id: id
    })
  });
  
  if (!res.ok) throw new Error('Failed to delete record');
  
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Error deleting record');
  }
}

export async function updateRecordInGAS(url: string, record: HouseholdRecord) {
  if (!url) {
    throw new Error('GAS Web App URL is not set');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'updateRecord',
      data: record
    })
  });
  
  if (!res.ok) throw new Error('Failed to update record');
  
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Error updating record');
  }
}
