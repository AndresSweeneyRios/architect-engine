import bpy
import os
import json
import io
from bpy.types import Panel, Operator
from .extract import (
    extract_triplanar_scale,
    get_material_custom_data,
)
from .utils import is_object_in_excluded_collections
import rna_xml

class VIEW3D_PT_project_architect_panel(Panel):

    bl_label = "Project Architect"
    bl_idname = "VIEW3D_PT_project_architect"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Project Architect'

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout
        prefs = context.preferences.addons[__package__].preferences
        box = layout.box()
        box.label(text="Texture Path Setup:", icon='TEXTURE')
        paths_configured = bool(prefs.textures_source and prefs.project_root)

        if not paths_configured:
            warning = box.box()
            warning.alert = True
            warning.label(text="⚠ Paths not configured!", icon='ERROR')
            row = warning.row()
            row.operator("preferences.addon_show", text="Configure Now", icon='PREFERENCES').module = __package__
        else:
            symlink_path = os.path.join(prefs.project_root, prefs.symlink_subfolder)
            box.label(text=f"Source: ...{prefs.textures_source[-30:]}", icon='IMPORT')
            box.label(text=f"Target: ...{symlink_path[-30:]}", icon='EXPORT')
            row = box.row()
            row.operator("texture.remap_to_symlink", text="Setup Symlink & Remap Paths", icon='LINKED')
            row = box.row()
            row.operator("preferences.addon_show", text="Configure Paths", icon='PREFERENCES').module = __package__

        layout.separator()
        box = layout.box()
        box.label(text="Path Operations:", icon='FILE_FOLDER')
        row = box.row()
        row.operator("file.make_paths_relative", text="Make Relative")
        row = box.row()
        row.operator("file.make_paths_absolute", text="Make Absolute")
        row = box.row()
        row.operator("texture.restore_case", text="Restore Proper Casing", icon='FILE_REFRESH')

        layout.separator()
        box = layout.box()
        box.label(text="Lightmap Baking:", icon='LIGHT')
        bakeable_count = 0
        for obj in context.scene.objects:
            if (obj.type == 'MESH' and
                not obj.hide_viewport and
                not obj.hide_render and
                not is_object_in_excluded_collections(obj) and
                obj.data.uv_layers):
                bakeable_count += 1

        box.label(text=f"Bakeable objects: {bakeable_count}", icon='MESH_DATA')
        settings = context.scene.project_architect
        settings_box = box.box()
        settings_box.label(text="Bake Settings (per .blend):", icon='SETTINGS')
        settings_box.prop(settings, "bake_compute_device")
        settings_box.prop(settings, "bake_samples")
        settings_box.prop(settings, "bake_margin")
        info_row = settings_box.row()
        info_row.label(text="ℹ GPU required (CPU not supported)", icon='INFO')
        if settings.bake_compute_device == 'AUTO':
            info_row = settings_box.row()
            info_row.label(text="💡 Auto will select: OptiX > CUDA > HIP > OneAPI", icon='INFO')
        elif settings.bake_compute_device == 'HIP':
            info_row = settings_box.row()
            info_row.label(text="✓ HIP is correct for AMD Radeon GPUs", icon='CHECKMARK')
        elif settings.bake_compute_device == 'OPTIX':
            info_row = settings_box.row()
            info_row.label(text="⚠ OptiX requires NVIDIA RTX GPU", icon='ERROR')
        elif settings.bake_compute_device == 'CUDA':
            info_row = settings_box.row()
            info_row.label(text="✓ CUDA is correct for NVIDIA GPUs", icon='CHECKMARK')

        settings_box.separator()
        settings_box.label(text="Resolution Settings:", icon='TEXTURE')
        settings_box.prop(settings, "lightmap_pixels_per_meter")
        settings_box.prop(settings, "lightmap_max_resolution")

        row = box.row()
        row.scale_y = 1.5
        row.operator("lightmap.bake_all", text="Bake Lightmaps", icon='RENDER_STILL')

        layout.separator()

        layout.label(text="Triplanar Materials:")
        triplanar_count = 0
        for material in bpy.data.materials:
            if extract_triplanar_scale(material):
                triplanar_count += 1

        box = layout.box()
        box.label(text=f"Found: {triplanar_count} materials", icon='MATERIAL')

        layout.separator()
        layout.operator("export_scene.project_architect_gltf", text="Export GLTF", icon='EXPORT')

        layout.separator()
        if triplanar_count > 0:
            layout.label(text="Triplanar Materials in Scene:")
            for material in bpy.data.materials:
                scale_data = extract_triplanar_scale(material)
                if scale_data:
                    row = layout.row()
                    row.label(text=f"  • {material.name}", icon='SHADING_TEXTURE')

class PROJECTARCHITECT_OT_copy_material_xml(Operator):

    bl_idname = "project_architect.copy_material_xml"
    bl_label = "Copy Material XML"

    def execute(self, context: bpy.types.Context) -> set[str]:
        material = None
        space = context.space_data
        if space and getattr(space, 'tree_type', '') == 'ShaderNodeTree':
            material = context.material
            if not material and getattr(space, 'node_tree', None):
                try:
                    users = getattr(space.node_tree, 'users_materials', None)
                    if users:
                        material = users[0]
                except Exception:
                    material = None
        if not material and getattr(context, 'object', None):
            material = getattr(context.object, 'active_material', None)

        if not material:
            self.report({'WARNING'}, "No material found to copy")
            return {'CANCELLED'}

        output = io.StringIO()
        rna_xml.rna2xml(
            fw=output.write,
            root_node="NodeTree",
            root_rna=material.node_tree,
            method='ATTR'
        )
        xml_str = output.getvalue()
        try:
            context.window_manager.clipboard = xml_str
        except Exception:
            bpy.context.window_manager.clipboard = xml_str

        output.close()

        self.report({'INFO'}, "Material XML copied to clipboard")
        return {'FINISHED'}

class SHADER_PT_project_architect_material_debug(Panel):

    bl_label = "Project Architect - Material Debug (JSON)"
    bl_idname = "SHADER_PT_project_architect_material_debug"
    bl_space_type = 'NODE_EDITOR'
    bl_region_type = 'UI'
    bl_category = 'Project Architect'

    @classmethod
    def poll(cls, context: bpy.types.Context) -> bool:
        space = context.space_data
        if not space:
            return False
        return getattr(space, 'tree_type', '') == 'ShaderNodeTree'

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout
        material = context.material
        space = context.space_data
        if not material and space and getattr(space, 'node_tree', None):
            try:
                users = getattr(space.node_tree, 'users_materials', None)
                if users:
                    material = users[0]
            except Exception:
                material = None
        if not material and getattr(context, 'object', None):
            material = getattr(context.object, 'active_material', None)

        if not material:
            layout.label(text="No material available in the Shader Editor.")
            return
        debug_data = get_material_custom_data(material)
        json_str = json.dumps(debug_data, indent=2)

        box = layout.box()
        for line in json_str.splitlines():
            box.label(text=line)

        layout.separator()
        layout.operator("project_architect.copy_material_xml", icon='COPYDOWN')


