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
  
  // Initialize header if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Timestamp', 'Village', 'HouseNumber', 'HouseRegNumber', 'HeadOfHousehold', 'MemberCount', 'Latitude', 'Longitude', 'Notes']);
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
        notes: row[9]
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
      record.notes || ''
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
        sheet.getRange(rowIndex, 1, 1, 10).setValues([[
          record.id,
          record.timestamp, // Keep original timestamp or new, depending on what client sends
          record.village,
          record.houseNumber,
          record.houseRegistrationNumber || '',
          record.headOfHousehold,
          record.memberCount,
          record.latitude,
          record.longitude,
          record.notes || ''
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
