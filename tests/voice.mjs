import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../voice.js', import.meta.url), 'utf8');
const events = [];
const timers = [];
let time = 0;
const context = { window: {}, URL, Map, Set, performance: { now: () => time },
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {} };
vm.runInNewContext(source, context);
const voice = new context.window.JungVoiceSession({ base: 'https://synthetic.test', initData: 'signed', status() {} });
voice.closed = false;
voice.ready = true;
voice.ws = { readyState: 1, bufferedAmount: 0, send: data => events.push(typeof data === 'string' ? JSON.parse(data) : data) };
const sources = [];
voice.context = { currentTime: 0, destination: {},
  createBuffer: (_channels, n, rate) => ({ duration: n / rate, getChannelData: () => new Float32Array(n) }),
  createBufferSource: () => { const source = { connect() {}, start() {}, stop() {} }; sources.push(source); return source; } };
voice.message({ type: 'ready' });
// Speech starts after three loud frames and ends after a pause.
for (let i = 0; i < 3; i++) { time += 20; voice.captureFrame({ pcm: new ArrayBuffer(960), rms: .1 }); }
time += 750;
voice.captureFrame({ pcm: new ArrayBuffer(960), rms: 0 });
assert.ok(events.some(event => event.type === 'end'));
voice.message({ type: 'phrase', turn: 1, phrase: 0, sample_rate: 24000 });
voice.message({ type: 'audio', turn: 1, phrase: 0, pcm: 'AAAAAA==' });
voice.message({ type: 'phrase_end', turn: 1, phrase: 0 });
assert.equal(events.filter(event => event.type === 'played').length, 0, 'queued sound is not heard sound');
sources[0].onended();
assert.equal(events.filter(event => event.type === 'played').length, 1);
voice.message({ type: 'phrase', turn: 1, phrase: 1, sample_rate: 24000 });
voice.message({ type: 'audio', turn: 1, phrase: 1, pcm: 'AAAAAA==' });
voice.message({ type: 'phrase_end', turn: 1, phrase: 1 });
voice.interrupt();
assert.equal(sources[1].onended, null, 'interrupted audio cannot acknowledge itself');
assert.ok(events.some(event => event.type === 'interrupt'));
for (let i = 0; i < 3; i++) { time += 20; voice.captureFrame({ pcm: new ArrayBuffer(960), rms: .1 }); }
time += 750;
voice.captureFrame({ pcm: new ArrayBuffer(960), rms: 0 });
voice.message({ type: 'done', turn: 1 });
assert.equal(voice.awaiting, true, 'old completion must not discard a new response');
voice.message({ type: 'phrase', turn: 1, phrase: 5, sample_rate: 24000 });
assert.equal(voice.phrases.has(5), false, 'stale phrase must never play');
voice.message({ type: 'phrase', turn: 2, phrase: 0, sample_rate: 24000 });
voice.message({ type: 'replace', turn: 2 });
voice.message({ type: 'phrase', turn: 2, phrase: 1000, sample_rate: 24000 });
voice.message({ type: 'audio', turn: 2, phrase: 1000, pcm: 'AAAAAA==' });
voice.message({ type: 'phrase_end', turn: 2, phrase: 1000 });
assert.equal(events.filter(event => event.phrase === 1000).length, 0);
sources.at(-1).onended();
assert.equal(events.filter(event => event.type === 'played' && event.phrase === 1000).length, 1);
console.log('Voice VAD, playback, interruption, stale turns and replacement: passed');

// Reconnection authenticates again and never replays unconfirmed user audio.
const sockets = [];
const reconnect = new context.window.JungVoiceSession({ base: 'https://synthetic.test', initData: 'signed', status() {},
  socket(url) { const socket = { url, readyState: 1, send(data) { this.last = JSON.parse(data); }, close() {} }; sockets.push(socket); return socket; } });
reconnect.closed = false;
reconnect.connect();
sockets[0].onopen();
assert.equal(sockets[0].last.type, 'auth');
assert.equal(new URL(sockets[0].url).search, '', 'authentication never goes in URLs');
sockets[0].onmessage({data: JSON.stringify({type:'ready'})});
sockets[0].onclose();
assert.equal(reconnect.ready, false);
timers.at(-1)();
sockets[1].onopen();
assert.equal(sockets[1].last.init_data, 'signed');
assert.equal(reconnect.sources.size, 0);
console.log('Voice reconnect authenticates again and clears playback: passed');

// Run the actual worklet with synthetic samples at the normal browser sample rate.
let Processor;
let frame;
const worklet = { sampleRate: 48000, AudioWorkletProcessor: class { constructor() { this.port = {postMessage(value) { frame = value; }}; } },
  registerProcessor(_name, value) { Processor = value; } };
vm.runInNewContext(await readFile(new URL('../voice-worklet.js',import.meta.url),'utf8'), worklet);
const capture = new Processor();
for (let i=0; i<8; i++) capture.process([[new Float32Array(128).fill(.1)]]);
assert.equal(frame.pcm.byteLength, 1024);
assert.ok(frame.rms > .09 && frame.rms < .11);
console.log('Actual capture worklet: 48 kHz -> 24 kHz mono PCM passed');

// A suspended audio device cannot leave the start button blocked forever.
const startupTimers=[];
const startupStatus=[];
let deviceClosed=false;
const startupEnv={...context,window:{},AudioContext:class {resume(){return new Promise(()=>{});}async close(){deviceClosed=true;}},
  setTimeout(callback){startupTimers.push(callback);return startupTimers.length;},clearTimeout(){}};
vm.runInNewContext(source,startupEnv);
const waiting=new startupEnv.window.JungVoiceSession({base:'https://synthetic.test',initData:'signed',status:text=>startupStatus.push(text)});
const startup=waiting.start();
assert.equal(startupTimers.length,1,'suspended audio initialization has a deadline');
startupTimers[0]();
await startup;
assert.ok(waiting.closed && deviceClosed,'timeout releases the audio device and permits retry');
assert.match(startupStatus.at(-1),/Не удалось включить звук/);
console.log('Suspended audio startup deadline and visible recovery: passed');
