// The following code adapts different common bone naming conventions to the Mixamo naming conventions.
// Standardizing these allows us to use the same animation clips across different models.

import * as THREE from 'three'

export const mapName = (name: string): string => {
  if (name.includes("mixamorig")) {
    return name;
  }

  if (name.includes("UNKNOWN")) {
    return name;
  }

  if (/root|hips/i.test(name)) {
    return 'mixamorigHips';
  }

  const spineMatch = name.match(/spine.?0*(\d+)/i);
  if (spineMatch) {
    let index = parseInt(spineMatch[1]);
    if (index === 1) {
      return 'mixamorigSpine';
    } else if (index === 2) {
      return 'mixamorigSpine1';
    }
    return 'mixamorigSpine2';
  }

  const spineRootMatch = name.match(/spine/i);
  if (spineRootMatch) {
    return 'mixamorigSpine';
  }

  if (/chest/i.test(name)) {
    return 'mixamorigSpine2';
  }

  if (/neck/i.test(name)) {
    return 'mixamorigNeck';
  }

  if (/head/i.test(name)) {
    return 'mixamorigHead';
  }

  const upperArmMatch = name.match(/upper.?arm.?([LR])/i);
  if (upperArmMatch) {
    return `mixamorig${upperArmMatch[1] === 'L' ? 'Left' : 'Right'}Arm`;
  }

  const lowerArmMatch = name.match(/forearm.?([LR])/i);
  if (lowerArmMatch) {
    return `mixamorig${lowerArmMatch[1] === 'L' ? 'Left' : 'Right'}ForeArm`;
  }

  const handMatch = name.match(/hand.?([LR])/i);
  if (handMatch) {
    return `mixamorig${handMatch[1] === 'L' ? 'Left' : 'Right'}Hand`;
  }

  const thighMatch = name.match(/thigh.?([LR])/i);
  if (thighMatch) {
    return `mixamorig${thighMatch[1] === 'L' ? 'LeftUpLeg' : 'RightUpLeg'}`;
  }

  const shinMatch = name.match(/shin.?([LR])/i);
  if (shinMatch) {
    return `mixamorig${shinMatch[1] === 'L' ? 'LeftLeg' : 'RightLeg'}`;
  }

  const footMatch = name.match(/foot.?([LR])/i);
  if (footMatch) {
    return `mixamorig${footMatch[1] === 'L' ? 'LeftFoot' : 'RightFoot'}`;
  }

  const legEndMatch = name.match(/leg.?end.?([LR])/i);
  if (legEndMatch) {
    return `mixamorig${legEndMatch[1] === 'L' ? 'LeftFoot' : 'RightFoot'}`;
  }

  const shoulderMatch = name.match(/shoulder.?([LR])/i);
  if (shoulderMatch) {
    return `mixamorig${shoulderMatch[1] === 'L' ? 'LeftShoulder' : 'RightShoulder'}`;
  }

  const toeMatch = name.match(/toe.?([LR])/i);
  if (toeMatch) {
    return `mixamorig${toeMatch[1] === 'L' ? 'LeftToeBase' : 'RightToeBase'}`;
  }

  const toeEndMatch = name.match(/toe.?end.?([LR])/i);
  if (toeEndMatch) {
    return `mixamorig${toeEndMatch[1] === 'L' ? 'LeftToe_End' : 'RightToe_End'}`;
  }
  console.error(`Unknown bone: ${name}`);

  return 'UNKNOWN';
};

export const adaptAnimation = (animation: THREE.AnimationClip) => {
  for (let i = 0; i < animation.tracks.length; i++) {
    const track = animation.tracks[i]
    const segments = track.name.split('.')
    const key = segments.pop()
    const name = segments.join('.')

    const originalTrackName = track.name

    track.name = `${mapName(name)}.${key}`
  }
}
