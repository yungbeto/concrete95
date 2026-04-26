'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { X, Maximize2, Shuffle } from 'lucide-react';
import type { AudioEngineHandle } from './AudioEngine';

interface VisualizerWindowProps {
  audioEngineRef: React.RefObject<AudioEngineHandle>;
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

const CANVAS_W = 320;
const CANVAS_H = 200;

// ---------------------------------------------------------------------------
// DNA
// ---------------------------------------------------------------------------

type VisualizerDNA = {
  mode: number;
  speed: number;
  noiseScale: number;
  noisePhase: [number, number];
  offset1: [number, number];
  offset2: [number, number];
  offset3: [number, number];
  warpBase: number;
  palA: [number, number, number];
  palB: [number, number, number];
  palC: [number, number, number];
  palD: [number, number, number];
  waveColor: [number, number, number];
};

const PALETTES = [
  {
    a: [0.5, 0.5, 0.6],
    b: [0.5, 0.4, 0.5],
    c: [1.0, 1.0, 0.8],
    d: [0.0, 0.25, 0.6],
    wave: [0.22, 1.0, 0.32],
  },
  {
    a: [0.6, 0.2, 0.05],
    b: [0.5, 0.3, 0.15],
    c: [1.5, 2.0, 1.0],
    d: [0.0, 0.1, 0.5],
    wave: [1.0, 0.85, 0.2],
  },
  {
    a: [0.1, 0.3, 0.5],
    b: [0.3, 0.4, 0.5],
    c: [0.8, 1.0, 1.2],
    d: [0.1, 0.5, 0.8],
    wave: [0.0, 0.9, 1.0],
  },
  {
    a: [0.2, 0.5, 0.35],
    b: [0.4, 0.5, 0.4],
    c: [1.2, 0.8, 0.6],
    d: [0.0, 0.4, 0.7],
    wave: [0.9, 0.2, 1.0],
  },
  {
    a: [0.75, 0.4, 0.28],
    b: [0.3, 0.4, 0.3],
    c: [1.5, 1.0, 0.5],
    d: [0.1, 0.2, 0.5],
    wave: [1.0, 0.55, 0.1],
  },
  {
    a: [0.1, 0.48, 0.15],
    b: [0.4, 0.48, 0.1],
    c: [2.0, 1.0, 0.5],
    d: [0.0, 0.6, 0.9],
    wave: [0.5, 1.0, 0.0],
  },
  {
    a: [0.25, 0.3, 0.42],
    b: [0.28, 0.28, 0.32],
    c: [1.0, 1.0, 1.0],
    d: [0.6, 0.7, 0.8],
    wave: [0.85, 0.9, 1.0],
  },
] as const;

// ---------------------------------------------------------------------------
// GLSL — shared header (uniforms + utility fns)
// ---------------------------------------------------------------------------

const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Uniforms packed into vec4s: worst-case 10 slots (WebGL 1.0 min = 16).
const HDR = `
precision mediump float;
varying vec2 v_uv;

uniform float     u_time;
uniform vec4      u_audio;    // bass, mid, high, aspect
uniform sampler2D u_waveform;

uniform vec4 u_dna;           // speed, noise_scale, warp_base, 0
uniform vec4 u_phase_o1;      // phase.xy, offset1.xy
uniform vec4 u_o2_o3;         // offset2.xy, offset3.xy

uniform vec3 u_pal_a;
uniform vec3 u_pal_b;
uniform vec3 u_pal_c;
uniform vec3 u_pal_d;
uniform vec3 u_wave_color;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;}
  return v;
}

vec3 cospalette(float t){
  return u_pal_a+u_pal_b*cos(6.28318*(u_pal_c*t+u_pal_d));
}

void waveLine(vec2 uv_sc, inout vec3 col){
  float r=length(uv_sc);
  // Symmetric sampling: angle folds 0→0.5→0 as the circle goes around.
  // Both endpoints of the fold land on the same texture value, so the
  // ring is always continuous with no seam.  Seam sits at 6 o'clock
  // (bottom), waveform origin at 12 o'clock (top).
  float a=fract(atan(uv_sc.y,uv_sc.x)/6.28318+0.25);
  float symA=abs(a-0.5); // 0.5→0→0.5, both ends identical
  float w=(texture2D(u_waveform,vec2(symA,0.5)).r-0.5)*2.0;
  float tR=0.48+w*0.16*(1.0+u_audio.x);
  float rD=abs(r-tR);
  col=mix(col,u_wave_color,smoothstep(0.032,0.0,rD));
  col+=u_wave_color*0.35*smoothstep(0.11,0.0,rD);
}
`;

// ---------------------------------------------------------------------------
// Mode 0 — Plasma (domain-warped fbm)
// ---------------------------------------------------------------------------
const FS_PLASMA =
  HDR +
  `
void main(){
  float bass=u_audio.x,mid=u_audio.y,high=u_audio.z,aspect=u_audio.w;
  float speed=u_dna.x,sc=u_dna.y,warpBase=u_dna.z;
  vec2 phase=u_phase_o1.xy,o1=u_phase_o1.zw,o2=u_o2_o3.xy,o3=u_o2_o3.zw;
  vec2 uv=(v_uv*2.0-1.0)*vec2(aspect,1.0);
  float t=u_time*speed,pulse=1.0+bass*0.55;
  vec2 q=vec2(fbm(uv*sc+phase+t*0.28),fbm(uv*sc+o1+phase+t*0.22));
  float wa=warpBase+mid*2.5;
  vec2 r=vec2(fbm(uv*sc*0.8+wa*q+o2+t*0.20),fbm(uv*sc*0.8+wa*q+o3+t*0.16));
  float f=clamp(fbm(uv*pulse*sc*0.7+4.0*r),0.0,1.0);
  vec3 col=cospalette(f)*0.85;
  float dist=length(uv/vec2(aspect,1.0));
  col+=u_wave_color*0.5*bass*max(0.0,1.35-dist*1.9);
  float spk=hash(floor(uv*22.0+t*6.0));
  col+=u_wave_color*step(1.0-high*0.4,spk)*high*0.7;
  waveLine(uv,col);
  col*=clamp(1.0-dot(v_uv*2.0-1.0,v_uv*2.0-1.0)*0.35,0.0,1.0);
  gl_FragColor=vec4(col,1.0);
}
`;

// ---------------------------------------------------------------------------
// Mode 1 — Starfield (angular sectors, each star has independent depth phase)
// ---------------------------------------------------------------------------
const FS_STARFIELD =
  HDR +
  `
void main(){
  float bass=u_audio.x,high=u_audio.z,aspect=u_audio.w;
  float t=u_time*u_dna.x*0.5;
  vec2 uv=(v_uv*2.0-1.0)*vec2(aspect,1.0);
  vec3 col=vec3(0.0,0.01,0.04);
  float PI2=6.28318;

  // Normalize angle to [0,1) with no seam discontinuity
  float normAng=fract(atan(uv.y,uv.x)/PI2+1.0);

  for(int layer=0;layer<3;layer++){
    float lf=float(layer);
    float N=32.0+lf*20.0; // 32 / 52 / 72 angular sectors
    float curSec=floor(normAng*N);

    // Check current sector and its two neighbours
    for(int di=-1;di<=1;di++){
      float s=mod(curSec+float(di),N);
      float h1=hash(vec2(s,lf*13.7+1.0)); // angle jitter
      float h2=hash(vec2(s,lf*13.7+2.0)); // speed jitter
      float h3=hash(vec2(s,lf*13.7+3.0)); // INDEPENDENT phase per star

      // Star direction: sector angle + small random jitter
      float sa=(s+0.5+(h1-0.5)*0.85)/N*PI2;
      vec2 dir=vec2(cos(sa),sin(sa));

      // Each star cycles at its own phase → never all reset at once
      float spd=(0.04+lf*0.025+h2*0.06)*(1.0+bass*1.5);
      float depth=fract(h3+t*spd);

      vec2 sPos=dir*depth*1.8;
      float d=length(uv-sPos);

      // Size grows with depth (perspective), smooth fade in + fade out envelope
      float sz=0.004+depth*0.03*(1.0+high*0.5);
      float env=smoothstep(0.0,0.12,depth)*(1.0-smoothstep(0.82,1.0,depth));
      float b=smoothstep(sz,0.0,d)*env*(0.4+depth*0.8);
      col+=cospalette(h1)*b;
    }
  }

  col*=smoothstep(2.0,0.15,length(uv));
  waveLine(uv,col);
  gl_FragColor=vec4(col,1.0);
}
`;

// ---------------------------------------------------------------------------
// Mode 2 — Warp Tunnel (polar / concentric rings)
// ---------------------------------------------------------------------------
const FS_TUNNEL =
  HDR +
  `
void main(){
  float bass=u_audio.x,mid=u_audio.y,high=u_audio.z,aspect=u_audio.w;
  float t=u_time*u_dna.x;
  vec2 uv=(v_uv*2.0-1.0)*vec2(aspect,1.0);
  float r=max(length(uv),0.001);

  // fract normalises to [0,1) with no discontinuity at the atan wrap point
  float normAng=fract(atan(uv.y,uv.x)/6.28318+1.0);

  float depth=fract(0.4/r-t*0.35*(1.0+bass));

  // Integer stripe count → exactly N complete cycles around the circle → seamless
  float numStripes=floor(6.0+u_dna.y*12.0);
  float stripes=sin(normAng*6.28318*numStripes+t*1.5)*0.5+0.5;
  float rings  =sin(depth*25.0+t*0.5)*0.5+0.5;

  // Angular noise sampled on a 2-D circle path → seamless by construction
  float na=normAng*6.28318;
  vec2 angVec=vec2(cos(na),sin(na))*2.0;
  float det=fbm(angVec+vec2(depth*1.5,t*0.1))*mid;

  float f=clamp(stripes*rings+det*0.4,0.0,1.0);
  vec3 col=cospalette(f+depth*0.3+t*0.04);
  col*=smoothstep(0.0,0.09,r);
  col*=1.0-smoothstep(0.75,1.5,r);
  col+=u_wave_color*0.18*high*(1.0-smoothstep(0.0,0.5,r));
  waveLine(uv,col);
  gl_FragColor=vec4(col,1.0);
}
`;

// ---------------------------------------------------------------------------
// Mode 3 — Lava Lamp (5 metaballs)
// ---------------------------------------------------------------------------
const FS_LAVA =
  HDR +
  `
void main(){
  float bass=u_audio.x,mid=u_audio.y,high=u_audio.z,aspect=u_audio.w;
  float t=u_time*u_dna.x*0.6;
  vec2 uv=(v_uv*2.0-1.0)*vec2(aspect,1.0);
  float sum=0.0;
  float ph=u_phase_o1.x;
  for(int i=0;i<5;i++){
    float fi=float(i);
    float px=fi*1.618+ph;
    vec2 c=vec2(
      sin(t*(0.41+fi*0.13)+px)    *(0.55+bass*0.25),
      cos(t*(0.29+fi*0.17)+px*1.3)*(0.65+mid*0.20)
    );
    float d=length(uv-c);
    sum+=(0.18+mid*0.08)/(d*d+0.01);
  }
  float iso =clamp((sum-2.2)*0.6,0.0,1.0);
  float glow=clamp((sum-0.9)*0.1,0.0,1.0);
  vec3 col=cospalette(iso+t*0.04)*iso;
  col+=cospalette(glow+t*0.06+0.3)*glow*0.5;
  col+=u_wave_color*0.14*high*iso;
  waveLine(uv,col);
  gl_FragColor=vec4(col,1.0);
}
`;

// ---------------------------------------------------------------------------
// Mode 4 — CRT Dither (pixelated plasma + Bayer-ish dither + scanlines)
// ---------------------------------------------------------------------------
const FS_CRT =
  HDR +
  `
void main(){
  float bass=u_audio.x,mid=u_audio.y,high=u_audio.z,aspect=u_audio.w;
  float t=u_time*u_dna.x;
  vec2 res=vec2(80.0,50.0);
  vec2 pUV=(floor(v_uv*res)+0.5)/res;
  vec2 uv=pUV*2.0-1.0; uv.x*=aspect;
  float sc=u_dna.y*3.0;
  vec2 ph=u_phase_o1.xy;
  float f=sin(uv.x*sc    +t   +ph.x)
         +sin(uv.y*sc*0.8+t*1.2+ph.y)
         +sin((uv.x+uv.y)*sc*0.6+t*0.7)
         +sin(length(uv)*sc*1.5-t*1.4);
  f=f*0.25+0.5+bass*0.2;
  vec3 col=cospalette(fract(f));
  col=floor(col*8.0)/8.0;
  vec2 bp=mod(floor(v_uv*res*2.0),4.0);
  float dith=hash(bp+vec2(t*31.0))*0.13-0.065;
  col=clamp(col+dith,0.0,1.0);
  col=floor(col*8.0)/8.0;
  float scan=mod(floor(v_uv.y*res.y),2.0);
  col*=0.80+0.20*scan;
  vec2 spPos=floor(v_uv*res);
  col+=u_wave_color*step(1.0-high*0.5,hash(spPos+vec2(t*17.0)))*high*0.9;
  waveLine(uv,col);
  gl_FragColor=vec4(col,1.0);
}
`;

// ---------------------------------------------------------------------------
// Mode 5 — Kaleidoscope (N-fold mirror + fbm plasma)
// ---------------------------------------------------------------------------
const FS_KALEIDO =
  HDR +
  `
void main(){
  float bass=u_audio.x,mid=u_audio.y,high=u_audio.z,aspect=u_audio.w;
  float t=u_time*u_dna.x;
  vec2 uv=(v_uv*2.0-1.0)*vec2(aspect,1.0);
  float r=length(uv);
  float a=atan(uv.y,uv.x);
  float N=floor(3.0+u_dna.y*5.0);
  float slice=6.28318/N;
  float fa=mod(a+t*0.04,slice);
  if(fa>slice*0.5) fa=slice-fa;
  vec2 p=vec2(cos(fa),sin(fa))*r;
  float sc=u_dna.y*0.9+0.3;
  vec2 ph=u_phase_o1.xy,o1=u_phase_o1.zw;
  vec2 q=vec2(fbm(p*sc+ph+t*0.22),fbm(p*sc+o1+ph+t*0.18));
  float wa=u_dna.z+mid*1.8;
  float f=clamp(fbm(p*sc*0.85+wa*q+t*0.12),0.0,1.0);
  vec3 col=cospalette(f+r*0.25+t*0.04);
  col*=1.0-r*0.45;
  col*=1.0+bass*0.5;
  col+=u_wave_color*0.2*high*(1.0-smoothstep(0.0,0.6,r));
  waveLine(uv,col);
  gl_FragColor=vec4(col,1.0);
}
`;

const MODES = [
  { name: 'Plasma', fs: FS_PLASMA },
  { name: 'Starfield', fs: FS_STARFIELD },
  { name: 'Tunnel', fs: FS_TUNNEL },
  { name: 'Lava Lamp', fs: FS_LAVA },
  { name: 'CRT Dither', fs: FS_CRT },
  { name: 'Kaleidoscope', fs: FS_KALEIDO },
];

// ---------------------------------------------------------------------------
// DNA helpers (defined after MODES so MODES.length is available)
// ---------------------------------------------------------------------------

function rng(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}
function rngOffset(): [number, number] {
  const s = () => (Math.random() > 0.5 ? 1 : -1);
  return [rng(2.5, 9.5) * s(), rng(2.5, 9.5) * s()];
}

function generateDNA(): VisualizerDNA {
  const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  return {
    mode: Math.floor(Math.random() * MODES.length),
    speed: rng(0.55, 1.45),
    noiseScale: rng(0.55, 1.2),
    noisePhase: [rng(-25, 25), rng(-25, 25)],
    offset1: rngOffset(),
    offset2: rngOffset(),
    offset3: rngOffset(),
    warpBase: rng(2.4, 4.8),
    palA: [...pal.a] as [number, number, number],
    palB: [...pal.b] as [number, number, number],
    palC: [...pal.c] as [number, number, number],
    palD: [...pal.d] as [number, number, number],
    waveColor: [...pal.wave] as [number, number, number],
  };
}

// ---------------------------------------------------------------------------
// WebGL helpers
// ---------------------------------------------------------------------------

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

type DynUniforms = {
  time: WebGLUniformLocation | null;
  audio: WebGLUniformLocation | null;
};

type GLState = {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  tex: WebGLTexture;
  uniforms: DynUniforms;
};

function initGLOnCanvas(
  canvas: HTMLCanvasElement,
  dna: VisualizerDNA,
): GLState | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, MODES[dna.mode].fs);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.LUMINANCE,
    1024,
    1,
    0,
    gl.LUMINANCE,
    gl.UNSIGNED_BYTE,
    new Uint8Array(1024).fill(128),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.useProgram(prog);

  const loc = (name: string) => gl.getUniformLocation(prog, name);
  gl.uniform1i(loc('u_waveform'), 0);
  gl.uniform4f(loc('u_dna'), dna.speed, dna.noiseScale, dna.warpBase, 0.0);
  gl.uniform4f(
    loc('u_phase_o1'),
    dna.noisePhase[0],
    dna.noisePhase[1],
    dna.offset1[0],
    dna.offset1[1],
  );
  gl.uniform4f(
    loc('u_o2_o3'),
    dna.offset2[0],
    dna.offset2[1],
    dna.offset3[0],
    dna.offset3[1],
  );
  gl.uniform3fv(loc('u_pal_a'), dna.palA);
  gl.uniform3fv(loc('u_pal_b'), dna.palB);
  gl.uniform3fv(loc('u_pal_c'), dna.palC);
  gl.uniform3fv(loc('u_pal_d'), dna.palD);
  gl.uniform3fv(loc('u_wave_color'), dna.waveColor);

  return {
    gl,
    prog,
    tex,
    uniforms: { time: loc('u_time'), audio: loc('u_audio') },
  };
}

function drawFrame(
  state: GLState,
  t: number,
  bass: number,
  mid: number,
  high: number,
  waveBytes: Uint8Array,
  w: number,
  h: number,
) {
  const { gl, tex, uniforms } = state;
  gl.viewport(0, 0, w, h);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    waveBytes.length,
    1,
    gl.LUMINANCE,
    gl.UNSIGNED_BYTE,
    waveBytes,
  );
  gl.uniform1f(uniforms.time, t);
  gl.uniform4f(uniforms.audio, bass, mid, high, w / h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MIN_W = 200;
const MIN_H = 140;

export default function VisualizerWindow({
  audioEngineRef,
  position,
  zIndex,
  onClose,
  onMouseDown,
  onTouchStart,
}: VisualizerWindowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [genKey, setGenKey] = useState(0);
  // Outer window pixel size — canvas fills the interior via flex
  const [size, setSize] = useState({ w: CANVAS_W + 24, h: CANVAS_H + 68 });

  const dnaRef = useRef<VisualizerDNA>(generateDNA());
  const [modeName, setModeName] = useState<string>(
    () => MODES[dnaRef.current.mode].name,
  );

  const windowRef = useRef<HTMLDivElement>(null);
  const glStateRef = useRef<GLState | null>(null);
  const fsGlStateRef = useRef<GLState | null>(null);
  const animIdRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  // --- Freeform resize ---
  const resizeDragRef = useRef<{
    handle: 's' | 'e' | 'se';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: 's' | 'e' | 'se') => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startW: size.w,
        startH: size.h,
      };
    },
    [size.w, size.h],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = resizeDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setSize({
        w: d.handle === 's' ? d.startW : Math.max(MIN_W, d.startW + dx),
        h: d.handle === 'e' ? d.startH : Math.max(MIN_H, d.startH + dy),
      });
    };
    const onUp = () => {
      resizeDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Keep canvas pixel dimensions in sync with its CSS layout size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const handleShuffle = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    glStateRef.current = null;
    fsGlStateRef.current = null;
    dnaRef.current = generateDNA();
    setModeName(MODES[dnaRef.current.mode].name);
    setGenKey((k) => k + 1);
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!glStateRef.current) {
      const state = initGLOnCanvas(canvas, dnaRef.current);
      if (!state) return;
      glStateRef.current = state;
    }

    const silentWave = new Uint8Array(1024).fill(128);

    const loop = () => {
      animIdRef.current = requestAnimationFrame(loop);
      const t = (performance.now() - startTimeRef.current) / 1000;
      const data = audioEngineRef.current?.getVisualizerData?.();

      let bass = 0,
        mid = 0,
        high = 0;
      let waveBytes = silentWave;

      if (data) {
        const freq = data.frequency;
        for (let i = 0; i <= 10; i++) bass += freq[i];
        bass = bass / 11 / 255;
        for (let i = 10; i <= 130; i++) mid += freq[i];
        mid = mid / 121 / 255;
        for (let i = 130; i <= 400; i++) high += freq[i];
        high = high / 271 / 255;
        const wf = data.waveform;
        const wb = new Uint8Array(Math.min(wf.length, 1024));
        for (let i = 0; i < wb.length; i++)
          wb[i] = Math.round((wf[i] * 0.5 + 0.5) * 255);
        waveBytes = wb;
      }

      // Read actual pixel dimensions so the viewport tracks resizes automatically
      if (glStateRef.current && canvasRef.current) {
        const { width: cw, height: ch } = canvasRef.current;
        drawFrame(
          glStateRef.current,
          t,
          bass,
          mid,
          high,
          waveBytes,
          cw || CANVAS_W,
          ch || CANVAS_H,
        );
      }

      if (fsGlStateRef.current && fsCanvasRef.current) {
        const fc = fsCanvasRef.current;
        drawFrame(
          fsGlStateRef.current,
          t,
          bass,
          mid,
          high,
          waveBytes,
          fc.width,
          fc.height,
        );
      }
    };

    animIdRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animIdRef.current);
      glStateRef.current = null;
    };
  }, [audioEngineRef, genKey]);

  // Fullscreen GL context
  useEffect(() => {
    if (!isFullscreen) {
      fsGlStateRef.current = null;
      return;
    }
    const id = setTimeout(() => {
      const canvas = fsCanvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      fsGlStateRef.current = initGLOnCanvas(canvas, dnaRef.current);
    }, 50);
    return () => clearTimeout(id);
  }, [isFullscreen, genKey]);

  // Resize fullscreen canvas
  useEffect(() => {
    if (!isFullscreen) return;
    const onResize = () => {
      const c = fsCanvasRef.current;
      if (c) {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isFullscreen]);

  // Escape exits fullscreen; R shuffles while fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === 'r' || e.key === 'R') handleShuffle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, handleShuffle]);

  return (
    <>
      <div
        ref={windowRef}
        tabIndex={-1}
        className='bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 font-sans absolute select-none flex flex-col overflow-hidden outline-none'
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex,
          width: `${size.w}px`,
          height: `${size.h}px`,
        }}
        onMouseDownCapture={() => windowRef.current?.focus()}
        onKeyDown={(e) => {
          if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            handleShuffle();
          }
        }}
      >
        {/* Title bar */}
        <div
          className='bg-blue-800 text-white flex items-center justify-between p-1 cursor-move shrink-0'
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <div className='flex items-center gap-1 min-w-0'>
            <Image
              src='/visualizer.png'
              alt=''
              width={16}
              height={16}
              className='w-4 h-4 object-contain shrink-0'
            />
            <span className='font-bold text-xs truncate'>
              Visualizer — {modeName}
            </span>
          </div>
          <div className='flex items-center gap-1 shrink-0'>
            <Button
              variant='retro'
              size='icon'
              className='w-5 h-5'
              onClick={(e) => {
                e.stopPropagation();
                handleShuffle();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title='New random visualizer'
            >
              <Shuffle className='w-3 h-3 text-black' />
            </Button>
            <Button
              variant='retro'
              size='icon'
              className='w-5 h-5'
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title='Fullscreen screensaver'
            >
              <Maximize2 className='w-3 h-3 text-black' />
            </Button>
            <Button
              variant='retro'
              size='icon'
              className='w-5 h-5'
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <X className='w-3 h-3 text-black' />
            </Button>
          </div>
        </div>

        {/* Canvas — flex-1 so it fills whatever height remains after the title bar */}
        <div
          className='flex-1 p-2 flex flex-col min-h-0'
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className='flex-1 min-h-0 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white'>
            <canvas ref={canvasRef} className='block w-full h-full' />
          </div>
          <p className='text-[10px] text-neutral-600 mt-1 text-center select-none shrink-0'>
            <Shuffle className='inline w-2.5 h-2.5 mr-0.5' />
            shuffle [R] &nbsp;·&nbsp;
            <Maximize2 className='inline w-2.5 h-2.5 mr-0.5' />
            screensaver
          </p>
        </div>

        {/* Resize handles — south, east, SE corner */}
        <div
          className='absolute bottom-0 left-0 right-3 h-1 z-10'
          style={{ cursor: 's-resize' }}
          onMouseDown={(e) => onResizeMouseDown(e, 's')}
        />
        <div
          className='absolute right-0 bottom-3 w-1 z-10'
          style={{ cursor: 'e-resize', top: '28px' }}
          onMouseDown={(e) => onResizeMouseDown(e, 'e')}
        />
        <div
          className='absolute bottom-0 right-0 w-3 h-3 z-10'
          style={{ cursor: 'se-resize' }}
          onMouseDown={(e) => onResizeMouseDown(e, 'se')}
        />
      </div>

      {isFullscreen && (
        <div
          className='fixed inset-0 bg-black z-[9999]'
          style={{ cursor: 'none' }}
          onClick={() => setIsFullscreen(false)}
        >
          <canvas ref={fsCanvasRef} className='block w-full h-full' />
          <div
            className='absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-sm font-sans pointer-events-none'
            style={{ animation: 'fadeOutHint 3s forwards 2s' }}
          >
            {modeName} · Click or Esc to exit • R to shuffle
          </div>
          <style>{`@keyframes fadeOutHint{from{opacity:1}to{opacity:0}}`}</style>
        </div>
      )}
    </>
  );
}
