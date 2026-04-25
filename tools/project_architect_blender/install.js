import * as path from 'path'
import * as os from 'os'
import * as child_process from 'child_process'
const BLENDER_VERSION = '4.5'
const ADDON_JUNCTION_DESTINATION = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Blender Foundation', 'Blender', BLENDER_VERSION, 'scripts', 'addons', 'project_architect')
const ADDON_SOURCE = path.join(import.meta.dirname)
const createJunction = (src, dest) => {
  child_process.execSync(`mklink /J "${dest}" "${src}"`, { shell: 'cmd.exe' })
}
createJunction(ADDON_SOURCE, ADDON_JUNCTION_DESTINATION)
