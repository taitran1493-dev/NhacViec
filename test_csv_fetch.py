import urllib.request
import csv
import io

sheet_id = '1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA'
gids = {
    'Danh Sach Cong Viec': '0',
    'NhanSu': '1121546996',
    'BaoCao': '2026235113'
}

for name, gid in gids.items():
    url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode('utf-8')
            reader = list(csv.reader(io.StringIO(content)))
            print(f"=== SHEET: {name} (gid={gid}, rows={len(reader)}) ===")
            for i, row in enumerate(reader[:15]):
                print(f"Row {i}: {row}")
    except Exception as e:
        print(f"Error fetching {name}: {e}")
