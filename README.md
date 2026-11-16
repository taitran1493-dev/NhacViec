# 🔔 TaskReminder Hub - Hệ Thống Nhắc Việc Trực Tuyến & Gửi Thông Báo Gmail

Hệ thống quản lý, phân công và tự động nhắc nhở công việc qua Gmail dành cho cá nhân, nhóm làm việc và doanh nghiệp.

---

## 🌟 Tính Năng Nổi Bật

1. **Quản lý công việc linh hoạt**:
   - Thêm, sửa, xóa công việc kèm mốc thời gian chi tiết (ngày & giờ).
   - Thiết lập lặp lại định kỳ hàng ngày (Hàng ngày đến giờ tự động gửi thông báo).
   - Phân cấp mức độ ưu tiên: Khẩn cấp (Urgent), Ưu tiên cao (High), Bình thường (Medium), Thấp (Low).
   - Đánh dấu hoàn thành trực quan ngay trên thẻ hoặc bảng danh sách.

2. **Phân chia ca làm việc trong ngày (Sáng - Trưa - Chiều - Tối)**:
   - 🌅 **Ca Sáng (08:00 - 11:30)**: Nhắc nhở bài đăng mở đầu ngày, tin tức, chia sẻ giá trị.
   - ☀️ **Ca Trưa (11:30 - 14:00)**: Nhắc nhở bài đăng tương tác, minigame, Q&A trong giờ nghỉ trưa.
   - 🌇 **Ca Chiều (14:00 - 18:00)**: Nhắc nhở bài đăng sản phẩm, khuyến mãi, chốt đơn cuối ngày.
   - 🌙 **Ca Tối & Nhiệm vụ khác**: Tổng kết chỉ số, báo cáo tương tác hoặc giờ tự chọn.
   - ⚡ **Tạo Nhanh 1-Click**: Tự động sinh ngay 3 bài đăng MXH chuẩn khung giờ cho cả ngày kèm phân công nhân sự.

3. **Quản lý Nhân sự & Người/Tập thể thực hiện**:
   - Thêm danh sách nhân viên, chuyên viên, đội nhóm (Tên, Email Gmail nhận thông báo, Vai trò, Phòng ban, Màu sắc đại diện).
   - Nút **"Gửi Thử Email Test"** tới từng nhân viên để kiểm tra tính sẵn sàng của hộp thư.

4. **Tự động gửi thông báo qua Gmail SMTP**:
   - **Quét tự động định kỳ (Mỗi 30 giây)**: Background scheduler chạy ngầm kiểm tra đến giờ nhắc sẽ tự động gửi email.
   - **Gửi nhắc nhở tức thì (Instant Dispatch)**: Nút bấm 🔔 "Nhắc Ngay" cho phép gửi email đến nhân viên bất kỳ lúc nào.
   - **Giao diện Email HTML sang trọng**: Hiển thị rõ ràng Ca làm việc, Tiêu đề, Hạn chót, Người phụ trách và Nút bấm trực tiếp mở Bảng điều khiển.
   - **Chế độ Mô Phỏng (Demo Mode)**: Nếu chưa cấu hình Mật khẩu ứng dụng Gmail, hệ thống vẫn lưu trữ và ghi nhận nhật ký mô phỏng an toàn, không bị crash.

5. **Nhật ký thông báo (Audit Logs)**:
   - Ghi lại đầy đủ lịch sử: Gửi lúc mấy giờ, gửi cho ai, nội dung gì và trạng thái thành công/thất bại.

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Chạy bằng file Batch
Nhấp đúp chuột vào file `start.bat` trong thư mục `task-reminder-hub`.

### Cách 2: Chạy bằng dòng lệnh Terminal
```bash
cd "C:\Users\PC\.gemini\antigravity\scratch\task-reminder-hub"
python app.py
```

Truy cập giao diện tại trình duyệt: **`http://localhost:5000`**

---

## 🔑 Hướng Dẫn Cấu Hình Gmail SMTP (1 Phút)

1. Mở tài khoản Google: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Bật tính năng **Xác minh 2 bước (2-Step Verification)** (nếu chưa bật).
3. Tại thanh tìm kiếm trên cùng của tài khoản Google, gõ **"Mật khẩu ứng dụng"** (App passwords).
4. Nhập tên ứng dụng bất kỳ (ví dụ: `Nhắc Việc`). Bấm **Tạo**.
5. Google sẽ cấp cho bạn một chuỗi **16 ký tự màu vàng**.
6. Vào tab **Cấu Hình Gmail** trên giao diện web, dán Email Gmail và chuỗi 16 ký tự này vào rồi bấm **Lưu Cấu Hình**.
7. Bấm **"Gửi Thử Email Test"** để xác nhận kết nối thành công!
