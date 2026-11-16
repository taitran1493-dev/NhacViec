import re

with open('sheet_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Look for tab container
idx = html.find('docs-sheet-tab-caption')
print('Found tab caption at', idx)
print(html[idx-300:idx+1500])
