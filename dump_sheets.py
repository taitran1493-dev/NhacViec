with open('sheet_dump.html', 'w', encoding='utf-8') as f:
    import urllib.request
    url = 'https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        f.write(html)
        print('Dumped HTML.')
        for kw in ['Danh Sach', 'NhanSu', 'BaoCao', 'Sheet1', 'grid']:
            idx = html.find(kw)
            print(f'Keyword {kw}: index {idx}')
