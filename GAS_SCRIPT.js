function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getRecords') {
    return getRecords();
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    
    if (action === 'addRecord') {
      return addRecord(body.data);
    } else if (action === 'deleteRecord') {
      return deleteRecord(body.id);
    } else if (action === 'updateRecord') {
      return updateRecord(body.data);
    } else if (action === 'getRecords') {
      return getRecords();
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet() {
  // Use the active spreadsheet if bound, otherwise you'll need SpreadsheetApp.openById('YOUR_ID')
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var expectedHeaders = [
    'ID', 'Timestamp', 'Village', 'HouseNumber', 'HouseRegNumber',
    'HeadOfHousehold', 'MemberCount', 'Latitude', 'Longitude', 'Notes',
    'CollectorName', 'BedriddenCount', 'PregnantOver36WeeksCount', 'ElderlyCount',
    'DiabetesCount', 'HypertensionCount'
  ];
  
  // Initialize header if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
  } else {
    // Backwards compatibility check: ensure new columns exist in the header row
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var h = 0; h < expectedHeaders.length; h++) {
      if (headers.length <= h || headers[h] !== expectedHeaders[h]) {
        sheet.getRange(1, h + 1).setValue(expectedHeaders[h]);
      }
    }
  }
  return sheet;
}

function getRecords() {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    var records = [];
    
    // Skip header row
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      records.push({
        id: row[0],
        timestamp: row[1],
        village: row[2],
        houseNumber: row[3],
        houseRegistrationNumber: row[4],
        headOfHousehold: row[5],
        memberCount: row[6],
        latitude: row[7],
        longitude: row[8],
        notes: row[9],
        collectorName: row[10] || '',
        bedriddenCount: Number(row[11]) || 0,
        pregnantOver36WeeksCount: Number(row[12]) || 0,
        elderlyCount: Number(row[13]) || 0,
        diabetesCount: Number(row[14]) || 0,
        hypertensionCount: Number(row[15]) || 0
      });
    }
    
    // Allow CORS by setting appropriate headers or just returning JSONP/JSON
    // Note: GAS handles CORS internally for Web Apps executed as "Me" and accessible to "Anyone"
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: records }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function addRecord(record) {
  try {
    var sheet = getSheet();
    sheet.appendRow([
      record.id,
      record.timestamp,
      record.village,
      record.houseNumber,
      record.houseRegistrationNumber || '',
      record.headOfHousehold,
      record.memberCount,
      record.latitude,
      record.longitude,
      record.notes || '',
      record.collectorName || '',
      record.bedriddenCount || 0,
      record.pregnantOver36WeeksCount || 0,
      record.elderlyCount || 0,
      record.diabetesCount || 0,
      record.hypertensionCount || 0
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteRecord(id) {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    
    // Find the row to delete (skip header)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        // +1 because array is 0-indexed but sheet rows are 1-indexed
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Record not found' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function updateRecord(record) {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === record.id) {
        var rowIndex = i + 1;
        // The record might only have updated fields, but we assume full replacement
        sheet.getRange(rowIndex, 1, 1, 16).setValues([[
          record.id,
          record.timestamp, // Keep original timestamp or new, depending on what client sends
          record.village,
          record.houseNumber,
          record.houseRegistrationNumber || '',
          record.headOfHousehold,
          record.memberCount,
          record.latitude,
          record.longitude,
          record.notes || '',
          record.collectorName || '',
          record.bedriddenCount || 0,
          record.pregnantOver36WeeksCount || 0,
          record.elderlyCount || 0,
          record.diabetesCount || 0,
          record.hypertensionCount || 0
        ]]);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Record not found' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
