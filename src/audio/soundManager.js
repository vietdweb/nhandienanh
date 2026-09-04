/**
 * Quản lý âm thanh hiệu ứng giao diện (Web Audio API)
 * và đọc số đếm tiếng Việt (Web Speech Synthesis API).
 */

const VIETNAMESE_NUMBERS = {
  0: 'Không',
  1: 'Một',
  2: 'Hai',
  3: 'Ba',
  4: 'Bốn',
  5: 'Năm',
  6: 'Sáu',
  7: 'Bảy',
  8: 'Tám',
  9: 'Chín',
  10: 'Mười'
};

export class SoundManager {
  constructor() {
    this.enabled = true;
    this.voiceEnabled = true;
    this.audioCtx = null;
    this.lastSpokenNumber = null;
    this.stableNumber = null;
    this.stableCount = 0;
    this.lastSpeakTime = 0;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Phát tiếng bíp / chime sci-fi theo nốt nhạc tương ứng số ngón tay
  playTone(frequency = 440, type = 'sine', duration = 0.15) {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio tone error:', e);
    }
  }

  // Tiếng chime tương ứng số đếm (cao dần từ 0 đến 5)
  playNumberChime(num) {
    const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 880, 987.77, 1046.5];
    const freq = freqs[Math.min(num, freqs.length - 1)] || 440;
    this.playTone(freq, 'triangle', 0.18);
  }

  // Đọc số tiếng Việt với bộ lọc chống nhiễu (debounced & stabilized)
  handleNumberDetection(num, gestureDesc = '') {
    if (num === null || num === undefined) {
      this.stableNumber = null;
      this.stableCount = 0;
      return;
    }

    // Đếm số khung hình ổn định liên tiếp (ít nhất 10 frame liên tiếp cùng 1 số ~ 300ms)
    if (num === this.stableNumber) {
      this.stableCount++;
    } else {
      this.stableNumber = num;
      this.stableCount = 1;
    }

    // Khi đã ổn định đủ lâu và khác với số vừa đọc gần nhất
    const now = Date.now();
    if (this.stableCount >= 10 && this.stableNumber !== this.lastSpokenNumber && (now - this.lastSpeakTime > 900)) {
      this.lastSpokenNumber = this.stableNumber;
      this.lastSpeakTime = now;

      // Phát tiếng chime
      this.playNumberChime(this.stableNumber);

      // Đọc tiếng Việt
      if (this.voiceEnabled && 'speechSynthesis' in window) {
        this.speakNumber(this.stableNumber);
      }
    }
  }

  speakNumber(num) {
    const text = VIETNAMESE_NUMBERS[num] !== undefined ? VIETNAMESE_NUMBERS[num] : `${num}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    // Tìm giọng tiếng Việt nếu có
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    window.speechSynthesis.cancel(); // Dừng câu cũ
    window.speechSynthesis.speak(utterance);
  }
}
