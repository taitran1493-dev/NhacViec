with open('sheet_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = 0
matches = []
while True:
    idx = html.find('Danh Sach Cong Viec', pos)
    if idx == -1:
        break
    matches.append(idx)
    pos = idx + 1

print('Positions of "Danh Sach Cong Viec":', matches)
for m in matches:
    print('--- Match at', m, '---')
    print(html[max(0, m - 150):min(len(html), m + 150)])
