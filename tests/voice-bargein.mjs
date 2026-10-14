import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
// While the guide is answering, a cough, an «угу» or speaker echo must not cut the reply.
const source = await readFile(new URL('../voice.js', import.meta.url), 'utf8');
let time = 0;
let outputRms = 0;
function session() {
  const events = [];
  const binary = [];
  const sources = [];
  const context = { window: {}, URL, Map, Set, Float32Array, performance: { now: () => time },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setTimeout: () => 1, clearTimeout() {} };
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
  voice.message({ type: 'ready' });
  const frame = rms => { time += 20; voice.captureFrame({ pcm: new ArrayBuffer(960), rms }); };
  // One finished user turn, the guide starts speaking.
  for (let i = 0; i < 3; i++) frame(.1);
  time += 750; frame(0);
  voice.message({ type: 'phrase', turn: 1, phrase: 0, sample_rate: 24000 });
  voice.message({ type: 'audio', turn: 1, phrase: 0, pcm: 'AAAAAA==' });
  binary.length = 0;
  return { voice, events, binary, sources, frame };
}
const interrupted = s => s.events.some(event => event.type === 'interrupt');

// A 120 ms cough while the guide speaks does not interrupt.
let s = session();
for (let i = 0; i < 6; i++) s.frame(.1);
for (let i = 0; i < 5; i++) s.frame(0);
assert.equal(interrupted(s), false, 'short noise must not cut the reply');
assert.equal(s.voice.sources.size, 1, 'playback continues');

// A short «угу» backchannel (two bursts) does not interrupt either.
s = session();
for (const level of [.1, .1, .1, .1, 0, 0, .1, .1, .1, .1, 0, 0, 0, 0, 0, 0, 0, 0]) s.frame(level);
assert.equal(interrupted(s), false, 'backchannel must not cut the reply');

// Real speech with natural micro-pauses interrupts and keeps its beginning.
s = session();
const speech = [];
for (let i = 0; i < 30; i++) speech.push(i % 6 === 5 ? 0 : .1);
let cutAt = -1;
speech.forEach((level, i) => { s.frame(level); if (cutAt < 0 && interrupted(s)) cutAt = i; });
assert.ok(cutAt >= 12 && cutAt <= 25, `sustained speech interrupts after ~300 ms, got frame ${cutAt}`);
assert.equal(s.voice.sources.size, 0, 'playback stopped');
assert.ok(s.binary.length >= cutAt, 'the start of the interrupting speech reaches the server');

// Speaker echo quieter than the guide's own output is ignored, a louder voice is not.
outputRms = .2;
s = session();
for (let i = 0; i < 40; i++) s.frame(.06);
assert.equal(interrupted(s), false, 'echo below the output level is not speech');
for (let i = 0; i < 40; i++) s.frame(.25);
assert.ok(interrupted(s), 'a voice louder than the echo interrupts');
outputRms = 0;

// While the guide is still thinking, a short noise does not cancel the answer.
s = session();
s.voice.interrupt(false);
s.voice.awaiting = true;
for (let i = 0; i < 4; i++) s.frame(.1);
for (let i = 0; i < 40; i++) s.frame(0);
assert.equal(interrupted(s), false, 'short noise while thinking keeps the answer');

console.log('Voice barge-in ignores noise, backchannel and echo: passed');
