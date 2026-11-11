(function(){
  var $=function(id){return document.getElementById(id)};
  var scene=$('scene'), lid=$('lid'), btn=$('btn'), alarm=$('alarm'), timeEl=$('time');
  var isOpen=false, timer=null, left=10, muted=false;

  // Cilindros apilados en 3D (capas)
  function stack(el,n,sideColor,topColor,step,borderTop){
    for(var i=0;i<n;i++){
      var d=document.createElement('i');
      d.style.transform='translateZ('+(i*step)+'px)';
      d.style.background=i===n-1?topColor:sideColor;
      el.appendChild(d);
    }
  }
  stack($('ring'),9,'#6f8f96','radial-gradient(#d4dde0,#aebbbf)',1.5);
  stack($('cap'),9,'#7a0000','radial-gradient(#f40000,#c00000)',1.5);
  $('cap').style.transform='translateZ(12px)';
  $('cap').dataset.z=12;

  // Escalado responsive
  function fit(){var s=Math.min(innerWidth/380,innerHeight/380,1.6);document.documentElement.style.setProperty('--s',s);document.getElementById('stage').style.setProperty('--s',s)}
  addEventListener('resize',fit);fit();

  // ---------- Audio (sintetizado con Web Audio, sin archivos externos) ----------
  var ctx=null, master=null, siren=null;
  function initAudio(){
    if(ctx) { if(ctx.state==='suspended') ctx.resume(); return; }
    var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    ctx=new AC(); master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
  }
  function beep(f,d,type,vol){
    if(!ctx) return; var o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'square'; o.frequency.value=f; g.gain.setValueAtTime(vol||.15,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+d);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime+d);
  }
  function startSiren(){
    if(!ctx||siren) return;
    var o=ctx.createOscillator(), g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain();
    o.type='sawtooth'; o.frequency.value=800; lfo.type='triangle'; lfo.frequency.value=1.4; lg.gain.value=300;
    g.gain.value=.12; lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(master);
    o.start(); lfo.start(); siren={o:o,lfo:lfo,g:g};
  }
  function stopSiren(){
    if(!siren) return; try{siren.o.stop();siren.lfo.stop()}catch(e){} siren=null;
  }
  function explosion(){
    if(!ctx) return; var len=ctx.sampleRate*2.5, b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
    var s=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain();
    s.buffer=b; f.type='lowpass'; f.frequency.setValueAtTime(3000,ctx.currentTime); f.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+2);
    g.gain.value=.9; s.connect(f); f.connect(g); g.connect(master); s.start();
  }

  $('snd').onclick=function(){
    muted=!muted; this.classList.toggle('muted',muted);
    initAudio(); if(master) master.gain.value=muted?0:1;
  };

  // ---------- Lógica ----------
  function fmt(n){return '00:'+(n<10?'0':'')+n}

  lid.onclick=function(e){
    e.stopPropagation(); initAudio();
    isOpen=!isOpen; scene.classList.toggle('open',isOpen);
    beep(isOpen?500:300,.12,'triangle',.12);
  };

  function press(){
    if(!isOpen) return; initAudio();
    btn.classList.add('pressed'); $('cap').style.transform='translateZ(4px)'; $('cap').classList.add('on');
    beep(220,.15,'square',.2);
    setTimeout(startCountdown,180);
  }
  // zona clickeable del botón (círculo 2D sobre la escena)
  $('cap').onclick=function(e){e.stopPropagation();press()};

  function startCountdown(){
    left=10; timeEl.textContent=fmt(left); alarm.classList.remove('boom'); alarm.classList.add('show');
    startSiren(); clearInterval(timer);
    timer=setInterval(function(){
      left--; timeEl.textContent=fmt(Math.max(left,0)); beep(left<4?1200:900,.1,'square',.1);
      if(left<=0){clearInterval(timer);detonate()}
    },1000);
  }
  function detonate(){
    stopSiren(); alarm.classList.add('boom'); explosion();
    var w=$('white');
    setTimeout(function(){
      w.classList.remove('slow'); w.classList.add('on');
      setTimeout(function(){
        reset(); isOpen=false; scene.classList.remove('open');
        setTimeout(function(){w.classList.add('slow'); w.classList.remove('on')},1800);
      },1500);
    },1000);
  }
  function reset(){
    clearInterval(timer); stopSiren(); alarm.classList.remove('show','boom');
    btn.classList.remove('pressed'); $('cap').style.transform='translateZ(12px)'; $('cap').classList.remove('on');
  }
  $('abort').onclick=function(){reset(); beep(600,.2,'triangle',.15)};
  $('reset').onclick=function(){reset(); isOpen=false; scene.classList.remove('open')};
})();
