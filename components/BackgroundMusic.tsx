"use client";

import { Music2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.28;

    const tryPlay = async () => {
      try {
        await audio.play();
        setPlaying(true);
        setBlocked(false);
      } catch {
        setBlocked(true);
      }
    };

    void tryPlay();

    // Browsers often block audible autoplay. If that happens, start the music
    // on the visitor's first interaction so the site still feels automatic.
    const unlock = () => {
      if (audio.paused) void tryPlay();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        setBlocked(false);
      } catch {
        setBlocked(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src="/assets/theme.mp3" loop preload="auto" />
      <button
        type="button"
        className={blocked && !playing ? "musicToggle attention" : "musicToggle"}
        onClick={toggle}
        aria-label={playing ? "Pause background music" : "Play background music"}
        title={playing ? "Pause music" : blocked ? "Play site music" : "Play music"}
      >
        <span className="musicIcon">{playing ? <Volume2 size={17}/> : <VolumeX size={17}/>}</span>
        <span className="musicLabel"><Music2 size={12}/>{playing ? "Music On" : "Music Off"}</span>
      </button>
    </>
  );
}
