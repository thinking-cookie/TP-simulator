"""Slice 1: CDC driving-centre exit -> Ubi Rd 3.  python3 -I tools/build_cdc_slice.py data/cdc_slice_raw.json data/cdc_slice_game.json"""
import json, math, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
OX, OY, W, H = 290.0, 400.0, 220, 240          # window in source metres
LANE = 3.4
def sh(p): return [round(p[0]-OX, 1), round(p[1]-OY, 1)]
# hand-picked route (source metres): centre north lane -> one-way exit lane -> Ubi Ave 4 -> Ubi Rd 3
TOUR_SRC = [(378,445.4),(401.9,445),(406.6,445.6),(413.5,449.3),(378.9,481.4),(358.9,506.1),(366.9,528.8),(374.8,527),(384.9,528.4),(392.1,531),(398.2,535.2),(404.5,541.9),(414,563.2),(417.5,572.7),(422.2,583.5)]
def chaikin(pts, n=2):
    for _ in range(n):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [(0.75*a[0]+0.25*b[0], 0.75*a[1]+0.25*b[1]), (0.25*a[0]+0.75*b[0], 0.25*a[1]+0.75*b[1])]
        pts = out + [pts[-1]]
    return pts
tour = chaikin([sh(p) for p in TOUR_SRC], 2)
def dist_to_tour(p):
    return min(math.hypot(p[0]-t[0], p[1]-t[1]) for t in tour)
def inside(p, m=0): return -m <= p[0] <= W+m and -m <= p[1] <= H+m
roads = []
for c, n, l, o, pts in d['R']:
    pts = [sh(p) for p in pts]
    if not any(inside(p, 0) for p in pts): continue
    svc = (c == 's')
    if svc and min(dist_to_tour(p) for p in pts) > 60: continue
    lanes = l or (1 if o else 2)
    w = (4.6 if o else 5.4) if svc else max(LANE, lanes*LANE)
    roads.append({'p': pts, 'w': round(w, 1), 'ow': o, 'n': n, 'svc': 1 if svc else 0, 'lanes': lanes})
blds = [{'p': [sh(p) for p in pts], 'n': n} for n, pts in d['B'] if any(inside(sh(p), 0) for p in pts)]
out = {'W': W, 'H': H, 'roads': roads, 'blds': blds, 'tour': [[round(x,1), round(y,1)] for x, y in tour], 'origin_src': [OX, OY]}
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('roads', len(roads), 'blds', len(blds), 'tour pts', len(tour), 'len m', round(sum(math.hypot(a[0]-b[0], a[1]-b[1]) for a, b in zip(tour, tour[1:]))))
