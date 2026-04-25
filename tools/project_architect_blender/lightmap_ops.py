import bpy
from bpy.types import Operator
from .lightmap import (
    calculate_lightmap_resolution,
    create_lightmap_image,
    get_lightmap_directory
)
from .utils import calculate_surface_area, is_object_in_excluded_collections

class LIGHTMAP_OT_bake_all(Operator):

    bl_idname = "lightmap.bake_all"
    bl_label = "Bake Lightmaps"
    bl_options = {'REGISTER'}

    _timer = None
    _is_baking = False

    def invoke(self, context: bpy.types.Context, event: bpy.types.Event) -> set[str]:
        if not bpy.data.filepath:
            self.report({'ERROR'}, "Please save your .blend file first!")
            return {'CANCELLED'}
        bakeable_count = 0
        for obj in context.scene.objects:
            if (obj.type == 'MESH' and
                not obj.hide_viewport and
                not obj.hide_render and
                not is_object_in_excluded_collections(obj) and
                obj.data.uv_layers):
                bakeable_count += 1

        if bakeable_count == 0:
            self.report({'WARNING'}, "No valid objects to bake!")
            return {'CANCELLED'}
        return context.window_manager.invoke_props_dialog(self, width=400)

    def draw(self, context: bpy.types.Context) -> None:

        layout = self.layout
        settings = context.scene.project_architect
        bakeable_count = 0
        for obj in context.scene.objects:
            if (obj.type == 'MESH' and
                not obj.hide_viewport and
                not obj.hide_render and
                not is_object_in_excluded_collections(obj) and
                obj.data.uv_layers):
                bakeable_count += 1

        box = layout.box()
        box.label(text="Ready to bake lightmaps:", icon='LIGHT')
        box.label(text=f"  • Objects: {bakeable_count}")
        box.label(text=f"  • Samples: {settings.bake_samples}")
        box.label(text=f"  • Compute: {settings.bake_compute_device}")
        box.label(text=f"  • Output: ./lightmaps/")

        layout.separator()
        if bakeable_count > 0:
            min_time = bakeable_count * 2
            max_time = bakeable_count * 6

            info_box = layout.box()
            info_box.label(text=f"Estimated time: {min_time}-{max_time} minutes", icon='TIME')
            info_box.label(text="(Press ESC between objects to cancel)", icon='INFO')

    def modal(self, context: bpy.types.Context, event: bpy.types.Event) -> set[str]:
        if event.type == 'ESC':
            self.cancel(context)
            return {'CANCELLED'}

        if event.type == 'TIMER' and not self._is_baking:
            pass

        return {'PASS_THROUGH'}

    def cancel(self, context: bpy.types.Context) -> None:
        wm = context.window_manager
        if self._timer:
            wm.event_timer_remove(self._timer)
        wm.progress_end()
        self.report({'WARNING'}, "Baking cancelled by user")

    def execute(self, context: bpy.types.Context) -> set[str]:
        wm = context.window_manager
        self._timer = wm.event_timer_add(0.1, window=context.window)
        wm.modal_handler_add(self)

        settings = context.scene.project_architect
        if context.scene.render.engine != 'CYCLES':
            self.report({'INFO'}, "Switching to Cycles render engine for baking...")
            context.scene.render.engine = 'CYCLES'
        original_device = context.scene.cycles.device
        original_samples = context.scene.cycles.samples
        original_selection = context.selected_objects.copy()
        original_active = context.view_layer.objects.active
        context.scene.cycles.device = 'GPU'
        context.scene.cycles.samples = settings.bake_samples
        cycles_prefs = context.preferences.addons['cycles'].preferences

        print(f"\n{'='*60}")
        print(f"GPU DETECTION AND CONFIGURATION:")
        print(f"{'='*60}")
        valid_types = []
        try:
            from bpy.types import CyclesPreferences
            for item in CyclesPreferences.bl_rna.properties['compute_device_type'].enum_items:
                if item.identifier != 'NONE':
                    valid_types.append(item.identifier)
        except Exception:
            valid_types = ['OPTIX', 'CUDA', 'HIP', 'ONEAPI']

        print(f"Valid compute types on this system: {valid_types}\n")
        priority_order = ['OPTIX', 'CUDA', 'HIP', 'ONEAPI']
        selected_compute = settings.bake_compute_device
        available_types = {}
        for compute_type in priority_order:
            if compute_type not in valid_types:
                continue

            try:
                cycles_prefs.compute_device_type = compute_type
                cycles_prefs.get_devices()
                print(f"Checking {compute_type}:")

                gpu_devices = [d for d in cycles_prefs.devices if d.type != 'CPU']

                if gpu_devices:
                    for device in cycles_prefs.devices:
                        print(f"  - {device.name} (type: {device.type}, use: {device.use})")
                    available_types[compute_type] = gpu_devices
                else:
                    print(f"  No GPU devices found")
            except Exception as e:
                print(f"  Error checking {compute_type}: {e}")

        print(f"\nAvailable compute types with GPUs: {list(available_types.keys())}")
        compute_type = None

        if selected_compute == 'AUTO':
            if available_types:
                compute_type = list(available_types.keys())[0]
                print(f"Auto-selected: {compute_type}")
            else:
                print(f"✗ ERROR: No GPU compute devices available!")
                print(f"{'='*60}\n")
                self.report({'ERROR'}, "No GPU compute devices available! Baking cancelled.")
                wm.progress_end()
                return {'CANCELLED'}
        else:
            if selected_compute in available_types:
                compute_type = selected_compute
                print(f"Using user-selected: {compute_type}")
            else:
                print(f"✗ ERROR: Selected compute type '{selected_compute}' not available!")
                print(f"  Available types: {list(available_types.keys())}")
                print(f"{'='*60}\n")
                self.report({'ERROR'}, f"{selected_compute} not available! Available: {', '.join(available_types.keys()) if available_types else 'None'}. Change compute device setting.")
                wm.progress_end()
                return {'CANCELLED'}

        if available_types:
            cycles_prefs.compute_device_type = compute_type

            print(f"\n✓ Selected compute device type: {compute_type}")
            cycles_prefs.get_devices()
            gpu_found = False
            gpu_list = []
            for device in cycles_prefs.devices:
                if device.type != 'CPU':
                    device.use = True
                    gpu_found = True
                    gpu_list.append(device.name)
                    print(f"  ✓ Enabled GPU: {device.name}")
                else:
                    device.use = False
                    print(f"  ✗ Disabled CPU: {device.name}")

            if not gpu_found:
                print(f"\n✗ ERROR: No GPU devices found!")
                print(f"{'='*60}\n")
                self.report({'ERROR'}, "No GPU devices found! Baking cancelled.")
                wm.progress_end()
                return {'CANCELLED'}

            print(f"\n✓ GPU(s) enabled: {', '.join(gpu_list)}")
        else:
            print(f"\n✗ ERROR: No GPU compute devices available!")
            print(f"{'='*60}\n")
            self.report({'ERROR'}, "No GPU compute devices available! Baking cancelled.")
            wm.progress_end()
            return {'CANCELLED'}

        print(f"\n{'='*60}")
        print(f"CYCLES SETTINGS:")
        print(f"  Device: GPU (required)")
        print(f"  Samples: {context.scene.cycles.samples}")
        print(f"{'='*60}\n")
        try:
            lightmap_dir = get_lightmap_directory()
            print(f"Lightmaps will be saved to: {lightmap_dir}\n")
        except Exception as e:
            self.report({'ERROR'}, str(e))
            wm.progress_end()
            return {'CANCELLED'}
        objects_to_bake = []
        for obj in context.scene.objects:
            if (obj.type == 'MESH' and
                not obj.hide_viewport and
                not obj.hide_render and
                not is_object_in_excluded_collections(obj)):
                if obj.data.uv_layers:
                    objects_to_bake.append(obj)
                else:
                    print(f"⚠ Skipping {obj.name}: No UV map found")

        if not objects_to_bake:
            self.report({'WARNING'}, "No valid objects to bake (need visible meshes with UVs, excluding COLLIDERS/COMMANDS)")
            wm.progress_end()
            return {'CANCELLED'}

        print(f"\n{'='*60}")
        print(f"LIGHTMAP BAKING - {len(objects_to_bake)} objects")
        print(f"{'='*60}\n")
        wm.progress_begin(0, len(objects_to_bake))

        baked_count = 0

        for idx, obj in enumerate(objects_to_bake):
            wm.progress_update(idx)

            print(f"\n[{idx + 1}/{len(objects_to_bake)}] Baking: {obj.name}")
            surface_area = calculate_surface_area(obj)
            width, height = calculate_lightmap_resolution(surface_area)

            print(f"  Surface area: {surface_area:.2f} m²")
            print(f"  Resolution: {width}x{height}")
            image_name = f"{obj.name}_lightmap_temp"
            lightmap_image = create_lightmap_image(image_name, width, height)
            temp_material_name = f"__TEMP_BAKE_{obj.name}__"
            if temp_material_name in bpy.data.materials:
                bpy.data.materials.remove(bpy.data.materials[temp_material_name])

            temp_material = bpy.data.materials.new(name=temp_material_name)
            temp_material.use_nodes = True
            temp_node = temp_material.node_tree.nodes.new('ShaderNodeTexImage')
            temp_node.image = lightmap_image
            temp_material.node_tree.nodes.active = temp_node
            original_materials = [slot.material for slot in obj.material_slots]
            for slot in obj.material_slots:
                slot.material = temp_material
            if len(obj.material_slots) == 0:
                obj.data.materials.append(temp_material)
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            context.view_layer.objects.active = obj
            try:
                self._is_baking = True
                print(f"  Baking lighting data...")

                bpy.ops.object.bake(
                    type='DIFFUSE',
                    pass_filter={'DIRECT', 'INDIRECT'},
                    use_clear=True,
                    margin=settings.bake_margin,
                    use_selected_to_active=False,
                )

                self._is_baking = False
                lightmap_filename = f"{obj.name}_lightmap.png"
                lightmap_path = lightmap_dir / lightmap_filename

                lightmap_image.filepath_raw = str(lightmap_path)
                lightmap_image.file_format = 'PNG'
                lightmap_image.save()

                print(f"  ✓ Saved to: {lightmap_filename}")
                obj["lightmap"] = lightmap_filename

                baked_count += 1

            except Exception as e:
                self._is_baking = False
                print(f"  ✗ Baking failed: {e}")
                self.report({'WARNING'}, f"Failed to bake {obj.name}: {e}")

            finally:
                if len(original_materials) > 0:
                    for slot_idx, original_mat in enumerate(original_materials):
                        if slot_idx < len(obj.material_slots):
                            obj.material_slots[slot_idx].material = original_mat
                else:
                    obj.data.materials.clear()
                if image_name in bpy.data.images:
                    temp_image = bpy.data.images[image_name]
                    temp_image.user_clear()
                    bpy.data.images.remove(temp_image, do_unlink=True)
                if temp_material_name in bpy.data.materials:
                    temp_mat = bpy.data.materials[temp_material_name]
                    temp_mat.user_clear()
                    bpy.data.materials.remove(temp_mat, do_unlink=True)
        wm.progress_end()
        context.scene.cycles.device = original_device
        context.scene.cycles.samples = original_samples
        bpy.ops.object.select_all(action='DESELECT')
        for obj in original_selection:
            obj.select_set(True)
        context.view_layer.objects.active = original_active

        print(f"\n{'='*60}")
        print(f"Baking complete: {baked_count}/{len(objects_to_bake)} objects")
        print(f"Lightmaps saved to: {lightmap_dir}")
        print(f"{'='*60}\n")

        if baked_count > 0:
            self.report({'INFO'}, f"Baked {baked_count} lightmap(s) to ./lightmaps/ folder")
        else:
            self.report({'WARNING'}, "No objects were successfully baked")

        return {'FINISHED'}


