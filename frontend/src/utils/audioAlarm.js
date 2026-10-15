import { getCustomAudioFile } from './customAudioDB.js';

class AlarmSoundManager {
  constructor() {
    this.audioCtx = null;
    this.timerId = null;
    this.isPlaying = false;
    this.currentTone = 'transit'; // 'transit' | 'gentle' | 'siren' | 'bell' | 'custom'

    // Custom song playback
    this.customAudio = null;
    this.customAudioUrl = null;
    this.customAudioName = '';
    this.previewTimer = null;

    // Automatically load any previously saved custom audio from IndexedDB
    if (typeof window !== 'undefined') {
      this.loadCustomAudio();
    }
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

  /**
   * Register a custom audio file (from user's mobile file manager)
   */
  setCustomAudioBlob(blob, fileName = 'Custom Song') {
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
    }
    try {
      this.customAudioUrl = URL.createObjectURL(blob);
      this.customAudio = new Audio(this.customAudioUrl);
      this.customAudio.loop = true;
      this.customAudioName = fileName;
      return true;
    } catch (err) {
      console.error('Failed to create custom audio object:', err);
      return false;
    }
  }

  /**
   * Load saved custom audio from IndexedDB on startup
   */
  async loadCustomAudio() {
    try {
      const data = await getCustomAudioFile();
      if (data && data.blob) {
        this.setCustomAudioBlob(data.blob, data.fileName);
        return data.fileName;
      }
    } catch (e) {
      console.warn('Could not restore custom audio:', e);
    }
    return null;
  }

  /**
   * Remove custom audio
   */
  clearCustomAudio() {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.currentTime = 0;
      this.customAudio = null;
    }
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
      this.customAudioUrl = null;
    }
    this.customAudioName = '';
  }

  playToneNote(tone, step = 0) {
    if (!this.audioCtx) return;
    try {
      if (tone === 'gentle') {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        const f = notes[step % notes.length];
        this.playBeep(f, 0.45, 'sine', 0.25);
      } else if (tone === 'siren') {
        const f = step % 2 === 0 ? 1046.5 : 880;
        this.playBeep(f, 0.22, 'sawtooth', 0.2);
      } else if (tone === 'bell') {
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
    if (tone === 'custom') {
      if (this.customAudio) {
        this.stopPreview();
        this.customAudio.currentTime = 0;
        this.customAudio.play().catch((err) => {
          console.warn('Custom audio preview notice:', err);
        });
        this.previewTimer = setTimeout(() => {
          this.stopPreview();
        }, 4000);
      } else {
        // Fallback to transit if no custom file selected
        this.previewTone('transit');
      }
      return;
    }

    this.stopPreview();
    this.initContext();
    this.playToneNote(tone, 0);
    setTimeout(() => {
      this.playToneNote(tone, 1);
    }, 280);
  }

  stopPreview() {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.customAudio && !this.isPlaying) {
      this.customAudio.pause();
      this.customAudio.currentTime = 0;
    }
  }

  startAlarm(tone = null) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const activeTone = tone || this.currentTone;

    // Trigger device vibration if available
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([600, 300, 600, 300, 600]);
      } catch (e) {}
    }

    // 1. Play Custom Song if selected and loaded
    if (activeTone === 'custom' && this.customAudio) {
      try {
        this.customAudio.currentTime = 0;
        this.customAudio.play().catch((err) => {
          console.warn('Custom song playback fallback to synthesized chime:', err);
          this.playSynthesizedAlarmLoop('transit');
        });

        // Repeat vibration while custom audio plays
        let vibCount = 0;
        this.timerId = setInterval(() => {
          vibCount++;
          if (typeof navigator !== 'undefined' && navigator.vibrate && vibCount % 2 === 0) {
            try {
              navigator.vibrate(300);
            } catch (e) {}
          }
        }, 1000);
        return;
      } catch (e) {
        console.warn('Custom audio play error:', e);
      }
    }

    // 2. Play Synthesized Chimes (transit, gentle, siren, bell)
    this.playSynthesizedAlarmLoop(activeTone);
  }

  playSynthesizedAlarmLoop(tone) {
    this.initContext();
    let step = 0;
    this.playToneNote(tone, step++);

    this.timerId = setInterval(() => {
      this.playToneNote(tone, step++);

      if (typeof navigator !== 'undefined' && navigator.vibrate && step % 2 === 0) {
        try {
          navigator.vibrate(300);
        } catch (e) {}
      }
    }, 450);
  }

  stopAlarm() {
    this.isPlaying = false;
    this.stopPreview();

    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.currentTime = 0;
    }

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
