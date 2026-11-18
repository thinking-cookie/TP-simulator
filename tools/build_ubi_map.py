#!/usr/bin/env python3
"""Build the game's Ubi road map from the raw OpenStreetMap export.
Usage: python3 -I tools/build_ubi_map.py data/ubi_osm_raw.json data/ubi_game.json
Data (c) OpenStreetMap contributors, ODbL. Arrow lights and give-way signs are INFERRED (see README)."""
import json, math, sys, heapq, collections

SRC, DST = sys.argv[1], sys.argv[2]
LON0, LON1, LAT0, LAT1 = 103.8970, 103.9010, 1.3255, 1.3310
KX = 111320*math.cos(math.radians(1.328)); KY = 110574
def P(lat, lon): return [(lon-LON0)*KX, (LAT1-lat)*KY]
WW, WH = (LON1-LON0)*KX, (LAT1-LAT0)*KY
LANE = 3.4
CLASSES = {'primary':5,'secondary':4,'tertiary':3,'primary_link':2,'secondary_link':2,'tertiary_link':2,'residential':2,'unclassified':2}
d = json.load(open(SRC))
def dist(a,b): return math.hypot(a[0]-b[0], a[1]-b[1])
def inside(p, m): return -m <= p[0] <= WW+m and -m <= p[1] <= WH+m
def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0]-a[0], b[1]-a[1]; l = math.hypot(dx, dy) or 1e-9
    dm, im = 0, 0
    for i in range(1, len(pts)-1):
        e = abs((pts[i][0]-a[0])*dy - (pts[i][1]-a[1])*dx)/l
        if e > dm: dm, im = e, i
    if dm <= tol: return [a, b]
    return dp(pts[:im+1], tol)[:-1] + dp(pts[im:], tol)

roads = []
for e in d['elements']:
    if e['type'] != 'way': continue
    t = e['tags']; hw = t.get('highway')
    if hw not in CLASSES: continue
    pts = [P(g['lat'], g['lon']) for g in e['geometry']]
    if not any(inside(p, 0) for p in pts): continue
    keep = [i for i, p in enumerate(pts) if inside(p, 70)]
    if len(keep) < 2: continue
    pts = pts[min(keep):max(keep)+1]
    pts = dp(pts, 0.4)
    ow = t.get('oneway') in ('yes', '1', 'true') or t.get('junction') == 'roundabout'
    try: lanes = int(str(t.get('lanes', '')).split(';')[0])
    except ValueError: lanes = 1 if ow or hw.endswith('_link') else 2
    w = max(LANE, min(22, lanes*LANE))
    tl = {k: t[k] for k in ('turn:lanes', 'turn:lanes:forward', 'turn:lanes:backward') if k in t}
    roads.append({'p': [[round(x, 2), round(y, 2)] for x, y in pts], 'w': round(w, 1), 'ow': 1 if ow else 0, 'n': t.get('name', ''), 'c': hw, 'lanes': lanes, 'tl': tl})
print('roads', len(roads))
# minor service roads (car parks, access roads): drawn only, not routed, no signals or give-way
minor = []
for e in d['elements']:
    if e['type'] != 'way' or e['tags'].get('highway') != 'service': continue
    if e['tags'].get('service') in ('parking_aisle',) : continue
    pts = [P(g['lat'], g['lon']) for g in e['geometry']]
    keep = [i for i, p in enumerate(pts) if inside(p, 30)]
    if len(keep) < 2: continue
    pts = dp(pts[min(keep):max(keep)+1], 0.5)
    if sum(dist(pts[i], pts[i+1]) for i in range(len(pts)-1)) < 12: continue
    minor.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts], 'w': 4.6})
print('minor', len(minor))

# ---- junction centres: the three signalised junctions checked in Street View ----
sig_nodes = [P(e['lat'], e['lon']) for e in d['elements'] if e['type'] == 'node' and e['tags'].get('highway') == 'traffic_signals' and e['tags'].get('crossing') != 'traffic_signals']
CEN = {'Ubi Ave 1 / Ubi Rd 3': P(1.32643, 103.89883), 'Ubi Ave 2 / Ubi Rd 3': P(1.32950, 103.89826), 'Ubi Ave 1 / Ubi Ave 2': P(1.33030, 103.90012)}
for k, c in CEN.items():
    near = [s for s in sig_nodes if dist(s, c) < 45]
    if near: CEN[k] = [sum(s[0] for s in near)/len(near), sum(s[1] for s in near)/len(near)]
    print(k, [round(v) for v in CEN[k]], 'signal nodes', len(near))

def rank(r): return CLASSES[r['c']]
signals = []
R_APP = 24.0
for jn, c in CEN.items():
    apps = []
    for r in roads:
        if r['c'].endswith('_link'): continue
        pts = r['p']
        for i in range(len(pts)-1):
            p, q = pts[i], pts[i+1]
            for rev in (False, True):
                if rev and r['ow']: continue
                a, b = (q, p) if rev else (p, q)
                if dist(a, c) > R_APP >= dist(b, c) and dist(a, c) < R_APP+60:
                    f = (dist(a, c)-R_APP)/max(1e-9, dist(a, c)-dist(b, c))
                    x = [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f]; L = dist(a, b) or 1e-9
                    dv = [(b[0]-a[0])/L, (b[1]-a[1])/L]
                    # the approach must head at the centre
                    if ((c[0]-x[0])*dv[0] + (c[1]-x[1])*dv[1]) < 0.5*R_APP: continue
                    apps.append((r, x, dv, rev))
    # one approach per road+direction
    seen = []
    out = []
    for r, x, dv, rev in apps:
        if any(dist(x, s) < 6 and (dv[0]*s2[0]+dv[1]*s2[1]) > 0.8 for s, s2 in seen): continue
        seen.append((x, dv)); out.append((r, x, dv, rev))
    if not out: continue
    out.sort(key=lambda a: -rank(a[0]))
    d0 = out[0][2]
    for r, x, dv, rev in out:
        left = [dv[1], -dv[0]]
        hw = r['w']/2 if r['ow'] else r['w']/2
        if r['ow']: a = [x[0]-left[0]*hw, x[1]-left[1]*hw]; b = [x[0]+left[0]*hw, x[1]+left[1]*hw]; lanes = r['lanes']; edge = [x[0]+left[0]*hw, x[1]+left[1]*hw]
        else: a = [x[0]+left[0]*0.15, x[1]+left[1]*0.15]; b = [x[0]+left[0]*hw, x[1]+left[1]*hw]; lanes = max(1, r['lanes']//2); edge = b
        tl = r['tl'].get('turn:lanes') or r['tl'].get('turn:lanes:backward' if rev else 'turn:lanes:forward') or ''
        arrow = 'R' if 'right' in tl else None
        grp = 'EW' if abs(dv[0]*d0[1]-dv[1]*d0[0]) < 0.7 else 'NS'
        head = [b[0]+left[0]*1.0+dv[0]*1.5, b[1]+left[1]*1.0+dv[1]*1.5]
        signals.append({'j': jn, 'grp': grp, 'a': [round(v, 2) for v in a], 'b': [round(v, 2) for v in b], 'dir': [round(dv[0], 3), round(dv[1], 3)],
                        'head': [round(v, 2) for v in head], 'lanes': lanes, 'edge': [round(v, 2) for v in edge], 'arrow': arrow, 'name': r['n'], 'c': [round(v, 1) for v in c]})
best = {}
for i, sg in enumerate(signals):
    if sg['arrow'] and sg['lanes'] >= 2:
        k = sg['j']
        if k not in best or sg['lanes'] > signals[best[k]]['lanes']: best[k] = i
for i, sg in enumerate(signals):
    if sg['arrow'] and best.get(sg['j']) != i: sg['arrow'] = None
print('signals', len(signals), 'arrows', sum(1 for s in signals if s['arrow']))

# ---- give way lines (inferred): link roads merging into a road, and named minor roads joining a bigger road ----
def near_signal_junction(p): return any(dist(p, c) < 40 for c in CEN.values())
def on_other_road(p, me):
    for r in roads:
        if r is me or r['c'].endswith('_link') and me['c'].endswith('_link'): continue
        for i in range(len(r['p'])-1):
            a, b = r['p'][i], r['p'][i+1]; L2 = (b[0]-a[0])**2 + (b[1]-a[1])**2 or 1e-9
            t = max(0, min(1, ((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1]))/L2))
            if math.hypot(p[0]-(a[0]+(b[0]-a[0])*t), p[1]-(a[1]+(b[1]-a[1])*t)) < r['w']/2 + 3: return r
    return None
giveways = []
for r in roads:
    if rank(r) > 3 and not r['c'].endswith('_link'): continue
    ends = []
    if r['c'].endswith('_link') or r['ow']: ends = [(r['p'][-1], r['p'][-2])]
    else: ends = [(r['p'][-1], r['p'][-2]), (r['p'][0], r['p'][1])]
    for end, prev in ends:
        if not inside(end, -10): continue
        major = on_other_road(end, r)
        if not major or (not r['c'].endswith('_link') and (rank(major) <= rank(r) or not r['n'])): continue
        L = dist(end, prev) or 1e-9
        # walk back along the way to 7 m from the end
        pts = r['p'] if end is r['p'][-1] else r['p'][::-1]
        acc = 0; k = len(pts)-1
        while k > 0 and acc + dist(pts[k], pts[k-1]) < 7: acc += dist(pts[k], pts[k-1]); k -= 1
        a0, b0 = pts[k], pts[max(0, k-1)]; f = (7-acc)/max(1e-9, dist(a0, b0))
        x = [a0[0]+(b0[0]-a0[0])*f, a0[1]+(b0[1]-a0[1])*f] if k > 0 else pts[0]
        dv = [(end[0]-x[0])/(dist(end, x) or 1e-9), (end[1]-x[1])/(dist(end, x) or 1e-9)]
        left = [dv[1], -dv[0]]; hw = r['w']/2
        if any(dist(x, g['x']) < 12 for g in giveways): continue
        if r['ow'] or r['c'].endswith('_link'): a = [x[0]-left[0]*hw, x[1]-left[1]*hw]; b = [x[0]+left[0]*hw, x[1]+left[1]*hw]
        else: a = [x[0]+left[0]*0.15, x[1]+left[1]*0.15]; b = [x[0]+left[0]*hw, x[1]+left[1]*hw]
        giveways.append({'x': [round(v, 2) for v in x], 'a': [round(v, 2) for v in a], 'b': [round(v, 2) for v in b], 'dir': [round(dv[0], 3), round(dv[1], 3)],
                         'sign': [round(b[0]+left[0]*1.1, 2), round(b[1]+left[1]*1.1, 2)], 'j': [round(end[0], 1), round(end[1], 1)], 'name': r['n'], 'link': r['c'].endswith('_link'), 'src': 'inferred'})
giveways = [g for g in giveways if inside(g['x'], -5)]
print('give-way lines', len(giveways), 'on links', sum(1 for g in giveways if g['link']))

# ---- directed graph for NPC loops and the player route ----
def key(p): return (round(p[0], 1), round(p[1], 1))
G = collections.defaultdict(list); NODE = {}
def off_poly(pts, o):
    out = []
    for i, p in enumerate(pts):
        a = pts[max(0, i-1)]; b = pts[min(len(pts)-1, i+1)]; L = dist(a, b) or 1e-9
        tx, ty = (b[0]-a[0])/L, (b[1]-a[1])/L
        out.append([p[0]+ty*o, p[1]-tx*o])
    return out
for r in roads:
    if r['p'] is None: continue
    off = (r['w']/2 - LANE/2) if r['ow'] else r['w']/4
    for fwd in ([True] if r['ow'] else [True, False]):
        pts = r['p'] if fwd else r['p'][::-1]
        for i in range(len(pts)-1):
            a, b = pts[i], pts[i+1]
            if not (inside(a, 30) and inside(b, 30)): continue
            n = max(1, int(dist(a, b)//15))
            for q in range(n):
                a2 = [a[0]+(b[0]-a[0])*q/n, a[1]+(b[1]-a[1])*q/n]; b2 = [a[0]+(b[0]-a[0])*(q+1)/n, a[1]+(b[1]-a[1])*(q+1)/n]
                ka, kb = key(a2), key(b2); NODE[ka] = a2; NODE[kb] = b2
                G[ka].append((kb, dist(a2, b2), r['n'], off))
def dijkstra(src, dst):
    best = {src: 0}; prev = {}; pq = [(0, src)]
    while pq:
        dd, u = heapq.heappop(pq)
        if u == dst: break
        if dd > best.get(u, 1e18): continue
        for v, w, n, o in G[u]:
            nd = dd + w
            if nd < best.get(v, 1e18): best[v] = nd; prev[v] = (u, n, o); heapq.heappush(pq, (nd, v))
    if dst not in prev and src != dst: return None
    path = [dst]; names = []; offs = []
    while path[-1] != src:
        u, n, o = prev[path[-1]]; names.append(n); offs.append(o); path.append(u)
    return path[::-1], names[::-1], offs[::-1]
def nearest(p): return min(NODE, key=lambda k: dist(NODE[k], p))
def route(keys):
    full, names, offs = [keys[0]], [], []
    for a, b in zip(keys, keys[1:]):
        r = dijkstra(a, b)
        if r is None: return None
        full += r[0][1:]; names += r[1]; offs += r[2]
    return full, names, offs
def lane_poly(path, offs):
    pts = [NODE[k] for k in path]
    out = []
    for i, p in enumerate(pts):
        a = pts[max(0, i-1)]; b = pts[min(len(pts)-1, i+1)]; L = dist(a, b) or 1e-9
        o = offs[min(i, len(offs)-1)] if i < len(offs) else offs[-1]
        out.append([p[0]+(b[1]-a[1])/L*o, p[1]-(b[0]-a[0])/L*o])
    return out

cs = list(CEN.values())
cn = [nearest(c) for c in cs]
A = nearest([120, 528]); E = nearest([385, 140])
tour = route([A, cn[0], cn[1], cn[2], E])
print('route', None if not tour else len(tour[0]))
out = {'W': round(WW, 1), 'H': round(WH, 1), 'roads': roads, 'minor': minor, 'signals': signals, 'giveways': giveways, 'centres': CEN, 'loops': []}
loopA = route([cn[0], cn[1], cn[2], cn[1], cn[0]])
loopB = route([cn[2], cn[1], cn[0], cn[1], cn[2]])
for lp in (loopA, loopB):
    if lp: out['loops'].append([[round(x, 1), round(y, 1)] for x, y in lane_poly(lp[0], lp[2])])
if tour:
    lp = lane_poly(tour[0], tour[2])
    out['tour'] = [[round(x, 1), round(y, 1)] for x, y in lp]; out['tour_names'] = tour[1]
    print('route names', [n for i, n in enumerate(tour[1]) if i == 0 or n != tour[1][i-1]])
json.dump(out, open(DST, 'w'), separators=(',', ':'))
import os; print('wrote', DST, os.path.getsize(DST)//1024, 'KB', 'world', round(WW), 'x', round(WH))
