import type { GameEvent } from "./game";

export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private charge: { osc: OscillatorNode; gain: GainNode } | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    const AudioCtx = window.AudioContext;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private out(): AudioNode | null {
    return this.master ?? this.ctx?.destination ?? null;
  }

  private noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noise) return this.noise;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.25), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  private burst(duration: number, gain: number, freq: number): void {
    if (!this.ctx) return;
    const destination = this.out();
    const buffer = this.noiseBuffer();
    if (!destination || !buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const amp = this.ctx.createGain();
    const t = this.ctx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(destination);
    source.start(t);
    source.stop(t + duration);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, slideTo?: number): void {
    if (!this.ctx) return;
    const destination = this.out();
    if (!destination) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const t = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + duration);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp);
    amp.connect(destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  punch(connected: boolean, beat: boolean): void {
    this.unlock();
    if (!connected) {
      this.tone(180, 0.06, "square", 0.03, 90);
      return;
    }
    this.burst(beat ? 0.09 : 0.05, beat ? 0.22 : 0.12, beat ? 1400 : 900);
    this.tone(beat ? 246 : 168, beat ? 0.12 : 0.08, "square", beat ? 0.1 : 0.06, 70);
    if (beat) this.tone(370, 0.1, "square", 0.05, 180);
  }

  super(beat: boolean): void {
    this.unlock();
    this.stopCharge();
    this.burst(0.22, 0.28, 700);
    this.tone(110, 0.26, "sawtooth", 0.1, 42);
    this.tone(beat ? 520 : 420, 0.16, "square", 0.06, 90);
  }

  clink(): void {
    this.unlock();
    this.tone(760, 0.05, "square", 0.04, 240);
  }

  hurt(): void {
    this.unlock();
    this.tone(90, 0.18, "sawtooth", 0.08, 40);
    this.burst(0.1, 0.12, 300);
  }

  win(): void {
    this.unlock();
    this.stopCharge();
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.14, "square", 0.05), index * 90);
    });
  }

  setCharging(active: boolean): void {
    if (!active) {
      this.stopCharge();
      return;
    }
    if (this.charge || !this.ctx) return;
    const destination = this.out();
    if (!destination) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const t = this.ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(680, t + 1);
    amp.gain.setValueAtTime(0.02, t);
    amp.gain.linearRampToValueAtTime(0.045, t + 1);
    osc.connect(amp);
    amp.connect(destination);
    osc.start(t);
    this.charge = { osc, gain: amp };
  }

  private stopCharge(): void {
    if (!this.charge || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.charge.gain.gain.cancelScheduledValues(t);
    this.charge.gain.gain.setValueAtTime(this.charge.gain.gain.value, t);
    this.charge.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    this.charge.osc.stop(t + 0.05);
    this.charge = null;
  }

  play(events: readonly GameEvent[]): void {
    let punched = false;
    let clinked = false;
    for (const event of events) {
      switch (event.type) {
        case "clink":
          if (!clinked) {
            this.clink();
            clinked = true;
          }
          break;
        case "hurt":
          this.hurt();
          break;
        case "win":
          this.win();
          break;
        case "punch":
          if (punched) break;
          punched = true;
          if (event.kind === "super") this.super(event.beat);
          else this.punch(event.connected, event.beat);
          break;
        default: {
          const neverEvent: never = event;
          void neverEvent;
          break;
        }
      }
    }
  }
}
