/**
 * Audio Alarm Utility using Web Audio API
 * Generates an audible alarm sound (two-tone repeating wake-up chime)
 * completely synthesized in the browser without requiring external audio files.
 */

class AlarmSoundManager {
  constructor() {
    this.audioCtx = null;
    this.timerId = null;
    this.isPlaying = false;
    this.currentTone = 'transit'; // 'transit' | 'gentle' | 'siren' | 'bell'
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setTone(tone) {
    this.currentTone = tone;
  }

  playToneNote(tone, step = 0) {
    if (!this.audioCtx) return;
    try {
      if (tone === 'gentle') {
        // Soft warm chords
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        const f = notes[step % notes.length];
        this.playBeep(f, 0.45, 'sine', 0.25);
      } else if (tone === 'siren') {
        // High attention alert
        const f = step % 2 === 0 ? 1046.5 : 880;
        this.playBeep(f, 0.22, 'sawtooth', 0.2);
      } else if (tone === 'bell') {
        // Resonant bell chime
        const f = step % 2 === 0 ? 1174.66 : 880; // D6 / A5
        this.playBeep(f, 0.5, 'sine', 0.35);
      } else {
        // Default 'transit'
        const f = step % 2 === 0 ? 987.77 : 783.99; // B5 and G5 alternation
        this.playBeep(f, 0.28, 'triangle', 0.35);
      }
    } catch (e) {}
  }

  playBeep(frequency, duration, type = 'sine', maxVolume = 0.5) {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(maxVolume, this.audioCtx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  previewTone(tone) {
    this.initContext();
    this.playToneNote(tone, 0);
    setTimeout(() => {
      this.playToneNote(tone, 1);
    }, 280);
  }

  startAlarm(tone = null) {
    if (this.isPlaying) return;
    this.initContext();
    this.isPlaying = true;
    const activeTone = tone || this.currentTone;

    // Trigger device vibration if available
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([600, 300, 600, 300, 600]);
      } catch (e) {}
    }

    let step = 0;
    // Play immediately
    this.playToneNote(activeTone, step++);

    // Repeat alarm chime every 450ms
    this.timerId = setInterval(() => {
      this.playToneNote(activeTone, step++);

      if (typeof navigator !== 'undefined' && navigator.vibrate && step % 2 === 0) {
        try {
          navigator.vibrate(300);
        } catch (e) {}
      }
    }, 450);
  }

  stopAlarm() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }
}

export const alarmAudio = new AlarmSoundManager();

