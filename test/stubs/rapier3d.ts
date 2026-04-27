export const init = () => Promise.resolve();

export class World {
  constructor(public gravity: any) { }
}

export class Vector3 {
  constructor(public x: number, public y: number, public z: number) { }
}

export default { init, World, Vector3 }