"""Byte Acres art, made in Blender: the logo, the field card, the material icons
and the drone model. Every shape is built here from primitives, in the brand
colours, so the art can be remade or restyled by running this again.

Run inside Blender (5.x), with the project folder as the argument:
    blender --background --python tools/blender/byte_acres_art.py -- <project folder>
or through the Blender MCP add-on, with OUT set to the project folder.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

OUT = globals().get('OUT') or (sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd())
PUBLIC = os.path.join(OUT, 'public')

# brand and art colours (the same values as replica/design/tokens.json)
C = {
    'accent': '#b19cff', 'ink': '#170f33', 'bg': '#0e1217',
    'grass': '#5fae4e', 'grass_dark': '#3f8a37', 'soil': '#8a5a3b', 'soil_dark': '#5b3a26', 'side': '#4a2f1f',
    'leaf': '#7cc96a', 'leaf_dark': '#3d7d35', 'trunk': '#7a4f2c', 'canopy': '#2f8f4e',
    'drone': '#e9eef4', 'drone_dark': '#3a4552', 'eye': '#b19cff',
    'hay': '#e8cf6a', 'wood': '#c99566', 'carrot': '#f39a54', 'water': '#6cc4f0', 'pumpkin': '#f0a23c',
    'power': '#f5e663', 'cactus': '#7fcf7a', 'gold': '#f2c94c', 'goo': '#c38df0', 'straw': '#e3c26f', 'band': '#d9475b',
    'petal': '#f6cf45', 'core': '#6b3f1d',
}


def srgb(hexs):
    h = hexs.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return (*lin, 1.0)


_mats = {}


def mat(name, rough=0.6, metal=0.0, emit=0.0, alpha=1.0):
    key = (name, rough, metal, emit, alpha)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f'{name}-{len(_mats)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(C[name])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = srgb(C[name])
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    _mats[key] = m
    return m


def obj(o, m, name=None, smooth=True, bevel=0.0):
    if name:
        o.name = name
    o.data.materials.clear()
    o.data.materials.append(m)
    if smooth and hasattr(o.data, 'polygons'):
        for p in o.data.polygons:
            p.use_smooth = True
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    return o


def scale_mesh(o, s):
    # scale the mesh itself and keep the object's origin where it was, so later
    # rotations turn each part about its own centre
    o.data.transform(Matrix.Diagonal((s[0], s[1], s[2], 1)))


def box(size, loc, m, name=None, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    scale_mesh(o, size)
    return obj(o, m, name, smooth=False, bevel=bevel)


def sphere(r, loc, m, scale=(1, 1, 1), name=None, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object
    scale_mesh(o, scale)
    return obj(o, m, name)


def ico(r, loc, m, name=None, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=loc, subdivisions=sub)
    return obj(bpy.context.active_object, m, name, smooth=False)


def cyl(r, depth, loc, m, name=None, r2=None, verts=32, rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, vertices=verts, rotation=rot)
    return obj(bpy.context.active_object, m, name)


def cone(r, depth, loc, m, name=None, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0, depth=depth, location=loc, vertices=verts, rotation=rot)
    return obj(bpy.context.active_object, m, name)


def torus(R, r, loc, m, name=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot)
    return obj(bpy.context.active_object, m, name)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    _mats.clear()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def stage(size_px, transparent=True, ortho=None, cam_loc=(0, -6, 4.5), target=(0, 0, 0.4), lens=50, bg=None):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = (size_px if isinstance(size_px, tuple) else (size_px, size_px))
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    # Standard keeps the brand colours true (AgX washes the violet out)
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world
    world.use_nodes = True
    bgn = world.node_tree.nodes['Background']
    bgn.inputs['Color'].default_value = srgb(bg) if bg else (0.6, 0.65, 0.75, 1)
    bgn.inputs['Strength'].default_value = 0.9 if not bg else 1.0
    cam_data = bpy.data.cameras.new('cam')
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = ortho
    else:
        cam_data.lens = lens
    cam = bpy.data.objects.new('cam', cam_data)
    sc.collection.objects.link(cam)
    cam.location = cam_loc
    d = Vector(target) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    for name, loc, energy, size in [('key', (-4, -4, 7), 900, 4), ('fill', (5, -2, 3), 250, 5), ('rim', (0, 6, 5), 500, 3)]:
        L = bpy.data.lights.new(name, 'AREA')
        L.energy = energy
        L.size = size
        lo = bpy.data.objects.new(name, L)
        sc.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- models

def drone(at=(0, 0, 0), scale=1.0, hat=True, names=False):
    """the farm drone: a round white shell, a violet eye, four rotors; parts named for the game"""
    x, y, z = at
    s = scale
    parts = []
    shell = sphere(0.5 * s, (x, y, z), mat('drone', 0.3, 0.1), scale=(1, 1, 0.62), name='shell' if names else None)
    parts.append(shell)
    parts.append(cyl(0.4 * s, 0.12 * s, (x, y, z - 0.26 * s), mat('drone_dark', 0.5), name='belly' if names else None, r2=0.3 * s))
    parts.append(sphere(0.14 * s, (x, y - 0.44 * s, z + 0.02 * s), mat('eye', 0.2, emit=1.0), name='eye' if names else None))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        ax, ay = math.cos(a), math.sin(a)
        arm = box((0.85 * s, 0.09 * s, 0.07 * s), (x + ax * 0.5 * s, y + ay * 0.5 * s, z + 0.05 * s), mat('drone_dark', 0.5), bevel=0.01)
        arm.rotation_euler = (0, 0, a)
        parts.append(arm)
        parts.append(cyl(0.07 * s, 0.12 * s, (x + ax * 0.85 * s, y + ay * 0.85 * s, z + 0.12 * s), mat('drone_dark', 0.4)))
        parts.append(cyl(0.32 * s, 0.025 * s, (x + ax * 0.85 * s, y + ay * 0.85 * s, z + 0.2 * s), mat('drone_dark', 0.4, alpha=0.55),
                         name=f'rotor_{i}' if names else None))
    if hat:
        parts += straw_hat((x, y, z + 0.3 * s), s)
    return parts


def straw_hat(at, s=1.0):
    x, y, z = at
    return [
        cyl(0.44 * s, 0.04 * s, (x, y, z), mat('straw', 0.8)),
        cyl(0.2 * s, 0.2 * s, (x, y, z + 0.11 * s), mat('straw', 0.8), r2=0.17 * s),
        cyl(0.205 * s, 0.06 * s, (x, y, z + 0.06 * s), mat('band', 0.6)),
    ]


def tile(x, y, kind='grass', h=0.35):
    top = 'grass' if kind == 'grass' else 'soil'
    box((1, 1, h), (x, y, -h / 2), mat(top, 0.9), bevel=0.04)
    if kind == 'soil':
        for k in (-0.25, 0, 0.25):
            box((0.8, 0.07, 0.04), (x, y + k, 0.01), mat('soil_dark', 0.9), bevel=0.01)


def grass_tuft(x, y, n=7, seed=1):
    import random
    r = random.Random(seed)
    for i in range(n):
        c = cone(0.04, 0.32, (x + r.uniform(-0.3, 0.3), y + r.uniform(-0.3, 0.3), 0.16), mat('grass_dark' if i % 3 else 'leaf', 0.8), verts=5)
        c.rotation_euler = (r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), 0)


def pumpkin(x, y, s=1.0):
    for i in range(6):
        a = i * math.pi / 3
        sphere(0.2 * s, (x + math.cos(a) * 0.1 * s, y + math.sin(a) * 0.1 * s, 0.18 * s), mat('pumpkin', 0.5), scale=(1, 1, 0.85))
    cyl(0.03 * s, 0.14 * s, (x, y, 0.42 * s), mat('leaf_dark', 0.7))


def sunflower(x, y):
    cyl(0.03, 0.7, (x, y, 0.35), mat('leaf_dark', 0.7))
    for i in range(12):
        a = i * math.tau / 12
        p = sphere(0.07, (x + math.cos(a) * 0.17, y - 0.04, 0.72 + math.sin(a) * 0.17), mat('petal', 0.5), scale=(1.6, 0.35, 0.6))
        p.rotation_euler = (0, -a, 0)
    cyl(0.11, 0.06, (x, y - 0.06, 0.72), mat('core', 0.8), rot=(math.pi / 2, 0, 0))


def tree(x, y):
    cyl(0.08, 0.6, (x, y, 0.3), mat('trunk', 0.8), r2=0.06)
    ico(0.36, (x, y, 0.8), mat('canopy', 0.8))
    ico(0.22, (x - 0.15, y - 0.1, 0.98), mat('leaf', 0.8))


def cactus_plant(x, y, h=0.7):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=h, location=(x, y, h / 2), vertices=24)
    o = obj(bpy.context.active_object, mat('cactus', 0.6), bevel=0.06)
    cyl(0.07, 0.25, (x + 0.2, y, h * 0.55), mat('cactus', 0.6))


# ---------------------------------------------------------------- items

def item_model(kind):
    if kind == 'hay':
        for i, a in enumerate((-0.25, 0, 0.25)):
            c = cyl(0.09, 1.2, (a * 0.8, 0, 0.6), mat('hay', 0.8), r2=0.03, verts=12)
            c.rotation_euler = (0, a, 0)
        torus(0.2, 0.05, (0, 0, 0.5), mat('trunk', 0.7))
    elif kind == 'wood':
        cyl(0.3, 1.1, (0, 0, 0.32), mat('trunk', 0.85), rot=(0, math.pi / 2, 0.5))
        end = cyl(0.26, 0.02, (0, 0, 0.32), mat('wood', 0.7), rot=(0, math.pi / 2, 0.5))
        end.location = (math.cos(0.5) * 0.555, math.sin(0.5) * 0.555, 0.32)
        ring = torus(0.15, 0.015, end.location, mat('trunk', 0.8), rot=(0, math.pi / 2, 0.5))
    elif kind == 'carrot':
        c = cone(0.22, 1.0, (0, 0, 0.5), mat('carrot', 0.6), rot=(math.pi, 0, 0))
        c.rotation_euler = (math.pi + 0.5, 0, 0)
        for a in (-0.4, 0, 0.4):
            l = cone(0.06, 0.45, (0, 0.2, 0.95), mat('leaf', 0.7), verts=6)
            l.rotation_euler = (0.5, a, 0)
    elif kind == 'water':
        sphere(0.38, (0, 0, 0.42), mat('water', 0.1, alpha=0.9))
        cone(0.35, 0.55, (0, 0, 0.88), mat('water', 0.1, alpha=0.9))
    elif kind == 'pumpkin':
        pumpkin(0, 0, 2.0)
    elif kind == 'power':
        # a lightning bolt: a flat outline, extruded and bevelled
        import bmesh
        pts = [(0.15, 0.62), (-0.32, 0.02), (-0.02, 0.02), (-0.18, -0.62), (0.32, 0.08), (0.03, 0.08), (0.2, 0.62)]
        me = bpy.data.meshes.new('bolt')
        bm = bmesh.new()
        vs = [bm.verts.new((x, 0, z + 0.62)) for x, z in pts]
        face = bm.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        bmesh.ops.translate(bm, verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, 0.16, 0))
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new('bolt', me)
        bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        obj(o, mat('power', 0.3, emit=1.2), smooth=False, bevel=0.025)
        o.rotation_euler = (0, 0, -0.35)
    elif kind == 'cactus':
        cactus_plant(0, 0, 1.0)
    elif kind == 'gold':
        for i, (dx, dz) in enumerate([(-0.15, 0.1), (0.15, 0.1), (0, 0.3)]):
            c = cyl(0.32, 0.1, (dx, 0, dz), mat('gold', 0.25, 0.9))
            c.rotation_euler = (0.25 * (i - 1), 0, 0)
    elif kind == 'goo':
        sphere(0.45, (0, 0, 0.36), mat('goo', 0.15, emit=0.4), scale=(1, 1, 0.8))
        sphere(0.08, (-0.15, -0.38, 0.45), mat('ink', 0.3))
        sphere(0.08, (0.15, -0.38, 0.45), mat('ink', 0.3))


# ---------------------------------------------------------------- jobs

def make_logo():
    """the mark: the drone in its straw hat over a sprouting soil tile, on a violet rounded square"""
    for px, transparent, name in [(1024, False, 'logo-1024.png'), (256, True, 'logo-256.png'), (128, True, 'logo-128.png'), (64, True, 'logo-64.png')]:
        clear()
        stage(px, transparent=transparent, ortho=3.3, cam_loc=(0, -6, 6.5), target=(0, 0, 0.3), bg=None if transparent else C['ink'])
        box((2.6, 2.6, 0.5), (0, 0, -0.55), mat('accent', 0.5), bevel=0.35)
        box((1.5, 1.5, 0.3), (0, 0, -0.15), mat('soil', 0.9), bevel=0.06)
        for k in (-0.35, 0, 0.35):
            box((1.2, 0.08, 0.04), (0, k, 0.01), mat('soil_dark', 0.9), bevel=0.01)
        for a in (-0.5, 0.5):
            l = sphere(0.17, (a * 0.32, -0.1, 0.32), mat('leaf', 0.6), scale=(1.4, 0.5, 0.7))
            l.rotation_euler = (0, a, 0)
        cyl(0.04, 0.3, (0, -0.1, 0.15), mat('leaf_dark', 0.7))
        drone((0, 0.05, 0.95), scale=0.95)
        render(os.path.join(PUBLIC, 'brand', name))


def make_field_card():
    """a little 3D field for the field cards on the home screen"""
    clear()
    stage((640, 280), transparent=False, cam_loc=(0.4, -5.6, 3.4), target=(0.2, 0.2, 0.1), lens=32, bg='#203a2c')
    layout = [['soil', 'soil', 'grass', 'grass', 'grass'], ['soil', 'soil', 'grass', 'soil', 'soil'], ['grass', 'grass', 'grass', 'soil', 'soil']]
    for j, row in enumerate(layout):
        for i, k in enumerate(row):
            x, y = i - 2, 1 - j
            tile(x, y, k)
            if k == 'grass':
                grass_tuft(x, y, 6, seed=i * 7 + j)
    pumpkin(-2, 1); pumpkin(-1, 1); pumpkin(-2, 0); pumpkin(-1, 0, 1.2)
    sunflower(1, 0); sunflower(2, 0); sunflower(1, -1); sunflower(2, -1)
    tree(0, -1)
    cactus_plant(1, 1, 0.6)
    drone((-0.2, 0.2, 1.4), scale=0.42)
    render(os.path.join(PUBLIC, 'brand', 'field-card.png'))


def make_items():
    for kind in ['hay', 'wood', 'carrot', 'water', 'pumpkin', 'power', 'cactus', 'gold', 'goo']:
        clear()
        stage(96, transparent=True, ortho=1.7, cam_loc=(1.6, -4, 3), target=(0, 0, 0.45))
        item_model(kind)
        render(os.path.join(PUBLIC, 'items', f'{kind}.png'))


def make_drone_glb():
    """the farm drone for the 3D view; parts named so the game can spin the rotors and light the eye"""
    clear()
    drone((0, 0, 0), scale=1.0, hat=False, names=True)
    for o in bpy.data.objects:
        o.select_set(True)
    path = os.path.join(PUBLIC, 'models', 'drone.glb')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)


JOBS = {'logo': make_logo, 'card': make_field_card, 'items': make_items, 'drone': make_drone_glb}
job = globals().get('JOB')
done = []
for name, fn in JOBS.items():
    if job in (None, 'all', name):
        fn()
        done.append(name)
result = {'done': done, 'out': PUBLIC}
