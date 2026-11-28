
import { useState } from "react";
import type { Track, RepeatMode } from "../types/music";

export function useQueue() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const currentTrack = queue[currentIndex] ?? null;

  function addTrack(track: Track) {
    setQueue((previous) => {
      const next = [...previous, track];

      if (currentIndex === -1) {
        setCurrentIndex(0);
      }

      return next;
    });
  }

  function addTracks(tracks: Track[]) {
    if (tracks.length === 0) return;

    setQueue((previous) => {
      const next = [...previous, ...tracks];

      if (currentIndex === -1) {
        setCurrentIndex(0);
      }

      return next;
    });
  }

  function nextTrack(): Track | null {
    if (queue.length === 0) return null;


    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      return queue[nextIndex];
    }

    if (repeatMode === "all") {
      setCurrentIndex(0);
      return queue[0];
    }

    return null;
  }

  function previousTrack(): Track | null {
    if (queue.length === 0) return null;

    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      setCurrentIndex(previousIndex);
      return queue[previousIndex];
    }

    if (repeatMode === "all") {
      const lastIndex = queue.length - 1;
      setCurrentIndex(lastIndex);
      return queue[lastIndex];
    }

    return currentTrack;
  }

  function cycleRepeatMode() {
    setRepeatMode((mode) => {
      if (mode === "off") return "all";
      if (mode === "all") return "one";
      return "off";
    });
  }

  function removeTrack(index: number) {
    setQueue((previous) => {
      const next = previous.filter((_, i) => i !== index);

      setCurrentIndex((current) => {
        if (next.length === 0) return -1;
        if (index < current) return current - 1;
        if (index === current) return Math.min(current, next.length - 1);
        return current;
      });

      return next;
    });
  }

  function clearQueue() {
    setQueue([]);
    setCurrentIndex(-1);
  }

  return {
    queue,
    currentIndex,
    currentTrack,
    repeatMode,
    addTrack,
    addTracks,
    nextTrack,
    previousTrack,
    cycleRepeatMode,
    clearQueue,
    setCurrentIndex,
    removeTrack,
  };
}
