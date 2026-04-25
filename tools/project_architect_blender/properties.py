import bpy
import os
from bpy.props import StringProperty, IntProperty, EnumProperty
from .config import BAKE_SAMPLES, BAKE_MARGIN, LIGHTMAP_PIXELS_PER_METER, LIGHTMAP_MAX_RESOLUTION

class ProjectArchitectSceneSettings(bpy.types.PropertyGroup):
    bake_samples: IntProperty(
        name="Bake Samples",
        description="Number of samples for lightmap baking",
        default=BAKE_SAMPLES,
        min=1,
        max=10000,
    )

    bake_compute_device: EnumProperty(
        name="Compute Device",
        description="GPU compute device type to use for baking",
        items=[
            ('AUTO', 'Auto-detect', 'Automatically select the best available GPU compute device'),
            ('OPTIX', 'OptiX', 'NVIDIA RTX GPUs only - fastest ray tracing (requires RTX)'),
            ('CUDA', 'CUDA', 'NVIDIA GPUs - standard compute'),
            ('HIP', 'HIP', 'AMD GPUs - use this for Radeon cards'),
            ('ONEAPI', 'OneAPI', 'Intel GPUs - use this for Intel Arc'),
        ],
        default='AUTO',
    )

    bake_margin: IntProperty(
        name="Bake Margin",
        description="Margin in pixels to extend baking beyond UV edges",
        default=BAKE_MARGIN,
        min=0,
        max=64,
    )

    lightmap_pixels_per_meter: IntProperty(
        name="Pixels per Meter",
        description="Lightmap resolution density (pixels per square meter)",
        default=LIGHTMAP_PIXELS_PER_METER,
        min=32,
        max=512,
    )

    lightmap_max_resolution: IntProperty(
        name="Max Resolution",
        description="Maximum lightmap resolution (will be clamped to this)",
        default=LIGHTMAP_MAX_RESOLUTION,
        min=256,
        max=8192,
    )

class ProjectArchitectPreferences(bpy.types.AddonPreferences):

    bl_idname = __package__

    textures_source: StringProperty(
        name="Textures Source Path",
        description="The current location of your texture library",
        default="",
        subtype='DIR_PATH',
    )

    project_root: StringProperty(
        name="Project Root",
        description="Root directory of your project",
        default="",
        subtype='DIR_PATH',
    )

    symlink_subfolder: StringProperty(
        name="Symlink Subfolder",
        description="Subfolder within project root for symlink (e.g., 'tools/textures/ambientcg')",
        default="tools/textures/ambientcg",
    )

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout

        box = layout.box()
        box.label(text="Texture Remapping Configuration:", icon='PREFERENCES')
        if not self.textures_source or not self.project_root:
            warning_box = layout.box()
            warning_box.alert = True
            warning_box.label(text="⚠ Please configure paths below:", icon='ERROR')

        box.prop(self, "textures_source")
        box.label(text="Where your textures currently are", icon='INFO')

        layout.separator()

        box.prop(self, "project_root")
        box.label(text="Your project's root directory", icon='INFO')

        box.prop(self, "symlink_subfolder")
        if self.project_root and self.symlink_subfolder:
            symlink_path = os.path.join(self.project_root, self.symlink_subfolder)
            result_box = layout.box()
            result_box.label(text="Symlink will be created at:", icon='LINKED')
            result_box.label(text=f"  {symlink_path}")


