import * as THREE from "three";
import * as playerInput from "../input/player";

function isElectron() {
  return navigator.userAgent.toLowerCase().includes("electron") ||
    navigator.userAgent.toLowerCase().includes("node.js") ||
    navigator.userAgent.toLowerCase().includes("electron/");
}

let firstClickResolved = false;

export const firstClick = new Promise<void>((resolve) => {
  if (firstClickResolved || isElectron()) {
    resolve();
    return;
  }

  const handler = () => {
    resolve();
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
    playerInput.emitter.off("justpressed", handler);
  };

  window.addEventListener("click", handler);
  window.addEventListener("keydown", handler);
  playerInput.emitter.on("justpressed", handler);
});

export const listener = new THREE.AudioListener();

listener.setMasterVolume(2.0);

if (!localStorage.getItem("volume")) {
  localStorage.setItem("volume", "2.0");
}

listener.setMasterVolume(parseFloat(localStorage.getItem("volume")!));

export const loadAudio = async (path: string, {
  loop = false,
  randomPitch = false,
  detune = 0,
  positional = false,
  pitchRange = 1500,
  volume = 0.2,
}) => {
  const audio = positional ? new THREE.PositionalAudio(listener) : new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();

  const buffer = await audioLoader.loadAsync(path);
  audio.setBuffer(buffer);
  audio.setLoop(loop);
  audio.setVolume(volume);
  audio.detune = detune;

  let activeFadeTimer: number | null = null;

  let isPlayPending = false;

  const setVolume = (volume: number) => {
    audio.setVolume(volume);
  };

  const play = async (fadeDuration = 0.02) => {
    await firstClick;

    if (isPlayPending) return;
    isPlayPending = true;

    try {
      if (activeFadeTimer !== null) {
        clearInterval(activeFadeTimer);
        activeFadeTimer = null;
      }

      if (audio.isPlaying) {
        audio.stop();
      }

      if (randomPitch) {
        audio.detune = Math.random() * pitchRange * 2 - pitchRange + detune;
      }

      const targetVolume = volume;
      audio.setVolume(0);

      audio.play();

      const fadeSteps = 5;
      const fadeInterval = fadeDuration / fadeSteps;

      return await new Promise<void>(resolve => {
        let step = 0;
        activeFadeTimer = window.setInterval(() => {
          step++;
          audio.setVolume(targetVolume * (step / fadeSteps));

          if (step >= fadeSteps) {
            clearInterval(activeFadeTimer!);
            activeFadeTimer = null;
            resolve();
          }
        }, fadeInterval * 1000) as unknown as number;
      });
    } finally {
      isPlayPending = false;
    }
  };

  const stop = async (fadeDuration = 0.02) => {
    if (!audio.isPlaying) return;

    if (activeFadeTimer !== null) return;

    const originalVolume = audio.getVolume();
    const fadeSteps = 5;
    const fadeInterval = fadeDuration / fadeSteps;

    return await new Promise<void>(resolve => {
      let step = 0;
      activeFadeTimer = window.setInterval(() => {
        step++;
        audio.setVolume(originalVolume * (1 - step / fadeSteps));

        if (step >= fadeSteps) {
          clearInterval(activeFadeTimer!);
          activeFadeTimer = null;
          audio.stop();
          audio.setVolume(originalVolume);
          resolve();
        }
      }, fadeInterval * 1000) as unknown as number;
    });
  };

  const getPositionalAudio = () => {
    if (!positional) {
      throw new Error("Audio is not positional");
    }

    return audio as THREE.PositionalAudio;
  };

  return {
    setVolume,
    play,
    stop,
    getPositionalAudio,

    get volume() {
      return audio.getVolume();
    },

    set volume(value: number) {
      audio.setVolume(value);
    },
  };
}
