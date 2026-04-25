export const MIN_VOLUME = 0.0;
export const MAX_VOLUME = 15.0;

export const setListenerVolume = async (volume: number) => {
  const loaders = await import("./loaders")
  const { listener } = loaders
  listener.setMasterVolume(volume);
}

export const setMasterVolumeFromPercentage = (percentage: number) => {
  const volume = (percentage / 100) * (MAX_VOLUME - MIN_VOLUME) + MIN_VOLUME;
  setListenerVolume(volume);
  localStorage.setItem('volume', volume.toString());
}

export const getMasterVolumePercentage = () => {
  const volume = parseFloat(localStorage.getItem('volume') || '2.0');
  const percentage = (volume - MIN_VOLUME) / (MAX_VOLUME - MIN_VOLUME) * 100;
  return percentage;
}

export const incrementVolumePercentage = (increment: number) => {
  const percentage = getMasterVolumePercentage();
  setMasterVolumeFromPercentage(percentage + increment);
}
