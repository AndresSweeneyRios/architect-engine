import bpy
import os
import subprocess
from pathlib import Path
from bpy.types import Operator
from .utils import get_actual_case_path

class TEXTURE_OT_remap_to_symlink(Operator):

    bl_idname = "texture.remap_to_symlink"
    bl_label = "Remap Textures to Symlink"
    bl_options = {'REGISTER', 'UNDO'}

    def invoke(self, context: bpy.types.Context, event: bpy.types.Event) -> set[str]:

        prefs = context.preferences.addons[__package__].preferences
        if not prefs.textures_source or not prefs.project_root:
            self.report({'ERROR'}, "Please configure paths in addon preferences first!")
            bpy.ops.preferences.addon_show('INVOKE_DEFAULT', module=__package__)
            return {'CANCELLED'}

        return context.window_manager.invoke_props_dialog(self, width=500)

    def draw(self, context: bpy.types.Context) -> None:

        layout = self.layout
        prefs = context.preferences.addons[__package__].preferences

        box = layout.box()
        box.label(text="This will:", icon='INFO')

        symlink_path = os.path.join(prefs.project_root, prefs.symlink_subfolder)

        box.label(text=f"1. Create symlink at:", icon='LINKED')
        box.label(text=f"   {symlink_path}")
        box.label(text=f"2. Pointing to:", icon='IMPORT')
        box.label(text=f"   {prefs.textures_source}")
        box.label(text=f"3. Remap all texture paths in this .blend", icon='TEXTURE')

        layout.separator()
        layout.label(text="Configure paths in Preferences if needed", icon='PREFERENCES')

    def execute(self, context: bpy.types.Context) -> set[str]:
        prefs = context.preferences.addons[__package__].preferences
        source_path = Path(prefs.textures_source)
        symlink_path = Path(prefs.project_root) / prefs.symlink_subfolder
        try:
            symlink_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            self.report({'ERROR'}, f"Failed to create directory: {e}")
            return {'CANCELLED'}
        if not symlink_path.exists():
            if not source_path.exists():
                self.report({'ERROR'}, f"Source doesn't exist: {source_path}")
                return {'CANCELLED'}

            try:
                cmd = f'New-Item -ItemType SymbolicLink -Path "{symlink_path}" -Target "{source_path}"'
                result = subprocess.run(
                    ["powershell", "-Command", cmd],
                    capture_output=True,
                    text=True
                )

                if result.returncode != 0:
                    self.report({'ERROR'}, f"Failed to create symlink. Run Blender as Administrator.")
                    return {'CANCELLED'}

                self.report({'INFO'}, f"Created symlink: {symlink_path}")

            except Exception as e:
                self.report({'ERROR'}, f"Error creating symlink: {e}")
                return {'CANCELLED'}
        source_path_normalized = source_path.resolve().as_posix().lower()
        symlink_path_normalized = symlink_path.resolve().as_posix() if symlink_path.exists() else symlink_path.as_posix()
        remapped_count = 0

        print("\n" + "="*60)
        print("TEXTURE REMAPPING DEBUG")
        print("="*60)
        print(f"Looking for textures from: {source_path}")
        print(f"  Normalized source: {source_path_normalized}")
        print(f"Will remap to: {symlink_path}")
        print(f"  Normalized symlink: {symlink_path_normalized}")
        print("="*60 + "\n")

        for image in bpy.data.images:
            if image.filepath:
                original_path = image.filepath
                abs_path = bpy.path.abspath(image.filepath)
                abs_path_obj = Path(abs_path).resolve()
                abs_path_normalized = abs_path_obj.as_posix().lower()

                print(f"Checking: {image.name}")
                print(f"  Original (relative): {original_path}")
                print(f"  Resolved absolute: {abs_path_obj.as_posix()}")
                print(f"  Checking if starts with: {source_path_normalized}")
                if abs_path_normalized.startswith(source_path_normalized):
                    print(f"  ✓ MATCH FOUND!")
                    actual_case_path = get_actual_case_path(abs_path_obj)
                    source_path_actual_case = get_actual_case_path(source_path.resolve())

                    print(f"  Actual case path: {actual_case_path}")
                    print(f"  Source actual case: {source_path_actual_case}")
                    relative_part = actual_case_path[len(source_path_actual_case):].lstrip('/')
                    symlink_path_str = symlink_path.as_posix()
                    new_abs_path = f"{symlink_path_str}/{relative_part}"

                    print(f"  Relative part (case-preserved): {relative_part}")
                    print(f"  New absolute path (with symlink): {new_abs_path}")
                    blend_dir = Path(bpy.data.filepath).parent.as_posix()
                    new_abs_path_obj = Path(new_abs_path)
                    blend_dir_obj = Path(blend_dir)

                    try:
                        rel_path = new_abs_path_obj.relative_to(blend_dir_obj)
                        new_rel_path = f"//{rel_path.as_posix()}"
                    except ValueError:
                        try:
                            rel = os.path.relpath(new_abs_path, blend_dir)
                            new_rel_path = f"//{rel.replace(os.sep, '/')}"
                        except:
                            new_rel_path = new_abs_path

                    print(f"  Blend file dir: {blend_dir}")
                    print(f"  New relative path: {new_rel_path}")
                    old_filepath = image.filepath
                    image.filepath = new_rel_path
                    try:
                        image.reload()
                    except Exception:
                        pass

                    print(f"  Set filepath from: {old_filepath}")
                    print(f"               to: {image.filepath}")

                    remapped_count += 1
                else:
                    print(f"  ✗ No match (not in source directory)")
                print()

        print("="*60)
        print(f"Total remapped: {remapped_count}")
        print("="*60 + "\n")

        if remapped_count > 0:
            print("\nVERIFICATION - Final image paths:")
            for image in bpy.data.images:
                if image.filepath:
                    abs_check = bpy.path.abspath(image.filepath)
                    print(f"  {image.name}:")
                    print(f"    Stored: {image.filepath}")
                    print(f"    Resolves to: {abs_check}")
            print()

            self.report({'INFO'}, f"Remapped {remapped_count} texture(s). Save your .blend file!")
        else:
            self.report({'WARNING'}, "No textures needed remapping. Check the Blender console for debug info.")

        return {'FINISHED'}

class TEXTURE_OT_restore_case(Operator):

    bl_idname = "texture.restore_case"
    bl_label = "Restore Texture Path Casing"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context: bpy.types.Context) -> set[str]:
        restored_count = 0

        print("\n" + "="*60)
        print("RESTORING TEXTURE PATH CASING")
        print("="*60 + "\n")

        for image in bpy.data.images:
            if image.filepath:
                original_filepath = image.filepath
                if original_filepath.startswith('//'):
                    blend_dir = Path(bpy.data.filepath).parent
                    rel_path_str = original_filepath[2:]
                    parts = rel_path_str.split('/')
                    current_path = blend_dir
                    fixed_parts = []
                    for part in parts:
                        if part == '..':
                            current_path = current_path.parent
                            fixed_parts.append('..')
                        elif part == '.':
                            fixed_parts.append('.')
                        else:
                            if current_path.exists():
                                found = False
                                try:
                                    for item in current_path.iterdir():
                                        if item.name.lower() == part.lower():
                                            fixed_parts.append(item.name)
                                            current_path = item
                                            found = True
                                            break
                                except (PermissionError, OSError):
                                    fixed_parts.append(part)
                                    current_path = current_path / part
                                    found = True

                                if not found:
                                    fixed_parts.append(part)
                                    current_path = current_path / part
                            else:
                                fixed_parts.append(part)
                                current_path = current_path / part
                    new_path = '//' + '/'.join(fixed_parts)

                else:
                    abs_path_obj = Path(original_filepath)

                    if not abs_path_obj.exists():
                        print(f"⚠ {image.name}: File not found, skipping")
                        continue

                    new_path = get_actual_case_path(abs_path_obj)
                if original_filepath != new_path:
                    print(f"✓ {image.name}:")
                    print(f"  Old: {original_filepath}")
                    print(f"  New: {new_path}")

                    image.filepath = new_path

                    try:
                        image.reload()
                    except Exception:
                        pass

                    restored_count += 1
                else:
                    print(f"  {image.name}: Already correct case")

        print("\n" + "="*60)
        print(f"Restored casing for {restored_count} texture(s)")
        print("="*60 + "\n")

        if restored_count > 0:
            self.report({'INFO'}, f"Restored casing for {restored_count} texture(s). Save your .blend file!")
        else:
            self.report({'INFO'}, "All texture paths already have correct casing")

        return {'FINISHED'}


