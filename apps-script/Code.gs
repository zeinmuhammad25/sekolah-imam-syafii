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
    if (name === "TeacherQuestions" || name === "QuestionFolders" || name === "Questions") return;
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

  // 2. Bank Soal: baca dari sheet relasional (QuestionFolders + Questions).
  //    Kalau sheet baru belum ada / kosong -> fallback ke sistem lama (baris 8-14).
  result.TeacherQuestions = buildTeacherQuestions(ss);
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Bank Soal: reader relasional + fallback lama ----------

function readSheetObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return h.toString().trim(); });
  return values.slice(1).map(function (row) {
    var o = {};
    headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
    return o;
  }).filter(function (o) { return String(o.id || '') !== ''; });
}

function buildTeacherQuestions(ss) {
  var GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];
  var fSheet = ss.getSheetByName('QuestionFolders');
  var qSheet = ss.getSheetByName('Questions');

  // Belum migrasi -> pakai pembaca lama supaya tidak ada yang rusak.
  if (!fSheet || fSheet.getLastRow() < 2) return buildTeacherQuestionsLegacy(ss);

  var folders = readSheetObjects(fSheet);
  var qs = (qSheet && qSheet.getLastRow() >= 2) ? readSheetObjects(qSheet) : [];

  var byFolder = {};
  qs.forEach(function (q) {
    var fid = String(q.folderId);
    if (!byFolder[fid]) byFolder[fid] = [];
    byFolder[fid].push({
      id: String(q.id),
      text: q.text,
      options: { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD },
      correctAnswer: q.correctAnswer,
      type: q.type || 'pg',
      updatedAt: q.updatedAt
    });
  });

  return GRADES.map(function (grade) {
    var gradeFolders = folders
      .filter(function (f) { return String(f.grade) === grade; })
      .map(function (f) { return { id: String(f.id), name: f.name }; });
    var questionsObj = {};
    gradeFolders.forEach(function (f) { questionsObj[f.id] = byFolder[f.id] || []; });
    return { grade: grade, data: { updatedAt: Date.now(), examTypes: { [grade]: gradeFolders }, questions: questionsObj } };
  });
}

// Pembaca lama (sel JSON di baris 8-14) - dipakai untuk fallback & sumber migrasi.
function buildTeacherQuestionsLegacy(ss) {
  var sheet = ss.getSheetByName("TeacherQuestions");
  var GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];
  var out = [];
  GRADES.forEach(function (grade, i) {
    var gradeExamTypes = [];
    var gradeQuestions = {};
    var lastUpdate = 0;
    if (sheet) {
      var rowValues = sheet.getRange(8 + i, 1, 1, 100).getValues()[0];
      rowValues.forEach(function (cell) {
        if (cell && cell.toString().trim() !== "") {
          try {
            var d = JSON.parse(cell);
            if (d.id && d.name) {
              gradeExamTypes.push({ id: d.id, name: d.name });
              gradeQuestions[d.id] = d.questions || [];
              if (d.updatedAt > lastUpdate) lastUpdate = d.updatedAt;
            }
          } catch (e) {}
        }
      });
    }
    out.push({ grade: grade, data: { updatedAt: lastUpdate || Date.now(), examTypes: { [grade]: gradeExamTypes }, questions: gradeQuestions } });
  });
  return out;
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
  var allowed = { Gallery: true, Teachers: true, News: true, QuestionFolders: true, Questions: true };
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
    var updCol = headers.indexOf('updatedAt'); // -1 kalau sheet tak punya kolom versi

    var action = params.action;
    var row = params.row || {};

    if (action === 'add') {
      var newId = nextId(sheetName, values, idCol);
      row.id = newId;
      var addNow = Date.now();
      if (updCol !== -1) row.updatedAt = addNow;
      var newRow = headers.map(function (h) { return (h in row) ? row[h] : ''; });
      sheet.appendRow(newRow);
      return jsonOut({ success: true, id: newId, updatedAt: addNow });
    }

    // deleteFolder: hapus folder + semua soal di dalamnya (khusus QuestionFolders)
    if (action === 'deleteFolder') {
      var fid = String(params.id);
      for (var rf = values.length - 1; rf >= 1; rf--) {
        if (String(values[rf][idCol]) === fid) sheet.deleteRow(rf + 1);
      }
      var qSheet = ss.getSheetByName('Questions');
      if (qSheet && qSheet.getLastRow() >= 2) {
        var qVals = qSheet.getDataRange().getValues();
        var qHead = qVals[0].map(function (h) { return h.toString().trim(); });
        var fCol = qHead.indexOf('folderId');
        if (fCol !== -1) {
          for (var rq = qVals.length - 1; rq >= 1; rq--) {
            if (String(qVals[rq][fCol]) === fid) qSheet.deleteRow(rq + 1);
          }
        }
      }
      return jsonOut({ success: true });
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

      // Optimistic concurrency: kalau ada kolom updatedAt & klien kirim expectedUpdatedAt,
      // tolak bila baris sudah berubah sejak klien memuatnya (cegah menimpa perubahan orang lain).
      if (updCol !== -1 && params.expectedUpdatedAt != null) {
        var currentUpd = values[rowNum - 1][updCol];
        if (String(currentUpd) !== String(params.expectedUpdatedAt)) {
          return jsonOut({ success: false, conflict: true, current: rowToObj(headers, values[rowNum - 1]) });
        }
      }

      // update: hanya tulis kolom yang dikirim, id tidak diubah
      for (var c = 0; c < headers.length; c++) {
        var h = headers[c];
        if (h === 'id' || h === 'updatedAt' || !h) continue;
        if (h in row) sheet.getRange(rowNum, c + 1).setValue(row[h]);
      }
      var updNow = Date.now();
      if (updCol !== -1) sheet.getRange(rowNum, updCol + 1).setValue(updNow);
      return jsonOut({ success: true, id: targetId, updatedAt: updNow });
    }

    // reorder: tulis ulang seluruh baris data sesuai urutan id yang dikirim (sekali jalan)
    if (action === 'reorder') {
      var ids = params.ids || [];
      var width = values[0].length;
      var dataRows = values.slice(1);
      var byId = {};
      for (var r = 0; r < dataRows.length; r++) { byId[String(dataRows[r][idCol])] = dataRows[r]; }
      var ordered = [];
      for (var k = 0; k < ids.length; k++) {
        var key = String(ids[k]);
        if (byId[key]) { ordered.push(byId[key]); delete byId[key]; }
      }
      // id yang tak disebut (jaga-jaga) ditaruh di akhir
      for (var leftover in byId) { if (byId.hasOwnProperty(leftover)) ordered.push(byId[leftover]); }
      if (ordered.length !== dataRows.length) return jsonOut({ success: false, error: 'jumlah baris tidak cocok' });
      if (ordered.length > 0) sheet.getRange(2, 1, ordered.length, width).setValues(ordered);
      return jsonOut({ success: true });
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

// ---------- Helper & migrasi bank soal ----------

function rowToObj(headers, rowArr) {
  var o = {};
  for (var i = 0; i < headers.length; i++) { if (headers[i]) o[headers[i]] = rowArr[i]; }
  return o;
}

function ensureSheet(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) s.getRange(1, 1, 1, headers.length).setValues([headers]);
  return s;
}

// JALANKAN SEKALI dari editor Apps Script (pilih fungsi ini -> Run).
// Baca bank soal lama (baris 8-14) -> tulis ke sheet QuestionFolders + Questions.
// Aman: dibatalkan kalau QuestionFolders sudah berisi (cegah migrasi ganda).
// Sheet lama TIDAK dihapus (biarkan sebagai backup).
function migrateBankSoal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet = ensureSheet(ss, 'QuestionFolders', ['id', 'grade', 'name', 'updatedAt']);
  var qSheet = ensureSheet(ss, 'Questions', ['id', 'folderId', 'text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'type', 'updatedAt']);

  if (fSheet.getLastRow() > 1) {
    return 'DIBATALKAN: QuestionFolders sudah berisi. Kosongkan dulu (sisakan header) kalau mau migrasi ulang.';
  }

  var legacy = buildTeacherQuestionsLegacy(ss);
  var now = Date.now();
  var folderRows = [];
  var questionRows = [];

  legacy.forEach(function (gradeObj) {
    var grade = gradeObj.grade;
    var exam = gradeObj.data.examTypes[grade] || [];
    var qmap = gradeObj.data.questions || {};
    exam.forEach(function (folder) {
      folderRows.push([folder.id, grade, folder.name, now]);
      (qmap[folder.id] || []).forEach(function (q) {
        var opt = q.options || {};
        questionRows.push([
          q.id, folder.id, q.text || '',
          opt.a || '', opt.b || '', opt.c || '', opt.d || '',
          q.correctAnswer || '', q.type || 'pg', now
        ]);
      });
    });
  });

  if (folderRows.length) fSheet.getRange(2, 1, folderRows.length, 4).setValues(folderRows);
  if (questionRows.length) qSheet.getRange(2, 1, questionRows.length, 10).setValues(questionRows);

  return 'OK: ' + folderRows.length + ' folder, ' + questionRows.length + ' soal dimigrasi.';
}
