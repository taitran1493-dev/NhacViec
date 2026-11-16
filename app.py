import os
import sys
import time
import json
import sqlite3
import smtplib
import threading
from datetime import datetime, date, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, render_template, send_from_directory

from sheets_sync import (
    DEFAULT_SHEET_ID,
    DEFAULT_GIDS,
    extract_sheet_id,
    sync_google_sheets,
    get_sheet_templates
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "reminder.db")

app = Flask(__name__, template_folder=os.path.join(BASE_DIR, "templates"), static_folder=os.path.join(BASE_DIR, "static"))

# -------------------------------------------------------------
# DATABASE INITIALIZATION & HELPERS
# -------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Employees / Assignees
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT,
        department TEXT,
        color TEXT DEFAULT '#2563EB',
        is_active INTEGER DEFAULT 1,
        created_at TEXT
    )
    ''')

    # Tasks
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        slot TEXT DEFAULT 'morning', -- morning, noon, afternoon, evening, custom
        scheduled_time TEXT NOT NULL, -- HH:MM e.g. 09:00
        due_date TEXT,                -- YYYY-MM-DD
        is_recurring INTEGER DEFAULT 1, -- 1: daily, 0: one-time
        priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
        status TEXT DEFAULT 'pending',   -- pending, in_progress, completed
        assignee_id INTEGER,
        last_reminded_date TEXT,
        created_at TEXT,
        FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL
    )
    ''')

    # Settings
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    # Reminders log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reminder_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        task_title TEXT,
        recipient_name TEXT,
        recipient_email TEXT,
        subject TEXT,
        status TEXT, -- 'sent', 'simulated', 'failed'
        message TEXT,
        sent_at TEXT
    )
    ''')

    # Config default settings based on user request:
    # Sender: tttai.mitsubishi.bth@gmail.com
    # Receiver: taitran.1493@gmail.com
    # Google Sheet: 1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA
    default_settings = {
        'smtp_email': 'tttai.mitsubishi.bth@gmail.com',
        'smtp_password': '',
        'sender_name': 'Mitsubishi BTH - Nhắc Việc Tự Động',
        'primary_recipient': 'taitran.1493@gmail.com',
        'google_sheet_url': 'https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing',
        'google_sheet_id': '1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA',
        'auto_remind_enabled': '1',
        'auto_sync_sheets': '1',
        'reminder_window_minutes': '30',
        'app_url': 'http://localhost:5000'
    }
    for k, v in default_settings.items():
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (k, v))
        # Update email sender and sheet id if they were previously default
        if k in ['smtp_email', 'google_sheet_url', 'google_sheet_id', 'primary_recipient', 'sender_name']:
            cursor.execute('UPDATE settings SET value = ? WHERE key = ? AND (value = "" OR value LIKE "%localhost%")', (v, k))

    # Add or update Tài Trần as primary recipient
    cursor.execute('SELECT id FROM employees WHERE email = ?', ('taitran.1493@gmail.com',))
    primary_emp = cursor.fetchone()
    if not primary_emp:
        cursor.execute('''
            INSERT INTO employees (name, email, role, department, color, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        ''', ('Tài Trần', 'taitran.1493@gmail.com', 'Quản lý & Tiếp nhận thông báo', 'Mitsubishi BTH', '#2563EB', datetime.now().isoformat()))
        primary_emp_id = cursor.lastrowid
    else:
        primary_emp_id = primary_emp[0]
        cursor.execute("UPDATE employees SET name = 'Tài Trần', department = 'Mitsubishi BTH' WHERE id = ?", (primary_emp_id,))

    # Seed sample employees if only 1 exists
    cursor.execute('SELECT COUNT(*) FROM employees')
    if cursor.fetchone()[0] <= 1:
        sample_employees = [
            ('Trần Thị Mai', 'mai.social@gmail.com', 'Chuyên viên Content Social', 'Marketing', '#EC4899', 1, datetime.now().isoformat()),
            ('Nguyễn Văn An', 'an.contentlead@gmail.com', 'Content Leader', 'Marketing', '#3B82F6', 1, datetime.now().isoformat()),
            ('Lê Hoàng Nam', 'nam.design@gmail.com', 'Graphic Designer', 'Sáng tạo & Media', '#8B5CF6', 1, datetime.now().isoformat())
        ]
        cursor.executemany('''
            INSERT OR IGNORE INTO employees (name, email, role, department, color, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', sample_employees)

    # Seed or re-assign sample daily tasks to Tài Trần
    cursor.execute('SELECT COUNT(*) FROM tasks')
    if cursor.fetchone()[0] == 0:
        today_str = date.today().isoformat()
        sample_tasks = [
            (
                'Đăng bài Fanpage ca Sáng: Điểm tin & Kiến thức ngành',
                'Soạn nội dung chào ngày mới, chia sẻ tips/insights hữu ích cho khách hàng. Kèm hình ảnh kích thước 1200x628 chuẩn.',
                'morning',
                '09:00',
                today_str,
                1,
                'high',
                'pending',
                primary_emp_id,
                None,
                datetime.now().isoformat()
            ),
            (
                'Đăng bài Fanpage ca Trưa: Tương tác / Minigame / Q&A',
                'Khung giờ vàng nghỉ trưa, đăng câu đố ngắn hoặc hỏi đáp kích thích bình luận, chốt tương tác trước 13h.',
                'noon',
                '12:00',
                today_str,
                1,
                'medium',
                'pending',
                primary_emp_id,
                None,
                datetime.now().isoformat()
            ),
            (
                'Đăng bài Fanpage ca Chiều: Sản phẩm & Khuyến mãi ngày',
                'Giới thiệu sản phẩm tiêu biểu, kèm call-to-action (CTA) đặt hàng / inbox nhận ưu đãi cuối ngày.',
                'afternoon',
                '16:30',
                today_str,
                1,
                'urgent',
                'pending',
                primary_emp_id,
                None,
                datetime.now().isoformat()
            ),
            (
                'Tổng hợp & báo cáo tương tác 3 bài đăng trong ngày',
                'Kiểm tra chỉ số Reach, Engagement, Comment, Lead của 3 ca đăng trong ngày và báo cáo vào nhóm chung.',
                'evening',
                '18:00',
                today_str,
                1,
                'medium',
                'pending',
                primary_emp_id,
                None,
                datetime.now().isoformat()
            )
        ]
        cursor.executemany('''
            INSERT INTO tasks (title, description, slot, scheduled_time, due_date, is_recurring, priority, status, assignee_id, last_reminded_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_tasks)

    conn.commit()
    conn.close()

# -------------------------------------------------------------
# EMAIL GENERATION & SENDING LOGIC
# -------------------------------------------------------------
def get_slot_badge_info(slot):
    mapping = {
        'morning': {'label': '🌅 CA SÁNG (08:00 - 11:30)', 'bg': '#FEF3C7', 'color': '#B45309', 'border': '#FDE68A'},
        'noon': {'label': '☀️ CA TRƯA (11:30 - 14:00)', 'bg': '#FFEDD5', 'color': '#C2410C', 'border': '#FED7AA'},
        'afternoon': {'label': '🌇 CA CHIỀU (14:00 - 18:00)', 'bg': '#E0E7FF', 'color': '#4338CA', 'border': '#C7D2FE'},
        'evening': {'label': '🌙 CA TỐI (18:00 - 22:00)', 'bg': '#EDE9FE', 'color': '#6D28D9', 'border': '#DDD6FE'},
        'custom': {'label': '⏱️ GIỜ TỰ CHỌN', 'bg': '#F1F5F9', 'color': '#475569', 'border': '#E2E8F0'}
    }
    return mapping.get(slot, mapping['custom'])

def build_reminder_email_html(task, assignee_name, app_url, sender_email):
    slot_info = get_slot_badge_info(task['slot'])
    priority_badges = {
        'urgent': ('#EF4444', '#FEE2E2', 'KHẨN CẤP ⚡'),
        'high': ('#F97316', '#FFEDD5', 'ƯU TIÊN CAO'),
        'medium': ('#3B82F6', '#DBEAFE', 'BÌNH THƯỜNG'),
        'low': ('#64748B', '#F1F5F9', 'THẤP')
    }
    p_color, p_bg, p_label = priority_badges.get(task['priority'], ('#3B82F6', '#DBEAFE', 'TIÊU CHUẨN'))
    formatted_now = datetime.now().strftime("%d/%m/%Y %H:%M")

    html = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }}
            .header {{ background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 32px 28px; text-align: left; }}
            .header h1 {{ margin: 0 0 8px 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; }}
            .header p {{ margin: 0; font-size: 13px; opacity: 0.9; }}
            .body {{ padding: 28px; }}
            .badge {{ display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }}
            .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }}
            .title {{ font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.4; }}
            .desc {{ font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0; }}
            .info-table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
            .info-table td {{ padding: 8px 0; font-size: 13.5px; border-bottom: 1px dashed #e2e8f0; }}
            .info-table td.label {{ color: #64748b; width: 140px; font-weight: 500; }}
            .info-table td.value {{ color: #0f172a; font-weight: 600; }}
            .btn-wrap {{ text-align: center; margin: 24px 0 8px 0; }}
            .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 13px 30px; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }}
            .footer {{ background: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="font-size: 26px; margin-bottom: 6px;">🔔</div>
                <h1>NHẮC NHỞ CÔNG VIỆC CẦN THỰC HIỆN</h1>
                <p>Hệ thống tự động thông báo phân công nhiệm vụ trong ngày</p>
            </div>
            <div class="body">
                <p style="font-size: 15px; margin: 0 0 16px 0;">Xin chào <strong>{assignee_name}</strong>,</p>
                <p style="font-size: 13.5px; color: #475569; margin: 0 0 20px 0;">
                    Bạn có công việc cần hoàn thành đúng tiến độ trong khung giờ hôm nay:
                </p>

                <div class="card">
                    <div style="margin-bottom: 12px;">
                        <span class="badge" style="background-color: {slot_info['bg']}; color: {slot_info['color']}; border: 1px solid {slot_info['border']};">
                            {slot_info['label']}
                        </span>
                        <span class="badge" style="background-color: {p_bg}; color: {p_color}; margin-left: 6px;">
                            {p_label}
                        </span>
                    </div>

                    <div class="title">{task['title']}</div>
                    <div class="desc">{task['description'] or 'Không có ghi chú thêm.'}</div>

                    <table class="info-table">
                        <tr>
                            <td class="label">⏰ Giờ thực hiện:</td>
                            <td class="value">{task['scheduled_time']} (Hôm nay)</td>
                        </tr>
                        <tr>
                            <td class="label">👤 Người phụ trách:</td>
                            <td class="value">{assignee_name}</td>
                        </tr>
                        <tr>
                            <td class="label">🔄 Tần suất:</td>
                            <td class="value">{'Lặp lại hàng ngày' if task['is_recurring'] else 'Một lần'}</td>
                        </tr>
                        <tr>
                            <td class="label">📊 Trạng thái:</td>
                            <td class="value" style="color: {'#16A34A' if task['status'] == 'completed' else '#D97706'};">
                                {'Đã hoàn thành' if task['status'] == 'completed' else 'Đang chờ thực hiện'}
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="btn-wrap">
                    <a href="{app_url}" class="btn" target="_blank">Mở Bảng Điều Khiển Để Hoàn Thành ➔</a>
                </div>
            </div>
            <div class="footer">
                <p style="margin: 0 0 4px 0;">Mail gửi: <strong>{sender_email}</strong> • Gửi vào lúc {formatted_now}</p>
                <p style="margin: 0;">Đồng bộ từ Google Sheet: <em>Danh Sach Cong Viec / NhanSu / BaoCao</em></p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

def send_email_via_smtp(to_email, to_name, subject, html_content, settings):
    smtp_email = settings.get('smtp_email', '').strip()
    smtp_password = settings.get('smtp_password', '').strip()
    sender_name = settings.get('sender_name', 'Mitsubishi BTH - Nhắc Việc').strip()

    if not smtp_email or not smtp_password:
        return {
            'success': True,
            'status': 'simulated',
            'message': f'Đã ghi nhận nhắc việc cho {to_email} (Chế độ mô phỏng - Chưa lưu App Password của {smtp_email}).'
        }

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{sender_name} <{smtp_email}>"
        msg['To'] = f"{to_name} <{to_email}>"

        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)

        try:
            server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15)
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, [to_email], msg.as_string())
            server.quit()
        except Exception:
            server = smtplib.SMTP('smtp.gmail.com', 587, timeout=15)
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, [to_email], msg.as_string())
            server.quit()

        return {
            'success': True,
            'status': 'sent',
            'message': f'Đã gửi thành công email nhắc việc từ {smtp_email} tới {to_email}'
        }
    except Exception as e:
        return {
            'success': False,
            'status': 'failed',
            'message': f'Lỗi khi gửi email qua Gmail SMTP ({smtp_email}): {str(e)}'
        }

# -------------------------------------------------------------
# BACKGROUND SCHEDULER & GOOGLE SHEETS SYNC WORKER
# -------------------------------------------------------------
def background_scheduler():
    """Checks every 30 seconds for task reminders and syncs Google Sheet periodically."""
    cycle_counter = 0
    while True:
        try:
            conn = get_db()
            cursor = conn.cursor()

            cursor.execute('SELECT key, value FROM settings')
            settings = dict(cursor.fetchall())

            # Periodic Google Sheets Auto-Sync (Every 5 minutes = 10 cycles of 30s)
            cycle_counter += 1
            if cycle_counter >= 10:
                cycle_counter = 0
                if settings.get('auto_sync_sheets') == '1':
                    sheet_id = settings.get('google_sheet_id', DEFAULT_SHEET_ID)
                    print(f"[SCHEDULER] Auto-syncing from Google Sheet {sheet_id}...")
                    sync_google_sheets(conn, sheet_id)

            if settings.get('auto_remind_enabled') == '1':
                now = datetime.now()
                today_str = now.strftime('%Y-%m-%d')

                cursor.execute('''
                    SELECT t.*, e.name as assignee_name, e.email as assignee_email
                    FROM tasks t
                    LEFT JOIN employees e ON t.assignee_id = e.id
                    WHERE t.status != 'completed'
                      AND (t.is_recurring = 1 OR t.due_date = ?)
                ''', (today_str,))
                tasks = cursor.fetchall()

                for t in tasks:
                    task = dict(t)
                    if task.get('last_reminded_date') == today_str:
                        continue

                    task_time_str = task['scheduled_time']
                    try:
                        task_time = datetime.strptime(task_time_str, '%H:%M').time()
                        now_time = now.time()

                        if now_time >= task_time:
                            assignee_email = task.get('assignee_email') or settings.get('primary_recipient', 'taitran.1493@gmail.com')
                            assignee_name = task.get('assignee_name') or 'Tài Trần'

                            subject = f"⏰ [Nhắc việc] {task['title']} ({task_time_str})"
                            app_url = settings.get('app_url', 'http://localhost:5000')
                            sender_email = settings.get('smtp_email', 'tttai.mitsubishi.bth@gmail.com')
                            html_body = build_reminder_email_html(task, assignee_name, app_url, sender_email)

                            res = send_email_via_smtp(assignee_email, assignee_name, subject, html_body, settings)

                            cursor.execute('UPDATE tasks SET last_reminded_date = ? WHERE id = ?', (today_str, task['id']))

                            cursor.execute('''
                                INSERT INTO reminder_logs (task_id, task_title, recipient_name, recipient_email, subject, status, message, sent_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (task['id'], task['title'], assignee_name, assignee_email, subject, res['status'], res['message'], datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

                            conn.commit()
                            print(f"[SCHEDULER] Reminded task #{task['id']} -> {assignee_email} ({res['status']})")
                    except Exception as err:
                        print(f"[SCHEDULER ERROR] Task #{task['id']}: {err}")

            conn.close()
        except Exception as e:
            print(f"[SCHEDULER LOOP ERROR] {e}")

        time.sleep(30)

# -------------------------------------------------------------
# API ROUTES
# -------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/summary', methods=['GET'])
def get_summary():
    conn = get_db()
    cursor = conn.cursor()
    today_str = date.today().isoformat()

    cursor.execute('SELECT COUNT(*) FROM tasks')
    total_tasks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'completed'")
    completed_tasks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status != 'completed'")
    pending_tasks = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM employees WHERE is_active = 1')
    total_employees = cursor.fetchone()[0]

    cursor.execute('''
        SELECT slot, COUNT(*) as count, 
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as done_count
        FROM tasks
        WHERE (is_recurring = 1 OR due_date = ?)
        GROUP BY slot
    ''', (today_str,))
    slot_stats = {row['slot']: {'total': row['count'], 'done': row['done_count'] or 0} for row in cursor.fetchall()}

    conn.close()
    return jsonify({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'pending_tasks': pending_tasks,
        'total_employees': total_employees,
        'slot_stats': slot_stats,
        'today': today_str
    })

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.*, e.name as assignee_name, e.email as assignee_email, e.color as assignee_color, e.department as assignee_department
        FROM tasks t
        LEFT JOIN employees e ON t.assignee_id = e.id
        ORDER BY t.scheduled_time ASC, t.id DESC
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Tiêu đề công việc là bắt buộc'}), 400

    description = data.get('description', '').strip()
    slot = data.get('slot', 'morning')
    scheduled_time = data.get('scheduled_time', '09:00').strip()
    due_date = data.get('due_date', date.today().isoformat())
    is_recurring = 1 if data.get('is_recurring') else 0
    priority = data.get('priority', 'medium')
    assignee_id = data.get('assignee_id')
    created_at = datetime.now().isoformat()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tasks (title, description, slot, scheduled_time, due_date, is_recurring, priority, status, assignee_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ''', (title, description, slot, scheduled_time, due_date, is_recurring, priority, assignee_id, created_at))
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'id': task_id, 'message': 'Đã tạo công việc thành công'})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    fields = ['title', 'description', 'slot', 'scheduled_time', 'due_date', 'priority', 'assignee_id', 'status']
    updates = []
    values = []

    for f in fields:
        if f in data:
            updates.append(f"{f} = ?")
            values.append(data[f])

    if 'is_recurring' in data:
        updates.append("is_recurring = ?")
        values.append(1 if data['is_recurring'] else 0)

    if not updates:
        conn.close()
        return jsonify({'message': 'Không có trường thay đổi'})

    values.append(task_id)
    query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã cập nhật công việc'})

@app.route('/api/tasks/<int:task_id>/toggle-status', methods=['POST'])
def toggle_task_status(task_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT status FROM tasks WHERE id = ?', (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Không tìm thấy công việc'}), 404

    current_status = row['status']
    new_status = 'completed' if current_status != 'completed' else 'pending'
    cursor.execute('UPDATE tasks SET status = ? WHERE id = ?', (new_status, task_id))
    conn.commit()
    conn.close()
    return jsonify({'status': new_status, 'message': f'Trạng thái chuyển thành: {new_status}'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    cursor.execute('DELETE FROM reminder_logs WHERE task_id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã xóa công việc thành công'})

@app.route('/api/tasks/<int:task_id>/send-reminder', methods=['POST'])
def send_task_reminder(task_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT t.*, e.name as assignee_name, e.email as assignee_email
        FROM tasks t
        LEFT JOIN employees e ON t.assignee_id = e.id
        WHERE t.id = ?
    ''', (task_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'Không tìm thấy công việc'}), 404

    cursor.execute('SELECT key, value FROM settings')
    settings = dict(cursor.fetchall())

    task = dict(row)
    assignee_email = task.get('assignee_email') or settings.get('primary_recipient', 'taitran.1493@gmail.com')
    assignee_name = task.get('assignee_name') or 'Tài Trần'

    app_url = settings.get('app_url', 'http://localhost:5000')
    sender_email = settings.get('smtp_email', 'tttai.mitsubishi.bth@gmail.com')
    subject = f"🔔 [Nhắc Ngay] {task['title']} - Khung giờ: {task['scheduled_time']}"
    html_body = build_reminder_email_html(task, assignee_name, app_url, sender_email)

    result = send_email_via_smtp(assignee_email, assignee_name, subject, html_body, settings)

    today_str = date.today().isoformat()
    cursor.execute('''
        INSERT INTO reminder_logs (task_id, task_title, recipient_name, recipient_email, subject, status, message, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (task['id'], task['title'], assignee_name, assignee_email, subject, result['status'], result['message'], datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    
    cursor.execute('UPDATE tasks SET last_reminded_date = ? WHERE id = ?', (today_str, task_id))
    conn.commit()
    conn.close()

    return jsonify(result)

@app.route('/api/tasks/preset-social-posts', methods=['POST'])
def create_preset_social_posts():
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    assignee_id = data.get('assignee_id')
    if not assignee_id:
        cursor.execute("SELECT id FROM employees WHERE email = 'taitran.1493@gmail.com'")
        row = cursor.fetchone()
        if row:
            assignee_id = row[0]

    today_str = date.today().isoformat()
    now_iso = datetime.now().isoformat()

    tasks_data = [
        (
            'Đăng bài Fanpage 01 (Sáng): Chia sẻ giá trị / Chào ngày mới',
            'Nội dung truyền cảm hứng, tin tức xu hướng ngành hoặc bí quyết hữu ích cho khách hàng lái xe an toàn.',
            'morning',
            '09:00',
            today_str,
            1,
            'high',
            'pending',
            assignee_id,
            now_iso
        ),
        (
            'Đăng bài Fanpage 02 (Trưa): Tương tác khách hàng / Mini Poll / Q&A',
            'Bài viết giải trí, minigame ngắn hoặc câu hỏi gợi mở thảo luận để kéo tương tác trong giờ nghỉ trưa.',
            'noon',
            '12:00',
            today_str,
            1,
            'medium',
            'pending',
            assignee_id,
            now_iso
        ),
        (
            'Đăng bài Fanpage 03 (Chiều): Dòng xe & Ưu đãi bảo dưỡng Mitsubishi',
            'Giới thiệu tính năng dòng xe, feedback khách hàng và chương trình khuyến mãi phụ tùng/bảo dưỡng trong ngày.',
            'afternoon',
            '16:30',
            today_str,
            1,
            'urgent',
            'pending',
            assignee_id,
            now_iso
        )
    ]

    cursor.executemany('''
        INSERT INTO tasks (title, description, slot, scheduled_time, due_date, is_recurring, priority, status, assignee_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tasks_data)
    conn.commit()
    conn.close()

    return jsonify({'message': 'Đã tạo thành công bộ 3 bài đăng MXH (Sáng - Trưa - Chiều) cho hôm nay!'})

# -------------------------------------------------------------
# GOOGLE SHEETS SYNC ENDPOINTS
# -------------------------------------------------------------
@app.route('/api/sheets/sync', methods=['POST'])
def sync_sheets():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'google_sheet_id'")
    row = cursor.fetchone()
    sheet_id = row[0] if row else DEFAULT_SHEET_ID

    stats = sync_google_sheets(conn, sheet_id)
    conn.close()

    msg = f"Đồng bộ thành công! Nhân sự: {stats['employees_imported']} mới, {stats['employees_updated']} cập nhật. Công việc: {stats['tasks_imported']} mới, {stats['tasks_updated']} cập nhật."
    if stats['sheet_is_empty']:
        msg += " (Lưu ý: Sheet 'Danh Sach Cong Viec' hiện chưa có hàng dữ liệu nào. Vui lòng bấm 'Xem mẫu cột' để copy dữ liệu vào sheet)."

    return jsonify({
        'success': True,
        'stats': stats,
        'message': msg
    })

@app.route('/api/sheets/templates', methods=['GET'])
def get_templates():
    return jsonify(get_sheet_templates())

# -------------------------------------------------------------
# EMPLOYEE ROUTES
# -------------------------------------------------------------
@app.route('/api/employees', methods=['GET'])
def list_employees():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT e.*, COUNT(t.id) as task_count,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_task_count
        FROM employees e
        LEFT JOIN tasks t ON e.id = t.assignee_id
        GROUP BY e.id
        ORDER BY (e.email = 'taitran.1493@gmail.com') DESC, e.id ASC
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/employees', methods=['POST'])
def create_employee():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    if not name or not email:
        return jsonify({'error': 'Họ tên và Email Gmail là bắt buộc'}), 400

    role = data.get('role', 'Nhân viên').strip()
    department = data.get('department', 'Mitsubishi BTH').strip()
    color = data.get('color', '#2563EB')

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO employees (name, email, role, department, color, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        ''', (name, email, role, department, color, datetime.now().isoformat()))
        emp_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({'id': emp_id, 'message': 'Đã thêm nhân sự thành công'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': f'Email {email} đã tồn tại trong hệ thống'}), 400

@app.route('/api/employees/<int:emp_id>', methods=['PUT'])
def update_employee(emp_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    fields = ['name', 'email', 'role', 'department', 'color', 'is_active']
    updates = []
    values = []

    for f in fields:
        if f in data:
            updates.append(f"{f} = ?")
            values.append(data[f])

    if not updates:
        conn.close()
        return jsonify({'message': 'Không có dữ liệu thay đổi'})

    values.append(emp_id)
    query = f"UPDATE employees SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã cập nhật thông tin nhân sự'})

@app.route('/api/employees/<int:emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM employees WHERE id = ?', (emp_id,))
    cursor.execute('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', (emp_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã xóa nhân sự'})

@app.route('/api/employees/<int:emp_id>/test-email', methods=['POST'])
def test_employee_email(emp_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM employees WHERE id = ?', (emp_id,))
    emp = cursor.fetchone()
    if not emp:
        conn.close()
        return jsonify({'error': 'Không tìm thấy nhân viên'}), 404

    cursor.execute('SELECT key, value FROM settings')
    settings = dict(cursor.fetchall())

    emp = dict(emp)
    sender_mail = settings.get('smtp_email', 'tttai.mitsubishi.bth@gmail.com')
    subject = f"✅ [Kiểm Tra Kết Nối] Thử nghiệm gửi email nhắc việc tới {emp['name']}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #2563eb; margin-top: 0;">🎉 Kết Nối Gmail Thành Công!</h2>
        <p>Xin chào <strong>{emp['name']}</strong>,</p>
        <p>Đây là email kiểm tra từ <strong>Hệ Thống Nhắc Việc Trực Tuyến</strong>.</p>
        <p>Hộp thư <code>{emp['email']}</code> đã sẵn sàng nhận thông báo nhắc nhở các ca làm việc trong ngày (Sáng, Trưa, Chiều).</p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 13px; color: #64748b; margin-top: 16px;">
            • Mail gửi: <strong>{sender_mail}</strong><br/>
            • Thời gian test: <strong>{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</strong>
        </div>
    </div>
    """
    res = send_email_via_smtp(emp['email'], emp['name'], subject, html, settings)

    cursor.execute('''
        INSERT INTO reminder_logs (task_id, task_title, recipient_name, recipient_email, subject, status, message, sent_at)
        VALUES (NULL, 'Kiểm tra email nhân sự', ?, ?, ?, ?, ?, ?)
    ''', (emp['name'], emp['email'], subject, res['status'], res['message'], datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    conn.commit()
    conn.close()

    return jsonify(res)

# -------------------------------------------------------------
# SETTINGS & LOGS ROUTES
# -------------------------------------------------------------
@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    settings = dict(cursor.fetchall())
    conn.close()

    masked_pw = '••••••••' if settings.get('smtp_password') else ''
    has_real_smtp = bool(settings.get('smtp_email') and settings.get('smtp_password'))

    return jsonify({
        'smtp_email': settings.get('smtp_email', 'tttai.mitsubishi.bth@gmail.com'),
        'primary_recipient': settings.get('primary_recipient', 'taitran.1493@gmail.com'),
        'smtp_password_masked': masked_pw,
        'has_smtp_password': bool(settings.get('smtp_password')),
        'has_real_smtp': has_real_smtp,
        'sender_name': settings.get('sender_name', 'Mitsubishi BTH - Nhắc Việc Tự Động'),
        'google_sheet_url': settings.get('google_sheet_url', 'https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing'),
        'google_sheet_id': settings.get('google_sheet_id', DEFAULT_SHEET_ID),
        'auto_remind_enabled': settings.get('auto_remind_enabled', '1') == '1',
        'auto_sync_sheets': settings.get('auto_sync_sheets', '1') == '1',
        'reminder_window_minutes': settings.get('reminder_window_minutes', '30'),
        'app_url': settings.get('app_url', 'http://localhost:5000')
    })

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()

    for key in ['smtp_email', 'primary_recipient', 'sender_name', 'app_url', 'reminder_window_minutes', 'google_sheet_url']:
        if key in data:
            cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(data[key]).strip()))

    if 'google_sheet_url' in data:
        sheet_id = extract_sheet_id(data['google_sheet_url'])
        cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('google_sheet_id', sheet_id))

    for bool_key in ['auto_remind_enabled', 'auto_sync_sheets']:
        if bool_key in data:
            val = '1' if data[bool_key] else '0'
            cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (bool_key, val))

    new_pw = data.get('smtp_password')
    if new_pw is not None and new_pw.strip() != '':
        cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('smtp_password', new_pw.strip()))

    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã lưu cấu hình thành công!'})

@app.route('/api/test-smtp', methods=['POST'])
def test_smtp_connection():
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    settings = dict(cursor.fetchall())
    conn.close()

    target_email = data.get('target_email', '').strip() or settings.get('primary_recipient', 'taitran.1493@gmail.com')
    sender_mail = settings.get('smtp_email', 'tttai.mitsubishi.bth@gmail.com')

    subject = "🚀 [Kiểm Tra Cấu Hình] Kết nối Gmail SMTP thành công!"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #10B981; margin-top: 0;">✨ Cấu Hình Gmail Hoàn Hảo!</h2>
        <p>Chúc mừng bạn! Hệ thống đã gửi email thành công qua máy chủ <strong>Gmail SMTP</strong>.</p>
        <p>Mọi lịch nhắc việc trong ngày (Ca Sáng, Trưa, Chiều) sẽ tự động gửi thông báo từ hộp thư này.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
            • Mail gửi thông báo: <strong>{sender_mail}</strong><br/>
            • Mail nhận thông báo: <strong>{target_email}</strong><br/>
            • Đồng bộ Google Sheet: <strong>https://docs.google.com/spreadsheets/d/{settings.get('google_sheet_id')}/edit</strong><br/>
            • Thời gian: <strong>{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</strong>
        </div>
    </div>
    """
    res = send_email_via_smtp(target_email, 'Tài Trần', subject, html, settings)
    return jsonify(res)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM reminder_logs
        ORDER BY id DESC
        LIMIT 100
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM reminder_logs')
    conn.commit()
    conn.close()
    return jsonify({'message': 'Đã dọn sạch nhật ký gửi thông báo'})

# -------------------------------------------------------------
# STARTUP
# -------------------------------------------------------------
if __name__ == '__main__':
    init_db()

    # Start background scheduler thread
    scheduler_thread = threading.Thread(target=background_scheduler, daemon=True)
    scheduler_thread.start()
    print("[SERVER] Background scheduler and Google Sheets sync started.")
    print("[SERVER] Starting Flask server on http://localhost:5000 ...")

    app.run(host='0.0.0.0', port=5000, debug=False)
