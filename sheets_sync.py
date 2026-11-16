import urllib.request
import urllib.parse
import csv
import io
import re
from datetime import datetime, date

DEFAULT_SHEET_ID = "1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA"
DEFAULT_GIDS = {
    'tasks': '0',           # Danh Sach Cong Viec
    'employees': '1121546996', # NhanSu
    'reports': '2026235113'    # BaoCao
}

def extract_sheet_id(url_or_id):
    if not url_or_id:
        return DEFAULT_SHEET_ID
    url_or_id = url_or_id.strip()
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url_or_id)
    if match:
        return match.group(1)
    return url_or_id

def fetch_sheet_rows(sheet_id, gid):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode('utf-8')
            if not content.strip():
                return []
            reader = list(csv.reader(io.StringIO(content)))
            return reader
    except Exception as e:
        print(f"[SHEETS ERROR] Failed fetching gid={gid}: {e}")
        return []

def normalize_text(text):
    if not text:
        return ""
    return str(text).strip().lower()

def parse_slot(val):
    v = normalize_text(val)
    if 'sáng' in v or 'sang' in v or 'morning' in v or '08' in v or '09' in v:
        return 'morning'
    if 'trưa' in v or 'trua' in v or 'noon' in v or '11' in v or '12' in v or '13' in v:
        return 'noon'
    if 'chiều' in v or 'chieu' in v or 'afternoon' in v or '14' in v or '15' in v or '16' in v or '17' in v:
        return 'afternoon'
    if 'tối' in v or 'toi' in v or 'evening' in v or 'night' in v or '18' in v or '19' in v or '20' in v:
        return 'evening'
    return 'custom'

def parse_priority(val):
    v = normalize_text(val)
    if 'khẩn' in v or 'urgent' in v or 'gấp' in v:
        return 'urgent'
    if 'cao' in v or 'high' in v:
        return 'high'
    if 'thấp' in v or 'low' in v:
        return 'low'
    return 'medium'

def parse_recurring(val):
    v = normalize_text(val)
    if any(x in v for x in ['hàng ngày', 'hang ngay', 'daily', 'có', 'co', '1', 'yes', 'true']):
        return 1
    return 0

def parse_time(val, default="09:00"):
    if not val:
        return default
    val = str(val).strip()
    match = re.search(r'(\d{1,2})[:h](\d{2})', val)
    if match:
        h = int(match.group(1))
        m = int(match.group(2))
        return f"{h:02d}:{m:02d}"
    return default

def sync_google_sheets(conn, sheet_id=None, gids=None):
    sheet_id = sheet_id or DEFAULT_SHEET_ID
    gids = gids or DEFAULT_GIDS
    cursor = conn.cursor()

    stats = {
        'employees_imported': 0,
        'employees_updated': 0,
        'tasks_imported': 0,
        'tasks_updated': 0,
        'sheet_is_empty': False,
        'messages': []
    }

    # 1. Sync Employees (NhanSu)
    emp_rows = fetch_sheet_rows(sheet_id, gids.get('employees', DEFAULT_GIDS['employees']))
    emp_map_by_email = {}
    emp_map_by_name = {}

    if len(emp_rows) > 1:
        headers = [normalize_text(h) for h in emp_rows[0]]
        # Find column indices
        col_name = next((i for i, h in enumerate(headers) if any(k in h for k in ['họ tên', 'tên', 'name', 'nhân sự', 'nhansu'])), 0)
        col_email = next((i for i, h in enumerate(headers) if 'email' in h or 'mail' in h or 'gmail' in h), 1)
        col_role = next((i for i, h in enumerate(headers) if any(k in h for k in ['chức vụ', 'vai trò', 'role'])), 2)
        col_dept = next((i for i, h in enumerate(headers) if any(k in h for k in ['phòng ban', 'bộ phận', 'dept'])), 3)

        for row in emp_rows[1:]:
            if not row or not any(row):
                continue
            name = row[col_name].strip() if len(row) > col_name else ""
            email = row[col_email].strip() if len(row) > col_email else ""
            role = row[col_role].strip() if len(row) > col_role else "Nhân viên"
            dept = row[col_dept].strip() if len(row) > col_dept else "Mitsubishi BTH"

            if not email and not name:
                continue

            if not email:
                email = f"{normalize_text(name).replace(' ', '')}@gmail.com"

            cursor.execute("SELECT id FROM employees WHERE email = ?", (email,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("""
                    UPDATE employees SET name = ?, role = ?, department = ? WHERE id = ?
                """, (name or email, role, dept, existing[0]))
                emp_id = existing[0]
                stats['employees_updated'] += 1
            else:
                cursor.execute("""
                    INSERT INTO employees (name, email, role, department, color, is_active, created_at)
                    VALUES (?, ?, ?, ?, '#2563EB', 1, ?)
                """, (name or email, email, role, dept, datetime.now().isoformat()))
                emp_id = cursor.lastrowid
                stats['employees_imported'] += 1

            emp_map_by_email[email.lower()] = emp_id
            if name:
                emp_map_by_name[name.lower()] = emp_id
    else:
        stats['messages'].append("Sheet 'NhanSu' hiện chưa có dữ liệu hàng.")

    # 2. Sync Tasks (Danh Sach Cong Viec)
    task_rows = fetch_sheet_rows(sheet_id, gids.get('tasks', DEFAULT_GIDS['tasks']))
    if len(task_rows) > 1:
        headers = [normalize_text(h) for h in task_rows[0]]
        col_title = next((i for i, h in enumerate(headers) if any(k in h for k in ['tiêu đề', 'công việc', 'tên việc', 'title'])), 0)
        col_desc = next((i for i, h in enumerate(headers) if any(k in h for k in ['mô tả', 'chi tiết', 'nội dung', 'desc'])), 1)
        col_slot = next((i for i, h in enumerate(headers) if any(k in h for k in ['ca', 'khung giờ', 'buổi', 'slot'])), 2)
        col_time = next((i for i, h in enumerate(headers) if any(k in h for k in ['giờ', 'thời gian', 'time'])), 3)
        col_assignee = next((i for i, h in enumerate(headers) if any(k in h for k in ['người thực hiện', 'phụ trách', 'nhân sự', 'assignee'])), 4)
        col_priority = next((i for i, h in enumerate(headers) if any(k in h for k in ['ưu tiên', 'mức độ', 'priority'])), 5)
        col_recurring = next((i for i, h in enumerate(headers) if any(k in h for k in ['lặp lại', 'hàng ngày', 'recurring'])), 6)
        col_status = next((i for i, h in enumerate(headers) if any(k in h for k in ['trạng thái', 'tiến độ', 'status'])), 7)

        today_str = date.today().isoformat()
        for row in task_rows[1:]:
            if not row or not any(row):
                continue
            title = row[col_title].strip() if len(row) > col_title else ""
            if not title:
                continue

            desc = row[col_desc].strip() if len(row) > col_desc else ""
            raw_slot = row[col_slot].strip() if len(row) > col_slot else ""
            slot = parse_slot(raw_slot)

            default_time = {'morning': '09:00', 'noon': '12:00', 'afternoon': '16:30', 'evening': '18:00'}.get(slot, '09:00')
            raw_time = row[col_time].strip() if len(row) > col_time else ""
            scheduled_time = parse_time(raw_time, default_time)

            assignee_val = row[col_assignee].strip() if len(row) > col_assignee else ""
            assignee_id = None
            if assignee_val:
                assignee_id = emp_map_by_email.get(assignee_val.lower()) or emp_map_by_name.get(assignee_val.lower())
                if not assignee_id:
                    # Look up in DB
                    cursor.execute("SELECT id FROM employees WHERE email = ? OR name = ?", (assignee_val, assignee_val))
                    found = cursor.fetchone()
                    if found:
                        assignee_id = found[0]

            raw_priority = row[col_priority].strip() if len(row) > col_priority else ""
            priority = parse_priority(raw_priority)

            raw_rec = row[col_recurring].strip() if len(row) > col_recurring else ""
            is_recurring = parse_recurring(raw_rec)

            raw_status = row[col_status].strip() if len(row) > col_status else ""
            status = 'completed' if any(x in normalize_text(raw_status) for x in ['xong', 'hoàn thành', 'done', 'completed']) else 'pending'

            # Upsert into tasks by title
            cursor.execute("SELECT id FROM tasks WHERE title = ?", (title,))
            existing_task = cursor.fetchone()
            if existing_task:
                cursor.execute("""
                    UPDATE tasks
                    SET description = ?, slot = ?, scheduled_time = ?, priority = ?, is_recurring = ?, assignee_id = ?, status = ?
                    WHERE id = ?
                """, (desc, slot, scheduled_time, priority, is_recurring, assignee_id, status, existing_task[0]))
                stats['tasks_updated'] += 1
            else:
                cursor.execute("""
                    INSERT INTO tasks (title, description, slot, scheduled_time, due_date, is_recurring, priority, status, assignee_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (title, desc, slot, scheduled_time, today_str, is_recurring, priority, status, assignee_id, datetime.now().isoformat()))
                stats['tasks_imported'] += 1
    else:
        stats['sheet_is_empty'] = True
        stats['messages'].append("Sheet 'Danh Sach Cong Viec' hiện chưa có hàng dữ liệu nào.")

    conn.commit()
    return stats

def get_sheet_templates():
    """Generates standard template tables for user to copy-paste into Google Sheets."""
    tasks_template = """Tiêu Đề Công Việc\tMô Tả Chi Tiết\tCa Làm Việc\tGiờ Nhắc\tNgười Thực Hiện\tMức Độ Ưu Tiên\tLặp Lại\tTrạng Thái
Đăng bài Fanpage ca Sáng: Điểm tin & Kiến thức ngành\tSoạn nội dung chào ngày mới, chia sẻ tips hữu ích cho khách hàng kèm hình ảnh chuẩn\tSáng\t09:00\ttaitran.1493@gmail.com\tCao\tHàng ngày\tChờ xử lý
Đăng bài Fanpage ca Trưa: Tương tác / Minigame / Q&A\tĐăng câu đố ngắn, khảo sát ý kiến khách hàng để kéo tương tác trong giờ nghỉ trưa\tTrưa\t12:00\ttaitran.1493@gmail.com\tBình thường\tHàng ngày\tChờ xử lý
Đăng bài Fanpage ca Chiều: Sản phẩm & Khuyến mãi ngày\tGiới thiệu dòng xe & dịch vụ bảo dưỡng Mitsubishi, kêu gọi khách hàng inbox nhận ưu đãi\tChiều\t16:30\ttaitran.1493@gmail.com\tKhẩn cấp\tHàng ngày\tChờ xử lý
Tổng hợp báo cáo tương tác & lead trong ngày\tTổng kết chỉ số Reach, Comment, Inbox của 3 bài đăng gửi vào nhóm quản lý\tTối\t18:00\ttaitran.1493@gmail.com\tBình thường\tHàng ngày\tChờ xử lý"""

    employees_template = """Họ Và Tên\tEmail Nhận Thông Báo\tChức Vụ / Vai Trò\tPhòng Ban\tTrạng Thái
Tài Trần\ttaitran.1493@gmail.com\tQuản lý & Tiếp nhận thông báo chính\tMitsubishi BTH\tHoạt động
Trần Thị Mai\tmai.social@gmail.com\tChuyên viên Content Social\tMarketing\tHoạt động
Nguyễn Văn An\tan.contentlead@gmail.com\tContent Leader\tMarketing\tHoạt động
Lê Hoàng Nam\tnam.design@gmail.com\tGraphic Designer & Media\tSáng tạo & Media\tHoạt động"""

    reports_template = """Thời Gian Gửi\tTên Công Việc\tNgười Nhận\tMail Nhận\tMail Gửi\tTrạng Thái\tThông Điệp"""

    return {
        'tasks': tasks_template,
        'employees': employees_template,
        'reports': reports_template
    }
