import * as THREE from 'three';
import animationsJson from '../assets/3d/animations/animations.json';

export const animationsPromise = Promise.resolve(animationsJson).then((json) => {
  const rawAnimations: {
    [key: string]: any
  } = json;

  animations = {};

  for (const key in rawAnimations) {
    animations[key] = THREE.AnimationClip.parse(rawAnimations[key]);
  }

  return animations;
})

let animations: {
  [key: string]: THREE.AnimationClip
} = null!;

export const getAnimation = (name: "") => {
  return animations[name];
}

export * from './animationPlayer';
export * as adapter from './adapter';
export * from './transform'
