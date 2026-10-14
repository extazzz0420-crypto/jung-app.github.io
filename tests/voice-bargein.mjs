import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
// While the guide answers, only a spoken «стоп» confirmed by the server stops it.
// Owner phone test 2026-10-14: any sound cut the reply.
const source = await readFile(new URL('../voice.js', import.meta.url), 'utf8');
let time = 0;
let outputRms = 0;
function session() {
  const events = [];
  const binary = [];
  const sources = [];
  const timers = [];
  const context = { window: {}, URL, Map, Set, Float32Array, performance: { now: () => time },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {} };
  vm.runInNewContext(source, context);
  const voice = new context.window.JungVoiceSession({ base: 'https://synthetic.test', initData: 'signed', status() {} });
  voice.closed = false;
  voice.ready = true;
  voice.ws = { readyState: 1, bufferedAmount: 0,
    send: data => (typeof data === 'string' ? events.push(JSON.parse(data)) : binary.push(data)) };
  voice.context = { currentTime: 0, destination: {},
    createBuffer: (_channels, n, rate) => ({ duration: n / rate, getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => { const s = { connect() {}, start() {}, stop() {} }; sources.push(s); return s; } };
  voice.analyser = { getFloatTimeDomainData: out => out.fill(outputRms) };
  voice.outputSamples = new Float32Array(256);
  voice.master = { gain: { value: 1 } };
  voice.message({ type: 'ready' });
  const frame = rms => { time += 20; voice.captureFrame({ pcm: new ArrayBuffer(960), rms }); };
  // One finished user turn, the guide starts speaking.
  for (let i = 0; i < 3; i++) frame(.1);
  time += 750; frame(0);
  voice.message({ type: 'phrase', turn: 1, phrase: 0, sample_rate: 24000 });
  voice.message({ type: 'audio', turn: 1, phrase: 0, pcm: 'AAAAAA==' });
  binary.length = 0;
  events.length = 0;
  return { voice, events, binary, sources, frame, timers };
}
const sent = (s, type) => s.events.filter(event => event.type === type).length;

// A 120 ms cough while the guide speaks is not even checked.
let s = session();
for (let i = 0; i < 6; i++) s.frame(.1);
for (let i = 0; i < 5; i++) s.frame(0);
assert.equal(sent(s, 'check'), 0, 'short noise is not a stop candidate');
assert.equal(s.voice.sources.size, 1, 'playback continues');

// A short «угу» backchannel (two bursts) is not checked either.
s = session();
for (const level of [.1, .1, .1, .1, 0, 0, .1, .1, .1, .1, 0, 0, 0, 0, 0, 0, 0, 0]) s.frame(level);
assert.equal(sent(s, 'check'), 0, 'backchannel is not a stop candidate');

// Sustained speech becomes a check: the reply keeps playing, only quieter, and the
// sample including its beginning goes to the server, closed at the pause.
s = session();
for (let i = 0; i < 30; i++) s.frame(i % 6 === 5 ? 0 : .1);
for (let i = 0; i < 25; i++) s.frame(0);
assert.equal(sent(s, 'check'), 1, 'speech during the reply is checked once');
assert.equal(sent(s, 'check_end'), 1, 'the sample is closed at the pause');
assert.equal(sent(s, 'interrupt'), 0, 'the client never cuts the reply on its own');
assert.equal(sent(s, 'end'), 0, 'a check is not a new turn');
assert.equal(s.voice.sources.size, 1, 'playback goes on while the server listens');
assert.ok(s.voice.master.gain.value < .5, 'playback is ducked while checking');
assert.ok(s.binary.length >= 20, 'the start of the speech reaches the server');

// The server heard no command: full volume again, the reply continues.
s.voice.message({ type: 'check_ignored' });
assert.equal(s.voice.master.gain.value, 1);
assert.equal(s.voice.sources.size, 1);

// A second candidate after that is checked again; the server heard «стоп».
for (let i = 0; i < 30; i++) s.frame(.1);
for (let i = 0; i < 25; i++) s.frame(0);
assert.equal(sent(s, 'check'), 2);
s.voice.message({ type: 'stopped', turn: 1 });
assert.equal(s.voice.sources.size, 0, 'playback stopped');
assert.equal(s.voice.awaiting, false);
assert.equal(s.voice.master.gain.value, 1, 'volume restored for the next reply');
assert.equal(sent(s, 'interrupt'), 0, 'the server already cancelled the reply');
// After the stop the person simply talks: a normal turn starts.
for (let i = 0; i < 3; i++) s.frame(.1);
time += 750; s.frame(0);
assert.equal(sent(s, 'end'), 1, 'speech after the stop is a new turn');

// No answer from the server: the volume does not stay low forever.
s = session();
for (let i = 0; i < 30; i++) s.frame(.1);
for (let i = 0; i < 25; i++) s.frame(0);
s.timers.at(-1)();
assert.equal(s.voice.master.gain.value, 1);
assert.equal(s.voice.checkPending, false);

// Speaker echo quieter than the guide's own output is not a candidate.
outputRms = .2;
s = session();
for (let i = 0; i < 40; i++) s.frame(.06);
assert.equal(sent(s, 'check'), 0, 'echo below the output level is not speech');
for (let i = 0; i < 40; i++) s.frame(.25);
assert.equal(sent(s, 'check'), 1, 'a voice louder than the echo is checked');
outputRms = 0;

// While the guide is still thinking, a short noise is not checked.
s = session();
s.voice.interrupt(false);
s.voice.awaiting = true;
for (let i = 0; i < 4; i++) s.frame(.1);
for (let i = 0; i < 40; i++) s.frame(0);
assert.equal(sent(s, 'check'), 0, 'short noise while thinking keeps the answer');

console.log('Voice stop by spoken command, noise, backchannel and echo: passed');
