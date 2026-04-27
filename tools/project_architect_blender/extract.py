import bpy
import os
import hashlib
import re
from typing import Any, Generator
from .config import (
    TARGET_NODE_LABEL, SCALE_FIELD_NAME, NORMAL_NODE_LABEL,
    EMISSIVE_NODE_LABEL, EMISSIVE_TEXTURE_LABEL_REGEX,
    ALBEDO_TEXTURE_LABEL_REGEX, NORMAL_TEXTURE_LABEL_REGEX, METALLIC_TEXTURE_LABEL_REGEX,
    ROUGHNESS_TEXTURE_LABEL_REGEX, ALPHA_TEXTURE_LABEL_REGEX, AO_TEXTURE_LABEL_REGEX,
    ALBEDO_TRIPLANAR_TEXTURE_LABEL_REGEX, NORMAL_TRIPLANAR_TEXTURE_LABEL_REGEX,
    METALLIC_TRIPLANAR_TEXTURE_LABEL_REGEX, ROUGHNESS_TRIPLANAR_TEXTURE_LABEL_REGEX,
    ALPHA_TRIPLANAR_TEXTURE_LABEL_REGEX, AO_TRIPLANAR_TEXTURE_LABEL_REGEX,
    EMISSIVE_TRIPLANAR_TEXTURE_LABEL_REGEX
)

def get_all_nodes(node_tree: bpy.types.NodeTree) -> Generator[bpy.types.Node, None, None]:

    for node in node_tree.nodes:
        yield node
        if node.type == 'GROUP' and node.node_tree:
            yield from get_all_nodes(node.node_tree)

def _save_packed_image_if_needed(image: bpy.types.Image | None) -> str | None:

    if not image:
        return None
    try:
        if getattr(image, 'filepath', None):
            abs_path = bpy.path.abspath(image.filepath)
            if abs_path and os.path.exists(abs_path):
                if bpy.data.filepath:
                    blend_dir = os.path.dirname(bpy.data.filepath)
                    try:
                        return os.path.relpath(abs_path, blend_dir)
                    except Exception:
                        return abs_path
                return abs_path
    except Exception:
        pass
    packed = getattr(image, 'packed_file', None)
    if not packed:
        return None
    if bpy.data.filepath:
        out_dir = os.path.dirname(bpy.data.filepath)
    else:
        out_dir = bpy.app.tempdir or os.path.expanduser('~')
    ext = ''
    try:
        if getattr(image, 'filepath', None):
            _, ext = os.path.splitext(image.filepath)
    except Exception:
        ext = ''

    if not ext:
        fmt = getattr(image, 'file_format', None) or 'PNG'
        ext = '.' + fmt.lower()
    name_hash = hashlib.sha1(image.name.encode('utf-8')).hexdigest()[:8]
    safe_name = ''.join(c for c in image.name if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"{safe_name}_{name_hash}{ext}"
    save_path = os.path.join(out_dir, filename)
    if os.path.exists(save_path):
        if bpy.data.filepath:
            try:
                return os.path.relpath(save_path, os.path.dirname(bpy.data.filepath))
            except Exception:
                return save_path
        return save_path
    try:
        image.filepath_raw = save_path
        if not getattr(image, 'file_format', None):
            image.file_format = 'PNG'
        image.save()
    except Exception:
        try:
            with open(save_path, 'wb') as f:
                f.write(packed.data)
        except Exception:
            return None
    if bpy.data.filepath:
        try:
            return os.path.relpath(save_path, os.path.dirname(bpy.data.filepath))
        except Exception:
            return save_path
    return save_path

def extract_texture_paths(material: bpy.types.Material) -> dict[str, dict[str, str]]:

    textures: dict[str, dict[str, str]] = {}

    if not material.use_nodes or not material.node_tree:
        return textures

    texture_mapping: tuple[tuple[re.Pattern[str], str], ...] = (
        (ALBEDO_TEXTURE_LABEL_REGEX, 'albedoTexture'),
        (NORMAL_TEXTURE_LABEL_REGEX, 'normalTexture'),
        (METALLIC_TEXTURE_LABEL_REGEX, 'metallicTexture'),
        (ROUGHNESS_TEXTURE_LABEL_REGEX, 'roughnessTexture'),
        (ALPHA_TEXTURE_LABEL_REGEX, 'alphaTexture'),
        (AO_TEXTURE_LABEL_REGEX, 'occlusionTexture'),
        (EMISSIVE_TEXTURE_LABEL_REGEX, 'emissiveTexture'),
        (ALBEDO_TRIPLANAR_TEXTURE_LABEL_REGEX, 'albedoTriplanarTexture'),
        (NORMAL_TRIPLANAR_TEXTURE_LABEL_REGEX, 'normalTriplanarTexture'),
        (METALLIC_TRIPLANAR_TEXTURE_LABEL_REGEX, 'metallicTriplanarTexture'),
        (ROUGHNESS_TRIPLANAR_TEXTURE_LABEL_REGEX, 'roughnessTriplanarTexture'),
        (ALPHA_TRIPLANAR_TEXTURE_LABEL_REGEX, 'alphaTriplanarTexture'),
        (AO_TRIPLANAR_TEXTURE_LABEL_REGEX, 'occlusionTriplanarTexture'),
        (EMISSIVE_TRIPLANAR_TEXTURE_LABEL_REGEX, 'emissiveTriplanarTexture'),
    )

    for node in get_all_nodes(material.node_tree):
        if node.type != 'TEX_IMAGE' or not node.image:
            continue

        match_candidates: list[str] = []
        for raw in (node.label, node.name, getattr(node.image, 'name', None)):
            candidate = (raw or '').strip()
            if candidate:
                match_candidates.append(candidate)
        image_filepath = (getattr(node.image, 'filepath', None) or '').strip()
        if image_filepath:
            file_name = os.path.basename(image_filepath)
            file_stem, _ = os.path.splitext(file_name)
            if file_name:
                match_candidates.append(file_name)
            if file_stem:
                match_candidates.append(file_stem)

        if not match_candidates:
            continue

        matched_gltf_name: str | None = None
        for label_pattern, gltf_name in texture_mapping:
            if any(label_pattern.fullmatch(candidate) for candidate in match_candidates):
                matched_gltf_name = gltf_name
                break

        if not matched_gltf_name:
            continue

        saved_path = _save_packed_image_if_needed(node.image)
        if saved_path:
            uri = saved_path
        else:
            uri = getattr(node.image, 'filepath', None)

        if uri:
            textures[matched_gltf_name] = {
                'uri': uri
            }

    return textures

def extract_triplanar_scale(material: bpy.types.Material) -> dict[str, dict[str, float]]:

    scale_data: dict[str, dict[str, float]] = {}

    if material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == 'MAPPING' and node.label == TARGET_NODE_LABEL:

                scale_input = node.inputs['Scale']
                if scale_input.is_linked:
                    linked_node = scale_input.links[0].from_node
                    if linked_node.type == 'VALUE':
                        scale_value = linked_node.outputs[0].default_value
                        scale_vector = (scale_value, scale_value, scale_value)
                    elif hasattr(linked_node.outputs[0], 'default_value'):
                        linked_value = linked_node.outputs[0].default_value
                        if hasattr(linked_value, '__len__') and len(linked_value) >= 3:
                            scale_vector = linked_value
                        else:
                            scale_vector = (linked_value, linked_value, linked_value)
                    else:
                        scale_vector = scale_input.default_value
                else:
                    scale_vector = scale_input.default_value
                scale_data[SCALE_FIELD_NAME] = {
                    'x': round(scale_vector[0], 6),
                    'y': round(scale_vector[1], 6),
                    'z': round(scale_vector[2], 6)
                }
                break

    return scale_data

def extract_normal_strength(material: bpy.types.Material) -> dict[str, float]:

    normal_data: dict[str, float] = {}

    if material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == 'NORMAL_MAP' and node.label == NORMAL_NODE_LABEL:

                strength_input = node.inputs['Strength']
                if strength_input.is_linked:
                    linked_node = strength_input.links[0].from_node
                    if linked_node.type == 'VALUE':
                        strength_value = linked_node.outputs[0].default_value
                    elif hasattr(linked_node.outputs[0], 'default_value'):
                        strength_value = linked_node.outputs[0].default_value
                    else:
                        strength_value = strength_input.default_value
                else:
                    strength_value = strength_input.default_value
                normal_data['normal_strength'] = round(float(strength_value), 6)
                break

    return normal_data

def extract_emissive_color(material: bpy.types.Material) -> dict[str, dict[str, float]]:

    emissive_data: dict[str, dict[str, float]] = {}

    if material.node_tree:
        for node in material.node_tree.nodes:
            if node.label == EMISSIVE_NODE_LABEL and node.type == 'RGB':
                color = node.outputs[0].default_value

                emissive_data['emissive'] = {
                    'r': round(color[0], 6),
                    'g': round(color[1], 6),
                    'b': round(color[2], 6),
                    'a': round(color[3], 6)
                }

                break

    return emissive_data

def get_materials_with_custom_data() -> dict[str, dict[str, Any]]:

    materials_data: dict[str, dict[str, Any]] = {}
    for material in bpy.data.materials:
        materials_data[material.name] = get_material_custom_data(material)

    return materials_data

def get_material_custom_data(material: bpy.types.Material) -> dict[str, Any]:

    material_data: dict[str, Any] = {}
    triplanar_scale = extract_triplanar_scale(material)
    if triplanar_scale:
        material_data.update(triplanar_scale)
    normal_strength = extract_normal_strength(material)
    if normal_strength:
        material_data.update(normal_strength)
    emissive = extract_emissive_color(material)
    if emissive:
        material_data.update(emissive)
    textures = extract_texture_paths(material)
    if textures:
        material_data['textures'] = textures

    return material_data


