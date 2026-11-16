/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - HỆ THỐNG NHẮC VIỆC & PHÂN CÔNG PHÒNG KINH DOANH
 * =========================================================================
 * Webhook đa năng kết nối trực tiếp với giao diện Web online:
 * 1. action: 'save_all'       -> Lưu đồng thời Công Việc vào "Danh Sach Cong Viec" và Nhân Sự vào "NhanSu"
 * 2. action: 'save_tasks'     -> Lưu toàn bộ danh sách công việc vào tab "Danh Sach Cong Viec"
 * 3. action: 'save_employees' -> Lưu toàn bộ danh sách nhân sự vào tab "NhanSu"
 * 4. action: 'send_email'     -> Gửi email nhắc việc qua Gmail & tự động ghi log vào tab "BaoCao"
 * 
 * Hướng dẫn cài đặt / cập nhật:
 * - Bước 1: Mở Google Sheet -> Menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * - Bước 2: Dán toàn bộ mã nguồn này đè vào file Code.gs -> Bấm biểu tượng Lưu (Ctrl + S).
 * - Bước 3: Bấm nút "Triển khai" (Deploy) ở góc trên bên phải -> "Quản lý bản triển khai" (Manage deployments).
 * - Bước 4: Bấm biểu tượng Cây Bút Chì (Chỉnh sửa) -> Ở mục "Phiên bản" (Version), chọn "Phiên bản mới" (New version) -> Bấm "Triển khai" (Deploy).
 *   (Đường link Webhook Exec của bạn sẽ giữ nguyên không thay đổi!)
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

      // Tự động ghi nhật ký vào sheet BaoCao
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
    // 2. LƯU CÔNG VIỆC VÀO SHEET "Danh Sach Cong Viec"
    // =====================================================================
    if (data.action === 'save_tasks' || data.action === 'save_all') {
      var taskSheet = ss.getSheetByName('Danh Sach Cong Viec');
      if (!taskSheet) {
        taskSheet = ss.insertSheet('Danh Sach Cong Viec');
      }

      var taskHeaders = [
        'Tiêu đề công việc',
        'Mô tả chi tiết',
        'Khung giờ',
        'Giờ nhắc cụ thể',
        'Người / Phân bổ phụ trách',
        'Độ ưu tiên',
        'Chế độ phân bổ',
        'Trạng thái',
        'Cập nhật lúc'
      ];

      // Xóa trắng bảng cũ để đồng bộ 100% với giao diện người dùng
      taskSheet.clearContents();
      taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
      taskSheet.getRange(1, 1, 1, taskHeaders.length)
        .setFontWeight('bold')
        .setBackground('#1d4ed8')
        .setFontColor('#ffffff');

      if (data.tasks && data.tasks.length > 0) {
        var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
        var taskRows = data.tasks.map(function(t) {
          return [
            t.title || '',
            t.description || '',
            t.slotName || t.slot || '',
            t.scheduled_time || '',
            t.assignee_label || t.assignee_name || '',
            t.priorityName || t.priority || 'Bình thường',
            t.modeName || t.assignee_mode || 'Cố định',
            t.statusName || t.status || 'Chờ thực hiện',
            nowStr
          ];
        });
        taskSheet.getRange(2, 1, taskRows.length, taskHeaders.length).setValues(taskRows);
        taskSheet.autoResizeColumns(1, taskHeaders.length);
      }

      if (data.action === 'save_tasks') {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Đã lưu thành công ' + (data.tasks ? data.tasks.length : 0) + ' công việc vào sheet "Danh Sach Cong Viec"!'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // =====================================================================
    // 3. LƯU NHÂN SỰ VÀO SHEET "NhanSu"
    // =====================================================================
    if (data.action === 'save_employees' || data.action === 'save_all') {
      var empSheet = ss.getSheetByName('NhanSu');
      if (!empSheet) {
        empSheet = ss.insertSheet('NhanSu');
      }

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

      if (data.employees && data.employees.length > 0) {
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
    system: 'Phòng Kinh Doanh - Hệ Thống Nhắc Việc & Phân Bổ',
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}
