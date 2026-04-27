import importlib
import json
import os
from typing import Any, cast

from .config import EXTENSION_NAME
from .extract import get_materials_with_custom_data

try:
  bpy = importlib.import_module("bpy")
  bpy_types = importlib.import_module("bpy.types")
  bpy_props = importlib.import_module("bpy.props")
  bpy_extras = importlib.import_module("bpy_extras.io_utils")

  Operator = bpy_types.Operator
  Context = bpy_types.Context
  Menu = bpy_types.Menu
  ExportHelper = bpy_extras.ExportHelper

  StringProperty = bpy_props.StringProperty
  BoolProperty = bpy_props.BoolProperty
  EnumProperty = bpy_props.EnumProperty
except Exception:
  bpy = cast(Any, None)

  class Operator:
    pass

  class ExportHelper:
    pass

  class Context:
    pass

  class Menu:
    pass

  def StringProperty(**kwargs: Any) -> Any:
    return None

  def BoolProperty(**kwargs: Any) -> Any:
    return None

  def EnumProperty(**kwargs: Any) -> Any:
    return None

class EXPORT_OT_project_architect_gltf(Operator, ExportHelper):

  bl_idname = "export_scene.project_architect_gltf"
  bl_label = "Export Project Architect GLTF"
  bl_options = {'PRESET'}

  filename_ext = ".gltf"

  filter_glob: StringProperty(
    default="*.gltf;*.glb",
    options={'HIDDEN'},
  )

  export_format: EnumProperty(
    name="Format",
    items=(
      ('GLTF_SEPARATE', 'glTF Separate (.gltf + .bin)', 'Export as separate files - Extension embedded in .gltf'),
      ('GLB', 'glTF Binary (.glb)', 'Export as binary - Extension saved as sidecar .json'),
    ),
    default='GLTF_SEPARATE',
    description="Use GLTF_SEPARATE to embed extension in the .gltf file"
  )

  export_textures: BoolProperty(
    name="Export Textures",
    description="Export textures with the model",
    default=True,
  )

  export_normals: BoolProperty(
    name="Export Normals",
    description="Export vertex normals",
    default=True,
  )

  export_tangents: BoolProperty(
    name="Export Tangents",
    description="Export vertex tangents",
    default=False,
  )

  export_materials: EnumProperty(
    name="Materials",
    items=(
      ('EXPORT', 'Export', 'Export all materials'),
      ('PLACEHOLDER', 'Placeholder', 'Export placeholder materials'),
      ('NONE', 'None', 'Do not export materials'),
    ),
    default='EXPORT',
  )

  export_colors: BoolProperty(
    name="Export Vertex Colors",
    description="Export vertex colors",
    default=True,
  )

  export_cameras: BoolProperty(
    name="Export Cameras",
    description="Export cameras",
    default=False,
  )

  export_lights: BoolProperty(
    name="Export Lights",
    description="Export lights using KHR_lights_punctual extension",
    default=True,
  )

  use_relative_paths: BoolProperty(
    name="Use Relative Texture Paths",
    description="Export texture paths relative to the .blend file location",
    default=True,
  )

  @staticmethod
  def _resolve_runtime_property(value: Any, fallback: Any) -> Any:
    if value is None:
      return fallback
    if type(value).__name__ == '_PropertyDeferred':
      try:
        keywords = getattr(value, 'keywords', {})
        return keywords.get('default', fallback)
      except Exception:
        return fallback
    return value

  def execute(self, context: Context) -> set[str]:
    if bpy is None:
      return {'CANCELLED'}

    materials_data = get_materials_with_custom_data()

    colliders_collection = bpy.data.collections.get("COLLIDERS")
    commands_collection = bpy.data.collections.get("COMMANDS")

    original_states: dict[str, dict[str, Any]] = {}

    if colliders_collection:
      original_states['COLLIDERS'] = {
        'hide_viewport': colliders_collection.hide_viewport,
        'hide_render': colliders_collection.hide_render,
      }
      colliders_collection.hide_viewport = False
      colliders_collection.hide_render = False

      for obj in colliders_collection.all_objects:
        if obj.name not in original_states:
          original_materials = []
          if hasattr(obj.data, 'materials'):
            original_materials = [mat for mat in obj.data.materials]

          original_states[obj.name] = {
            'hide_viewport': obj.hide_viewport,
            'hide_render': obj.hide_render,
            'hide_select': obj.hide_select,
            'materials': original_materials,
          }

          if hasattr(obj.data, 'materials'):
            obj.data.materials.clear()

        obj.hide_viewport = False
        obj.hide_render = False
        obj.hide_select = False

    if commands_collection:
      original_states['COMMANDS'] = {
        'hide_viewport': commands_collection.hide_viewport,
        'hide_render': commands_collection.hide_render,
      }
      commands_collection.hide_viewport = False
      commands_collection.hide_render = False

      for obj in commands_collection.all_objects:
        if obj.name not in original_states:
          original_materials = []
          if hasattr(obj.data, 'materials'):
            original_materials = [mat for mat in obj.data.materials]

          original_states[obj.name] = {
            'hide_viewport': obj.hide_viewport,
            'hide_render': obj.hide_render,
            'hide_select': obj.hide_select,
            'materials': original_materials,
          }

          if hasattr(obj.data, 'materials'):
            obj.data.materials.clear()

        obj.hide_viewport = False
        obj.hide_render = False
        obj.hide_select = False

    try:
      export_format = self._resolve_runtime_property(self.export_format, 'GLTF_SEPARATE')
      export_lights = bool(self._resolve_runtime_property(self.export_lights, True))

      export_settings = {
        'filepath': self.filepath,
        'export_format': export_format,
        'export_image_format': 'NONE',
        'export_hierarchy_flatten_objs': False,
        'export_hierarchy_full_collections': True,
        'export_extras': True,
        'export_lights': export_lights,
      }

      bpy.ops.export_scene.gltf(**export_settings)
    finally:
      if colliders_collection and 'COLLIDERS' in original_states:
        state = original_states['COLLIDERS']
        colliders_collection.hide_viewport = state['hide_viewport']
        colliders_collection.hide_render = state['hide_render']

      if commands_collection and 'COMMANDS' in original_states:
        state = original_states['COMMANDS']
        commands_collection.hide_viewport = state['hide_viewport']
        commands_collection.hide_render = state['hide_render']

      for obj_name, state in original_states.items():
        if obj_name in {'COLLIDERS', 'COMMANDS'}:
          continue

        obj = bpy.data.objects.get(obj_name)
        if not obj:
          continue

        obj.hide_viewport = state['hide_viewport']
        obj.hide_render = state['hide_render']
        obj.hide_select = state['hide_select']

        if 'materials' in state and hasattr(obj.data, 'materials'):
          obj.data.materials.clear()
          for mat in state['materials']:
            obj.data.materials.append(mat)

    if materials_data:
      if export_format == 'GLTF_SEPARATE':
        gltf_path = self.filepath
        if not gltf_path.endswith('.gltf'):
          gltf_path = os.path.splitext(gltf_path)[0] + '.gltf'

        try:
          with open(gltf_path, 'r') as file:
            gltf_data = json.load(file)

          if 'extensionsUsed' not in gltf_data:
            gltf_data['extensionsUsed'] = []

          if EXTENSION_NAME not in gltf_data['extensionsUsed']:
            gltf_data['extensionsUsed'].append(EXTENSION_NAME)

          if 'materials' in gltf_data:
            for material in gltf_data['materials']:
              material_name = material.get('name')

              if material_name in materials_data:
                if 'extensions' not in material:
                  material['extensions'] = {}

                material['extensions'][EXTENSION_NAME] = materials_data[material_name]

          with open(gltf_path, 'w') as file:
            json.dump(gltf_data, file, indent=2)

          self.report({'INFO'}, f"Exported with {len(materials_data)} materials containing custom data")
        except Exception as error:
          self.report({'ERROR'}, f"Failed to add custom extension: {error}")
          return {'CANCELLED'}
      else:
        json_path = os.path.splitext(self.filepath)[0] + '_extension.json'
        try:
          extension_data = {
            "extensionsUsed": [EXTENSION_NAME],
            "materials": materials_data
          }
          with open(json_path, 'w') as file:
            json.dump(extension_data, file, indent=2)

          self.report({'INFO'}, f"Exported GLB + extension data to {json_path}")
        except Exception as error:
          self.report({'ERROR'}, f"Failed to save extension data: {error}")
          return {'CANCELLED'}
    else:
      self.report({'WARNING'}, "No custom material data found in materials")

    return {'FINISHED'}

def menu_func_export(self: Menu, context: Context) -> None:
  _ = context
  self.layout.operator(EXPORT_OT_project_architect_gltf.bl_idname, text="Project Architect GLTF (.gltf/.glb)")


