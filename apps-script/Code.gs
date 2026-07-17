// ==========================================
// GOOGLE APPS SCRIPT - MIAS (v2.0 - + Admin CRUD & Upload)
// ==========================================
// Perubahan dari v1.9:
// - doPost: tambah type 'ROW' (add/update/delete baris Gallery/Teachers/News)
// - doPost: tambah type 'UPLOAD' (upload foto ke Google Drive -> URL publik)
// - Logic SAVE_FOLDER / DELETE_FOLDER (bank soal) TIDAK diubah.
// Setelah tempel: Deploy > Manage deployments > Edit > New version > Deploy.
// Saat pertama jalan akan minta izin akses Google Drive -> Allow.

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TeacherQuestions") || ss.insertSheet("TeacherQuestions");
  const result = { TeacherQuestions: [] };

  // 1. Ambil data Standard dari tab lain (Settings, Staff, etc)
  ss.getSheets().forEach(s => {
    const name = s.getName();
    if (name === "TeacherQuestions") return;
    const vals = s.getDataRange().getValues();
    if (vals.length > 0) {
      const headers = vals[0].map(h => h.toString().trim());
      result[name] = vals.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
        return obj;
      });
    } else { result[name] = []; }
  });

  // 2. Ambil data Bank Soal (Atomic Column Extraction)
  // Row 8 (TK) s/d Row 14 (SD 6)
  const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];
  const teacherQuestionsData = [];

  GRADES.forEach((grade, i) => {
    const rowIndex = 8 + i; // TK mulai di baris 8
    const rowValues = sheet.getRange(rowIndex, 1, 1, 100).getValues()[0]; // Ambil 100 kolom

    let gradeExamTypes = [];
    let gradeQuestions = {};
    let lastUpdate = 0;

    rowValues.forEach(cell => {
      if (cell && cell.toString().trim() !== "") {
        try {
          const folderData = JSON.parse(cell);
          if (folderData.id && folderData.name) {
            gradeExamTypes.push({ id: folderData.id, name: folderData.name });
            gradeQuestions[folderData.id] = folderData.questions || [];
            if (folderData.updatedAt > lastUpdate) lastUpdate = folderData.updatedAt;
          }
        } catch (e) {
          // Bukan JSON yang valid, skip
        }
      }
    });

    teacherQuestionsData.push({
      grade: grade,
      data: {
        updatedAt: lastUpdate || Date.now(),
        examTypes: { [grade]: gradeExamTypes },
        questions: gradeQuestions
      }
    });
  });

  result.TeacherQuestions = teacherQuestionsData;
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TeacherQuestions") || ss.insertSheet("TeacherQuestions");

  // Logic 1: Atomic Folder Sync (Sangat Aman)
  if (params.type === 'SAVE_FOLDER') {
    const { grade, folderId, folderName, questions } = params;
    const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];
    const rowIndex = GRADES.indexOf(grade) + 8; // TK di baris 8

    if (rowIndex >= 8) {
      const lock = LockService.getScriptLock();
      lock.waitLock(15000); // Tunggu sampai 15 detik jika ada user lain sedang menulis

      try {
        const rowValues = sheet.getRange(rowIndex, 1, 1, 100).getValues()[0];
        let foundCol = -1;

        // Cari apakah folder ini sudah ada di salah satu kolom
        for (let c = 0; c < rowValues.length; c++) {
          const cell = rowValues[c];
          if (cell) {
            try {
              const d = JSON.parse(cell);
              if (d.id === folderId) { foundCol = c + 1; break; }
            } catch(err) {}
          }
          if (foundCol === -1 && (!cell || cell === "")) {
            // Kita simpan index kolom kosong pertama sebagai cadangan jika tidak ketemu
            // Tapi kita telusuri semua dulu
          }
        }

        // Jika tidak ketemu, cari kolom kosong pertama
        if (foundCol === -1) {
          for (let c = 0; c < rowValues.length; c++) {
            if (!rowValues[c] || rowValues[c] === "") { foundCol = c + 1; break; }
          }
        }

        const payload = {
          id: folderId,
          name: folderName,
          questions: questions || [],
          updatedAt: Date.now()
        };

        sheet.getRange(rowIndex, foundCol).setValue(JSON.stringify(payload));
        return ContentService.createTextOutput(JSON.stringify({success: true, col: foundCol})).setMimeType(ContentService.MimeType.JSON);
      } finally {
        lock.releaseLock();
      }
    }
  }

  // Logic 2: Hapus Folder
  if (params.type === 'DELETE_FOLDER') {
    const { grade, folderId } = params;
    const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];
    const rowIndex = GRADES.indexOf(grade) + 8;

    const rowValues = sheet.getRange(rowIndex, 1, 1, 100).getValues()[0];
    for (let c = 0; c < rowValues.length; c++) {
      if (rowValues[c]) {
        try {
          const d = JSON.parse(rowValues[c]);
          if (d.id === folderId) {
            sheet.getRange(rowIndex, c + 1).clearContent();
            break;
          }
        } catch(err) {}
      }
    }
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }

  // Logic 3: CRUD baris umum untuk Gallery / Teachers / News (Admin panel)
  if (params.type === 'ROW') {
    return handleRow(ss, params);
  }

  // Logic 4: Upload foto ke Google Drive -> kembalikan URL publik
  if (params.type === 'UPLOAD') {
    return handleUpload(params);
  }

  return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Unknown type'})).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Helper Admin CRUD ----------

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// id auto & PERMANEN: ambil angka terbesar yang pernah ada + 1 (delete tak me-reuse).
// News dikasih akhiran "-News" biar konsisten dengan data lama.
function nextId(sheetName, values, idCol) {
  var max = 0;
  for (var r = 1; r < values.length; r++) {
    var v = String(values[r][idCol] || '');
    var m = v.match(/\d+/);
    if (m) { var n = parseInt(m[0], 10); if (n > max) max = n; }
  }
  var next = max + 1;
  return sheetName === 'News' ? (next + '-News') : next;
}

function handleRow(ss, params) {
  var allowed = { Gallery: true, Teachers: true, News: true };
  var sheetName = params.sheetName;
  if (!allowed[sheetName]) return jsonOut({ success: false, error: 'sheet tidak diizinkan' });

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonOut({ success: false, error: 'sheet tidak ditemukan: ' + sheetName });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function (h) { return h.toString().trim(); });
    var idCol = headers.indexOf('id');
    if (idCol === -1) return jsonOut({ success: false, error: 'kolom id tidak ada' });

    var action = params.action;
    var row = params.row || {};

    if (action === 'add') {
      var newId = nextId(sheetName, values, idCol);
      row.id = newId;
      var newRow = headers.map(function (h) { return (h in row) ? row[h] : ''; });
      sheet.appendRow(newRow);
      return jsonOut({ success: true, id: newId });
    }

    if (action === 'update' || action === 'delete') {
      var targetId = String(params.id != null ? params.id : row.id);
      var rowNum = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][idCol]) === targetId) { rowNum = r + 1; break; }
      }
      if (rowNum === -1) return jsonOut({ success: false, error: 'id tidak ditemukan: ' + targetId });

      if (action === 'delete') {
        sheet.deleteRow(rowNum);
        return jsonOut({ success: true });
      }

      // update: hanya tulis kolom yang dikirim, id tidak diubah
      for (var c = 0; c < headers.length; c++) {
        var h = headers[c];
        if (h === 'id' || !h) continue;
        if (h in row) sheet.getRange(rowNum, c + 1).setValue(row[h]);
      }
      return jsonOut({ success: true, id: targetId });
    }

    // move: geser baris naik/turun (urutan tampil = urutan baris)
    if (action === 'move') {
      var mId = String(params.id);
      var mRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][idCol]) === mId) { mRow = r + 1; break; }
      }
      if (mRow === -1) return jsonOut({ success: false, error: 'id tidak ditemukan: ' + mId });

      var neighbor = params.direction === 'up' ? mRow - 1 : mRow + 1;
      var lastDataRow = values.length; // header di baris 1; baris data terakhir = values.length
      if (neighbor < 2 || neighbor > lastDataRow) {
        return jsonOut({ success: true, moved: false }); // sudah di ujung
      }
      var lastCol = sheet.getLastColumn();
      var aVals = sheet.getRange(mRow, 1, 1, lastCol).getValues();
      var bVals = sheet.getRange(neighbor, 1, 1, lastCol).getValues();
      sheet.getRange(mRow, 1, 1, lastCol).setValues(bVals);
      sheet.getRange(neighbor, 1, 1, lastCol).setValues(aVals);
      return jsonOut({ success: true, moved: true });
    }

    return jsonOut({ success: false, error: 'action tidak dikenal: ' + action });
  } finally {
    lock.releaseLock();
  }
}

function handleUpload(params) {
  try {
    var dataUrl = params.imageBase64 || '';
    var m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    var mime = m ? m[1] : 'image/jpeg';
    var b64 = m ? m[2] : dataUrl;
    var bytes = Utilities.base64Decode(b64);
    var name = (params.filename || ('upload-' + Date.now())).replace(/[^\w.\-]/g, '_');
    var blob = Utilities.newBlob(bytes, mime, name);

    var folder = getUploadFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var id = file.getId();
    // URL CDN langsung (tanpa redirect) -> paling andal untuk <img> & og:image crawler.
    // drive.google.com/thumbnail me-redirect ke sini; pakai yang final biar crawler tak nyasar.
    var url = 'https://lh3.googleusercontent.com/d/' + id + '=w1200';
    return jsonOut({ success: true, url: url, fileId: id });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

// Folder Drive tujuan upload foto. Ganti ID di sini kalau mau pindah folder.
var UPLOAD_FOLDER_ID = '1TRdZHE9mirLUU2jldUCpTXqNvxnzEA7E';

function getUploadFolder() {
  return DriveApp.getFolderById(UPLOAD_FOLDER_ID);
}
