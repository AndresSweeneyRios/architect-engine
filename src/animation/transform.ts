import * as THREE from 'three';

export const rotateAnimationTracks = (animationClip: THREE.AnimationClip, eulerRotation: THREE.Euler)  => {
  // Create a quaternion from the euler rotation
  const rotationQuat = new THREE.Quaternion();
  rotationQuat.setFromEuler(eulerRotation);

  // Iterate over all tracks in the animation clip
  animationClip.tracks.forEach((track) => {
    if (track.name.endsWith('.position')) {
      // For position tracks, rotate the positions manually
      const values = track.values;
      for (let i = 0; i < values.length; i += 3) {
        const pos = new THREE.Vector3(values[i], values[i + 1], values[i + 2]);
        pos.applyQuaternion(rotationQuat); // Apply the rotation
        values[i] = pos.x;
        values[i + 1] = pos.y;
        values[i + 2] = pos.z;
      }
    } else if (track.name.endsWith('.quaternion')) {
      // For quaternion tracks, adjust the rotation by multiplying
      const values = track.values;
      for (let i = 0; i < values.length; i += 4) {
        const originalQuat = new THREE.Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]);
        originalQuat.premultiply(rotationQuat); // Rotate the quaternion
        values[i] = originalQuat.x;
        values[i + 1] = originalQuat.y;
        values[i + 2] = originalQuat.z;
        values[i + 3] = originalQuat.w;
      }
    }
    // Scale tracks are not affected by rotation, so no changes are needed for them
  });
};

export const rotateAnimationTracksArray = (animationClips: THREE.AnimationClip[], eulerRotation: THREE.Euler) => {
  for (const clip of animationClips) {
    rotateAnimationTracks(clip, eulerRotation);
  }
}

export const scaleAnimation = (animationClip: THREE.AnimationClip, scaleFactor: number) => {
  animationClip.tracks.forEach((track) => {
      // Scale position tracks
      if (track.name.endsWith('.position')) {
          const values = track.values;
          for (let i = 0; i < values.length; i++) {
              values[i] *= scaleFactor; // Scale position values
          }
      }
      // Rotation (quaternion) and scale tracks are not affected by size scaling
  });
  return animationClip; // Return the scaled animation
};

export const scaleAnimationArray = (animationClips: THREE.AnimationClip[], scaleFactor: number) => {
  for (const clip of animationClips) {
    scaleAnimation(clip, scaleFactor);
  }
}

export const adjustAnimationIntensity = (animationClip: THREE.AnimationClip, intensityFactor: number) => {
  animationClip.tracks.forEach((track) => {
      if (track.name.endsWith('.position')) {
          // Scale position keyframes
          const values = track.values;
          for (let i = 0; i < values.length; i++) {
              values[i] *= intensityFactor;
          }
      } else if (track.name.endsWith('.quaternion')) {
          // Scale quaternion rotations by interpolating toward identity quaternion
          const values = track.values;
          for (let i = 0; i < values.length; i += 4) {
              values[i] *= intensityFactor;     // x
              values[i + 1] *= intensityFactor; // y
              values[i + 2] *= intensityFactor; // z
              values[i + 3] += (1 - values[i + 3]) * (1 - intensityFactor); // Interpolate w
          }
      }
  });
  return animationClip;
};

export const adjustAnimationIntensityArray = (animationClips: THREE.AnimationClip[], intensityFactor: number) => {
  for (const clip of animationClips) {
    adjustAnimationIntensity(clip, intensityFactor);
  }
}
