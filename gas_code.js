/**
 * Google Apps Script for IELTS Wordbook App Backend (6タブ自動マージ版)
 * 
 * このスクリプトは、スプレッドシート内の以下の6つのシートからデータを自動で集計し、
 * 合計3,800語のマスターデータとしてアプリへ送信します。
 * - 「基本単語1000」
 * - 「コア単語2000[レベル１]」 (またはレベル１)
 * - 「コア単語2000[レベル２]」 (またはレベル２)
 * - 「コア単語2000[レベル３]」 (またはレベル３)
 * - 「コア単語2000[レベル４]」 (またはレベル４)
 * - 「分野別単語800」
 */

function doGet(e) {
  var action = e.parameter.action;
  var wordNo = e.parameter.wordNo;
  
  // 1. 6つのシートから全単語データを自動集計して返す
  if (action === 'get_words') {
    return getMasterWordsFromAllSheets();
  }
  
  var sheet = getOrCreateWeakWordsSheet();
  
  // 2. 苦手単語の一覧取得
  if (action === 'get') {
    var data = sheet.getDataRange().getValues();
    var weakWords = [];
    var startRow = 0;
    if (data.length > 0 && (data[0][0] === 'No' || data[0][0] === 'WordNo')) {
      startRow = 1;
    }
    for (var i = startRow; i < data.length; i++) {
      if (data[i][0]) {
        var formattedNo = String(data[i][0]).trim();
        if (formattedNo) {
          weakWords.push(formattedNo);
        }
      }
    }
    return jsonResponse({ success: true, weakWords: weakWords });
  }
  
  // 3. 苦手単語の追加
  if (action === 'add' && wordNo) {
    wordNo = String(wordNo).trim();
    if (!wordNo) {
      return jsonResponse({ success: false, error: 'Invalid wordNo' });
    }
    
    var data = sheet.getDataRange().getValues();
    var exists = false;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === wordNo) {
        exists = true;
        break;
      }
    }
    
    if (!exists) {
      sheet.appendRow([wordNo, new Date()]);
    }
    return jsonResponse({ success: true, action: 'add', wordNo: wordNo });
  }
  
  // 4. 苦手単語の削除
  if (action === 'remove' && wordNo) {
    wordNo = String(wordNo).trim();
    var data = sheet.getDataRange().getValues();
    var deleted = false;
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0]).trim() === wordNo) {
        sheet.deleteRow(i + 1);
        deleted = true;
      }
    }
    return jsonResponse({ success: true, action: 'remove', wordNo: wordNo, deleted: deleted });
  }
  
  return jsonResponse({ success: false, error: 'Unknown or missing action' });
}

function doPost(e) {
  var params = {};
  try {
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    params = e.parameter;
  }
  
  var dummyE = {
    parameter: {
      action: params.action || e.parameter.action,
      wordNo: params.wordNo || e.parameter.wordNo
    }
  };
  return doGet(dummyE);
}

// 6つのシートを動的に探索・結合して返す
function getMasterWordsFromAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var words = [];
  
  // 読み取り対象のシート名とレベルの定義（濁点Unicode違いも両方対応）
  var sheetConfigs = [
    { pattern: "基本単語", level: "基本単語" },
    { pattern: "レベル１", level: "コア単語 レベル1", altPattern: "レベル１" },
    { pattern: "レベル２", level: "コア単語 レベル2", altPattern: "レベル２" },
    { pattern: "レベル３", level: "コア単語 レベル3", altPattern: "レベル３" },
    { pattern: "レベル４", level: "コア単語 レベル4", altPattern: "レベル４" },
    { pattern: "分野別単語", level: "分野別単語" }
  ];
  
  for (var c = 0; c < sheetConfigs.length; c++) {
    var config = sheetConfigs[c];
    var targetSheet = null;
    
    // シート名があいまい一致するものを探す
    for (var s = 0; s < allSheets.length; s++) {
      var name = allSheets[s].getName();
      if (name.indexOf(config.pattern) !== -1 || (config.altPattern && name.indexOf(config.altPattern) !== -1)) {
        targetSheet = allSheets[s];
        break;
      }
    }
    
    if (!targetSheet) {
      continue;
    }
    
    var data = targetSheet.getDataRange().getValues();
    if (data.length < 2) continue;
    
    // ヘッダー解析
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var colIdx = {
      no: headers.indexOf("No"),
      word: headers.indexOf("Word"),
      pos: headers.indexOf("POS"),
      phonetic: headers.indexOf("Phonetic"),
      meaning: headers.indexOf("Meaning"),
      synonym: headers.indexOf("Synonym"),
      exampleEn: headers.indexOf("Example_EN"),
      exampleJa: headers.indexOf("Example_JA"),
      category: headers.indexOf("Category")
    };
    
    // 各行をパース
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var wordVal = colIdx.word !== -1 ? String(row[colIdx.word]).trim() : "";
      if (!wordVal || wordVal.toLowerCase() === "word") continue;
      
      var noVal = colIdx.no !== -1 ? String(row[colIdx.no]).trim() : "";
      if (noVal && !isNaN(noVal)) {
        noVal = String("0000" + noVal).slice(-4);
      }
      
      words.push({
        "No": noVal || String(words.length + 1),
        "Category": colIdx.category !== -1 ? String(row[colIdx.category]).trim() : "",
        "Word": wordVal,
        "POS": colIdx.pos !== -1 ? String(row[colIdx.pos]).trim() : "",
        "Phonetic": colIdx.phonetic !== -1 ? String(row[colIdx.phonetic]).trim() : "",
        "Meaning": colIdx.meaning !== -1 ? String(row[colIdx.meaning]).trim() : "",
        "Synonym": colIdx.synonym !== -1 ? String(row[colIdx.synonym]).trim() : "",
        "Example_EN": colIdx.exampleEn !== -1 ? String(row[colIdx.exampleEn]).trim() : "",
        "Example_JA": colIdx.exampleJa !== -1 ? String(row[colIdx.exampleJa]).trim() : "",
        "Level": config.level
      });
    }
  }
  
  return jsonResponse(words);
}

function getOrCreateWeakWordsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "WeakWords";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["WordNo", "CreatedAt"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
