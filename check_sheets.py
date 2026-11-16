import urllib.request
import re
import csv
import io
import json

url = 'https://docs.google.com/spreadsheets/d/1UvZKWzGpycOIjFHcjrHonQoCuFOWIpqfE0Jdj4eeXbA/edit?usp=sharing'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        print('Loaded HTML. Length:', len(html))
        # Find bootstrap data or sheet info
        match = re.search(r'var bootstrapData = (\{.*?\});', html)
        if not match:
            # Look for sheet metadata
            matches = re.findall(r'(\d+),\"([^\"]+)\",\d+,\d+,\d+,', html)
            print('Matches sample:', matches[:10])
        # Find all gid patterns
        gids = set(re.findall(r'gid=(\d+)', html))
        print('Found GIDs:', gids)
        # Find sheet names
        names = re.findall(r'\[\"([^\"]+)\",\d+,\d+,\d+\]', html)
        print('Names:', names)
except Exception as e:
    print('Error:', e)
