"""
Procedural, seamlessly tiling PBR textures generated with numpy (FFT noise),
written to blender/textures/*.png and referenced by the materials.

  *_a  albedo (sRGB)
  *_n  tangent space normal map (OpenGL / glTF convention)
  *_r  packed ORM style map: G = roughness, B = metallic
"""
import os
import math
import numpy as np
import bpy

from lib import TEX_DIR

TAU = math.tau


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------
def noise(n, beta=2.0, seed=0, aniso=(1.0, 1.0), m=None):
    """Periodic 1/f^beta noise, zero mean, unit std. Shape (m or n, n)."""
    m = m or n
    rng = np.random.default_rng(seed)
    F = np.fft.fft2(rng.standard_normal((m, n)))
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    fy = np.fft.fftfreq(m)[:, None] * m * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    F *= f ** (-beta / 2.0)
    F[0, 0] = 0
    out = np.real(np.fft.ifft2(F))
    out -= out.mean()
    out /= out.std() + 1e-8
    return out.astype(np.float32)


def grid(n, m=None):
    m = m or n
    v, u = np.mgrid[0:m, 0:n].astype(np.float32)
    return u / n, v / m


def C(c):
    return np.array(c, np.float32)


def mix(c0, c1, t):
    t = np.asarray(t, np.float32)[..., None]
    return C(c0) * (1 - t) + C(c1) * t


def sat(x):
    return np.clip(x, 0.0, 1.0)


def sstep(e0, e1, x):
    t = sat((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)


def frac(x):
    return x - np.floor(x)


def normal_from_height(h, strength=1.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nrm = np.stack([-dx * strength, -dy * strength, np.ones_like(h)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    return nrm * 0.5 + 0.5


def rough_map(r, metal=0.0):
    out = np.ones(r.shape + (3,), np.float32)
    out[..., 1] = sat(r)
    out[..., 2] = metal
    return out


def save_png(name, arr):
    arr = np.asarray(arr, np.float32)
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)
    img = bpy.data.images.new("__tmp_" + name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(sat(arr)).ravel())
    img.filepath_raw = os.path.join(TEX_DIR, name + ".png")
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


# --------------------------------------------------------------------------
# generators
# --------------------------------------------------------------------------
N = 1024


def plaster(seed=1):
    big = noise(N, 3.0, seed)
    mid = noise(N, 2.0, seed + 1)
    fine = noise(N, 0.7, seed + 2)
    cr = noise(N, 2.6, seed + 3)
    crmask = sstep(0.4, 1.4, noise(N, 3.0, seed + 4))
    cracks = np.exp(-(cr / 0.028) ** 2) * crmask
    streak = noise(N, 2.2, seed + 5, aniso=(1.0, 9.0))
    pits = sstep(2.4, 3.4, noise(N, 0.2, seed + 6))
    tone = sat(0.5 + 0.2 * big + 0.1 * mid + 0.07 * streak)
    height = 0.06 * big + 0.12 * mid + 0.10 * fine - 0.9 * cracks - 0.7 * pits
    save_png("plaster_n", normal_from_height(height, 2.2))
    save_png("plaster_r", rough_map(0.84 + 0.05 * mid - 0.05 * tone))

    def albedo(name, dark, light):
        col = mix(dark, light, tone)
        col *= (1 + 0.035 * fine)[..., None]
        col *= (1 - 0.30 * cracks - 0.22 * pits)[..., None]
        save_png(name, col)
    albedo("plaster_white_a", (0.80, 0.76, 0.69), (0.97, 0.95, 0.90))
    albedo("plaster_sand_a", (0.70, 0.58, 0.44), (0.88, 0.77, 0.62))
    albedo("plaster_fort_a", (0.62, 0.48, 0.35), (0.80, 0.66, 0.50))
    albedo("plaster_inner_a", (0.78, 0.68, 0.55), (0.92, 0.85, 0.74))


def sand(seed=10):
    u, v = grid(N)
    warp = noise(N, 3.0, seed)
    ripple = 0.5 + 0.5 * np.sin(TAU * (v * 18 + 0.9 * warp + 0.25 * noise(N, 2.5, seed + 1)))
    ripple = ripple ** 1.6
    grain = noise(N, 0.1, seed + 2)
    big = noise(N, 3.0, seed + 3)
    pebbles = sstep(2.6, 3.0, noise(N, 0.6, seed + 4))
    tone = sat(0.5 + 0.25 * big + 0.08 * (ripple - 0.5))
    col = mix((0.76, 0.56, 0.36), (0.93, 0.77, 0.55), tone) * (1 + 0.06 * grain)[..., None]
    col = col * (1 - 0.35 * pebbles)[..., None]
    save_png("sand_a", col)
    save_png("sand_n", normal_from_height(ripple * 0.8 + grain * 0.06 + pebbles * 0.6, 2.0))
    save_png("sand_r", rough_map(np.full_like(u, 0.94)))


def paving(seed=20):
    u, v = grid(N)
    rows, cols = 4, 3
    r = np.floor(v * rows)
    x = u * cols + (r % 2) * 0.5
    c = np.floor(x) % cols
    fx, fy = frac(x), v * rows - r
    d = np.minimum(np.minimum(fx, 1 - fx) / cols, np.minimum(fy, 1 - fy) / rows)
    rng = np.random.default_rng(seed)
    tone_t = rng.uniform(-1, 1, (rows, cols)).astype(np.float32)
    tone = tone_t[r.astype(int) % rows, c.astype(int)]
    big = noise(N, 2.4, seed + 1)
    fine = noise(N, 0.6, seed + 2)
    g = 0.0035
    stone = sstep(g, g + 0.010, d)
    worn = 0.25 * big + 0.05 * fine
    col = mix((0.62, 0.55, 0.46), (0.82, 0.75, 0.64), sat(0.5 + 0.18 * tone + 0.2 * big))
    col *= (1 + 0.05 * fine)[..., None]
    col = col * stone[..., None] + C((0.40, 0.35, 0.29)) * (1 - stone)[..., None]
    save_png("paving_a", col)
    save_png("paving_n", normal_from_height(stone * 1.2 + worn * 0.25, 2.4))
    save_png("paving_r", rough_map(0.95 - 0.22 * stone + 0.04 * big))


def wood(seed=30, planks=4):
    u, v = grid(N)
    grain = noise(N, 1.6, seed, aniso=(1.0, 14.0))
    rings = np.sin(TAU * (u * planks * 5 + 1.4 * noise(N, 2.5, seed + 1, aniso=(1.0, 6.0))))
    p = u * planks
    pid = np.floor(p).astype(int)
    fp = p - pid
    seam = 1 - sstep(0.0, 0.025, np.minimum(fp, 1 - fp))
    rng = np.random.default_rng(seed)
    ptone = rng.uniform(-0.12, 0.12, planks + 1).astype(np.float32)[pid]
    tone = sat(0.5 + 0.17 * grain + 0.1 * rings + ptone)
    base = mix((0.22, 0.12, 0.06), (0.47, 0.29, 0.15), tone) * (1 - 0.55 * seam)[..., None]
    save_png("wood_a", base)
    save_png("wood_dark_a", base * C((0.62, 0.6, 0.58)))
    save_png("wood_n", normal_from_height(0.25 * grain + 0.12 * rings - 1.4 * seam, 2.0))
    save_png("wood_r", rough_map(0.62 + 0.12 * grain * 0.3 + 0.2 * seam))


def palm_trunk(seed=40):
    u, v = grid(N)
    rows, per = 7, 7
    row = np.floor(v * rows + 0.12 * noise(N, 3.0, seed))
    fy = v * rows - np.floor(v * rows)
    x = u * per + (row % 2) * 0.5
    fx = frac(x)
    vshape = fy - 0.45 * np.abs(2 * fx - 1)
    scale = sstep(-0.45, 0.6, vshape)
    edge = sstep(0.82, 1.0, fy)
    fib = noise(N, 1.0, seed + 1, aniso=(8.0, 1.0))
    big = noise(N, 2.8, seed + 2)
    h = scale * 0.9 - edge * 0.8 + 0.15 * fib
    tone = sat(0.45 + 0.3 * scale - 0.25 * edge + 0.12 * big + 0.05 * fib)
    save_png("trunk_a", mix((0.27, 0.21, 0.15), (0.62, 0.52, 0.40), tone))
    save_png("trunk_n", normal_from_height(h, 3.0))


def rock(seed=50):
    u, v = grid(N)
    n1 = noise(N, 2.6, seed)
    n2 = noise(N, 1.4, seed + 1)
    ridged = 1 - np.abs(noise(N, 2.2, seed + 2))
    strata = 0.5 + 0.5 * np.sin(TAU * (v * 9 + 0.6 * n1))
    tone = sat(0.5 + 0.22 * n1 + 0.1 * n2 + 0.12 * (strata - 0.5))
    col = mix((0.30, 0.24, 0.20), (0.66, 0.54, 0.43), tone)
    save_png("rock_a", col)
    save_png("rock_n", normal_from_height(0.4 * n1 + 0.5 * ridged + 0.15 * n2 + 0.25 * strata, 3.0))


def carpet(seed=60):
    H, W = 1536, 1024
    Lm, Wm = 7.5, 5.0
    u, v = grid(W, H)
    X = (u - 0.5) * Wm
    Y = (v - 0.5) * Lm
    red = C((0.56, 0.07, 0.08))
    navy = C((0.07, 0.11, 0.25))
    gold = C((0.86, 0.62, 0.22))
    ivory = C((0.93, 0.87, 0.74))
    green = C((0.10, 0.36, 0.25))
    col = np.empty((H, W, 3), np.float32)
    col[:] = red
    e = np.minimum(Wm / 2 - np.abs(X), Lm / 2 - np.abs(Y))
    along = np.where(Wm / 2 - np.abs(X) < Lm / 2 - np.abs(Y), Y, X)

    def put(mask, c):
        col[mask] = c
    # field: lozenge lattice with small motifs
    s = 0.62
    p, q = (X + Y) / s, (X - Y) / s
    fp, fq = frac(p), frac(q)
    line = np.minimum(np.minimum(fp, 1 - fp), np.minimum(fq, 1 - fq))
    put(line < 0.045, gold * 0.92)
    rr = np.abs(fp - 0.5) + np.abs(fq - 0.5)
    put(rr < 0.20, navy)
    put(rr < 0.12, ivory)
    put(rr < 0.05, red)
    # central medallion
    m = np.abs(X) / 1.35 + np.abs(Y) / 2.3
    put(m < 1.0, gold)
    put(m < 0.96, navy)
    put((m < 0.80) & (m > 0.0), ivory)
    star = np.abs(np.sin(8 * np.arctan2(Y, X))) * 0.18 + 0.45
    put(m < star, red)
    put(m < 0.32, gold)
    put(m < 0.26, green)
    put(m < 0.12, gold)
    # corner quarter medallions
    cm = np.minimum(np.abs(np.abs(X) - (Wm / 2 - 0.7)) / 0.9 + np.abs(np.abs(Y) - (Lm / 2 - 0.7)) / 0.9, 9)
    put(cm < 0.55, navy)
    put(cm < 0.42, ivory)
    put(cm < 0.22, red)
    # borders
    put(e < 0.62, gold)
    put(e < 0.58, navy)
    zig = np.abs(frac(along / 0.36) - 0.5) * 2
    put((e < 0.52) & (e > 0.16) & (np.abs((e - 0.16) / 0.36 - zig) < 0.12), gold)
    put((e < 0.52) & (e > 0.16) & (np.abs((e - 0.16) / 0.36 - (1 - zig)) < 0.06), red)
    put(e < 0.16, ivory)
    put(e < 0.11, red)
    put(e < 0.05, navy)
    fib = noise(W, 0.15, seed, m=H)
    wear = noise(W, 3.0, seed + 1, m=H)
    col *= (1 + 0.07 * fib + 0.05 * wear)[..., None]
    save_png("carpet_a", col)
    save_png("carpet_n", normal_from_height(fib * 0.25, 1.5))


def weave(seed=70):
    u, v = grid(N)
    k = 24
    su, sv = u * k, v * k
    iu, iv = np.floor(su), np.floor(sv)
    fu, fv = su - iu, sv - iv
    over_h = ((np.floor(su / 2) + np.floor(sv / 2) + (iu % 2) * 0 ) % 2) == 0
    hprof = np.sin(np.pi * fv) ** 0.6
    vprof = np.sin(np.pi * fu) ** 0.6
    h = np.where(over_h, hprof, vprof)
    rng = np.random.default_rng(seed)
    st_h = rng.uniform(-0.1, 0.1, k).astype(np.float32)[iv.astype(int) % k]
    st_v = rng.uniform(-0.1, 0.1, k).astype(np.float32)[iu.astype(int) % k]
    tone = sat(0.55 + np.where(over_h, st_h, st_v) + 0.3 * (h - 0.5) + 0.05 * noise(N, 1.0, seed))
    col = mix((0.45, 0.33, 0.18), (0.82, 0.68, 0.44), tone)
    save_png("weave_a", col)
    save_png("weave_n", normal_from_height(h * 2.0, 2.0))


def fabric(seed=80):
    u, v = grid(N)
    bands = [
        (0.00, (0.55, 0.06, 0.08)), (0.30, (0.86, 0.62, 0.22)), (0.33, (0.08, 0.30, 0.22)),
        (0.40, (0.86, 0.62, 0.22)), (0.43, (0.55, 0.06, 0.08)), (0.62, (0.93, 0.87, 0.74)),
        (0.645, (0.10, 0.10, 0.12)), (0.67, (0.93, 0.87, 0.74)), (0.695, (0.55, 0.06, 0.08)),
    ]
    t = frac(v * 2)
    col = np.empty((N, N, 3), np.float32)
    for start, c in bands:
        col[t >= start] = c
    # small woven diamonds in the dark green band
    diamond = (np.abs(frac(u * 24) - 0.5) + np.abs((t - 0.365) / 0.035)) < 0.5
    col[diamond & (t > 0.33) & (t < 0.40)] = (0.93, 0.87, 0.74)
    thread = 0.5 + 0.5 * np.sin(TAU * u * 256) * np.sin(TAU * v * 256)
    col *= (0.92 + 0.08 * thread)[..., None]
    save_png("fabric_a", col)
    save_png("fabric_n", normal_from_height(thread * 0.4, 1.0))


def frieze(seed=90):
    W, H = 1024, 256
    u, v = grid(W, H)
    x = frac(u * 6) - 0.5
    y = v - 0.5
    cream = C((0.92, 0.85, 0.70))
    red = C((0.58, 0.12, 0.10))
    green = C((0.14, 0.38, 0.30))
    ochre = C((0.80, 0.56, 0.20))
    col = np.empty((H, W, 3), np.float32)
    col[:] = cream
    col[np.abs(y) > 0.40] = red
    col[(np.abs(y) > 0.36) & (np.abs(y) <= 0.40)] = ochre
    d = np.abs(x) * 1.0 + np.abs(y) * 0.9
    col[d < 0.32] = green
    col[d < 0.25] = cream
    col[d < 0.17] = red
    ang = np.arctan2(y, x)
    petal = np.abs(np.cos(4 * ang)) * 0.06 + 0.05
    col[np.hypot(x, y) < petal] = ochre
    tri = (np.abs(frac(u * 24) - 0.5) * 2 * 0.06 + 0.40) < np.abs(y)
    col[tri & (np.abs(y) < 0.46)] = ochre
    col *= (1 + 0.04 * noise(W, 1.0, seed, m=H))[..., None]
    save_png("frieze_a", col)


# ---------------------------------------------------------------- character
def dress(seed=100):
    n = 512
    u, v = grid(n)
    thread = 0.5 + 0.5 * np.sin(TAU * u * 160) * np.sin(TAU * v * 160)
    shade = noise(n, 2.6, seed)
    col = mix((0.03, 0.36, 0.26), (0.07, 0.52, 0.38), sat(0.55 + 0.18 * shade)) * (0.94 + 0.06 * thread)[..., None]
    # tiny scattered gold diamonds (machine embroidery motif)
    k = 14
    fx, fy = frac(u * k + 0.5 * (np.floor(v * k) % 2)), frac(v * k)
    dia = (np.abs(fx - 0.5) + np.abs(fy - 0.5)) < 0.09
    col[dia] = (0.9, 0.7, 0.32)
    save_png("dress_a", col)
    save_png("dress_n", normal_from_height(thread * 0.3 + dia * 0.8, 1.2))


def embroidery(seed=110):
    W, H = 1024, 256
    u, v = grid(W, H)
    gold = C((0.92, 0.72, 0.30))
    red = C((0.62, 0.08, 0.12))
    white = C((0.96, 0.92, 0.84))
    green = C((0.05, 0.40, 0.29))
    col = np.empty((H, W, 3), np.float32)
    col[:] = red
    y = v - 0.5
    col[np.abs(y) > 0.38] = gold
    col[(np.abs(y) > 0.33) & (np.abs(y) <= 0.38)] = green
    x = frac(u * 16) - 0.5
    d = np.abs(x) * 1.2 + np.abs(y)
    col[(d < 0.3) & (d > 0.22)] = gold
    col[d < 0.12] = white
    col[d < 0.06] = gold
    zig = np.abs(frac(u * 32) - 0.5) * 2
    col[(np.abs(y) < 0.33) & (np.abs(np.abs(y) / 0.33 - zig) < 0.08) & (d >= 0.3)] = gold
    stitch = 0.5 + 0.5 * np.sin(TAU * u * 420)
    col *= (0.9 + 0.1 * stitch)[..., None]
    h = (col.mean(-1) > 0.55).astype(np.float32) * 0.8 + stitch * 0.15
    save_png("embroid_a", col)
    save_png("embroid_n", normal_from_height(h, 1.6))


def scarf(seed=120):
    n = 512
    u, v = grid(n)
    base = mix((0.62, 0.05, 0.17), (0.80, 0.12, 0.26), sat(0.5 + 0.2 * noise(n, 2.5, seed)))
    k = 8
    row = np.floor(v * k)
    fx = frac(u * k + 0.5 * (row % 2)) - 0.5
    fy = frac(v * k) - 0.5
    r = np.hypot(fx, fy)
    ang = np.arctan2(fy, fx)
    petal = 0.17 + 0.09 * np.cos(5 * ang)
    base[r < petal] = (0.98, 0.78, 0.30)
    base[r < 0.07] = (0.98, 0.95, 0.88)
    dots = np.hypot(frac(u * k * 2 + 0.25) - 0.5, frac(v * k * 2 + 0.25) - 0.5) < 0.07
    base[dots & (r > petal + 0.04)] = (0.98, 0.9, 0.7)
    save_png("scarf_a", base)


def court(seed=130):
    n = 1024
    u, v = grid(n)
    x, y = (u - 0.5) * 2, (v - 0.5) * 2
    r = np.hypot(x, y)
    a = np.arctan2(y, x)
    sand = C((0.86, 0.76, 0.60))
    terra = C((0.70, 0.36, 0.22))
    teal = C((0.10, 0.44, 0.45))
    cream = C((0.95, 0.90, 0.78))
    gold = C((0.84, 0.64, 0.28))
    col = np.empty((n, n, 3), np.float32)
    col[:] = sand
    # 8-point star (two overlapping squares) in the centre
    def square(rot):
        c, s = np.cos(rot), np.sin(rot)
        xr, yr = x * c - y * s, x * s + y * c
        return np.maximum(np.abs(xr), np.abs(yr))
    star = np.minimum(square(0), square(np.pi / 4))
    col[star < 0.42] = gold
    col[star < 0.39] = teal
    col[star < 0.30] = cream
    col[star < 0.27] = terra
    col[star < 0.12] = gold
    # rings with alternating tiles
    seg = np.floor((a + np.pi) / (2 * np.pi) * 32)
    ring1 = (r > 0.55) & (r < 0.66)
    col[ring1 & (seg % 2 == 0)] = terra
    col[ring1 & (seg % 2 == 1)] = cream
    col[(r > 0.53) & (r < 0.55)] = gold
    col[(r > 0.66) & (r < 0.68)] = gold
    ring2 = (r > 0.86) & (r < 0.96)
    col[ring2] = teal
    tri = np.abs(frac((a + np.pi) / (2 * np.pi) * 48) - 0.5) * 2
    col[ring2 & ((r - 0.86) / 0.10 < tri)] = cream
    col[(r > 0.96) & (r < 0.985)] = gold
    # grout lines (polar grid)
    grout = (np.abs(frac(r * 22) - 0.5) > 0.47) | (np.abs(frac((a + np.pi) / (2 * np.pi) * 64) - 0.5) > 0.47)
    col[grout & (star > 0.42)] *= 0.78
    col *= (1 + 0.05 * noise(n, 1.2, seed))[..., None]
    save_png("court_a", col)


def face(seed=140):
    """Painted face in equirectangular (lon/lat) space of a unit sphere whose front is -Y.
    Writes face_open.png (into textures/) and face_closed.png (also copied to the web app)."""
    W, H = 2048, 1024
    u, v = grid(W, H)
    lon = (u - 0.5) * TAU
    lat = (v - 0.5) * math.pi
    x = lon * np.cos(lat)          # local tangent coordinates (unit sphere radius = 1)
    y = lat
    skin = C((0.88, 0.69, 0.55))
    base = np.empty((H, W, 3), np.float32)
    base[:] = skin
    # soft cheek blush and a gentle shading towards the jaw
    for sx in (-1, 1):
        d = np.hypot((x - sx * 0.6) / 0.17, (y + 0.24) / 0.12)
        base = base * (1 - 0.5 * np.exp(-d * d))[..., None] + C((0.97, 0.52, 0.55)) * (0.5 * np.exp(-d * d))[..., None]
    base *= (1 - 0.07 * sat((-y - 0.35) / 0.4))[..., None]
    # nose hint
    dn = np.hypot(x / 0.05, (y + 0.17) / 0.035)
    base *= (1 - 0.12 * np.exp(-dn * dn))[..., None]
    # hair fringe under the scarf (scalloped bangs)
    edge = 0.5 + 0.045 * np.abs(np.sin(x * 9)) + 0.02 * np.cos(x * 5 + 1.0)
    hair = (y > edge) & (np.abs(x) < 1.2)
    hair_col = mix((0.10, 0.06, 0.04), (0.24, 0.14, 0.09), sat((y - edge) / 0.25 + 0.15 * np.sin(x * 40)))
    base[hair] = hair_col[hair]
    # mouth: small smile
    mcx, mcy, mr = 0.0, -0.31, 0.15
    dm = np.abs(np.hypot(x - mcx, y - mcy) - mr)
    smile = (dm < 0.018) & (y < mcy - mr * 0.55) & (np.abs(x) < 0.11)
    lip = (np.hypot(x / 0.07, (y + 0.475) / 0.03) < 1.0)
    out = {}
    for closed in (False, True):
        col = base.copy()
        col[lip] = col[lip] * 0.55 + C((0.86, 0.42, 0.45)) * 0.45
        col[smile] = (0.55, 0.22, 0.24)
        for sx in (-1, 1):
            ex, ey, a, b = sx * 0.36, 0.02, 0.165, 0.215
            # eyebrow: thin soft arch
            bx = (x - sx * 0.39) / 0.2
            by = y - (0.33 + 0.05 * (1 - bx * bx))
            brow = (np.abs(bx) < 1) & (np.abs(by) < 0.022 * (1 - 0.5 * np.abs(bx)))
            col[brow] = (0.17, 0.10, 0.07)
            if not closed:
                e = ((x - ex) / a) ** 2 + ((y - ey) / b) ** 2
                inside = e < 1
                t = sat((y - (ey - b)) / (2 * b))
                iris = mix((0.62, 0.38, 0.18), (0.13, 0.07, 0.04), t)
                ring = sat((e - 0.6) / 0.4)
                iris = iris * (1 - 0.45 * ring)[..., None]
                col[inside] = iris[inside]
                pupil = ((x - ex) / (a * 0.45)) ** 2 + ((y - ey - 0.02) / (b * 0.5)) ** 2 < 1
                col[pupil] = (0.05, 0.03, 0.02)
                hl1 = np.hypot(x - (ex - sx * 0.05), y - (ey + 0.08)) < 0.055
                hl2 = np.hypot(x - (ex + sx * 0.06), y - (ey - 0.09)) < 0.026
                col[hl1 | hl2] = (1.0, 1.0, 1.0)
                # kohl liner along the upper lid with a little wing
                upper = (e > 0.78) & (e < 1.45) & (y > ey - 0.02)
                wx = (x - ex) * sx
                wing = (wx > a * 0.75) & (wx < a * 1.45) & (np.abs(y - (ey + 0.06 + (wx - a * 0.75) * 0.55)) < 0.022 * (1.5 - (wx - a * 0.75) / (a * 0.7)))
                col[upper | wing] = (0.04, 0.025, 0.02)
                lower = (e > 0.95) & (e < 1.2) & (y < ey - 0.02) & ((x - ex) * sx > -a * 0.4)
                col[lower] = col[lower] * 0.55
            else:
                # closed: a happy curved lash line
                dc = np.abs(np.hypot(x - ex, y - (ey + 0.12)) - 0.2)
                lid = (dc < 0.02) & (y < ey + 0.02) & (np.abs(x - ex) < a)
                col[lid] = (0.04, 0.025, 0.02)
        out[closed] = sat(col)
    save_png("face_open", out[False])
    save_png("face_closed", out[True])


ALL = (plaster, sand, paving, wood, palm_trunk, rock, carpet, weave, fabric, frieze, dress, embroidery, scarf, court, face)
CHECK = {"plaster": "plaster_n", "sand": "sand_a", "paving": "paving_a", "wood": "wood_a", "palm_trunk": "trunk_a",
         "rock": "rock_a", "carpet": "carpet_a", "weave": "weave_a", "fabric": "fabric_a", "frieze": "frieze_a",
         "dress": "dress_a", "embroidery": "embroid_a", "scarf": "scarf_a", "court": "court_a", "face": "face_open"}


def build_all(force=False):
    for fn in ALL:
        out = os.path.join(TEX_DIR, CHECK[fn.__name__] + ".png")
        if force or not os.path.exists(out):
            fn()
            print("texture", fn.__name__, "done")
