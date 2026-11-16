# 🚀 Hướng Dẫn Đưa Lên GitHub & Chạy Online Miễn Phí (GitHub Pages)

Tệp `index.html` đã được xây dựng thành **một file duy nhất (Standalone Single-File Web App)**, không cần cài đặt Python hay máy chủ. Bạn chỉ cần tải file này lên GitHub là có thể truy cập từ điện thoại, máy tính hoặc bất kỳ đâu 24/7!

---

## 📌 Bước 1: Tải file lên GitHub

### Cách 1: Thao tác trực tiếp trên giao diện web GitHub (Dễ nhất - Không cần cài Git)
1. Đăng nhập vào [GitHub.com](https://github.com) và tạo một kho lưu trữ mới (Repository), ví dụ đặt tên là: `task-reminder`
2. Chọn chế độ **Public**.
3. Tại trang Repository vừa tạo, bấm **"uploading an existing file"** (hoặc kéo thả).
4. Kéo thả file `index.html` từ máy tính:
   `C:\Users\PC\.gemini\antigravity\scratch\task-reminder-hub\index.html` vào GitHub.
5. Bấm nút màu xanh **"Commit changes"**.

### Cách 2: Bằng dòng lệnh Git (Nếu máy đã cài Git)
```bash
cd "C:\Users\PC\.gemini\antigravity\scratch\task-reminder-hub"
git init
git add index.html
git commit -m "Khoi tao Task Reminder online"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/task-reminder.git
git push -u origin main
```

---

## 📌 Bước 2: Bật tính năng GitHub Pages (Để lấy link chạy Online)

1. Trên trang Repository GitHub của bạn, bấm vào tab **Settings** (Cài đặt) ở góc phải trên.
2. Ở thanh bên trái, tìm và bấm vào mục **Pages**.
3. Tại phần **Build and deployment**:
   - **Source**: Chọn `Deploy from a branch`.
   - **Branch**: Chọn nhánh `main` (hoặc `master`), thư mục giữ nguyên là `/ (root)`.
4. Bấm **Save**.
5. Đợi khoảng 30 - 60 giây, GitHub sẽ cấp cho bạn một đường link online có dạng:  
   👉 **`https://<ten-tai-khoan>.github.io/task-reminder/`**

---

## 📌 Bước 3: Kích hoạt gửi Gmail tự động 100% qua Google Apps Script (2 Phút)

Vì chạy online trên GitHub (không có server riêng), bạn có thể dùng tính năng **Google Apps Script** có sẵn ngay trong Google Sheet của bạn để tự động gửi email từ tài khoản `tttai.mitsubishi.bth@gmail.com`:

1. Mở file Google Sheet của bạn: [https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit](https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit)
2. Trên thanh menu chọn: **Tiện ích mở rộng (Extensions)** &gt; **Apps Script**.
3. Xóa toàn bộ mã mặc định và dán đoạn mã sau vào:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'send_email') {
      GmailApp.sendEmail(data.to, data.subject, data.bodyText, {
        htmlBody: data.htmlBody,
        name: 'Mitsubishi BTH - Nhắc Việc Tự Động'
      });
      
      // Tự động ghi log vào sheet BaoCao
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var reportSheet = ss.getSheetByName('BaoCao');
      if (reportSheet) {
        reportSheet.appendRow([new Date(), data.taskTitle, data.recipientName, data.to, Session.getActiveUser().getEmail(), 'Thành công', 'Đã gửi qua Gmail']);
      }
      return ContentService.createTextOutput(JSON.stringify({success: true, message: 'Đã gửi email thành công!'})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Bấm biểu tượng 💾 **Lưu (Save)**.
5. Bấm nút màu xanh **Triển khai (Deploy)** ở góc trên bên phải &gt; chọn **Triển khai mới (New deployment)**:
   - Chọn loại: **Ứng dụng web (Web app)** (bấm biểu tượng bánh răng cạnh 'Select type').
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me - tttai.mitsubishi.bth@gmail.com)`.
   - **Ai có quyền truy cập (Who has access)**: **`Bất kỳ ai (Anyone)`** *(rất quan trọng)*.
6. Bấm **Triển khai (Deploy)** &gt; Cấp quyền truy cập nếu Google hỏi &gt; Sao chép đường dẫn **URL ứng dụng web** (dạng `https://script.google.com/macros/s/.../exec`).
7. Mở trang web GitHub Pages của bạn &gt; vào tab **Cấu Hình Gmail** &gt; dán link này vào ô **Google Apps Script Webhook URL** rồi bấm **Lưu Cài Đặt**.

Từ đây, mọi thao tác nhắc việc trên web online sẽ **tự động gửi email thật từ Gmail của bạn** và **tự động ghi log vào sheet `BaoCao`** hoàn toàn tự động và miễn phí!
