import { rapierFinishedLoading } from '../simulation/repository/PhysicsRepository'
import { DEFAULT_SCENE, Scene, scenes } from "./_scenes"
export * from "./_scenes"

let sceneCleanup: (() => void) | null = null

export const loadScene = async (scene: Scene) => {
  try {
    await rapierFinishedLoading

    unloadScene()

    const sceneModule = await scene()

    sceneCleanup = await sceneModule.init()

  } catch (e) {
    console.error(e)
  }
}

export const unloadScene = () => {
  if (sceneCleanup) {
    sceneCleanup()
    sceneCleanup = null
  }
}

/**
 * Takes the query parameter "scene" and attempts to load the corresponding scene. 
 * 
 * If none is found, loads the default scene.
 * 
 * @param defaultScene Alternative default scene.
 */
export const loadSceneFromQuery = (defaultScene: Scene = DEFAULT_SCENE) => {
  const url = new URL(window.location.href)
  const sceneQuery = url.searchParams.get('scene')
  const scene = scenes[sceneQuery as keyof typeof scenes]

  void loadScene(scene || defaultScene)
}
