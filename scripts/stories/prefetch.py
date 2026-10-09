# Download the pages a writer needs for each road, so a writer without network access (Codex) can work from saved text.
# Usage (repo root): python3 scripts/stories/prefetch.py <work dir> <batch file>
# Also pulls Wikipedia articles for places near the mapped line (geosearch), as the writers do by hand.
# Writes <work dir>/cache/<id>/NN.txt, each starting with "URL: <the page's real address>" and then plain text,
# plus index.txt listing them. Wikipedia pages also record their coordinates. A 403 falls back to the newest full Wayback capture.
import html, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

S, batch = sys.argv[1], sys.argv[2]
UA = 'Rambleroo/0.1 (story research; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)'


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/json,*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    if data[:5] == b'%PDF-':  # route descriptions are often PDFs; keep their text, not the raw bytes
        out = subprocess.run(['pdftotext', '-layout', '-', '-'], input=data, capture_output=True, timeout=120)
        return html.escape(out.stdout.decode('utf-8', 'replace'))
    return data.decode('utf-8', 'replace')


def text_of(raw):
    raw = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', raw)
    # Keep descriptions some sites only put in meta tags or embedded JSON.
    metas = re.findall(r'(?i)<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]+)"', raw)
    body = html.unescape(re.sub(r'(?s)<[^>]+>', ' ', raw))
    return re.sub(r'\s+', ' ', ' '.join(metas) + ' ' + body).strip()


def wiki(title):
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts|coordinates', 'explaintext': 1, 'redirects': 1, 'titles': title, 'format': 'json'})
    d = json.loads(get('https://en.wikipedia.org/w/api.php?' + q))
    for p in d.get('query', {}).get('pages', {}).values():
        if 'missing' in p or not p.get('extract'):
            return None
        c = (p.get('coordinates') or [{}])[0]
        url = 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(p['title'].replace(' ', '_'))
        coord = f"COORDINATES: {c['lon']}, {c['lat']}\n" if 'lat' in c else ''
        return url, coord + p['extract']
    return None


def page(url):
    try:
        return url, text_of(get(url))
    except urllib.error.HTTPError as e:
        if e.code not in (403, 429):
            return None
    except Exception:
        return None
    try:  # newest Wayback capture of the same page
        a = json.loads(get('https://archive.org/wayback/available?url=' + urllib.parse.quote(url)))
        snap = a.get('archived_snapshots', {}).get('closest', {})
        if snap.get('available'):
            wb = snap['url'].replace('http://', 'https://', 1)
            return wb, text_of(get(wb))
    except Exception:
        return None
    return None


ROADS = {}
for f in json.load(open('public/data/byways.geojson'))['features']:
    ROADS.setdefault(f['properties']['id'], []).extend(f['geometry']['coordinates'])


def along(rid, n=8):
    pts = [p for line in ROADS.get(rid, []) for p in line]
    return [pts[int(i * (len(pts) - 1) / (n - 1))] for i in range(n)] if len(pts) > 1 else pts


def nearby(lon, lat):
    q = urllib.parse.urlencode({'action': 'query', 'list': 'geosearch', 'gscoord': f'{lat}|{lon}', 'gsradius': 4000, 'gslimit': 6, 'format': 'json'})
    try:
        return [g['title'] for g in json.loads(get('https://en.wikipedia.org/w/api.php?' + q)).get('query', {}).get('geosearch', [])]
    except Exception:
        return []


for rid in [l.strip() for l in open(batch) if l.strip()]:
    m = json.load(open(f'{S}/material/{rid}.json'))
    out = f'{S}/cache/{rid}'
    os.makedirs(out, exist_ok=True)
    got, seen = [], set()

    def keep(res):
        if res and res[0] not in seen and len(res[1]) > 200:
            seen.add(res[0])
            n = len(got)
            open(f'{out}/{n:02d}.txt', 'w').write(f'URL: {res[0]}\n\n{res[1][:60000]}\n')
            got.append(res[0])

    urls = []
    for ch in m['chapters']:
        if ch.get('url'):
            urls.append(ch['url'])
        urls += [f['source'] for f in ch.get('facts', []) if f.get('source', '').startswith('http')]
    for u in dict.fromkeys(urls):
        if 'wikipedia.org/wiki/' in u:
            keep(wiki(urllib.parse.unquote(u.split('/wiki/')[1]).replace('_', ' ')))
        else:
            keep(page(u))
        time.sleep(0.5)
    for title in [m['name']] + [c['name'] for c in m['chapters']]:
        keep(wiki(title))
        time.sleep(0.3)
    for pl in m['stripPlaces']:
        src = pl.get('source') or ''
        if 'wikipedia.org/wiki/' in src:
            keep(wiki(urllib.parse.unquote(src.split('/wiki/')[1]).replace('_', ' ')))
            time.sleep(0.3)
    # Wikipedia articles about places within 4 km of the mapped line, at evenly spaced points along it.
    titles = []
    for lon, lat in along(rid):
        titles += nearby(lon, lat)
        time.sleep(0.3)
    for t in list(dict.fromkeys(titles))[:25]:
        keep(wiki(t))
        time.sleep(0.3)
    open(f'{out}/index.txt', 'w').write('\n'.join(f'{i:02d}.txt {u}' for i, u in enumerate(got)) + '\n')
    print(rid, len(got), 'pages', flush=True)
