with open('sheet_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
# Check initialCellCount or cell data in topsnapshot
print("initialCellCount found:", re.findall(r'initialCellCount":(\d+)', html))
print("firstchunklength:", re.findall(r'firstchunklength":(\d+)', html))

# Look for any text in waffle or snapshot
# Let's see what is inside topsnapshot
idx = html.find('"topsnapshot":')
print(html[idx:idx+2000])
