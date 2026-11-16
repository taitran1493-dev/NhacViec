# 🚀 Hướng Dẫn Đưa Lên GitHub & Sử Dụng Tool Nhắc Việc Online (Mitsubishi BTH)

File `index.html` đã được xây dựng thành **một file duy nhất (Standalone Single-File Web App)** với đầy đủ các tính năng phân bổ nhân sự, xoay vòng ca và tự động gửi email thông qua Webhook Exec Google Apps Script của bạn.

---

## 🌟 Điểm Cải Tiến & Tính Năng Cốt Lõi Mới

1. **Không còn công việc mẫu bị gán cứng**:
   - Giao diện sạch sẽ, bắt đầu với các tùy chọn do bạn thêm vào hoặc đồng bộ trực tiếp từ Google Sheet.
2. **Cơ chế phân bổ nhân sự đa dạng**:
   - 🔄 **Xoay vòng theo Ngày (Daily Rotation)**: Chọn danh sách nhân sự (ví dụ: An, Bình, Châu) -> Mỗi ngày hệ thống tự động giao cho 1 bạn phụ trách xoay vòng (hỗ trợ cả 3 ca Sáng, Trưa, Chiều trong ngày).
   - 🔄 **Xoay vòng theo Tuần (Weekly Rotation)**: Mỗi tuần 1 bạn phụ trách.
   - ⏱️ **Xoay vòng theo Ca (Shift Rotation)**: Ca Sáng bạn A, Ca Trưa bạn B, Ca Chiều bạn C.
   - 📢 **Nhắc TẤT CẢ nhân sự (Broadcast)**: Gửi thông báo đồng loạt tới mọi thành viên (phù hợp cho: "Báo cáo cuối ngày", "Họp tuần"...).
   - 👤 **Chỉ định cố định**: Giao cố định cho 1 nhân sự cụ thể.
3. **Phát hiện trùng lịch & Trùng nhân sự (Conflict Detection)**:
   - Tự động kiểm tra và gắn cờ cảnh báo màu đỏ nếu 1 nhân sự bị giao từ 2 việc trở lên trong cùng 1 khung giờ, giúp quản lý không bị phân công chồng chéo.
4. **Ma trận phân bổ 7 ngày (Schedule Matrix)**:
   - Bảng trực quan thể hiện lịch phân công trong 7 ngày tới (Thứ 2 đến Chủ Nhật), nhìn vào là biết ai trực ngày nào, ca nào.
5. **Cảnh báo khi Sheet `NhanSu` chưa có dữ liệu**:
   - Tự động phát hiện nếu sheet `NhanSu` còn trống và hiển thị thông báo yêu cầu nhập nhân sự kèm nút bấm sao chép mẫu cột vào Google Sheet.
6. **Đã tích hợp sẵn Webhook Exec của bạn**:
   - `https://script.google.com/macros/s/AKfycbwP2j1YvdVGwD__ArFRVHoWCMMzvN07weeEmat7YYpuUMITXGqtf0va4h1vLiUdLa9C/exec`
   - Mail gửi: `tttai.mitsubishi.bth@gmail.com`
   - Mail nhận chính: `taitran.1493@gmail.com`
   - Tự động ghi nhật ký vào sheet `BaoCao`.

---

## 📌 Cách đưa lên GitHub & Chạy Online trong 1 phút

1. Đăng nhập [GitHub.com](https://github.com) > Tạo Repository mới (chế độ **Public**).
2. Bấm **"uploading an existing file"** > Kéo thả file `index.html` từ:
   `C:\Users\PC\.gemini\antigravity\scratch\task-reminder-hub\index.html` vào GitHub.
3. Bấm **Commit changes**.
4. Vào **Settings** của repository > chọn mục **Pages** ở thanh menu trái:
   - **Branch**: Chọn `main` (hoặc `master`), thư mục giữ nguyên `/ (root)`.
   - Bấm **Save**.
5. Sau 30 giây, link online sẽ xuất hiện:
   👉 **`https://<ten-tai-khoan>.github.io/<ten-repo>/`**
