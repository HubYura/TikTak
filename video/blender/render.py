"""ЧасоПарк — рендер відеопояснень у Blender.

Будує для кожного кліпу редаговану сцену (Тік + навчальний циферблат), анімує її
за партитурою video/clips.json і озвучкою video/out/<id>/spans.json, зберігає
.blend і рендерить MP4 зі звуком, постер JPG і субтитри VTT.

    blender -b -P video/blender/render.py -- --only stage-4
    blender -b -P video/blender/render.py -- --res 1920x1080 --engine EEVEE
    blender -b -P video/blender/render.py -- --no-render      # лише .blend для правок

Стрілки — точна математика: хвилинна = 6° на хвилину, годинна = 0,5° на хвилину,
секундна = 360° на хвилину. Кольори — як у грі: коротка червона, довга синя.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
FONT = VIDEO / 'assets' / 'Nunito-ExtraBold.ttf'

# ---------- Параметри ----------

def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser(prog='render.py')
    ap.add_argument('--clips', default=str(VIDEO / 'clips.json'))
    ap.add_argument('--out', default=str(VIDEO / 'out'))
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--res', default='1280x720')
    ap.add_argument('--fps', type=int, default=25)
    ap.add_argument('--engine', default='EEVEE', choices=['CYCLES', 'EEVEE'])
    ap.add_argument('--samples', type=int, default=8)
    ap.add_argument('--no-render', action='store_true', help='лише зберегти .blend')
    ap.add_argument('--frames', type=int, default=0, help='обрізати кліп (для швидкої перевірки)')
    return ap.parse_args(argv)


# ---------- Кольори (як у грі) ----------

def srgb(hexstr, a=1.0):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)

COL = {
    'gold': '#ffc93c', 'goldD': '#d99b0b', 'bezel': '#26364a', 'dial': '#ffffff', 'band': '#e3f0ff',
    'ink': '#1d2b3a', 'tick': '#a9b8c8', 'hour': '#ff5a5f', 'hourD': '#c73c43', 'min': '#2d8cff',
    'minD': '#1560c2', 'sec': '#ff9f1a', 'glow': '#ffd84d', 'tikRim': '#15111f', 'tikFace': '#fffaf0',
    'eye': '#26364a', 'blush': '#ff9a9a', 'grass': '#ef7d45', 'grassD': '#b9a4ff', 'cloud': '#ff8fd3', 'space': '#2a1f6e',
    'label': '#1f2d3d', 'pill': '#ffffff', 'orange': '#ff8c42', 'green': '#22b865', 'blue': '#2d8cff',
    'red': '#ff5a5f', 'gear': '#aab5c3', 'gearD': '#7d8a99'
}

SKY = [  # (з години, верх неба, небо біля обрію) — та сама палітра, що й у грі (skyFor у scene.ts)
    (0, '#18264a', '#34487a'), (5, '#f3a26b', '#ffdcb3'), (7, '#7ee3f2', '#c8f4fa'),
    (18, '#ee8559', '#ffd29e'), (20, '#46598c', '#8579a8'), (22, '#18264a', '#34487a')
]

def sky_at(h24):
    """(верх, обрій) неба о цій годині."""
    col = SKY[0][1:]
    for h, *c in SKY:
        if h24 >= h:
            col = tuple(c)
    return col


# ---------- Будівельні функції ----------

MATS = {}

def mat(name, hexstr, alpha=None):
    """Пласкі «мультяшні» кольори: чисте випромінювання без освітлення.
    alpha != None — матеріал із прозорістю, яку можна анімувати (для підсвіток)."""
    key = (name, hexstr, alpha is not None)
    if key in MATS and alpha is None:
        return MATS[key]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb(hexstr)
    em.inputs['Strength'].default_value = 1.0
    if alpha is None:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        MATS[key] = m
    else:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.name = 'Alpha'
        mix.inputs[0].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    return m


def link(obj, coll):
    coll.objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, material, coll, loc=(0, 0, 0), parent=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([Vector((x, y, 0)) for x, y in verts], [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return link(o, coll)


def disc(name, r, material, coll, loc=(0, 0, 0), seg=96, sx=1.0, sy=1.0, parent=None):
    verts = [(0, 0)] + [(r * sx * math.cos(2 * math.pi * i / seg), r * sy * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    faces = [(0, i + 1, (i + 1) % seg + 1) for i in range(seg)]
    return mesh_obj(name, verts, faces, material, coll, loc, parent)


def ring(name, r_in, r_out, material, coll, loc=(0, 0, 0), seg=128, a0=0.0, a1=360.0, parent=None):
    """Кільце або дуга (кути за годинниковою стрілкою від 12)."""
    full = abs(a1 - a0) >= 360
    n = seg if full else max(4, int(seg * abs(a1 - a0) / 360))
    pts = []
    for i in range(n + (0 if full else 1)):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((math.sin(a), math.cos(a)))
    verts = [(r_out * s, r_out * c) for s, c in pts] + [(r_in * s, r_in * c) for s, c in pts]
    m = len(pts)
    faces = []
    for i in range(m if full else m - 1):
        j = (i + 1) % m
        faces.append((i, j, m + j, m + i))
    return mesh_obj(name, verts, faces, material, coll, loc, parent)


def sector(name, r, a0, a1, material, coll, loc, parent=None):
    n = 48
    verts = [(0, 0)] + [(r * math.sin(math.radians(a0 + (a1 - a0) * i / n)),
                         r * math.cos(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    faces = [(0, i + 1, i + 2) for i in range(n)]
    return mesh_obj(name, verts, faces, material, coll, loc, parent)


def rect(name, w, h, material, coll, loc=(0, 0, 0), rot=0.0, anchor_bottom=False, parent=None):
    y0 = 0 if anchor_bottom else -h / 2
    o = mesh_obj(name, [(-w / 2, y0), (w / 2, y0), (w / 2, y0 + h), (-w / 2, y0 + h)], [(0, 1, 2, 3)],
                 material, coll, loc, parent)
    o.rotation_euler[2] = rot
    return o


def text(name, body, size, material, coll, loc, parent=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    if FONT.exists():
        cu.font = bpy.data.fonts.load(str(FONT), check_existing=True)
    o = bpy.data.objects.new(name, cu)
    o.location = loc
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return link(o, coll)


def empty(name, coll, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    if parent:
        o.parent = parent
    return link(o, coll)


def hand_shape(length, half_w, tail):
    return [(-half_w, -tail), (half_w, -tail), (half_w * 0.7, length - 0.25), (0, length), (-half_w * 0.7, length - 0.25)]


def polar(a_deg, r, c=(0, 0)):
    a = math.radians(a_deg)
    return (c[0] + r * math.sin(a), c[1] + r * math.cos(a))


# ---------- Анімаційні помічники ----------

def set_interp(kind):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = kind


def key_visible(obj, frame, on):
    obj.hide_render = not on
    obj.hide_viewport = not on
    obj.keyframe_insert('hide_render', frame=frame)
    obj.keyframe_insert('hide_viewport', frame=frame)


def key_scale(obj, frame, s, interp='BEZIER'):
    set_interp(interp)
    obj.scale = (s, s, s)
    obj.keyframe_insert('scale', frame=frame)


def key_alpha(material, frame, a):
    node = material.node_tree.nodes.get('Alpha')
    if not node:
        return
    node.inputs[0].default_value = a
    node.inputs[0].keyframe_insert('default_value', frame=frame)


def pop_in(obj, f, fps):
    """Поява з пружинкою."""
    key_visible(obj, 1, False)
    key_visible(obj, f, True)
    key_scale(obj, f, 0.01)
    key_scale(obj, f + int(0.18 * fps), 1.15)
    key_scale(obj, f + int(0.32 * fps), 1.0)


# ---------- Сцена ----------

class Clip:
    def __init__(self, data, spans, fps):
        self.d, self.fps = data, fps
        self.spans = spans['sentences']
        self.duration = spans['duration']
        self.frames = max(1, math.ceil(self.duration * fps))

    def f(self, t):
        return 1 + int(round(t * self.fps))


def hm(s):
    h, m = s.split(':')
    return int(h) * 60 + int(m)


def build(clip: Clip, args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    sc = bpy.context.scene
    sc.name = clip.d['id']
    coll = sc.collection
    fps = clip.fps
    d = clip.d
    parts = set(d.get('parts', []))
    day = bool(d.get('day'))

    # Камера: ортографічна, згори — пласка «мультяшна» композиція
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 16
    cam = bpy.data.objects.new('Camera', cam_data)
    cam.location = (0, 0, 30)
    link(cam, coll)
    sc.camera = cam

    # Тло
    bg_mat = bpy.data.materials.new('SkyAnim')  # окремий, бо колір анімується
    try:
        bg_mat.use_nodes = True
    except Exception:
        pass
    nt = bg_mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    # Небо — градієнт, як у грі: світліше біля обрію, тож пагорб на заході сонця не зливається з небом
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    xyz = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], xyz.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.clamp = True
    rng.inputs['From Min'].default_value, rng.inputs['From Max'].default_value = -4.0, 7.0
    nt.links.new(xyz.outputs['Y'], rng.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    nt.links.new(rng.outputs['Result'], mix.inputs['Factor'])
    a_in = next(i for i in mix.inputs if i.name == 'A' and i.type == 'RGBA')
    b_in = next(i for i in mix.inputs if i.name == 'B' and i.type == 'RGBA')
    nt.links.new(next(o for o in mix.outputs if o.type == 'RGBA'), em.inputs['Color'])
    for sock, name in ((a_in, 'SkyHorizon'), (b_in, 'SkyTop')):
        rgb = nt.nodes.new('ShaderNodeRGB')
        rgb.name = name
        rgb.outputs[0].default_value = srgb(COL['space'])
        nt.links.new(rgb.outputs[0], sock)
    rect('Sky', 60, 40, bg_mat, coll, (0, 0, -5))
    # Космос: зорі — лише там, де не показуємо денне небо
    if not day:
        import random
        rnd = random.Random(7)
        star = mat('Star', '#ffffff')
        for i in range(46):
            x, y = rnd.uniform(-14, 14), rnd.uniform(-2.5, 8)
            disc(f'Star{i}', rnd.choice([0.03, 0.045, 0.07]), star, coll, (x, y, -4.97), seg=8)
    # Чорний контур, як усюди в грі: без нього кораловий пагорб зливається із заходом сонця
    ink, rim = mat('HillInk', COL['tikRim']), 0.14
    disc('HillBackRim', 1, ink, coll, (6, -6.1, -4.905), sx=8 + rim, sy=2.9 + rim)
    disc('HillBack', 1, mat('GrassD', COL['grassD']), coll, (6, -6.1, -4.9), sx=8, sy=2.9)
    disc('HillRim', 1, ink, coll, (-1.5, -6.8, -4.805), sx=11 + rim, sy=3.3 + rim)
    disc('Hill', 1, mat('Grass', COL['grass']), coll, (-1.5, -6.8, -4.8), sx=11, sy=3.3)

    def tree(name, x, y, s, bush=False):
        t = empty(name, coll, (x, y, -4.6))
        if not bush:
            rect(name + '.trunk', 0.28 * s, 1.1 * s, mat('Trunk', '#f3e6d2'), coll, (0, 0, 0), anchor_bottom=True, parent=t)
        base = 0.0 if bush else 1.0 * s
        for j, (dx, dy, r, col) in enumerate([(-0.45, 0.25, 0.55, '#1a8a90'), (0.45, 0.25, 0.55, '#1a8a90'),
                                              (0, 0.65, 0.7, '#2ec4b6'), (-0.15, 0.95, 0.35, '#9ff0e2')]):
            disc(f'{name}.leaf{j}', r * s, mat('Leaf' + col, col), coll, (dx * s, base + dy * s, 0.01 * j), parent=t)
        return t

    tree('TreeL', -7.3, -3.5, 1.0)
    tree('TreeR', 7.65, -3.4, 0.8)
    tree('Bush', -1.9, -3.9, 0.7, bush=True)
    clouds = []
    for i, (x, y, s) in enumerate([(-6.5, 3.6, 1.0), (0.5, 4.1, 0.7), (6.8, 3.3, 0.9)]):
        c = empty(f'Cloud{i}', coll, (x, y, -4.5))
        for j, (dx, dy, r) in enumerate([(-0.5, 0, 0.45), (0.1, 0.2, 0.6), (0.7, 0, 0.42)]):
            disc(f'Cloud{i}.{j}', r * s, mat('Cloud', COL['cloud']), coll, (dx * s, dy * s, 0), parent=c)
        clouds.append(c)

    # ---------- Циферблат ----------
    C = (3.3, -0.35)
    R = 3.1
    clock = empty('Clock', coll, (C[0], C[1], 0))
    disc('Bezel', R + 0.34, mat('Gold', COL['gold']), coll, (0, 0, 0.0), parent=clock)
    # Світло зліва згори, тінь справа знизу — циферблат виглядає об'ємним
    ring('BezelLight', R + 0.18, R + 0.34, mat('GoldLight', '#ffe596'), coll, (0, 0, 0.003), a0=270, a1=390, parent=clock)
    ring('BezelShade', R + 0.18, R + 0.34, mat('GoldShade', COL['goldD']), coll, (0, 0, 0.003), a0=90, a1=210, parent=clock)
    disc('BezelIn', R + 0.17, mat('BezelDark', COL['bezel']), coll, (0, 0, 0.01), parent=clock)
    disc('Dial', R, mat('Dial', COL['dial']), coll, (0, 0, 0.02), parent=clock)

    band = ring('MinuteBand', R - 0.95, R - 0.1, mat('Band', COL['band']), coll, (0, 0, 0.03), parent=clock)

    glows = {}

    def glow_obj(key, obj):
        glows[key] = obj
        return obj

    # Сектори половинок і чвертей (підсвітки з прозорістю)
    halves = empty('Halves', coll, (0, 0, 0.04), parent=clock)
    for i, (a0, a1, col) in enumerate([(0, 180, COL['green']), (180, 360, COL['blue'])]):
        m = mat(f'Half{i}', col, alpha=0.0)
        sector(f'Half{i}', R - 0.98, a0, a1, m, coll, (0, 0, 0), parent=halves)
    glow_obj('halves', halves)
    quarters = empty('Quarters', coll, (0, 0, 0.041), parent=clock)
    for i, col in enumerate([COL['gold'], COL['green'], COL['blue'], COL['red']]):
        m = mat(f'Quarter{i}', col, alpha=0.0)
        sector(f'Quarter{i}', R - 0.98, i * 90, i * 90 + 90, m, coll, (0, 0, 0), parent=quarters)
    glow_obj('quarters', quarters)

    fives_glow = ring('FivesGlow', R - 0.95, R - 0.1, mat('FivesGlow', COL['glow'], alpha=0.0), coll, (0, 0, 0.035), parent=clock)
    glow_obj('fives', fives_glow)
    ticks_glow = ring('TicksGlow', R - 0.42, R - 0.05, mat('TicksGlow', COL['glow'], alpha=0.0), coll, (0, 0, 0.045), parent=clock)
    glow_obj('ticks', ticks_glow)

    ticks = empty('Ticks', coll, (0, 0, 0.05), parent=clock)
    for k in range(60):
        if k % 5 == 0:
            continue
        x, y = polar(k * 6, R - 0.12)
        rect(f'Tick{k}', 0.05, 0.24, mat('Tick', COL['tick']), coll, (x, y, 0), rot=-math.radians(k * 6),
             anchor_bottom=False, parent=ticks)
    hour_ticks = empty('HourTicks', coll, (0, 0, 0.05), parent=clock)
    for k in range(12):
        x, y = polar(k * 30, R - 0.2)
        rect(f'HourTick{k}', 0.11, 0.34, mat('Ink', COL['ink']), coll, (x, y, 0), rot=-math.radians(k * 30), parent=hour_ticks)

    fives = empty('Fives', coll, (0, 0, 0.06), parent=clock)
    for n in range(1, 13):
        x, y = polar(n * 30, R - 0.55)
        text(f'Five{n}', '00' if n == 12 else f'{n * 5:02d}', 0.36, mat('FiveText', COL['minD']), coll, (x, y, 0), parent=fives)

    numbers = {}
    for n in range(1, 13):
        x, y = polar(n * 30, R * 0.56)
        numbers[n] = text(f'Num{n}', str(n), 0.82, mat('Ink', COL['ink']), coll, (x, y, 0.07), parent=clock)
        g = disc(f'NumGlow{n}', 0.5, mat(f'NumGlow{n}', COL['glow'], alpha=0.0), coll, (x, y, 0.065), parent=clock)
        glow_obj(f'num{n}', g)

    # Стрілки: порожні «осі» в центрі, які обертаються
    axes = {}
    for key, length, half_w, tail, col, colD, z in [
        ('hour', 1.75, 0.2, 0.35, COL['hour'], COL['hourD'], 0.10),
        ('minute', R - 0.2, 0.14, 0.45, COL['min'], COL['minD'], 0.12),
    ]:
        ax = empty(f'Axis.{key}', coll, (0, 0, z), parent=clock)
        shape = hand_shape(length, half_w, tail)
        outline = hand_shape(length + 0.07, half_w + 0.06, tail + 0.06)
        g = mesh_obj(f'Glow.{key}', [(x * 1.35, y * 1.08) for x, y in outline], [tuple(range(5))],
                     mat(f'HandGlow.{key}', COL['glow'], alpha=0.0), coll, (0, 0, -0.004), parent=ax)
        glow_obj(key, g)
        mesh_obj(f'Hand.{key}.edge', outline, [tuple(range(5))], mat(f'{key}D', colD), coll, (0, 0, -0.002), parent=ax)
        mesh_obj(f'Hand.{key}', shape, [tuple(range(5))], mat(key, col), coll, (0, 0, 0), parent=ax)
        axes[key] = ax
    ax = empty('Axis.second', coll, (0, 0, 0.14), parent=clock)
    rect('Hand.second', 0.06, R - 0.1 + 0.5, mat('Second', COL['sec']), coll, (0, -0.5, 0), anchor_bottom=True, parent=ax)
    disc('Hand.second.tail', 0.14, mat('Second', COL['sec']), coll, (0, -0.4, 0.001), parent=ax)
    g = rect('Glow.second', 0.2, R + 0.5, mat('HandGlow.second', COL['glow'], alpha=0.0), coll, (0, -0.55, -0.004), anchor_bottom=True, parent=ax)
    glow_obj('second', g)
    axes['second'] = ax
    disc('Hub', 0.28, mat('BezelDark', COL['bezel']), coll, (0, 0, 0.16), parent=clock)
    disc('HubGold', 0.13, mat('Gold', COL['gold']), coll, (0, 0, 0.17), parent=clock)

    # Стрілка-коло «за годинниковою стрілкою»
    circ = empty('CircleArrow', coll, (0, 0, 0.2), parent=clock)
    ring('CircleArc', R + 0.62, R + 0.78, mat('CircleArc', COL['orange'], alpha=0.0), coll, (0, 0, 0), a0=10, a1=330, parent=circ)
    head = mesh_obj('CircleHead', [(0.0, 0.34), (0.0, -0.34), (0.42, 0)], [(0, 1, 2)],
                    mat('CircleHead', COL['orange'], alpha=0.0), coll, (0, 0, 0), parent=circ)
    head_axis = empty('CircleHeadAxis', coll, (0, 0, 0.01), parent=circ)
    head.parent = head_axis
    head.location = (0.0, R + 0.7, 0)
    glow_obj('circle', circ)

    # Механізм — дві шестерні
    gears = empty('Gears', coll, (-1.2, -2.9, 0.3))
    gear_objs = []
    for i, (x, y, r, teeth) in enumerate([(0, 0, 0.75, 12), (1.12, -0.55, 0.45, 8)]):
        gx = empty(f'Gear{i}', coll, (x, y, 0), parent=gears)
        disc(f'GearBody{i}', r, mat('Gear', COL['gear']), coll, (0, 0, 0), parent=gx)
        disc(f'GearHole{i}', r * 0.3, mat('GearD', COL['gearD']), coll, (0, 0, 0.01), parent=gx)
        for t in range(teeth):
            a = 360 * t / teeth
            px, py = polar(a, r)
            rect(f'Tooth{i}.{t}', 0.2, 0.3, mat('Gear', COL['gear']), coll, (px, py, 0), rot=-math.radians(a), parent=gx)
        gear_objs.append((gx, teeth))
    glow_obj('gears', gears)

    # ---------- Тік ----------
    T = (-4.9, -0.6)
    ground_shadow = disc('Tik.shadow', 1, mat('GroundShadow', '#5a9e3c'), coll, (T[0], -3.5, -4.55), sx=1.5, sy=0.28)
    tik = empty('Tik', coll, (T[0], T[1], 0.5))
    # Ноги з черевиками — Тік стоїть на пагорбі, а не висить у повітрі
    for sgn in (-1, 1):
        rect(f'Tik.leg{sgn}', 0.24, 1.1, mat('TikRim', COL['tikRim']), coll, (sgn * 0.6, -2.95, -0.02), anchor_bottom=True, parent=tik)
        disc(f'Tik.shoe{sgn}', 0.22, mat('Shoe', '#26364a'), coll, (sgn * 0.72, -2.95, -0.015), sx=1.7, parent=tik)
    # Руки: плече — порожній об'єкт, що обертається; рука дивиться вгору при куті 0
    arms = {}
    for sgn in (-1, 1):
        sh = empty(f'Tik.shoulder{sgn}', coll, (sgn * 1.9, -0.45, -0.01), parent=tik)
        rect(f'Tik.arm{sgn}', 0.24, 1.25, mat('TikRim', COL['tikRim']), coll, (0, 0, 0), anchor_bottom=True, parent=sh)
        disc(f'Tik.gloveEdge{sgn}', 0.29, mat('Shoe', '#26364a'), coll, (0, 1.32, 0.001), parent=sh)
        disc(f'Tik.glove{sgn}', 0.24, mat('Glove', '#ffffff'), coll, (0, 1.32, 0.002), parent=sh)
        arms[sgn] = sh
    disc('Tik.rim', 2.12, mat('TikRim', COL['tikRim']), coll, (0, 0, 0), parent=tik)
    disc('Tik.shade', 1.98, mat('TikShade', '#f0ae1e'), coll, (0, 0, 0.008), parent=tik)
    disc('Tik.body', 1.9, mat('TikBody', COL['gold']), coll, (-0.07, 0.07, 0.01), parent=tik)
    ring('Tik.light', 1.62, 1.84, mat('TikLight', '#ffe596'), coll, (-0.05, 0.05, 0.015), a0=285, a1=345, parent=tik)
    disc('Tik.face', 1.55, mat('TikFace', COL['tikFace']), coll, (0, 0, 0.02), parent=tik)
    rect('Tik.stem', 0.26, 0.55, mat('TikRim', COL['tikRim']), coll, (0, 2.0, -0.01), anchor_bottom=True, parent=tik)
    disc('Tik.bell', 0.3, mat('TikBody', COL['gold']), coll, (0, 2.62, 0), parent=tik)
    for a in (0, 90, 180, 270):
        x, y = polar(a, 1.3)
        rect(f'Tik.mark{a}', 0.1, 0.28, mat('TikMark', '#e7cf9f'), coll, (x, y, 0.03), rot=-math.radians(a), parent=tik)
    eyes = empty('Tik.eyes', coll, (0, 0.18, 0.04), parent=tik)
    for s in (-1, 1):
        disc(f'Tik.eye{s}', 0.24, mat('Eye', COL['eye']), coll, (s * 0.52, 0, 0), sx=0.8, sy=1.0, parent=eyes)
        disc(f'Tik.shine{s}', 0.08, mat('Pill', COL['pill']), coll, (s * 0.52 + 0.07, 0.1, 0.01), parent=eyes)
    happy_eyes = empty('Tik.happyEyes', coll, (0, 0.14, 0.04), parent=tik)
    for s in (-1, 1):
        ring(f'Tik.happyEye{s}', 0.2, 0.3, mat('Eye', COL['eye']), coll, (s * 0.52, -0.1, 0), a0=-70, a1=70, parent=happy_eyes)
    blush = empty('Tik.blush', coll, (0, -0.35, 0.035), parent=tik)
    for s in (-1, 1):
        disc(f'Tik.blush{s}', 0.2, mat('Blush', COL['blush']), coll, (s * 0.95, 0, 0), parent=blush)
    mouths = {
        'idle': ring('Tik.mouthIdle', 0.4, 0.5, mat('Eye', COL['eye']), coll, (0, -0.15, 0.04), a0=120, a1=240, parent=tik),
        'happy': sector('Tik.mouthHappy', 0.55, 90, 270, mat('Eye', COL['eye']), coll, (0, -0.42, 0.04), parent=tik),
        'oops': disc('Tik.mouthOops', 0.2, mat('Eye', COL['eye']), coll, (0, -0.62, 0.04), sx=0.8, parent=tik),
        'talk': disc('Tik.mouthTalk', 0.28, mat('Eye', COL['eye']), coll, (0, -0.62, 0.04), sx=1.1, sy=0.8, parent=tik),
    }

    # Сонце / місяць для добових кліпів
    sun = disc('Sun', 0.55, mat('Sun', '#ffd76a'), coll, (-7.0, 3.6, -4.0))
    moon = empty('Moon', coll, (-7.0, 3.6, -4.0))
    disc('MoonBody', 0.5, mat('Moon', '#eef3ff'), coll, (0, 0, 0), parent=moon)

    # Підпис
    label_mat = mat('Label', COL['label'])
    pill_mat = mat('Pill', COL['pill'])

    # ---------- Анімація ----------
    sc.frame_start = 1
    sc.frame_end = min(clip.frames, args.frames) if args.frames else clip.frames
    sc.render.fps = fps

    beats = d['beats']
    spans = clip.spans
    F = clip.f

    # Видимість частин циферблата
    def part_objs(p):
        return {
            'numbers': list(numbers.values()), 'cardinal': [numbers[n] for n in (12, 3, 6, 9)],
            'fives': [fives, band], 'ticks': [ticks], 'hour': [axes['hour']], 'minute': [axes['minute']],
            'second': [axes['second']]
        }[p]

    def set_tree_visible(o, frame, on):
        key_visible(o, frame, on)
        for ch in o.children_recursive:
            key_visible(ch, frame, on)

    shown = set()
    for p in parts:
        for o in part_objs(p):
            shown.add(o.name)
    all_parts = ['numbers', 'fives', 'ticks', 'hour', 'minute', 'second']
    for p in all_parts:
        for o in part_objs(p):
            set_tree_visible(o, 1, o.name in shown)
    hour_ticks_on = bool(parts & {'numbers', 'cardinal', 'ticks'}) or any(
        set(b.get('show', [])) & {'numbers', 'cardinal', 'ticks'} for b in beats)
    set_tree_visible(hour_ticks, 1, hour_ticks_on)

    # Підсвітки: усі вимкнені, вмикаються на свої речення
    def glow_mats(o):
        objs = [o] + list(o.children_recursive)
        return [s.material for ob in objs if ob.type == 'MESH' for s in ob.material_slots if s.material and s.material.node_tree.nodes.get('Alpha')]

    GLOW_ALPHA = {'halves': 0.35, 'quarters': 0.35, 'fives': 0.55, 'ticks': 0.5, 'circle': 1.0}
    for key, o in glows.items():
        for m in glow_mats(o):
            key_alpha(m, 1, 0.0)
    for key in ('gears',):
        set_tree_visible(glows[key], 1, False)

    # Хвилини циферблата — неперервні (без стрибка через 12)
    cur = float(hm(d['start']))
    period = 1440 if day else 720

    def key_hands(frame, mins, interp):
        set_interp(interp)
        axes['minute'].rotation_euler[2] = -math.radians(mins * 6)
        axes['hour'].rotation_euler[2] = -math.radians(mins * 0.5)
        axes['second'].rotation_euler[2] = -math.radians(mins * 360)
        for a in axes.values():
            a.keyframe_insert('rotation_euler', index=2, frame=frame)

    def key_sky(frame, mins):
        top, horizon = sky_at(int(mins // 60) % 24) if day else (COL['space'], COL['space'])
        set_interp('LINEAR')
        for name, col in (('SkyTop', top), ('SkyHorizon', horizon)):
            node = bg_mat.node_tree.nodes[name]
            node.outputs[0].default_value = srgb(col)
            node.outputs[0].keyframe_insert('default_value', frame=frame)
        h24 = (mins / 60) % 24
        is_day = 6 <= h24 < 20
        key_visible(sun, frame, day and is_day)
        for o in [moon] + list(moon.children):
            key_visible(o, frame, day and not is_day)

    key_hands(1, cur, 'CONSTANT')
    key_sky(1, cur)

    # Рот і настрій
    mood_track = []  # (t0, t1, mood)
    point_track = []  # (t0, t1, чи показує рукою на циферблат)
    labels = []

    for i, beat in enumerate(beats):
        sp = spans[i] if i < len(spans) else spans[-1]
        t0, t1 = sp['start'], sp['end']
        f0, f1 = F(t0), max(F(t0) + 1, F(t1))

        # Рух стрілок
        target = None
        interp = 'BEZIER'
        if 'turn' in beat:
            target, interp = cur + beat['turn'], 'LINEAR'
        elif 'clock' in beat:
            delta = (hm(beat['clock']) - cur) % period
            if delta:
                target = cur + delta
        if target is not None and target != cur:
            key_hands(f0, cur, interp)
            steps = max(1, int((f1 - f0) / max(1, fps // 4))) if day else 1
            for s in range(1, steps + 1):
                ms = cur + (target - cur) * s / steps
                fs = f0 + int((f1 - f0) * s / steps)
                if day:
                    key_sky(fs, ms)
            if interp == 'BEZIER':
                # Легкий перельот і повернення — стрілка «доводиться», як у справжнього механізму
                key_hands(f1, target + 0.8, 'BEZIER')
                key_hands(f1 + max(2, fps // 8), target, 'CONSTANT')
            else:
                key_hands(f1, target, 'CONSTANT')
            if day:
                key_sky(f0, cur)
            cur = target

        # Поява нових частин
        for p in beat.get('show', []):
            for o in part_objs(p):
                if o.name in shown:
                    continue
                shown.add(o.name)
                for ob in [o] + list(o.children_recursive):
                    key_visible(ob, 1, False)
                pop_in(o, f0, fps)
                for ob in o.children_recursive:
                    key_visible(ob, f0, True)
            if p in ('numbers', 'cardinal'):
                set_tree_visible(hour_ticks, f0, True)

        # Підсвітки на час речення
        for gk in beat.get('glow', []):
            o = glows.get(gk)
            if not o:
                continue
            if gk == 'gears':
                set_tree_visible(o, f0, True)
                pop_in(o, f0, fps)
                continue
            a = GLOW_ALPHA.get(gk, 0.85)
            for m in glow_mats(o):
                set_interp('BEZIER')
                key_alpha(m, max(1, f0 - 2), 0.0)
                key_alpha(m, f0 + int(0.25 * fps), a)
                key_alpha(m, f1, a)
                key_alpha(m, f1 + int(0.3 * fps), 0.0)

        if beat.get('label'):
            labels.append((beat['label'], f0, f1 + int(0.4 * fps)))
        mood_track.append((t0, t1, beat.get('mood', 'idle')))
        pointing = bool(beat.get('glow') or beat.get('show') or target is not None)
        point_track.append((t0, t1, pointing))

    # Підписи з білою «пігулкою»
    bpy.context.view_layer.update()
    for j, (body, f0, f1) in enumerate(labels):
        lab = empty(f'Label{j}', coll, (C[0], 3.72, 0.4))
        t = text(f'LabelText{j}', body, 0.62, label_mat, coll, (0, 0, 0.02), parent=lab)
        bpy.context.view_layer.update()
        w = max(1.2, t.dimensions.x + 0.7)
        rect(f'LabelPill{j}', w - 0.95, 0.95, pill_mat, coll, (0, 0, 0), parent=lab)
        for sgn in (-1, 1):
            disc(f'LabelCap{j}.{sgn}', 0.475, pill_mat, coll, (sgn * (w - 0.95) / 2, 0, 0), parent=lab)
        for ob in [lab] + list(lab.children):
            key_visible(ob, 1, False)
        pop_in(lab, f0, fps)
        for ob in lab.children:
            key_visible(ob, f0, True)
        for ob in [lab] + list(lab.children):
            key_visible(ob, min(f1, sc.frame_end), False if f1 < sc.frame_end else True)

    # Настрій і рот: під час мовлення рот «говорить»
    def mood_at(t):
        for t0, t1, m in mood_track:
            if t0 <= t <= t1 + 0.4:
                return m
        return 'idle'

    def speaking(t):
        return any(t0 <= t <= t1 for t0, t1, _ in mood_track)

    step = 0.14
    t, flip, last = 0.0, False, None
    while t <= clip.duration + step:
        m = mood_at(t)
        talk = speaking(t) and flip and m != 'oops'
        state = (m, talk)
        if state != last:
            fr = F(t)
            for k, o in mouths.items():
                on = (k == 'talk') if talk else (k == m)
                key_visible(o, fr, on)
            happy = m == 'happy'
            for o in [eyes] + list(eyes.children):
                key_visible(o, fr, not happy)
            for o in [happy_eyes] + list(happy_eyes.children) + [blush] + list(blush.children):
                key_visible(o, fr, happy)
            last = state
        flip = not flip
        t += step

    # Тік підстрибує й трохи гойдається; кліпає
    set_interp('BEZIER')
    for k in range(0, clip.frames + fps, fps // 2):
        tt = k / fps
        m = mood_at(tt)
        hop = 0.35 if m == 'happy' and (k // (fps // 2)) % 2 == 0 else 0.0
        tik.location = (T[0], T[1] + 0.08 * math.sin(tt * 2.4) + hop, 0.5)
        tik.rotation_euler[2] = math.radians(3 * math.sin(tt * 1.7)) + (math.radians(-6 if m == 'oops' else 0))
        tik.keyframe_insert('location', frame=1 + k)
        tik.keyframe_insert('rotation_euler', index=2, frame=1 + k)
    # Права рука показує на циферблат, коли там щось відбувається; ліва махає, коли Тік радіє
    def points_at(tt):
        return any(a <= tt <= b + 0.3 and p for a, b, p in point_track)

    set_interp('BEZIER')
    step_f = max(2, fps // 5)
    last_r = last_l = last_look = None
    for k in range(0, clip.frames + step_f, step_f):
        tt = k / fps
        pt = points_at(tt)
        r_ang = -78 if pt else -160
        m = mood_at(tt)
        wave = m == 'happy' or (d['id'] == 'intro' and tt < 2.5)
        l_ang = (28 + 22 * math.sin(tt * 9)) if wave else 160
        look = 0.09 if pt else 0.0
        if r_ang != last_r or pt:
            arms[1].rotation_euler[2] = math.radians(r_ang + (3 * math.sin(tt * 3) if pt else 0))
            arms[1].keyframe_insert('rotation_euler', index=2, frame=1 + k)
            last_r = r_ang
        if l_ang != last_l or wave:
            arms[-1].rotation_euler[2] = math.radians(l_ang)
            arms[-1].keyframe_insert('rotation_euler', index=2, frame=1 + k)
            last_l = l_ang
        if look != last_look:
            eyes.location.x = look
            eyes.keyframe_insert('location', index=0, frame=1 + k)
            last_look = look

    # Тінь стискається, коли Тік підстрибує
    for k in range(0, clip.frames + fps, fps // 2):
        m = mood_at(k / fps)
        hop = m == 'happy' and (k // (fps // 2)) % 2 == 0
        ground_shadow.scale = (1.5 * (0.75 if hop else 1), 0.28 * (0.75 if hop else 1), 1)
        ground_shadow.keyframe_insert('scale', frame=1 + k)

    # Іскорки навколо Тіка, коли він радіє
    spark_mat = mat('Spark', COL['gold'])
    n_spark = 0
    for t0, t1, m in mood_track:
        if m != 'happy':
            continue
        for j, (dx, dy, sz) in enumerate([(-2.6, 2.2, 0.32), (2.4, 2.6, 0.26), (-2.9, -0.6, 0.22), (2.7, 0.4, 0.3)]):
            star = mesh_obj(f'Spark{n_spark}', [(0, sz), (sz * 0.28, sz * 0.28), (sz, 0), (sz * 0.28, -sz * 0.28),
                                               (0, -sz), (-sz * 0.28, -sz * 0.28), (-sz, 0), (-sz * 0.28, sz * 0.28)],
                            [tuple(range(8))], spark_mat, coll, (T[0] + dx, T[1] + dy, 0.6))
            n_spark += 1
            f_on = F(t0) + j * 3
            pop_in(star, f_on, fps)
            key_visible(star, min(sc.frame_end, F(t1) + int(0.5 * fps)), False)
            set_interp('LINEAR')
            star.rotation_euler[2] = 0
            star.keyframe_insert('rotation_euler', index=2, frame=f_on)
            star.rotation_euler[2] = math.radians(90)
            star.keyframe_insert('rotation_euler', index=2, frame=F(t1) + int(0.5 * fps))

    set_interp('BEZIER')
    for k in range(int(2.2 * fps), clip.frames, int(3.3 * fps)):
        eyes.scale = (1, 1, 1)
        eyes.keyframe_insert('scale', frame=k)
        eyes.scale = (1, 0.12, 1)
        eyes.keyframe_insert('scale', frame=k + 2)
        eyes.scale = (1, 1, 1)
        eyes.keyframe_insert('scale', frame=k + 4)

    # Хмари пливуть, шестерні й стрілка-коло крутяться
    set_interp('LINEAR')
    for i, c in enumerate(clouds):
        x0 = c.location.x
        c.keyframe_insert('location', index=0, frame=1)
        c.location.x = x0 + 0.25 * (i + 1) * clip.duration
        c.keyframe_insert('location', index=0, frame=clip.frames)
        c.location.x = x0
    for i, (gx, teeth) in enumerate(gear_objs):
        gx.rotation_euler[2] = 0
        gx.keyframe_insert('rotation_euler', index=2, frame=1)
        gx.rotation_euler[2] = (-1 if i == 0 else 12 / 8) * math.radians(40) * clip.duration
        gx.keyframe_insert('rotation_euler', index=2, frame=clip.frames)
    head_axis.rotation_euler[2] = 0
    head_axis.keyframe_insert('rotation_euler', index=2, frame=1)
    head_axis.rotation_euler[2] = -math.radians(120) * clip.duration
    head_axis.keyframe_insert('rotation_euler', index=2, frame=clip.frames)

    return sc


# ---------- Рендер і вихідні файли ----------

def setup_render(sc, args):
    w, h = (int(x) for x in args.res.lower().split('x'))
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    try:
        sc.view_settings.view_transform = 'Standard'   # точні кольори з гри, без Filmic/AgX
        sc.view_settings.look = 'None'
    except Exception:
        pass
    if args.engine == 'CYCLES':
        r.engine = 'CYCLES'
        sc.cycles.samples = args.samples
        sc.cycles.use_denoising = False
        sc.cycles.max_bounces = 0
        sc.cycles.transparent_max_bounces = 16
        try:
            sc.cycles.device = 'GPU'
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.get_devices()
            if not any(dv.use for dv in prefs.devices):
                sc.cycles.device = 'CPU'
        except Exception:
            sc.cycles.device = 'CPU'
    else:
        for name in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
            try:
                r.engine = name
                break
            except TypeError:
                continue
        try:
            sc.eevee.taa_render_samples = args.samples
        except Exception:
            pass


def add_audio(sc, wav: Path):
    if not wav.exists():
        return False
    ed = sc.sequence_editor or sc.sequence_editor_create()
    strips = ed.strips if hasattr(ed, 'strips') else ed.sequences   # 5.0 перейменував sequences → strips
    strips.new_sound('voice', str(wav), 1, 1)
    # Лише звукові стрічки: Blender усе одно рендерить камеру, а звук іде в MP4.
    # (З use_sequencer = False звук у файл не потрапляє — перевірено.)
    sc.render.use_sequencer = True
    return True


def set_video_output(sc, path: Path, with_audio: bool):
    s = sc.render.image_settings
    try:
        s.media_type = 'VIDEO'
    except Exception:
        pass
    s.file_format = 'FFMPEG'
    ff = sc.render.ffmpeg
    ff.format = 'MPEG4'
    ff.codec = 'H264'
    ff.constant_rate_factor = 'HIGH'
    ff.ffmpeg_preset = 'GOOD'
    ff.gopsize = sc.render.fps
    if with_audio:
        ff.audio_codec = 'AAC'
        ff.audio_bitrate = 160
        ff.audio_channels = 'MONO'
    sc.render.filepath = str(path)


def set_still_output(sc, path: Path):
    s = sc.render.image_settings
    try:
        s.media_type = 'IMAGE'
    except Exception:
        pass
    s.file_format = 'JPEG'
    s.quality = 90
    sc.render.filepath = str(path)


def vtt(spans, path: Path):
    def ts(t):
        h, rem = divmod(t, 3600)
        m, s = divmod(rem, 60)
        return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'
    lines = ['WEBVTT', '']
    for i, sp in enumerate(spans, 1):
        lines += [str(i), f"{ts(sp['start'])} --> {ts(sp['end'] + 0.3)}", sp['text'], '']
    path.write_text('\n'.join(lines), 'utf-8')


def estimate_spans(clip_data):
    t, out = 0.6, []
    for i, s in enumerate(clip_data['sentences']):
        d = max(1.0, len(s.split()) / 2.2)
        out.append({'start': round(t, 3), 'end': round(t + d, 3), 'text': s})
        t += d + (0.9 if i == len(clip_data['sentences']) - 1 else 0.35)
    return {'duration': round(t, 3), 'sentences': out, 'voiced': False}


def write_manifest(out_dir: Path):
    clips = {}
    for d in sorted(p for p in out_dir.iterdir() if p.is_dir()):
        mp4 = d / f'{d.name}.mp4'
        if mp4.exists():
            entry = {'src': f'{d.name}.mp4'}
            if (d / f'{d.name}.jpg').exists():
                entry['poster'] = f'{d.name}.jpg'
            if (d / f'{d.name}.vtt').exists():
                entry['vtt'] = f'{d.name}.vtt'
            spans = d / 'spans.json'
            if spans.exists() and not json.loads(spans.read_text('utf-8')).get('voiced'):
                entry['narrate'] = True   # без голосу: гра читає субтитри сама
            clips[d.name] = entry
    (out_dir / 'manifest.json').write_text(json.dumps({'clips': clips}, ensure_ascii=False, indent=2), 'utf-8')
    return len(clips)


def main():
    args = parse_args()
    clips = json.loads(Path(args.clips).read_text('utf-8'))
    out_dir = Path(args.out)
    for data in clips:
        if args.only and data['id'] not in args.only:
            continue
        d = out_dir / data['id']
        d.mkdir(parents=True, exist_ok=True)
        spans_file = d / 'spans.json'
        spans = json.loads(spans_file.read_text('utf-8')) if spans_file.exists() else estimate_spans(data)
        clip = Clip(data, spans, args.fps)
        sc = build(clip, args)
        setup_render(sc, args)
        voiced = spans.get('voiced') and add_audio(sc, d / 'voice.wav')
        bpy.ops.wm.save_as_mainfile(filepath=str(d / f"{data['id']}.blend"))
        vtt(spans['sentences'], d / f"{data['id']}.vtt")
        print(f"[{data['id']}] {clip.frames} кадрів, {clip.duration:.1f} с, звук: {'так' if voiced else 'ні'}")
        if args.no_render:
            continue
        # Постер — кадр наприкінці першого речення, коли вже є що показати
        sc.frame_set(min(sc.frame_end, clip.f(spans['sentences'][0]['end'])))
        set_still_output(sc, d / f"{data['id']}.jpg")
        bpy.ops.render.render(write_still=True)
        sc.frame_set(1)
        set_video_output(sc, d / f"{data['id']}.mp4", bool(voiced))
        bpy.ops.render.render(animation=True)
    n = write_manifest(out_dir)
    print(f'manifest.json: {n} кліпів готово')


if __name__ == '__main__':
    main()
