bl_info = {
    "name": "Project Architect",
    "author": "Andres Sweeney-Rios",
    "version": (1, 0, 0),
    "blender": (4, 5, 0),
    "location": "View3D > Sidebar > Project Architect",
    "description": "Complete workflow tools: GLTF export with triplanar mapping, lightmap baking, and texture path management",
    "category": "3D View",
}

import bpy
from . import config
from . import utils
from . import lightmap
from . import extract
from . import properties
from . import texture_ops
from . import lightmap_ops
from . import export_ops
from . import ui

classes = (
    properties.ProjectArchitectSceneSettings,
    properties.ProjectArchitectPreferences,
    texture_ops.TEXTURE_OT_remap_to_symlink,
    texture_ops.TEXTURE_OT_restore_case,
    lightmap_ops.LIGHTMAP_OT_bake_all,
    export_ops.EXPORT_OT_project_architect_gltf,
    ui.VIEW3D_PT_project_architect_panel,
    ui.PROJECTARCHITECT_OT_copy_material_xml,
    ui.SHADER_PT_project_architect_material_debug,
)

def register() -> None:

    for cls in classes:
        bpy.utils.register_class(cls)

    bpy.types.Scene.project_architect = bpy.props.PointerProperty(
        type=properties.ProjectArchitectSceneSettings
    )

    bpy.types.TOPBAR_MT_file_export.append(export_ops.menu_func_export)

def unregister() -> None:

    bpy.types.TOPBAR_MT_file_export.remove(export_ops.menu_func_export)

    del bpy.types.Scene.project_architect

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()


