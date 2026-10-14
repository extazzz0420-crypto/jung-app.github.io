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

// High tones above 12 kHz must not fold back into the speech band when 48 kHz becomes
// 24 kHz (aliasing): an 18 kHz tone would otherwise come out as a loud 6 kHz one.
const antiAlias = new Processor();
let phase18 = 0;
for (let block = 0; block < 32; block++) {
  const samples = new Float32Array(128);
  for (let i = 0; i < 128; i++, phase18++) samples[i] = .1 * Math.sin(2 * Math.PI * 18000 * phase18 / 48000);
  antiAlias.process([[samples]]);
}
assert.ok(frame.rms < .012, `18 kHz tone must be filtered before decimation, rms ${frame.rms}`);
const speechBand = new Processor();
let phase1k = 0;
for (let block = 0; block < 32; block++) {
  const samples = new Float32Array(128);
  for (let i = 0; i < 128; i++, phase1k++) samples[i] = .1 * Math.sin(2 * Math.PI * 1000 * phase1k / 48000);
  speechBand.process([[samples]]);
}
assert.ok(frame.rms > .065, `1 kHz speech band passes unchanged, rms ${frame.rms}`);
console.log('Capture worklet anti-aliasing filter: passed');

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

// Muting suppresses outbound audio and clears pre-roll before the next utterance.
const muted = new context.window.JungVoiceSession({base:'https://synthetic.test',initData:'signed',status(){}});
muted.closed = false; muted.ready = true; muted.sequence = 0;
const muteEvents = [];
muted.ws = {readyState:1,send:data=>muteEvents.push(data)};
const track = {enabled:true}; muted.stream = {getAudioTracks:()=>[track]};
muted.setMuted(true);
for (let i=0;i<5;i++) muted.captureFrame({pcm:new ArrayBuffer(960),rms:.5});
assert.equal(muteEvents.length,0); assert.equal(track.enabled,false);
muted.setMuted(false);
assert.equal(track.enabled,true); assert.equal(muted.preRoll.length,0);
console.log('Mute privacy and pre-roll reset: passed');

// Each voice plays at its measured level through a peak limiter.
const leveled = new context.window.JungVoiceSession({base:'https://synthetic.test',initData:'signed',status(){}});
leveled.closed = false; leveled.ready = true; leveled.awaiting = true; leveled.turn = 1;
leveled.ws = {readyState:1,send(){}};
const gains = []; const links = [];
leveled.context = {currentTime:0, destination:{name:'out'},
  createGain(){ const node={gain:{value:1},connect(target){links.push(['gain',target]);return target;}}; gains.push(node); return node; },
  createBuffer:(_c,n,rate)=>({duration:n/rate,getChannelData:()=>new Float32Array(n)}),
  createBufferSource:()=>({connect(target){links.push(['source',target]);},start(){},stop(){}})};
leveled.limiter = {name:'limiter'};
leveled.message({type:'phrase',turn:1,phrase:0,sample_rate:24000,gain:1.25});
leveled.message({type:'audio',turn:1,phrase:0,pcm:'AAAAAA=='});
leveled.message({type:'audio',turn:1,phrase:0,pcm:'AAAAAA=='});
assert.equal(gains.length,1,'one gain node per phrase');
assert.equal(gains[0].gain.value,1.25);
assert.ok(links.some(([from,to])=>from==='gain'&&to===leveled.limiter),'gain feeds the limiter');
assert.equal(links.filter(([from,to])=>from==='source'&&to===gains[0]).length,2);
console.log('Per-voice loudness gain and limiter: passed');

// Preview decodes the sample, applies the voice gain and can be stopped.
const previewNodes = [];
class PreviewContext {
  constructor(){ this.destination={}; this.currentTime=0; }
  async resume(){} async close(){ this.closed=true; }
  createGain(){ const n={gain:{value:1},connect:t=>t}; previewNodes.push(n); return n; }
  createDynamicsCompressor(){ return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect:t=>t}; }
  createBuffer(_c,n,rate){ return {duration:n/rate,getChannelData:()=>new Float32Array(n)}; }
  createBufferSource(){ const s={connect:t=>t,start(){s.started=true;},stop(){s.stopped=true;}}; this.source=s; return s; }
}
const previewEnv={...context,window:{},AudioContext:PreviewContext};
vm.runInNewContext(source,previewEnv);
const playing = await previewEnv.window.JungVoiceSession.playPreview({pcm:'AAAAAA==',sample_rate:24000,gain:1.4});
assert.equal(previewNodes[0].gain.value,1.4);
playing.stop();
console.log('Voice preview playback with gain: passed');
