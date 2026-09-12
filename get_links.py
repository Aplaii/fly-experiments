import requests
from bs4 import BeautifulSoup
import re

url = 'https://janelia-flyem.github.io/male-cns/download/'
r = requests.get(url)
soup = BeautifulSoup(r.text, 'html.parser')

print("ALL LINKS:")
for a in soup.find_all('a', href=True):
    href = a['href']
    text = a.get_text(strip=True)
    if any(keyword in href.lower() or keyword in text.lower() for keyword in ['download', 'data', 'zenodo', 'neuprint', 'storage', 'tar.gz', 'manc']):
        print(f"TEXT: {text}\nLINK: {href}\n")
