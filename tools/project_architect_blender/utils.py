from pathlib import Path
from typing import Iterable

import bpy

def get_actual_case_path(path: str | Path) -> str:

    path_obj = Path(path)
    if not path_obj.exists():
        return str(path_obj)
    try:
        resolved = path_obj.resolve()
        parts = []
        current = resolved

        while current != current.parent:
            parent = current.parent
            try:
                for item in parent.iterdir():
                    if item.samefile(current):
                        parts.insert(0, item.name)
                        break
            except (PermissionError, OSError):
                parts.insert(0, current.name)
            current = parent
        if resolved.drive:
            return resolved.drive + '/' + '/'.join(parts)
        else:
            return '/' + '/'.join(parts)

    except Exception as e:
        print(f"Warning: Could not get actual case for {path}: {e}")
        return str(path_obj.as_posix())

def calculate_surface_area(obj: bpy.types.Object) -> float:

    import bmesh

    if obj.type != 'MESH':
        return 0.0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    area = sum(face.calc_area() for face in bm.faces)

    bm.free()
    return float(area)

def is_object_in_excluded_collections(
    obj: bpy.types.Object,
    excluded_collections: set[str] | None = None,
) -> bool:

    from .config import EXCLUDED_COLLECTIONS

    if excluded_collections is None:
        excluded_collections = EXCLUDED_COLLECTIONS

    def check_parents(coll: bpy.types.Collection) -> bool:
        for parent_coll in bpy.data.collections:
            child_names = [child.name for child in parent_coll.children]
            if coll.name in child_names:
                if parent_coll.name in excluded_collections:
                    return True
                if check_parents(parent_coll):
                    return True
        return False

    for collection in obj.users_collection:
        if collection.name in excluded_collections:
            return True

        if check_parents(collection):
            return True

    return False


