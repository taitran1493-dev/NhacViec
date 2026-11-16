with open('sheet_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

sub = html[263000:268000]
print(sub[:3000])
