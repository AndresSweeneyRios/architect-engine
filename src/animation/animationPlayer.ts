import * as THREE from 'three'
import { MAX_ALLOWED_PAUSE } from '../simulation/loop'

const mixerMap = new Map<string, THREE.AnimationMixer>()
const activeAction = new Map<string, THREE.AnimationAction>()

const CROSSFADE_DURATION = 0.15

export const playAnimation = async (model: THREE.SkinnedMesh, clip: THREE.AnimationClip, timeScale = 1, crossfadeDuration = CROSSFADE_DURATION) => {
  try {
    if (!mixerMap.has(model.uuid)) {
      mixerMap.set(model.uuid, new THREE.AnimationMixer(model))
    }

    const mixer = mixerMap.get(model.uuid)!

    const action = mixer.clipAction(clip)
    action.timeScale = timeScale

    action.reset()
    action.play()
    mixer.update(0)

    if (activeAction.has(model.uuid)) {
      const previousAction = activeAction.get(model.uuid)!
      previousAction.crossFadeTo(action, crossfadeDuration, false)
      mixer.update(0)
    }

    activeAction.set(model.uuid, action)
  } catch (error) {
    console.error(error)
  }
}

let previousTime = performance.now()
let deltaTime = 0

const loop = (time: DOMHighResTimeStamp) => {
  requestAnimationFrame(loop);

  deltaTime = (time - previousTime) / 1000

  if (deltaTime > MAX_ALLOWED_PAUSE) {
    deltaTime = 0
    previousTime = time
  }

  try {
    mixerMap.forEach((mixer) => {
      mixer.update(deltaTime)
    })
  } catch (error) {
    console.error(error)
  }

  previousTime = time
};

requestAnimationFrame(loop) 
