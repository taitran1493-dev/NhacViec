// TaskReminder Hub - Core Application JS

let state = {
    tasks: [],
    employees: [],
    settings: {},
    logs: [],
    summary: {},
    activeTab: 'today',
    templates: {},
    currentTemplateTab: 'tasks'
};

// ------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadAllData();
    loadSheetTemplates();

    // Auto refresh data every 15 seconds
    setInterval(() => {
        loadAllData(false);
    }, 15000);
});

function initClock() {
    const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
        const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });
        
        const clockEl = document.getElementById('liveClock');
        if (clockEl) clockEl.textContent = timeStr;
        
        const dateEl = document.getElementById('currentDateDisplay');
        if (dateEl) dateEl.textContent = dateStr;
    };
    updateTime();
    setInterval(updateTime, 1000);
}

async function loadAllData(showLoading = true) {
    try {
        const [sumRes, tasksRes, empRes, setRes, logsRes] = await Promise.all([
            fetch('/api/summary'),
            fetch('/api/tasks'),
            fetch('/api/employees'),
            fetch('/api/settings'),
            fetch('/api/logs')
        ]);

        state.summary = await sumRes.json();
        state.tasks = await tasksRes.json();
        state.employees = await empRes.json();
        state.settings = await setRes.json();
        state.logs = await logsRes.json();

        renderSummary();
        renderSmtpNotice();
        renderTodaySlots();
        renderAllTasks();
        renderEmployees();
        renderSettings();
        renderLogs();
        populateEmployeeDropdowns();

        lucide.createIcons();
    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

async function loadSheetTemplates() {
    try {
        const res = await fetch('/api/sheets/templates');
        state.templates = await res.json();
    } catch (e) {
        console.error('Failed to load sheet templates:', e);
    }
}

// ------------------------------------------------------------------
// GOOGLE SHEETS SYNC ACTIONS
// ------------------------------------------------------------------
async function triggerSheetSync() {
    showToast('Đang kết nối và đồng bộ từ Google Sheet...', 'info');
    try {
        const res = await fetch('/api/sheets/sync', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, data.stats?.sheet_is_empty ? 'warning' : 'success');
            loadAllData(false);
        } else {
            showToast(data.error || 'Lỗi khi đồng bộ Google Sheet', 'error');
        }
    } catch (e) {
        showToast('Không thể kết nối đến máy chủ', 'error');
    }
}

function openSheetTemplateModal() {
    document.getElementById('sheetTemplateModal').classList.remove('hidden');
    switchTemplateTab('tasks');
    lucide.createIcons();
}

function closeSheetTemplateModal() {
    document.getElementById('sheetTemplateModal').classList.add('hidden');
}

function switchTemplateTab(tabKey) {
    state.currentTemplateTab = tabKey;
    ['tasks', 'employees', 'reports'].forEach(k => {
        const btn = document.getElementById(`tmplTab-${k}`);
        if (!btn) return;
        if (k === tabKey) {
            btn.className = 'px-4 py-2 text-xs font-bold border-b-2 border-emerald-600 text-emerald-700';
        } else {
            btn.className = 'px-4 py-2 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800';
        }
    });

    const box = document.getElementById('templateContentBox');
    if (box && state.templates[tabKey]) {
        box.value = state.templates[tabKey];
    }
}

function copyTemplateToClipboard() {
    const box = document.getElementById('templateContentBox');
    if (!box) return;
    box.select();
    navigator.clipboard.writeText(box.value).then(() => {
        const label = document.getElementById('btnCopyLabel');
        if (label) label.textContent = 'Đã Sao Chép!';
        showToast('Đã copy bảng mẫu! Hãy mở Google Sheet và nhấn Ctrl + V vào ô A1', 'success');
        setTimeout(() => {
            if (label) label.textContent = 'Sao Chép Bảng';
        }, 2500);
    }).catch(() => {
        showToast('Vui lòng chọn toàn bộ văn bản và nhấn Ctrl + C để copy', 'warning');
    });
}

// ------------------------------------------------------------------
// TAB SWITCHING
// ------------------------------------------------------------------
function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });

    const activeBtn = document.getElementById(`tabBtn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    }

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.add('hidden');
    });

    const activePane = document.getElementById(`tabContent-${tabId}`);
    if (activePane) {
        activePane.classList.remove('hidden');
    }

    lucide.createIcons();
}

// ------------------------------------------------------------------
// SUMMARY & NOTICES
// ------------------------------------------------------------------
function renderSummary() {
    const s = state.summary || {};
    const total = s.total_tasks || 0;
    const completed = s.completed_tasks || 0;
    const pending = s.pending_tasks || 0;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('statTotalTasks').textContent = total;
    document.getElementById('statPendingTasks').textContent = pending;
    document.getElementById('statCompletedTasks').textContent = completed;
    document.getElementById('statCompletionRate').textContent = `${rate}% tiến độ`;
    document.getElementById('statTotalEmployees').textContent = s.total_employees || 0;
}

function renderSmtpNotice() {
    const badge = document.getElementById('smtpStatusBadge');
    if (!badge) return;

    if (!state.settings.has_real_smtp) {
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200';
        badge.textContent = 'Mô Phỏng / Chưa Nhập App Password';
    } else {
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';
        badge.textContent = 'Gmail SMTP Sẵn Sàng';
    }
}

// ------------------------------------------------------------------
// TODAY'S SHIFTS (SÁNG - TRƯA - CHIỀU - TỐI)
// ------------------------------------------------------------------
function renderTodaySlots() {
    const morningTasks = state.tasks.filter(t => t.slot === 'morning');
    const noonTasks = state.tasks.filter(t => t.slot === 'noon');
    const afternoonTasks = state.tasks.filter(t => t.slot === 'afternoon');
    const eveningTasks = state.tasks.filter(t => t.slot === 'evening' || t.slot === 'custom');

    document.getElementById('morningCountBadge').textContent = `${morningTasks.length} việc`;
    document.getElementById('noonCountBadge').textContent = `${noonTasks.length} việc`;
    document.getElementById('afternoonCountBadge').textContent = `${afternoonTasks.length} việc`;

    renderSlotColumn('morningTasksList', morningTasks, 'morning');
    renderSlotColumn('noonTasksList', noonTasks, 'noon');
    renderSlotColumn('afternoonTasksList', afternoonTasks, 'afternoon');
    renderEveningList('eveningTasksList', eveningTasks);
}

function renderSlotColumn(containerId, tasks, slotType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <i data-lucide="calendar-plus" class="w-8 h-8 stroke-1 text-slate-300 mb-2"></i>
                <p class="text-xs">Chưa có việc trong ca này</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(task => createTaskCardHtml(task, true)).join('');
}

function renderEveningList(containerId, tasks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-6 text-slate-400 text-xs">
                Không có việc riêng hoặc ca tối nào hôm nay.
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(task => createTaskCardHtml(task, false)).join('');
}

function createTaskCardHtml(task, isColumn = true) {
    const isCompleted = task.status === 'completed';
    const priorityColors = {
        urgent: 'bg-red-50 text-red-700 border-red-200',
        high: 'bg-orange-50 text-orange-700 border-orange-200',
        medium: 'bg-blue-50 text-blue-700 border-blue-200',
        low: 'bg-slate-50 text-slate-600 border-slate-200'
    };
    const pBadgeClass = priorityColors[task.priority] || priorityColors.medium;
    const pLabel = {
        urgent: 'Khẩn cấp',
        high: 'Ưu tiên cao',
        medium: 'Bình thường',
        low: 'Thấp'
    }[task.priority] || 'Bình thường';

    const empColor = task.assignee_color || '#2563EB';
    const empName = task.assignee_name || 'Tài Trần';

    return `
        <div class="task-card bg-white rounded-xl border ${isCompleted ? 'border-emerald-200/90 bg-emerald-50/20' : 'border-slate-200'} p-3.5 shadow-sm space-y-2.5">
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5 flex-1 min-w-0">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskStatus(${task.id})" class="mt-0.5 rounded cursor-pointer w-4 h-4 text-blue-600 focus:ring-blue-500">
                    <div class="flex-1 min-w-0">
                        <h5 class="text-xs sm:text-sm font-bold text-slate-900 leading-snug ${isCompleted ? 'line-through text-slate-400' : ''} truncate-2-lines">
                            ${escapeHtml(task.title)}
                        </h5>
                        ${task.description ? `<p class="text-[11px] text-slate-500 mt-0.5 line-clamp-2 ${isCompleted ? 'line-through text-slate-400' : ''}">${escapeHtml(task.description)}</p>` : ''}
                    </div>
                </div>

                <div class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px] shrink-0 border border-slate-200/60 flex items-center gap-1">
                    <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i>
                    <span>${task.scheduled_time}</span>
                </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${empColor};"></span>
                    <span class="text-[11px] font-semibold text-slate-700 truncate" title="${empName}">${empName}</span>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${pBadgeClass}">
                        ${pLabel}
                    </span>

                    <button onclick="sendReminderNow(${task.id})" title="Gửi email nhắc nhở ngay lập tức" class="p-1 rounded-lg hover:bg-blue-50 text-blue-600 border border-blue-200 transition-all flex items-center justify-center">
                        <i data-lucide="send" class="w-3.5 h-3.5"></i>
                    </button>

                    <button onclick="openEditTaskModal(${task.id})" title="Chỉnh sửa" class="p-1 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200 transition-all">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>

                    <button onclick="deleteTask(${task.id})" title="Xóa" class="p-1 rounded-lg hover:bg-red-50 text-red-500 border border-red-200 transition-all">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------
// ALL TASKS TABLE & FILTERING
// ------------------------------------------------------------------
function renderAllTasks() {
    filterAllTasks();
}

function filterAllTasks() {
    const search = (document.getElementById('taskSearchInput')?.value || '').toLowerCase().trim();
    const slot = document.getElementById('filterSlotSelect')?.value || '';
    const status = document.getElementById('filterStatusSelect')?.value || '';
    const assignee = document.getElementById('filterAssigneeSelect')?.value || '';

    const filtered = state.tasks.filter(t => {
        if (search && !t.title.toLowerCase().includes(search) && !(t.description && t.description.toLowerCase().includes(search))) {
            return false;
        }
        if (slot && t.slot !== slot) return false;
        if (status && t.status !== status) return false;
        if (assignee && String(t.assignee_id) !== String(assignee)) return false;
        return true;
    });

    const tbody = document.getElementById('allTasksTableBody');
    const empty = document.getElementById('allTasksEmptyState');

    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    const slotLabels = {
        morning: '🌅 Sáng',
        noon: '☀️ Trưa',
        afternoon: '🌇 Chiều',
        evening: '🌙 Tối',
        custom: '⏱️ Tự chọn'
    };

    const priorityBadges = {
        urgent: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">Khẩn cấp</span>',
        high: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Ưu tiên cao</span>',
        medium: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Bình thường</span>',
        low: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Thấp</span>'
    };

    tbody.innerHTML = filtered.map(t => {
        const isDone = t.status === 'completed';
        const empName = t.assignee_name || 'Tài Trần';
        const empColor = t.assignee_color || '#2563EB';

        return `
            <tr class="hover:bg-slate-50/80 transition-colors ${isDone ? 'bg-slate-50/50' : ''}">
                <td class="py-3 px-4 text-center">
                    <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskStatus(${t.id})" class="rounded w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer">
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-slate-900 ${isDone ? 'line-through text-slate-400' : ''}">
                        ${escapeHtml(t.title)}
                    </div>
                    ${t.description ? `<div class="text-[11px] text-slate-500 mt-0.5 line-clamp-1 ${isDone ? 'line-through text-slate-400' : ''}">${escapeHtml(t.description)}</div>` : ''}
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <span class="font-semibold text-slate-700 text-xs">${slotLabels[t.slot] || t.slot}</span>
                    <span class="ml-1.5 px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-700 text-[11px] border border-slate-200">${t.scheduled_time}</span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${empColor};"></span>
                        <span class="font-medium text-slate-800 text-xs">${empName}</span>
                    </div>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                    ${priorityBadges[t.priority] || priorityBadges.medium}
                </td>
                <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                    ${t.is_recurring ? '<span class="text-blue-600 font-semibold flex items-center gap-1"><i data-lucide="repeat" class="w-3.5 h-3.5"></i> Hàng ngày</span>' : '<span class="text-slate-400">Một lần</span>'}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <button onclick="sendReminderNow(${t.id})" title="Gửi nhắc Gmail ngay" class="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs border border-blue-200 transition-all inline-flex items-center gap-1">
                        <i data-lucide="send" class="w-3 h-3"></i> Nhắc Ngay
                    </button>
                    <button onclick="openEditTaskModal(${t.id})" title="Chỉnh sửa" class="p-1 rounded hover:bg-slate-100 text-slate-500 border border-slate-200 transition-all inline-block">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="deleteTask(${t.id})" title="Xóa" class="p-1 rounded hover:bg-red-50 text-red-500 border border-red-200 transition-all inline-block">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

// ------------------------------------------------------------------
// EMPLOYEES & TEAMS MANAGEMENT
// ------------------------------------------------------------------
function renderEmployees() {
    const grid = document.getElementById('employeeGrid');
    if (!grid) return;

    if (state.employees.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <i data-lucide="users" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
                <p>Chưa có nhân sự nào trong danh sách.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.employees.map(emp => {
        const initial = emp.name.charAt(0).toUpperCase();
        const isPrimary = emp.email === 'taitran.1493@gmail.com';

        return `
            <div class="bg-white rounded-2xl border ${isPrimary ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div class="space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm" style="background-color: ${emp.color || '#2563EB'};">
                            ${initial}
                        </div>
                        <div class="flex items-center gap-1">
                            ${isPrimary ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Mail Chính</span>' : ''}
                            <button onclick="openEditEmployeeModal(${emp.id})" title="Sửa thông tin" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                            </button>
                            ${!isPrimary ? `
                            <button onclick="deleteEmployee(${emp.id})" title="Xóa" class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 border border-red-200">
                                <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                            </button>` : ''}
                        </div>
                    </div>

                    <div>
                        <h4 class="font-bold text-slate-900 text-sm">${escapeHtml(emp.name)}</h4>
                        <p class="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5 truncate" title="${emp.email}">
                            <i data-lucide="mail" class="w-3 h-3 shrink-0"></i>
                            <span>${escapeHtml(emp.email)}</span>
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-1.5 text-[11px]">
                        <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">${emp.role || 'Nhân viên'}</span>
                        <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">${emp.department || 'Mitsubishi BTH'}</span>
                    </div>

                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                        <span class="text-slate-500">Nhiệm vụ phân công:</span>
                        <span class="font-bold text-slate-800">${emp.task_count || 0} việc</span>
                    </div>
                </div>

                <button onclick="testEmployeeEmail(${emp.id})" class="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
                    <i data-lucide="send" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>Gửi Thử Email Test</span>
                </button>
            </div>
        `;
    }).join('');
}

function populateEmployeeDropdowns() {
    const selects = ['taskForm_assignee_id', 'presetAssigneeSelect', 'filterAssigneeSelect'];
    selects.forEach(selId => {
        const select = document.getElementById(selId);
        if (!select) return;

        const currentVal = select.value;
        const isFilter = selId.startsWith('filter');
        const defaultOption = isFilter ? '<option value="">Tất cả Nhân sự</option>' : '';

        const optionsHtml = state.employees.map(e => `
            <option value="${e.id}" ${e.email === 'taitran.1493@gmail.com' ? 'selected' : ''}>${e.name} (${e.email})</option>
        `).join('');

        select.innerHTML = defaultOption + optionsHtml;
        if (currentVal) select.value = currentVal;
    });
}

// ------------------------------------------------------------------
// SETTINGS & LOGS
// ------------------------------------------------------------------
function renderSettings() {
    const s = state.settings || {};
    const emailEl = document.getElementById('setting_smtp_email');
    const recipientEl = document.getElementById('setting_primary_recipient');
    const senderEl = document.getElementById('setting_sender_name');
    const urlEl = document.getElementById('setting_app_url');
    const sheetUrlEl = document.getElementById('setting_google_sheet_url');
    const autoEl = document.getElementById('setting_auto_remind_enabled');
    const autoSyncEl = document.getElementById('setting_auto_sync_sheets');

    if (emailEl) emailEl.value = s.smtp_email || 'tttai.mitsubishi.bth@gmail.com';
    if (recipientEl) recipientEl.value = s.primary_recipient || 'taitran.1493@gmail.com';
    if (senderEl) senderEl.value = s.sender_name || 'Mitsubishi BTH - Nhắc Việc Tự Động';
    if (urlEl) urlEl.value = s.app_url || 'http://localhost:5000';
    if (sheetUrlEl) sheetUrlEl.value = s.google_sheet_url || 'https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing';
    if (autoEl) autoEl.checked = s.auto_remind_enabled;
    if (autoSyncEl) autoSyncEl.checked = s.auto_sync_sheets;
}

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    const empty = document.getElementById('logsEmptyState');
    if (!tbody) return;

    if (state.logs.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = state.logs.map(log => {
        let badge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-700">Đã gửi</span>';
        if (log.status === 'simulated') {
            badge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-700">Mô phỏng</span>';
        } else if (log.status === 'failed') {
            badge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-100 text-red-700">Thất bại</span>';
        }

        return `
            <tr class="hover:bg-slate-50">
                <td class="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">${log.sent_at}</td>
                <td class="py-2.5 px-3 font-medium text-slate-800">${escapeHtml(log.task_title || log.subject)}</td>
                <td class="py-2.5 px-3 font-semibold text-slate-700">${escapeHtml(log.recipient_name)}</td>
                <td class="py-2.5 px-3 text-blue-600 font-mono text-[11px]">${escapeHtml(log.recipient_email)}</td>
                <td class="py-2.5 px-3 whitespace-nowrap">${badge}</td>
                <td class="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title="${escapeHtml(log.message || '')}">${escapeHtml(log.message || '')}</td>
            </tr>
        `;
    }).join('');
}

// ------------------------------------------------------------------
// ACTIONS: TASK OPERATIONS
// ------------------------------------------------------------------
async function toggleTaskStatus(taskId) {
    try {
        const res = await fetch(`/api/tasks/${taskId}/toggle-status`, { method: 'POST' });
        if (res.ok) {
            loadAllData(false);
        }
    } catch (e) {
        showToast('Lỗi khi cập nhật trạng thái', 'error');
    }
}

async function sendReminderNow(taskId) {
    showToast('Đang tiến hành gửi email nhắc nhở...', 'info');
    try {
        const res = await fetch(`/api/tasks/${taskId}/send-reminder`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message, data.status === 'simulated' ? 'warning' : 'success');
            loadAllData(false);
        } else {
            showToast(data.error || data.message || 'Lỗi gửi email', 'error');
        }
    } catch (e) {
        showToast('Không thể kết nối đến máy chủ', 'error');
    }
}

function openTaskModal() {
    document.getElementById('taskForm_id').value = '';
    document.getElementById('taskForm_title').value = '';
    document.getElementById('taskForm_description').value = '';
    document.getElementById('taskForm_slot').value = 'morning';
    document.getElementById('taskForm_scheduled_time').value = '09:00';
    document.getElementById('taskForm_priority').value = 'medium';
    document.getElementById('taskForm_is_recurring').checked = true;
    document.getElementById('taskModalTitle').textContent = 'Thêm Công Việc Mới';
    document.getElementById('taskModal').classList.remove('hidden');
    lucide.createIcons();
}

function openTaskModalWithSlot(slot, defaultTime) {
    openTaskModal();
    document.getElementById('taskForm_slot').value = slot;
    document.getElementById('taskForm_scheduled_time').value = defaultTime;
}

function openEditTaskModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('taskForm_id').value = task.id;
    document.getElementById('taskForm_title').value = task.title;
    document.getElementById('taskForm_description').value = task.description || '';
    document.getElementById('taskForm_slot').value = task.slot;
    document.getElementById('taskForm_scheduled_time').value = task.scheduled_time;
    document.getElementById('taskForm_priority').value = task.priority;
    document.getElementById('taskForm_assignee_id').value = task.assignee_id || '';
    document.getElementById('taskForm_is_recurring').checked = Boolean(task.is_recurring);
    document.getElementById('taskModalTitle').textContent = 'Chỉnh Sửa Công Việc';
    document.getElementById('taskModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.add('hidden');
}

function syncSlotDefaultTime() {
    const slot = document.getElementById('taskForm_slot').value;
    const timeInput = document.getElementById('taskForm_scheduled_time');
    const defaults = {
        morning: '09:00',
        noon: '12:00',
        afternoon: '16:30',
        evening: '18:00',
        custom: '10:00'
    };
    if (defaults[slot]) {
        timeInput.value = defaults[slot];
    }
}

async function saveTask(e) {
    e.preventDefault();
    const id = document.getElementById('taskForm_id').value;
    const payload = {
        title: document.getElementById('taskForm_title').value.trim(),
        description: document.getElementById('taskForm_description').value.trim(),
        slot: document.getElementById('taskForm_slot').value,
        scheduled_time: document.getElementById('taskForm_scheduled_time').value,
        priority: document.getElementById('taskForm_priority').value,
        assignee_id: document.getElementById('taskForm_assignee_id').value ? parseInt(document.getElementById('taskForm_assignee_id').value) : null,
        is_recurring: document.getElementById('taskForm_is_recurring').checked
    };

    try {
        const url = id ? `/api/tasks/${id}` : '/api/tasks';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast(id ? 'Đã cập nhật công việc' : 'Đã tạo công việc mới', 'success');
            closeTaskModal();
            loadAllData(false);
        } else {
            showToast(data.error || 'Có lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Bạn có chắc chắn muốn xóa công việc này?')) return;
    try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Đã xóa công việc thành công', 'success');
            loadAllData(false);
        }
    } catch (e) {
        showToast('Lỗi khi xóa công việc', 'error');
    }
}

// ------------------------------------------------------------------
// ACTIONS: PRESET (ĐĂNG 3 BÀI MXH: SÁNG - TRƯA - CHIỀU)
// ------------------------------------------------------------------
function openPresetModal() {
    document.getElementById('presetModal').classList.remove('hidden');
    lucide.createIcons();
}

function closePresetModal() {
    document.getElementById('presetModal').classList.add('hidden');
}

async function confirmGeneratePreset() {
    const assigneeId = document.getElementById('presetAssigneeSelect').value;
    try {
        const res = await fetch('/api/tasks/preset-social-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignee_id: assigneeId ? parseInt(assigneeId) : null
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            closePresetModal();
            loadAllData(false);
            switchTab('today');
        } else {
            showToast(data.error || 'Lỗi khi tạo lịch mẫu', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

// ------------------------------------------------------------------
// ACTIONS: EMPLOYEE OPERATIONS
// ------------------------------------------------------------------
function openEmployeeModal() {
    document.getElementById('empForm_id').value = '';
    document.getElementById('empForm_name').value = '';
    document.getElementById('empForm_email').value = '';
    document.getElementById('empForm_role').value = '';
    document.getElementById('empForm_department').value = 'Mitsubishi BTH';
    document.getElementById('empForm_color').value = '#2563EB';
    document.getElementById('employeeModalTitle').textContent = 'Thêm Nhân Sự Mới';
    document.getElementById('employeeModal').classList.remove('hidden');
    lucide.createIcons();
}

function openEditEmployeeModal(empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    document.getElementById('empForm_id').value = emp.id;
    document.getElementById('empForm_name').value = emp.name;
    document.getElementById('empForm_email').value = emp.email;
    document.getElementById('empForm_role').value = emp.role || '';
    document.getElementById('empForm_department').value = emp.department || 'Mitsubishi BTH';
    document.getElementById('empForm_color').value = emp.color || '#2563EB';
    document.getElementById('employeeModalTitle').textContent = 'Chỉnh Sửa Nhân Sự';
    document.getElementById('employeeModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.add('hidden');
}

async function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('empForm_id').value;
    const payload = {
        name: document.getElementById('empForm_name').value.trim(),
        email: document.getElementById('empForm_email').value.trim(),
        role: document.getElementById('empForm_role').value.trim(),
        department: document.getElementById('empForm_department').value.trim(),
        color: document.getElementById('empForm_color').value
    };

    try {
        const url = id ? `/api/employees/${id}` : '/api/employees';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast(id ? 'Đã cập nhật nhân sự' : 'Đã thêm nhân sự mới', 'success');
            closeEmployeeModal();
            loadAllData(false);
        } else {
            showToast(data.error || 'Có lỗi xảy ra', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

async function deleteEmployee(empId) {
    if (!confirm('Bạn có chắc muốn xóa nhân sự này? Các việc được giao sẽ chuyển thành Chưa phân công.')) return;
    try {
        const res = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Đã xóa nhân sự', 'success');
            loadAllData(false);
        }
    } catch (e) {
        showToast('Lỗi khi xóa nhân sự', 'error');
    }
}

async function testEmployeeEmail(empId) {
    showToast('Đang gửi email test...', 'info');
    try {
        const res = await fetch(`/api/employees/${empId}/test-email`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message, data.status === 'simulated' ? 'warning' : 'success');
            loadAllData(false);
        } else {
            showToast(data.error || data.message || 'Lỗi gửi email test', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

// ------------------------------------------------------------------
// ACTIONS: SETTINGS & SMTP
// ------------------------------------------------------------------
async function saveSettings(e) {
    e.preventDefault();
    const payload = {
        smtp_email: document.getElementById('setting_smtp_email').value.trim(),
        primary_recipient: document.getElementById('setting_primary_recipient').value.trim(),
        sender_name: document.getElementById('setting_sender_name').value.trim(),
        app_url: document.getElementById('setting_app_url').value.trim(),
        google_sheet_url: document.getElementById('setting_google_sheet_url').value.trim(),
        auto_remind_enabled: document.getElementById('setting_auto_remind_enabled').checked,
        auto_sync_sheets: document.getElementById('setting_auto_sync_sheets').checked
    };

    const newPw = document.getElementById('setting_smtp_password').value.trim();
    if (newPw) {
        payload.smtp_password = newPw;
    }

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Đã lưu cấu hình thành công!', 'success');
            loadAllData(false);
        } else {
            showToast(data.error || 'Lỗi lưu cấu hình', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

async function testSmtpConnection() {
    const email = document.getElementById('setting_primary_recipient').value.trim();
    if (!email) {
        showToast('Vui lòng điền Email người nhận để kiểm tra', 'error');
        return;
    }

    showToast('Đang gửi thử nghiệm kết nối Gmail...', 'info');
    try {
        const res = await fetch('/api/test-smtp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_email: email })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message, data.status === 'simulated' ? 'warning' : 'success');
            loadAllData(false);
        } else {
            showToast(data.error || data.message || 'Lỗi kết nối SMTP', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối máy chủ', 'error');
    }
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
}

async function clearLogs() {
    if (!confirm('Bạn có muốn xóa sạch toàn bộ lịch sử gửi thông báo?')) return;
    try {
        const res = await fetch('/api/logs/clear', { method: 'POST' });
        if (res.ok) {
            showToast('Đã dọn sạch nhật ký', 'success');
            loadAllData(false);
        }
    } catch (e) {
        showToast('Lỗi khi xóa nhật ký', 'error');
    }
}

// ------------------------------------------------------------------
// TOAST NOTIFICATIONS HELPER
// ------------------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-red-600 text-white',
        warning: 'bg-amber-600 text-white',
        info: 'bg-slate-900 text-white'
    };
    const icons = {
        success: 'check-circle-2',
        error: 'alert-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2.5 pointer-events-auto transform translate-y-2 opacity-0 transition-all duration-200`;
    toast.innerHTML = `
        <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 250);
    }, 4500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
