"""Build local read-only dictionary shards; source: ECDICT under MIT (see data/ecdict/LICENSE)."""
import csv, json, re
from pathlib import Path
base=Path('data/ecdict')
shards={}
count=0
with (base/'full.csv').open(encoding='utf-8-sig',newline='') as source:
    for row in csv.DictReader(source):
        term=row['word'].strip().lower()
        if not re.fullmatch(r"[a-z][a-z '\-]{0,79}",term) or not row['translation']: continue
        key=re.sub('[^a-z]','',term)[:2].ljust(2,'_')
        shards.setdefault(key,{})[term]={ 'term':term, 'phonetic':row['phonetic'], 'meaningZh':row['translation'].replace('\\n','\n')[:1800], 'definition':row['definition'].replace('\\n','\n')[:1400], 'exchange':row['exchange'] }
        count+=1
(base/'shards').mkdir(exist_ok=True)
for key,entries in shards.items():
    (base/'shards'/f'{key}.json').write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(base/'metadata.json').write_text(json.dumps({'entries':count,'source':'https://github.com/skywind3000/ECDICT','license':'MIT'},indent=2),encoding='utf-8')
print(f'Built {count} entries in {len(shards)} shards')
