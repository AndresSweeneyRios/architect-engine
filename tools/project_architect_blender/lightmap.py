import bpy
import math
from pathlib import Path
from .config import LIGHTMAP_NODE_LABEL

def calculate_lightmap_resolution(
    surface_area: float,
    pixels_per_meter: int | None = None,
    max_resolution: int | None = None,
) -> tuple[int, int]:
    scene = bpy.context.scene

    if pixels_per_meter is None:
        pixels_per_meter = scene.project_architect.lightmap_pixels_per_meter
    if max_resolution is None:
        max_resolution = scene.project_architect.lightmap_max_resolution

    if surface_area <= 0:
        return (256, 256)
    base_resolution = math.sqrt(surface_area) * pixels_per_meter
    power = round(math.log2(base_resolution))
    resolution = 2 ** power
    resolution = max(256, min(resolution, max_resolution))
    return (int(resolution), int(resolution))

def create_lightmap_image(name: str, width: int, height: int) -> bpy.types.Image:
    if name in bpy.data.images:
        old_image = bpy.data.images[name]
        old_image.user_clear()
        bpy.data.images.remove(old_image)
    image = bpy.data.images.new(
        name=name,
        width=width,
        height=height,
        alpha=False,
        float_buffer=False
    )
    image.colorspace_settings.name = 'sRGB'
    image.source = 'GENERATED'

    return image

def get_lightmap_directory() -> Path:

    if not bpy.data.filepath:
        raise RuntimeError("Please save your .blend file first")

    blend_dir = Path(bpy.data.filepath).parent
    lightmap_dir = blend_dir / "lightmaps"
    lightmap_dir.mkdir(exist_ok=True)

    return lightmap_dir

def get_or_create_lightmap_node(
    material: bpy.types.Material,
    image: bpy.types.Image,
) -> bpy.types.Node:

    if not material.use_nodes:
        material.use_nodes = True

    node_tree = material.node_tree
    lightmap_node = None
    for node in node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.label == LIGHTMAP_NODE_LABEL:
            lightmap_node = node
            break
    if not lightmap_node:
        lightmap_node = node_tree.nodes.new('ShaderNodeTexImage')
        lightmap_node.label = LIGHTMAP_NODE_LABEL
        lightmap_node.name = LIGHTMAP_NODE_LABEL
        lightmap_node.location = (-400, 0)
    lightmap_node.image = image

    return lightmap_node


