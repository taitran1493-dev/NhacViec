# 🚀 Hướng Dẫn Sử Dụng & Đưa Lên GitHub Tool Nhắc Việc Online (Phòng Kinh Doanh)

File `index.html` là một ứng dụng web độc lập hoàn chỉnh (**Single-File Web App**), chạy trực tiếp trên GitHub Pages không cần server, có khả năng đồng bộ 2 chiều (Đọc & Ghi) với Google Sheets và gửi email thông báo qua Gmail Webhook.

---

## 🌟 CẬP NHẬT QUAN TRỌNG: TÍNH NĂNG LƯU VÀO GOOGLE SHEET (2 CHIỀU)

Hệ thống hiện tại đã hỗ trợ đầy đủ tính năng **Lưu Công Việc** và **Lưu Nhân Sự** vào các tab Google Sheet tương ứng:

| Dữ liệu trên Web App | Tab Sheet tương ứng trên Google Drive | Thao tác kích hoạt |
| :--- | :--- | :--- |
| **Công Việc (Tasks)** | `Danh Sach Cong Viec` | Bấm nút **"Lưu Vào Sheet"** (hoặc tự động lưu khi thêm/sửa/xóa) |
| **Nhân Sự (Team)** | `NhanSu` | Bấm nút **"Lưu Nhân Sự Vào Sheet"** (hoặc tự động lưu khi thêm/sửa/xóa) |
| **Nhật Ký Thông Báo** | `BaoCao` | Tự động ghi log mỗi khi hệ thống gửi email nhắc việc |

---

## ⚡ HƯỚNG DẪN CẬP NHẬT CODE.GS TRONG GOOGLE APPS SCRIPT (BẮT BUỘC ĐỂ GHI SHEET)

Để Google Sheet của bạn cho phép Web App ghi trực tiếp dữ liệu vào 2 sheet `Danh Sach Cong Viec` và `NhanSu`, bạn hãy thực hiện 4 bước sau (chỉ mất 1 phút):

1. **Mở Google Sheet của bạn**:
   - Truy cập: [Google Sheet Phòng Kinh Doanh](https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing)
   - Vào menu trên cùng: **Tiện ích mở rộng (Extensions)** > **Apps Script**.

2. **Dán mã nguồn mới vào file `Code.gs`**:
   - Mở file `Code.gs`, **xóa sạch** toàn bộ mã cũ.
   - Sao chép toàn bộ nội dung trong file [Code.gs](file:///C:/Users/PC/.gemini/antigravity/scratch/task-reminder-hub/Code.gs) (hoặc bấm nút **"Mã Script Ghi Sheet"** ngay trên giao diện Web) và dán vào.
   - Bấm biểu tượng **Lưu (Ctrl + S)**.

3. **Cập nhật Bản Triển Khai (Deploy)**:
   - Ở góc trên bên phải, bấm nút **Triển khai (Deploy)** > chọn **Quản lý bản triển khai (Manage deployments)**.
   - Bấm vào biểu tượng **Cây Bút Chì (Chỉnh sửa)** bên cạnh bản triển khai hiện tại.
   - Tại mục **Phiên bản (Version)**: Chọn **Phiên bản mới (New version)**.
   - Bấm nút **Triển khai (Deploy)** ở góc dưới.

> [!NOTE]
> Đường link Webhook URL (`.../exec`) của bạn sẽ **giữ nguyên không đổi**, nhưng hệ thống Google Apps Script sẽ nhận phiên bản code mới nhất có quyền ghi và format các bảng tính!

---

## 📌 Cách đưa lên GitHub & Chạy Online trong 1 phút

1. Đăng nhập [GitHub.com](https://github.com) > Tạo Repository mới (đặt tên ví dụ: `phong-kinh-doanh-reminder`, chọn chế độ **Public**).
2. Bấm **"uploading an existing file"** > Kéo thả file `index.html` từ:
   `C:\Users\PC\.gemini\antigravity\scratch\task-reminder-hub\index.html` vào GitHub.
3. Bấm **Commit changes**.
4. Vào **Settings** của repository > chọn mục **Pages** ở thanh menu bên trái:
   - **Branch**: Chọn `main` (hoặc `master`), thư mục giữ nguyên `/ (root)`.
   - Bấm **Save**.
5. Sau khoảng 30 giây đến 1 phút, bạn sẽ có link online truy cập miễn phí vĩnh viễn:
   👉 **`https://<ten-tai-khoan>.github.io/<ten-repo>/`**

---

## 🛠️ Toàn Bộ Mã Nguồn `Code.gs` (Để tiện copy trực tiếp)

```javascript
function doPost(e) {
  try {
    var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. GỬI EMAIL NHẮC VIỆC & GHI LOG VÀO SHEET "BaoCao"
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
        reportSheet.getRange(1, 1, 1, reportHeaders.length).setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
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

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Đã gửi email nhắc việc thành công!' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. LƯU CÔNG VIỆC VÀO SHEET "Danh Sach Cong Viec"
    if (data.action === 'save_tasks' || data.action === 'save_all') {
      var taskSheet = ss.getSheetByName('Danh Sach Cong Viec');
      if (!taskSheet) taskSheet = ss.insertSheet('Danh Sach Cong Viec');

      var taskHeaders = ['Tiêu đề công việc', 'Mô tả chi tiết', 'Khung giờ', 'Giờ nhắc cụ thể', 'Người / Phân bổ phụ trách', 'Độ ưu tiên', 'Chế độ phân bổ', 'Trạng thái', 'Cập nhật lúc'];
      taskSheet.clearContents();
      taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
      taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');

      if (data.tasks && data.tasks.length > 0) {
        var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
        var taskRows = data.tasks.map(function(t) {
          return [t.title || '', t.description || '', t.slotName || t.slot || '', t.scheduled_time || '', t.assignee_label || t.assignee_name || '', t.priorityName || t.priority || 'Bình thường', t.modeName || t.assignee_mode || 'Cố định', t.statusName || t.status || 'Chờ thực hiện', nowStr];
        });
        taskSheet.getRange(2, 1, taskRows.length, taskHeaders.length).setValues(taskRows);
        taskSheet.autoResizeColumns(1, taskHeaders.length);
      }

      if (data.action === 'save_tasks') {
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Đã lưu công việc vào sheet "Danh Sach Cong Viec"!' })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 3. LƯU NHÂN SỰ VÀO SHEET "NhanSu"
    if (data.action === 'save_employees' || data.action === 'save_all') {
      var empSheet = ss.getSheetByName('NhanSu');
      if (!empSheet) empSheet = ss.insertSheet('NhanSu');

      var empHeaders = ['Họ và tên', 'Email nhận thông báo', 'Chức vụ', 'Phòng ban', 'Cập nhật lúc'];
      empSheet.clearContents();
      empSheet.getRange(1, 1, 1, empHeaders.length).setValues([empHeaders]);
      empSheet.getRange(1, 1, 1, empHeaders.length).setFontWeight('bold').setBackground('#059669').setFontColor('#ffffff');

      if (data.employees && data.employees.length > 0) {
        var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
        var empRows = data.employees.map(function(e) {
          return [e.name || '', e.email || 'tttai.mitsubishi.bth@gmail.com', e.role || 'Chuyên viên kinh doanh', e.department || 'Phòng Kinh Doanh', nowStr];
        });
        empSheet.getRange(2, 1, empRows.length, empHeaders.length).setValues(empRows);
        empSheet.autoResizeColumns(1, empHeaders.length);
      }

      if (data.action === 'save_employees') {
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Đã lưu nhân sự vào sheet "NhanSu"!' })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 4. LƯU TẤT CẢ (save_all)
    if (data.action === 'save_all') {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Đã lưu cả Công việc và Nhân sự vào Google Sheet!' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Yêu cầu không có action phù hợp: ' + data.action })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'online', system: 'Phòng Kinh Doanh - TaskHub', timestamp: new Date() })).setMimeType(ContentService.MimeType.JSON);
}
```
