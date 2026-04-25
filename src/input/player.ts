// This input controller is intended for singleplayer only.
// It supports keyboard + mouse or gamepad input.

const DEADZONE = 0.15;
const MAX_DELTA = 50;
const TRIGGER_THRESHOLD = 0.5;
const SMOOTHING_FACTOR = 0.99;
const DEBOUNCE_TIME_MS = 200;
const GAMEPAD_LOOK_MULTIPLIER = 20.0;
const ONE_MINUS_SMOOTHING = 1 - SMOOTHING_FACTOR;

const GAMEPAD_BUTTON_LEFT_FACE = 2;
const GAMEPAD_BUTTON_BOTTOM_FACE = 0;
const GAMEPAD_BUTTON_TOP_FACE = 3;
const GAMEPAD_BUTTON_RIGHT_FACE = 1;
const GAMEPAD_BUTTON_START = 9;
const GAMEPAD_BUTTON_DPAD_UP = 12;
const GAMEPAD_BUTTON_DPAD_DOWN = 13;
const GAMEPAD_BUTTON_DPAD_LEFT = 14;
const GAMEPAD_BUTTON_DPAD_RIGHT = 15;

const ACTION_INTERACT = 0;
const ACTION_MAIN_ACTION_1 = 1;
const ACTION_MAIN_ACTION_2 = 2;
const ACTION_SETTINGS = 3;
const ACTION_CANCEL = 4;
const ACTION_UP = 5;
const ACTION_DOWN = 6;
const ACTION_LEFT = 7;
const ACTION_RIGHT = 8;
const ACTION_COUNT = 9;

const ACTION_NAMES: InputAction[] = [
  "interact",
  "mainAction1",
  "mainAction2",
  "settings",
  "cancel",
  "up",
  "down",
  "left",
  "right"
];

const SOURCE_KEYBOARD = 0;
const SOURCE_MOUSE = 1;
const SOURCE_GAMEPAD = 2;

const INPUT_SOURCE_NAMES: InputSource[] = ["keyboard", "mouse", "gamepad"];

const BUFFER_WALK_X = 0;
const BUFFER_WALK_Y = 1;
const BUFFER_LOOK_X = 2;
const BUFFER_LOOK_Y = 3;
const BUFFER_RAW_LOOK_X = 4;
const BUFFER_RAW_LOOK_Y = 5;
const BUFFER_SMOOTHED_LOOK_X = 6;
const BUFFER_SMOOTHED_LOOK_Y = 7;
const BUFFER_SIZE = 8;

export const STATE_WALK_X = 0;
export const STATE_WALK_Y = 1;
export const STATE_LOOK_X = 2;
export const STATE_LOOK_Y = 3;

export const STATE_INTERACT = 0;
export const STATE_MAIN_ACTION_1 = 1;
export const STATE_MAIN_ACTION_2 = 2;
export const STATE_SETTINGS = 3;
export const STATE_CANCEL = 4;
export const STATE_UP = 5;
export const STATE_DOWN = 6;
export const STATE_LEFT = 7;
export const STATE_RIGHT = 8;

export type InputAction = "interact" | "mainAction1" | "mainAction2" | "settings" | "cancel" | "up" | "down" | "left" | "right";

export type InputSource = "keyboard" | "mouse" | "gamepad";

export interface JustPressedEvent {
  action: InputAction;
  inputSource: InputSource;
  consume(): void;
}

class EventEmitter {
  private listeners: { [event: string]: { listener: (payload: JustPressedEvent) => void, order: number }[] } = {};

  public on(event: string, listener: (payload: JustPressedEvent) => void, options?: { order: number }) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    const order = options?.order ?? 0;
    this.listeners[event].push({ listener, order });
    this.listeners[event].sort((a, b) => a.order - b.order);
  }

  public off(event: string, listener: (payload: JustPressedEvent) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l.listener !== listener);
  }

  public *emit(event: string, payload: JustPressedEvent & { _consumed?: boolean }) {
    if (!this.listeners[event]) return;
    for (const { listener, order } of this.listeners[event]) {
      listener(payload);
      yield order;
      if (payload._consumed) {
        break;
      }
    }
  }
}

function applyDeadzone(value: number): number {
  const absVal = Math.abs(value);
  if (absVal < DEADZONE) return 0;
  return (value - Math.sign(value) * DEADZONE) / (1 - DEADZONE);
}

const floatBuffer = new Float32Array(BUFFER_SIZE);
const buttonStates = new Uint8Array(ACTION_COUNT);
const prevButtonStates = new Uint8Array(ACTION_COUNT);
const debounceTimers: Array<number | undefined> = new Array(ACTION_COUNT);

export const inputFloats = floatBuffer.subarray(0, 4);
export const inputButtons = buttonStates;

const keyboardPressed = new Set<string>();
const mouseButtonsPressed = new Set<number>();

export const emitter = new EventEmitter();

const onKeyDown = (e: KeyboardEvent) => {
  keyboardPressed.add(e.key.toLowerCase());
};

const onKeyUp = (e: KeyboardEvent) => {
  keyboardPressed.delete(e.key.toLowerCase());
};

const onMouseDown = (e: MouseEvent) => {
  mouseButtonsPressed.add(e.button);
};

const onMouseUp = (e: MouseEvent) => {
  mouseButtonsPressed.delete(e.button);
};

const onMouseMove = (e: MouseEvent) => {
  const deltaX = Math.max(-MAX_DELTA, Math.min(e.movementX, MAX_DELTA));
  const deltaY = Math.max(-MAX_DELTA, Math.min(e.movementY, MAX_DELTA));
  floatBuffer[BUFFER_RAW_LOOK_X] += deltaX;
  floatBuffer[BUFFER_RAW_LOOK_Y] += deltaY;
};

const onPointerLockChange = () => {
  if (document.pointerLockElement === null) {
    resetInputs();
  }
};

const onFullscreenChange = () => {
  if (!document.fullscreenElement) {
    resetInputs();
  }
};

function resetInputs() {
  keyboardPressed.clear();
  mouseButtonsPressed.clear();
  floatBuffer.fill(0);
  buttonStates.fill(0);
  prevButtonStates.fill(0);
}

function getGamepadButtonPressed(buttonIndex: number, analog: boolean = false): boolean {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (!gp) continue;
    const btn = gp.buttons[buttonIndex];
    if (!btn) continue;
    if (analog) {
      if (btn.value > TRIGGER_THRESHOLD) return true;
    } else {
      if (btn.pressed) return true;
    }
  }
  return false;
}

function checkJustPressed(actionIndex: number, inputSourceIndex: number) {
  const newState = buttonStates[actionIndex];
  const prevState = prevButtonStates[actionIndex];

  if (newState && !prevState) {
    if (debounceTimers[actionIndex]) {
      return;
    }

    const payload: JustPressedEvent & { _consumed?: boolean } = {
      action: ACTION_NAMES[actionIndex],
      inputSource: INPUT_SOURCE_NAMES[inputSourceIndex],
      consume: () => {
        payload._consumed = true;
      }
    };

    const generator = emitter.emit("justpressed", payload);

    for (const _ of generator) {
      if (payload._consumed) break;
    }

    debounceTimers[actionIndex] = window.setTimeout(() => {
      debounceTimers[actionIndex] = undefined;
    }, DEBOUNCE_TIME_MS);
  }
}

export function init() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousedown", onMouseDown, { capture: false });
  window.addEventListener("mouseup", onMouseUp, { capture: false });
  window.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("fullscreenchange", onFullscreenChange);
}

export function dispose() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
}

export function update() {
  const buf = floatBuffer;

  buf[BUFFER_WALK_X] = 0;
  buf[BUFFER_WALK_Y] = 0;
  buf[BUFFER_LOOK_X] = 0;
  buf[BUFFER_LOOK_Y] = 0;

  if (keyboardPressed.has("w")) buf[BUFFER_WALK_Y] -= 1;
  if (keyboardPressed.has("s")) buf[BUFFER_WALK_Y] += 1;
  if (keyboardPressed.has("a")) buf[BUFFER_WALK_X] -= 1;
  if (keyboardPressed.has("d")) buf[BUFFER_WALK_X] += 1;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      gp = gamepads[i];
      break;
    }
  }

  if (gp) {
    const gpX = applyDeadzone(gp.axes[0] || 0);
    const gpY = applyDeadzone(gp.axes[1] || 0);
    buf[BUFFER_WALK_X] += gpX;
    buf[BUFFER_WALK_Y] += gpY;

    if (gp.buttons[GAMEPAD_BUTTON_DPAD_UP]?.pressed) buf[BUFFER_WALK_Y] -= 1;
    if (gp.buttons[GAMEPAD_BUTTON_DPAD_DOWN]?.pressed) buf[BUFFER_WALK_Y] += 1;
    if (gp.buttons[GAMEPAD_BUTTON_DPAD_LEFT]?.pressed) buf[BUFFER_WALK_X] -= 1;
    if (gp.buttons[GAMEPAD_BUTTON_DPAD_RIGHT]?.pressed) buf[BUFFER_WALK_X] += 1;
  }

  const mag = Math.hypot(buf[BUFFER_WALK_X], buf[BUFFER_WALK_Y]);
  if (mag > 1) {
    buf[BUFFER_WALK_X] /= mag;
    buf[BUFFER_WALK_Y] /= mag;
  }

  buf[BUFFER_SMOOTHED_LOOK_X] = buf[BUFFER_SMOOTHED_LOOK_X] * ONE_MINUS_SMOOTHING +
    buf[BUFFER_RAW_LOOK_X] * SMOOTHING_FACTOR;
  buf[BUFFER_SMOOTHED_LOOK_Y] = buf[BUFFER_SMOOTHED_LOOK_Y] * ONE_MINUS_SMOOTHING +
    buf[BUFFER_RAW_LOOK_Y] * SMOOTHING_FACTOR;

  buf[BUFFER_LOOK_X] = buf[BUFFER_SMOOTHED_LOOK_X];
  buf[BUFFER_LOOK_Y] = buf[BUFFER_SMOOTHED_LOOK_Y];

  buf[BUFFER_RAW_LOOK_X] = 0;
  buf[BUFFER_RAW_LOOK_Y] = 0;

  if (gp) {
    const gpX = applyDeadzone(gp.axes[2] || 0);
    const gpY = applyDeadzone(gp.axes[3] || 0);
    buf[BUFFER_LOOK_X] += gpX * GAMEPAD_LOOK_MULTIPLIER;
    buf[BUFFER_LOOK_Y] += gpY * GAMEPAD_LOOK_MULTIPLIER;
  }

  if (document.pointerLockElement === null) {
    buf[BUFFER_WALK_X] = 0;
    buf[BUFFER_WALK_Y] = 0;
    buf[BUFFER_LOOK_X] = 0;
    buf[BUFFER_LOOK_Y] = 0;
  }

  const interactKeyboard = keyboardPressed.has("e");
  const interactGamepad = getGamepadButtonPressed(GAMEPAD_BUTTON_LEFT_FACE);
  buttonStates[ACTION_INTERACT] = (interactKeyboard || interactGamepad) ? 1 : 0;

  const mainAction1Mouse = mouseButtonsPressed.has(0);
  const mainAction1Gamepad = getGamepadButtonPressed(GAMEPAD_BUTTON_BOTTOM_FACE, true);
  buttonStates[ACTION_MAIN_ACTION_1] = (mainAction1Mouse || mainAction1Gamepad) ? 1 : 0;

  const mainAction2Mouse = mouseButtonsPressed.has(2);
  const mainAction2Gamepad = getGamepadButtonPressed(GAMEPAD_BUTTON_TOP_FACE, true);
  buttonStates[ACTION_MAIN_ACTION_2] = (mainAction2Mouse || mainAction2Gamepad) ? 1 : 0;

  const cancelKeyboard = keyboardPressed.has("backspace");
  const cancelGamepad = getGamepadButtonPressed(GAMEPAD_BUTTON_RIGHT_FACE);
  buttonStates[ACTION_CANCEL] = (cancelKeyboard || cancelGamepad) ? 1 : 0;

  const settingsKeyboard = keyboardPressed.has("escape");
  const settingsGamepad = getGamepadButtonPressed(GAMEPAD_BUTTON_START);
  buttonStates[ACTION_SETTINGS] = (settingsKeyboard || settingsGamepad) ? 1 : 0;

  buttonStates[ACTION_UP] = (keyboardPressed.has("arrowup") || (gp?.buttons[GAMEPAD_BUTTON_DPAD_UP]?.pressed ?? false)) ? 1 : 0;
  buttonStates[ACTION_DOWN] = (keyboardPressed.has("arrowdown") || (gp?.buttons[GAMEPAD_BUTTON_DPAD_DOWN]?.pressed ?? false)) ? 1 : 0;
  buttonStates[ACTION_LEFT] = (keyboardPressed.has("arrowleft") || (gp?.buttons[GAMEPAD_BUTTON_DPAD_LEFT]?.pressed ?? false)) ? 1 : 0;
  buttonStates[ACTION_RIGHT] = (keyboardPressed.has("arrowright") || (gp?.buttons[GAMEPAD_BUTTON_DPAD_RIGHT]?.pressed ?? false)) ? 1 : 0;

  checkJustPressed(ACTION_INTERACT, interactKeyboard ? SOURCE_KEYBOARD : interactGamepad ? SOURCE_GAMEPAD : SOURCE_MOUSE);
  checkJustPressed(ACTION_MAIN_ACTION_1, mainAction1Mouse ? SOURCE_MOUSE : mainAction1Gamepad ? SOURCE_GAMEPAD : SOURCE_KEYBOARD);
  checkJustPressed(ACTION_MAIN_ACTION_2, mainAction2Mouse ? SOURCE_MOUSE : mainAction2Gamepad ? SOURCE_GAMEPAD : SOURCE_KEYBOARD);
  checkJustPressed(ACTION_SETTINGS, settingsKeyboard ? SOURCE_KEYBOARD : settingsGamepad ? SOURCE_GAMEPAD : SOURCE_MOUSE);
  checkJustPressed(ACTION_CANCEL, cancelKeyboard ? SOURCE_KEYBOARD : cancelGamepad ? SOURCE_GAMEPAD : SOURCE_MOUSE);

  checkJustPressed(ACTION_UP, keyboardPressed.has("arrowup") ? SOURCE_KEYBOARD : SOURCE_GAMEPAD);
  checkJustPressed(ACTION_DOWN, keyboardPressed.has("arrowdown") ? SOURCE_KEYBOARD : SOURCE_GAMEPAD);
  checkJustPressed(ACTION_LEFT, keyboardPressed.has("arrowleft") ? SOURCE_KEYBOARD : SOURCE_GAMEPAD);
  checkJustPressed(ACTION_RIGHT, keyboardPressed.has("arrowright") ? SOURCE_KEYBOARD : SOURCE_GAMEPAD);

  prevButtonStates.set(buttonStates);
}

export function getWalkX(): number {
  return inputFloats[STATE_WALK_X];
}

export function getWalkY(): number {
  return inputFloats[STATE_WALK_Y];
}

export function getLookX(): number {
  return inputFloats[STATE_LOOK_X];
}

export function getLookY(): number {
  return inputFloats[STATE_LOOK_Y];
}

export function isInteract(): boolean {
  return inputButtons[STATE_INTERACT] !== 0;
}

export function isMainAction1(): boolean {
  return inputButtons[STATE_MAIN_ACTION_1] !== 0;
}

export function isMainAction2(): boolean {
  return inputButtons[STATE_MAIN_ACTION_2] !== 0;
}

export function isSettings(): boolean {
  return inputButtons[STATE_SETTINGS] !== 0;
}

export function isCancel(): boolean {
  return inputButtons[STATE_CANCEL] !== 0;
}

export function isUp(): boolean {
  return inputButtons[STATE_UP] !== 0;
}

export function isDown(): boolean {
  return inputButtons[STATE_DOWN] !== 0;
}

export function isLeft(): boolean {
  return inputButtons[STATE_LEFT] !== 0;
}

export function isRight(): boolean {
  return inputButtons[STATE_RIGHT] !== 0;
}

export const waitForAction = (action: InputAction | "all" = "mainAction1") => new Promise<void>(resolve => {
  const handler = (payload: JustPressedEvent) => {
    if (action !== "all" && payload.action !== action) {
      return
    }

    emitter.off("justpressed", handler)

    resolve()
  }

  emitter.on("justpressed", handler)
})

init();
