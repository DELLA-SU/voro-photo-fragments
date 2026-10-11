// Gentle browser synthesis, driven by the same time and field as the relief.
export class WaveAudio {
 constructor(){this.context=null;this.volume=.35;}
 async start(){
  if(!this.context){
   const AudioEngine=window.AudioContext||window.webkitAudioContext;
   if(!AudioEngine)throw Error('이 브라우저는 오디오를 지원하지 않습니다.');
   this.context=new AudioEngine();const c=this.context;
   this.master=c.createGain();this.master.gain.value=0;
   this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=1400;this.filter.Q.value=.5;
   this.analyser=c.createAnalyser();this.analyser.fftSize=256;this.samples=new Float32Array(256);
   this.filter.connect(this.master);this.master.connect(this.analyser);this.analyser.connect(c.destination);
   this.voices=[174.61,261.63,349.23].map((frequency,i)=>{
    const oscillator=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();
    oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.value=0;
    oscillator.connect(gain);gain.connect(pan);pan.connect(this.filter);oscillator.start();
    return {oscillator,gain,pan,frequency,weight:[.09,.06,.035][i]};
   });
  }
  await this.context.resume();
 }
 smooth(parameter,value){const now=this.context.currentTime;parameter.cancelScheduledValues(now);parameter.setTargetAtTime(value,now,.08);}
 update(time,signals,active){
  if(!this.context)return 0;
  this.smooth(this.master.gain,active?this.volume:0);
  if(active){
   const swell=.5+.5*Math.sin(time*3.2);
   this.voices.forEach((voice,i)=>{
    const signal=signals[i%signals.length];
    this.smooth(voice.oscillator.frequency,voice.frequency*Math.pow(2,signal*.12));
    this.smooth(voice.gain.gain,voice.weight*(.45+.55*swell)*(.8+.2*signal));
    this.smooth(voice.pan.pan,Math.max(-.75,Math.min(.75,(i-1)*.4+signal*.25)));
   });
   this.smooth(this.filter.frequency,900+1100*swell);
  }
  this.analyser.getFloatTimeDomainData(this.samples);
  return Math.sqrt(this.samples.reduce((sum,v)=>sum+v*v,0)/this.samples.length);
 }
}
