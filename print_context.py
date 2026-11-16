with open('sheet_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

for kw in ['Danh Sach', 'NhanSu', 'BaoCao']:
    idx = html.find(kw)
    if idx != -1:
        start = max(0, idx - 200)
        end = min(len(html), idx + 200)
        print(f"=== Context for '{kw}': ===")
        print(html[start:end])
