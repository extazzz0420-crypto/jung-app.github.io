/* Voice transport contains no credentials, persistence or conversation text. */
(function () {
  'use strict';
  function bounded(promise, milliseconds) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Audio setup timeout')), milliseconds);
    })]).finally(() => clearTimeout(timer));
  }
  function decodePcm(context, base64, rate) {
    const raw = atob(base64);
    if (raw.length % 2) throw new Error('unaligned PCM');
    const length = raw.length / 2;
    const buffer = context.createBuffer(1, length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const sample = raw.charCodeAt(i * 2) | raw.charCodeAt(i * 2 + 1) << 8;
      channel[i] = (sample >= 32768 ? sample - 65536 : sample) / 32768;
    }
    return buffer;
  }
  // Voices are leveled by a per-voice gain; this limiter catches the remaining peaks.
  function createLimiter(context, target) {
    if (!context.createDynamicsCompressor) return target;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 20;
    limiter.attack.value = .001; limiter.release.value = .25;
    limiter.connect(target);
    return limiter;
  }
  class VoiceSession {
    constructor({ base, initData, status, minutes = () => {}, loud = false, socket = url => new WebSocket(url) }) {
      Object.assign(this, { base, initData, status, minutes, loud, socket });
      this.sources = new Set();
      this.epoch = 0;
      this.closed = true;
      this.retry = 0;
    }
    async start() {
      if (!this.closed) return;
      this.muted = false;
      this.inputLevel = 0;
      this.closed = false;
      const epoch = ++this.epoch;
      this.status('Разреши микрофон, чтобы начать разговор.');
      try {
        this.context = new AudioContext();
        await bounded(this.context.resume(), 5000);
        const request = navigator.mediaDevices.getUserMedia({ audio: {
          // «Громкий звук»: with echo cancellation on, Android plays the reply at the quieter
          // call volume (owner 2026-10-14, volume at max). Off = media volume, but the
          // person must speak over the guide to stop it.
          channelCount: 1, echoCancellation: !this.loud, noiseSuppression: true, autoGainControl: !this.loud,
        } });
        request.then(stream => {
          if (epoch !== this.epoch) stream.getTracks().forEach(track => track.stop());
        }, () => {});
        const stream = await bounded(request, 15000);
        if (epoch !== this.epoch) { stream.getTracks().forEach(t => t.stop()); return; }
        this.stream = stream;
        await bounded(this.context.audioWorklet.addModule('./voice-worklet.js?v=20261015-voice-button'), 10000);
        if (epoch !== this.epoch) return;
        if (this.context.createAnalyser) {
          this.analyser = this.context.createAnalyser();
          this.analyser.fftSize = 256;
          this.analyser.connect(this.context.destination);
          this.outputSamples = new Float32Array(256);
        }
        this.limiter = createLimiter(this.context, this.analyser || this.context.destination);
        // One master level, lowered while a possible «стоп» is being checked.
        this.master = this.context.createGain();
        this.master.connect(this.limiter);
        this.capture = new AudioWorkletNode(this.context, 'jung-capture');
        this.input = this.context.createMediaStreamSource(stream);
        this.input.connect(this.capture);
        this.silent = this.context.createGain();
        this.silent.gain.value = 0;
        this.capture.connect(this.silent).connect(this.context.destination);
        this.capture.port.onmessage = event => this.captureFrame(event.data);
        this.connect();
      } catch (error) {
        if (epoch !== this.epoch) return;
        this.stop();
        this.status(error.name === 'NotAllowedError'
          ? 'Микрофон закрыт. Разреши доступ в настройках Telegram и нажми «Начать разговор».'
          : 'Не удалось включить звук. Открой приложение на телефоне и попробуй ещё раз.');
      }
    }
    connect() {
      if (this.closed) return;
      this.ready = false;
      this.status(this.retry ? 'Восстанавливаю связь…' : 'Соединяюсь…');
      const url = new URL('/api/voice', this.base);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = this.socket(url.href);
      this.ws = ws;
      const timer = setTimeout(() => ws.close(), 10000);
      ws.onopen = () => this.send({ type: 'auth', init_data: this.initData });
      ws.onmessage = event => {
        if (this.ws !== ws || this.closed) return;
        try { this.message(JSON.parse(event.data)); }
        catch { this.status('Не удалось воспроизвести ответ. Подключись снова.'); this.stop(); }
        if (this.ready) clearTimeout(timer);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (this.ws !== ws || this.closed) return;
        this.ready = false;
        this.interrupt(false);
        this.speaking = false;
        this.preRoll = [];
        this.endCheck(false);
        if (this.retry++ < 3) {
          this.status('Связь прервалась. После подключения повтори последнюю фразу.');
          this.reconnectTimer = setTimeout(() => this.connect(), 500 * 2 ** this.retry);
        } else { this.stop(); this.status('Связь не восстановилась. Нажми «Начать разговор».'); }
      };
      ws.onerror = () => this.status('Нет связи. Пробую подключиться снова…');
    }
    send(value) {
      if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(value));
    }
    captureFrame({ pcm, rms }) {
      this.inputLevel = this.muted ? 0 : rms;
      if (!this.ready || this.closed || this.muted) return;
      const now = performance.now();
      this.preRoll ||= [];
      // While the guide answers, the microphone is ignored: the «Остановить» button stops
      // a reply. A spoken «стоп» was tried and dropped (owner phone tests 2026-10-14: the
      // phone's echo cancellation buried the word under the reply; recognition missed it).
      // After the last phrase was sent and played, speech is the next turn at once
      // (answers right after a reply were lost before).
      const answering = this.sources.size > 0 || (this.awaiting && !this.allSent);
      if (answering || (!this.speaking && now < (this.quietUntil || 0))) {
        this.loudFrames = 0;
        if (answering) this.preRoll = [];
        else { this.preRoll.push(pcm); if (this.preRoll.length > 30) this.preRoll.shift(); }
        return;
      }
      if (rms > .025) {
        this.lastVoice = now;
        this.loudFrames = (this.loudFrames || 0) + 1;
      } else this.loudFrames = 0;
      if (!this.speaking && this.loudFrames >= 3) {
        this.speaking = true;
        this.startedSpeaking = now;
        this.errorState = false;
        this.status('Слушаю тебя…');
        this.preRoll.forEach(frame => this.ws.send(frame));
        this.preRoll = [];
      }
      if (this.speaking) {
        if (this.ws.bufferedAmount > 256000) { this.stop(); this.status('Связь слишком медленная. Попробуй ещё раз.'); return; }
        this.ws.send(pcm);
        if (now - this.lastVoice > 700 || now - this.startedSpeaking > 59000) {
          this.turn = ++this.sequence;
          this.send({ type: 'end' });
          this.speaking = false;
          this.awaiting = true;
          this.allSent = false;
          this.loudFrames = 0;
          this.status('Проводник обдумывает ответ…');
        }
      } else {
        this.preRoll.push(pcm);
        // 600 ms keeps the start of speech that had to last 300 ms before it counted.
        if (this.preRoll.length > 30) this.preRoll.shift();
      }
    }
    // Quieter playback while a possible «стоп» is checked, so the person feels heard.
    duck(on) {
      const gain = this.master?.gain;
      if (!gain) return;
      const now = this.context.currentTime;
      gain.cancelScheduledValues?.(now);
      // .15, not .3: the phone's echo cancellation lets the person through only when the
      // reply is nearly silent (owner test 2026-10-14: «стоп» came back as fragments).
      gain.setTargetAtTime ? gain.setTargetAtTime(on ? .15 : 1, now, .05) : (gain.value = on ? .15 : 1);
    }
    endCheck(restore) {
      clearTimeout(this.checkTimer);
      if (this.checking) this.send({ type: 'check_end' });
      this.checking = false;
      this.checkPending = false;
      if (restore) this.duck(false);
    }
    setMuted(value) {
      this.muted = value;
      this.stream?.getAudioTracks().forEach(track => { track.enabled = !value; });
      if (value && this.speaking) {
        this.turn = ++this.sequence;
        this.send({type: 'end'});
        this.awaiting = true;
      }
      this.speaking = false;
      this.loudFrames = 0;
      this.preRoll = [];
      this.inputLevel = 0;
      this.endCheck(true);
    }
    outputLevel() {
      if (!this.analyser || !this.sources.size) return 0;
      this.analyser.getFloatTimeDomainData(this.outputSamples);
      let sum = 0;
      for (const value of this.outputSamples) sum += value * value;
      return Math.sqrt(sum / this.outputSamples.length);
    }
    interrupt(notify = true) {
      if (notify && this.awaiting) this.send({ type: 'interrupt' });
      this.sources.forEach(source => { source.onended = null; source.stop(); });
      this.sources.clear();
      this.turn = null;
      this.awaiting = false;
      this.allSent = false;
      this.nextTime = 0;
      this.phrases = new Map();
      this.endCheck(true);
    }
    message(event) {
      if (event.type === 'ready') { this.sequence = 0; this.turn = null; this.ready = true; this.status('Можешь говорить. Паузы отправляют фразу автоматически.'); return; }
      if (event.type === 'error') {
        this.errorState = true;
        this.status(event.text);
        if (event.close || ['unauthorized', 'unavailable', 'no_consent', 'not_onboarded', 'blocked', 'busy', 'memory_failed'].includes(event.code)) this.stop();
        return;
      }
      if (event.type === 'listening') { this.status('Слушаю тебя…'); return; }
      if (event.type === 'minutes') { this.minutes(event); return; }
      if (event.type === 'heard_as_turn') {
        // The server took words sent as a stop check for the next turn.
        this.endCheck(true);
        this.turn = ++this.sequence;
        this.awaiting = true;
        this.allSent = false;
        this.status('Проводник обдумывает ответ…');
        return;
      }
      if (event.type === 'generated') { if (event.turn === this.turn) this.allSent = true; return; }
      if (event.type === 'check_ignored') { this.endCheck(true); return; }
      if (event.type === 'stopped') {
        // The server already cancelled the reply; only local playback stops here.
        if (event.turn === this.turn) this.interrupt(false);
        else this.endCheck(true);
        this.status('Остановился. Слушаю тебя…');
        return;
      }
      if (event.type === 'done') {
        if (event.turn !== this.turn) return;
        this.awaiting = false;
        if (!this.speaking && !this.errorState) this.status('Слушаю тебя…');
        return;
      }
      if (!this.awaiting) return;
      if (event.type === 'replace') { this.interrupt(false); this.awaiting = true; this.turn = event.turn; return; }
      if (event.type === 'phrase') {
        if (this.turn !== event.turn) return;
        this.turn = event.turn;
        this.phrases ||= new Map();
        this.phrases.set(event.phrase, { rate: event.sample_rate, gain: event.gain || 1, playing: 0, ended: false, samples: 0 });
      }
      if (event.turn !== this.turn) return;
      const phrase = this.phrases?.get(event.phrase);
      if (event.type === 'audio' && phrase) {
        if (this.nextTime - this.context.currentTime > 60) throw new Error('playback limit');
        const buffer = decodePcm(this.context, event.pcm, phrase.rate);
        const length = buffer.length ?? Math.round(buffer.duration * phrase.rate);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.phraseOutput(phrase));
        phrase.playing++;
        phrase.samples += length;
        this.sources.add(source);
        source.onended = () => {
          this.sources.delete(source);
          // The room's echo of the last word must not start a turn of its own.
          if (!this.sources.size && this.allSent) this.quietUntil = performance.now() + (this.loud ? 600 : 150);
          phrase.playing--;
          this.acknowledge(event.turn, event.phrase, phrase);
        };
        const start = Math.max(this.context.currentTime + .03, this.nextTime || 0);
        this.nextTime = start + buffer.duration;
        source.start(start);
        this.status('Проводник говорит.');
      }
      if (event.type === 'phrase_end' && phrase) {
        phrase.ended = true;
        this.acknowledge(event.turn, event.phrase, phrase);
      }
    }
    phraseOutput(phrase) {
      const out = this.master || this.limiter || this.analyser || this.context.destination;
      if (!this.context.createGain || phrase.gain === 1) return out;
      if (!phrase.node) {
        phrase.node = this.context.createGain();
        phrase.node.gain.value = phrase.gain;
        phrase.node.connect(out);
      }
      return phrase.node;
    }
    acknowledge(turn, index, phrase) {
      if (turn === this.turn && phrase.ended && !phrase.playing && phrase.samples && !phrase.acked) {
        phrase.acked = true;
        this.send({ type: 'played', turn, phrase: index });
      }
    }
    stop() {
      this.closed = true;
      this.epoch++;
      this.ready = false;
      this.inputLevel = 0;
      this.analyser?.disconnect();
      clearTimeout(this.reconnectTimer);
      this.interrupt(false);
      this.ws?.close();
      this.stream?.getTracks().forEach(track => track.stop());
      this.capture?.disconnect();
      this.input?.disconnect();
      this.context?.close().catch(() => {});
    }
  }
  // One-shot preview of a voice sample; returns a handle that stops playback.
  VoiceSession.playPreview = async ({ pcm, sample_rate: rate, gain = 1 }, ended = () => {}) => {
    const context = new AudioContext();
    await bounded(context.resume(), 5000);
    const source = context.createBufferSource();
    source.buffer = decodePcm(context, pcm, rate);
    const level = context.createGain();
    level.gain.value = gain;
    source.connect(level);
    level.connect(createLimiter(context, context.destination));
    const stop = () => { try { source.stop(); } catch { /* already ended */ } context.close().catch(() => {}); };
    source.onended = () => { stop(); ended(); };
    source.start();
    return { stop };
  };
  window.JungVoiceSession = VoiceSession;
})();
