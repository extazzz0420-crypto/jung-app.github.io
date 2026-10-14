/* Invoked by workspace tools/check_live_voice_local.py. Synthetic devices only. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const [base, initData] = process.argv.slice(2);
assert.ok(base.startsWith('http://127.0.0.1:'), 'stub server must be loopback');
let time = 0;
let Processor;
let capture;
let stopped = false;
let completed = false;
let firstAudio = null;
const started = performance.now();
const worklet = {sampleRate:48000, AudioWorkletProcessor:class {constructor(){this.port={postMessage: data => capture.port.onmessage?.({data})};}},
  registerProcessor(_name, value){Processor=value;}};
vm.runInNewContext(await readFile(new URL('../voice-worklet.js',import.meta.url),'utf8'),worklet);
class Context {
  constructor(){ this.destination={}; this.audioWorklet={addModule:async()=>{}}; }
  get currentTime(){return performance.now()/1000;}
  async resume(){}
  async close(){}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{},connect(){return {connect(){}};}};}
  createBuffer(_channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){const source={connect(){},start:when=>{firstAudio??=performance.now()-started;source.timer=setTimeout(()=>source.onended?.(),Math.max(0,when-this.currentTime)*1000+10);},stop(){clearTimeout(source.timer);}};return source;}
}
const messages=[];
const env={window:{},AudioContext:Context,AudioWorkletNode:class {constructor(){capture=this;this.port={};}connect(){return {connect(){return {connect(){}};}};}disconnect(){}},
  navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped=true;}}]})}},
  performance:{now:()=>time},URL,WebSocket,Map,Set,atob, setTimeout,clearTimeout};
vm.runInNewContext(await readFile(new URL('../voice.js',import.meta.url),'utf8'),env);
const session = new env.window.JungVoiceSession({base,initData,status:text=>messages.push(text),socket:url=>{
  const ws=new WebSocket(url);
  ws.addEventListener('message',event=>{if(JSON.parse(event.data).type==='done')completed=true;});return ws;
}});
await session.start();
async function until(check){for(let i=0;i<300;i++){if(check())return;await delay(10);}throw new Error('Synthetic path timed out: '+messages.at(-1));}
await until(()=>session.ready);
const processor=new Processor();
for(let i=0;i<40;i++){time+=128/48;processor.process([[new Float32Array(128).fill(.1)]]);}
for(let i=0;i<320;i++){time+=128/48;processor.process([[new Float32Array(128)]]);}
await until(()=>completed);
assert.ok(firstAudio !== null,'first PCM must reach playback');
assert.equal(session.sources.size,0,'all acknowledged phrases finished playback');
session.stop();
assert.ok(stopped,'microphone released');
console.log(JSON.stringify({path:'worklet -> VAD -> authenticated WebSocket -> STT -> psychologist -> screen -> TTS -> playback -> acknowledgement',first_stub_sound_ms:Math.round(firstAudio),microphone_released:stopped}));
