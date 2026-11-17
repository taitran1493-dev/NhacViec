/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - HỆ THỐNG NHẮC VIỆC & PHÂN CÔNG PHÒNG KINH DOANH
 * =========================================================================
 * Webhook URL:
 * https://script.google.com/macros/s/AKfycbznDq_z0thisC7LSpshyeJr6X3QxNbe-NJ0RCrJ1fcvr4_4KyFGBer4aszpuxbdlggp/exec
 * 
 * Các chức năng cốt lõi:
 * 1. doPost(e): Webhook nhận lệnh từ giao diện Web (save_all, save_tasks, save_employees, send_email).
 *    - Có cơ chế BẢO VỆ DỮ LIỆU: Chặn ghi đè mảng rỗng khi mở từ trình duyệt/thiết bị mới chưa đồng bộ!
 * 2. autoCheckAndSendReminders(): HÀM TỰ ĐỘNG CHẠY 24/7 TRÊN GOOGLE CLOUD
 *    - Quét sheet "Danh Sach Cong Viec" và "NhanSu" mỗi 5-10 phút.
 *    - Đến đúng giờ cấu hình (09:00, 12:00, 16:30...), tự gửi Gmail cho người đến lượt.
 * 3. setupAutoReminderTrigger(): Chạy hàm này 1 lần để kích hoạt lịch tự động 24/7!
 * =========================================================================
 */

function doPost(e) {
  try {
    var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // =====================================================================
    // 1. GỬI EMAIL THÔNG BÁO NHẮC VIỆC & GHI LOG VÀO SHEET "BaoCao"
    // =====================================================================
    if (data.action === 'send_email') {
      var recipient = data.to || 'tttai.mitsubishi.bth@gmail.com';
      var subject = data.subject || '🔔 [Phòng Kinh Doanh] Nhắc nhở công việc';
      var bodyText = data.bodyText || '';
      var htmlBody = data.htmlBody || '';

      if (recipient) {
        GmailApp.sendEmail(recipient, subject, bodyText, {
          htmlBody: htmlBody,
          name: 'Phòng Kinh Doanh - Nhắc Việc Tự Động'
        });
      }

      var reportSheet = ss.getSheetByName('BaoCao');
      if (!reportSheet) {
        reportSheet = ss.insertSheet('BaoCao');
      }
      if (reportSheet.getLastRow() === 0) {
        var reportHeaders = ['Thời gian gửi', 'Tiêu đề công việc', 'Người nhận', 'Email nhận', 'Hệ thống gửi', 'Trạng thái', 'Ghi chú'];
        reportSheet.appendRow(reportHeaders);
        reportSheet.getRange(1, 1, 1, reportHeaders.length)
          .setFontWeight('bold')
          .setBackground('#2563eb')
          .setFontColor('#ffffff');
      }

      var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
      reportSheet.appendRow([
        nowStr,
        data.taskTitle || '',
        data.recipientName || '',
        recipient,
        Session.getActiveUser().getEmail(),
        'Thành công',
        'Đã gửi qua Gmail Webhook'
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Đã gửi email nhắc việc thành công!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =====================================================================
    // 2. LƯU CÔNG VIỆC VÀO SHEET "Danh Sach Cong Viec" (CÓ CHỐNG MẤT DỮ LIỆU)
    // =====================================================================
    if (data.action === 'save_tasks' || data.action === 'save_all') {
      var taskSheet = ss.getSheetByName('Danh Sach Cong Viec');
      if (!taskSheet) {
        taskSheet = ss.insertSheet('Danh Sach Cong Viec');
      }

      var hasIncomingTasks = (data.tasks && data.tasks.length > 0);
      var allowEmptyTasks = (data.allowEmptyOverwrite === true);

      // Bảo vệ: Nếu thiết bị mới gửi mảng rỗng mà không có cờ xóa chủ đích, KHÔNG xóa dữ liệu đang có trên Sheet!
      if (hasIncomingTasks || allowEmptyTasks || taskSheet.getLastRow() === 0) {
        var taskHeaders = [
          'Tiêu đề công việc',
          'Mô tả chi tiết',
          'Khung giờ',
          'Giờ nhắc cụ thể',
          'Người phụ trách / Thứ tự luân phiên',
          'Độ ưu tiên',
          'Chế độ phân bổ',
          'Trạng thái',
          'Cập nhật lúc'
        ];

        taskSheet.clearContents();
        taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
        taskSheet.getRange(1, 1, 1, taskHeaders.length)
          .setFontWeight('bold')
          .setBackground('#1d4ed8')
          .setFontColor('#ffffff');

        if (hasIncomingTasks) {
          var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
          var taskRows = data.tasks.map(function(t) {
            return [
              t.title || '',
              t.description || '',
              t.slotName || t.slot || '',
              t.scheduled_time || '09:00',
              t.assignee_label || t.assignee_name || '',
              t.priorityName || t.priority || 'Bình thường',
              t.modeName || t.assignee_mode || 'Cố định',
              t.statusName || t.status || 'Chờ thực hiện',
              nowStr
            ];
          });
          // Định dạng cột Giờ nhắc (cột 4) là văn bản thuần để không bị đổi sang Date(1899...)
          taskSheet.getRange(2, 4, taskRows.length, 1).setNumberFormat('@');
          taskSheet.getRange(2, 1, taskRows.length, taskHeaders.length).setValues(taskRows);
          taskSheet.autoResizeColumns(1, taskHeaders.length);
        }
      }

      if (data.action === 'save_tasks') {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Đã lưu thành công ' + (data.tasks ? data.tasks.length : 0) + ' công việc vào sheet "Danh Sach Cong Viec"!'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // =====================================================================
    // 3. LƯU NHÂN SỰ VÀO SHEET "NhanSu" (CÓ CHỐNG MẤT DỮ LIỆU)
    // =====================================================================
    if (data.action === 'save_employees' || data.action === 'save_all') {
      var empSheet = ss.getSheetByName('NhanSu');
      if (!empSheet) {
        empSheet = ss.insertSheet('NhanSu');
      }

      var hasIncomingEmps = (data.employees && data.employees.length > 0);
      var allowEmptyEmps = (data.allowEmptyOverwrite === true);

      // Bảo vệ: Nếu thiết bị mới gửi mảng rỗng mà không có cờ xóa chủ đích, KHÔNG xóa danh sách nhân sự đang có!
      if (hasIncomingEmps || allowEmptyEmps || empSheet.getLastRow() === 0) {
        var empHeaders = [
          'Họ và tên',
          'Email nhận thông báo',
          'Chức vụ',
          'Phòng ban',
          'Cập nhật lúc'
        ];

        empSheet.clearContents();
        empSheet.getRange(1, 1, 1, empHeaders.length).setValues([empHeaders]);
        empSheet.getRange(1, 1, 1, empHeaders.length)
          .setFontWeight('bold')
          .setBackground('#059669')
          .setFontColor('#ffffff');

        if (hasIncomingEmps) {
          var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
          var empRows = data.employees.map(function(e) {
            return [
              e.name || '',
              e.email || 'tttai.mitsubishi.bth@gmail.com',
              e.role || 'Chuyên viên kinh doanh',
              e.department || 'Phòng Kinh Doanh',
              nowStr
            ];
          });
          empSheet.getRange(2, 1, empRows.length, empHeaders.length).setValues(empRows);
          empSheet.autoResizeColumns(1, empHeaders.length);
        }
      }

      if (data.action === 'save_employees') {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Đã lưu thành công ' + (data.employees ? data.employees.length : 0) + ' nhân sự vào sheet "NhanSu"!'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // =====================================================================
    // 4. LƯU TẤT CẢ (save_all)
    // =====================================================================
    if (data.action === 'save_all') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Đã lưu thành công toàn bộ Công việc và Nhân sự vào các Sheet tương ứng!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Lệnh đã nhận nhưng không có action phù hợp: ' + data.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'Phòng Kinh Doanh TaskHub',
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 5. HÀM TỰ ĐỘNG QUÉT VÀ NHẮC VIỆC 24/7 TRÊN MÁY CHỦ GOOGLE
// =========================================================================
function autoCheckAndSendReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var taskSheet = ss.getSheetByName('Danh Sach Cong Viec');
  var empSheet = ss.getSheetByName('NhanSu');
  var reportSheet = ss.getSheetByName('BaoCao');
  if (!taskSheet) return;

  // Dùng getDisplayValues() để luôn lấy đúng chuỗi giờ "09:00", "17:30"
  var taskData = taskSheet.getDataRange().getDisplayValues();
  if (taskData.length <= 1) return;

  var employees = [];
  if (empSheet && empSheet.getLastRow() > 1) {
    var empData = empSheet.getDataRange().getDisplayValues();
    for (var i = 1; i < empData.length; i++) {
      var row = empData[i];
      if (row[0]) {
        employees.push({
          name: String(row[0]).trim(),
          email: row[1] ? String(row[1]).trim() : 'tttai.mitsubishi.bth@gmail.com',
          role: row[2] ? String(row[2]).trim() : '',
          department: row[3] ? String(row[3]).trim() : ''
        });
      }
    }
  }
  var defaultEmail = 'tttai.mitsubishi.bth@gmail.com';

  var now = new Date();
  var nowHour = parseInt(Utilities.formatDate(now, "GMT+7", "HH"), 10);
  var nowMinute = parseInt(Utilities.formatDate(now, "GMT+7", "mm"), 10);
  var currentTotalMinutes = nowHour * 60 + nowMinute;
  var todayDateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");

  var scriptProps = PropertiesService.getScriptProperties();

  for (var t = 1; t < taskData.length; t++) {
    var taskRow = taskData[t];
    var title = taskRow[0] ? String(taskRow[0]).trim() : '';
    var description = taskRow[1] ? String(taskRow[1]).trim() : '';
    var slot = taskRow[2] ? String(taskRow[2]).trim() : '';
    var timeStr = taskRow[3] ? String(taskRow[3]).trim() : '';
    var assigneeInfo = taskRow[4] ? String(taskRow[4]).trim() : '';
    var priority = taskRow[5] ? String(taskRow[5]).trim() : 'Bình thường';
    var mode = taskRow[6] ? String(taskRow[6]).trim() : 'Cố định';
    var status = taskRow[7] ? String(taskRow[7]).trim() : '';

    if (!title) continue;
    if (status.toLowerCase().includes('hoàn thành') || status.toLowerCase().includes('completed')) continue;

    var timeList = [];
    if (slot.toLowerCase().includes('3 ca') || slot.toLowerCase().includes('cả 3')) {
      timeList = ['09:00', '12:00', '16:30'];
    } else if (timeStr.includes(',')) {
      timeList = timeStr.split(',').map(function(s) { return s.trim(); });
    } else if (timeStr.includes(':')) {
      timeList = [timeStr];
    } else {
      if (slot.includes('Sáng')) timeList = ['09:00'];
      else if (slot.includes('Trưa')) timeList = ['12:00'];
      else if (slot.includes('Chiều')) timeList = ['16:30'];
      else if (slot.includes('Tối')) timeList = ['17:30'];
    }

    for (var m = 0; m < timeList.length; m++) {
      var targetTime = timeList[m];
      var parts = targetTime.split(':');
      if (parts.length < 2) continue;
      var targetH = parseInt(parts[0], 10);
      var targetM = parseInt(parts[1], 10);
      var targetTotalMinutes = targetH * 60 + targetM;

      var diffMinutes = currentTotalMinutes - targetTotalMinutes;
      if (diffMinutes >= 0 && diffMinutes < 12) {
        var reminderKey = 'SENT_' + todayDateStr + '_' + title + '_' + targetTime;
        var alreadySent = scriptProps.getProperty(reminderKey);
        if (alreadySent) continue;

        var recipientsToSend = [];
        if (mode.toLowerCase().includes('tất cả') || assigneeInfo.toLowerCase().includes('tất cả')) {
          recipientsToSend = employees.length > 0 ? employees : [{ name: 'Toàn thể nhân sự', email: defaultEmail }];
        } else if (assigneeInfo.includes('[Hiện tại:')) {
          var match = assigneeInfo.match(/\[Hiện tại:\s*([^\]]+)\]/);
          var curName = match ? match[1].trim() : '';
          var foundEmp = employees.find(function(e) { return e.name.toLowerCase() === curName.toLowerCase(); });
          if (foundEmp) {
            recipientsToSend = [foundEmp];
          } else {
            recipientsToSend = [{ name: curName || 'Người phụ trách', email: defaultEmail }];
          }
        } else {
          var singleEmp = employees.find(function(e) { return e.name.toLowerCase() === assigneeInfo.toLowerCase(); });
          if (singleEmp) {
            recipientsToSend = [singleEmp];
          } else {
            recipientsToSend = [{ name: assigneeInfo || 'Người phụ trách', email: defaultEmail }];
          }
        }

        for (var r = 0; r < recipientsToSend.length; r++) {
          var rec = recipientsToSend[r];
          var targetEmail = rec.email || defaultEmail;

          var emailSubject = '🔔 [Phòng Kinh Doanh - Nhắc Việc] ' + title + ' (' + targetTime + ')';
          var emailBody = 'Xin chào ' + rec.name + ',\n\nBạn có công việc cần thực hiện theo lịch nhắc:\n' +
                          '- Công việc: ' + title + '\n' +
                          '- Khung giờ: ' + targetTime + '\n' +
                          '- Ghi chú: ' + (description || 'Không có') + '\n\n' +
                          'Trân trọng,\nPhòng Kinh Doanh';

          var htmlContent = '<div style="font-family: Arial, sans-serif; max-width: 550px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">' +
            '<div style="background: #2563eb; color: #fff; padding: 20px;">' +
            '<h2 style="margin: 0; font-size: 18px;">🔔 PHÒNG KINH DOANH - NHẮC NHỞ CÔNG VIỆC</h2>' +
            '<p style="margin: 5px 0 0 0; font-size: 13px;">Hệ thống nhắc việc tự động 24/7 trên Google Cloud</p>' +
            '</div>' +
            '<div style="padding: 20px;">' +
            '<p>Xin chào <strong>' + rec.name + '</strong>,</p>' +
            '<p>Đã đến giờ thực hiện công việc được phân bổ hôm nay:</p>' +
            '<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">' +
            '<h3 style="margin-top: 0; color: #0f172a;">' + title + '</h3>' +
            (description ? '<p style="color: #475569; font-size: 13px;">' + description + '</p>' : '') +
            '<p style="margin-bottom: 0;"><strong>⏰ Giờ thực hiện:</strong> ' + targetTime + ' | <strong>Độ ưu tiên:</strong> ' + priority + '</p>' +
            '</div>' +
            '<p style="font-size: 12px; color: #64748b; margin-top: 20px;">Vui lòng hoàn thành công việc đúng tiến độ.</p>' +
            '</div>' +
            '</div>';

          try {
            GmailApp.sendEmail(targetEmail, emailSubject, emailBody, {
              htmlBody: htmlContent,
              name: 'Phòng Kinh Doanh - Nhắc Việc Tự Động'
            });

            if (!reportSheet) {
              reportSheet = ss.insertSheet('BaoCao');
              reportSheet.appendRow(['Thời gian gửi', 'Tiêu đề công việc', 'Người nhận', 'Email nhận', 'Hệ thống gửi', 'Trạng thái', 'Ghi chú']);
            }
            var nowLogStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
            reportSheet.appendRow([
              nowLogStr,
              title,
              rec.name,
              targetEmail,
              'Trigger Tự Động 24/7',
              'Thành công',
              'Tự động gửi theo giờ hẹn: ' + targetTime
            ]);
          } catch (mailErr) {
            Logger.log('Lỗi gửi mail: ' + mailErr);
          }
        }

        scriptProps.setProperty(reminderKey, 'SENT');
      }
    }
  }
}

function setupAutoReminderTrigger() {
  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === 'autoCheckAndSendReminders') {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  }

  ScriptApp.newTrigger('autoCheckAndSendReminders')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✓ Đã cài đặt xong Trigger tự động nhắc việc mỗi 10 phút!');
}
