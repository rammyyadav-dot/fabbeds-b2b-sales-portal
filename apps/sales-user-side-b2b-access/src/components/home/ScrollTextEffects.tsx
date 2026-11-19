import { type ReactNode, useRef } from 'react';
import {
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';

function clampWords(text:string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function RevealWord({
  word,
  index,
  total,
  progress,
  reduced,
}:{
  word:string;
  index:number;
  total:number;
  progress:MotionValue<number>;
  reduced:boolean|null;
}) {
  const start=index/Math.max(total,1);
  const end=Math.min(1,start+Math.max(0.12,1/Math.max(total,1)*2.25));
  const opacity=useTransform(progress,[start,end],[0.18,1]);
  const filter=useTransform(progress,[start,end],['blur(7px)','blur(0px)']);
  const y=useTransform(progress,[start,end],[8,0]);

  return (
    <motion.span
      aria-hidden="true"
      style={reduced?undefined:{opacity,filter,y}}
      className="inline-block mr-[0.26em]"
    >
      {word}
    </motion.span>
  );
}

export function WordReveal({
  text,
  className='',
  as='p',
}:{
  text:string;
  className?:string;
  as?:'p'|'h1'|'h2'|'h3';
}) {
  const ref=useRef<HTMLElement|null>(null);
  const reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start 0.9','end 0.42']});
  const words=clampWords(text);
  const Tag=motion[as] as any;

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((word,index)=>(
        <RevealWord
          key={word+'-'+index}
          word={word}
          index={index}
          total={words.length}
          progress={scrollYProgress}
          reduced={reduced}
        />
      ))}
    </Tag>
  );
}

export function ScrollGradientZoom({
  children,
  className='',
}:{
  children:ReactNode;
  className?:string;
}) {
  const ref=useRef<HTMLDivElement|null>(null);
  const reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start 0.9','end 0.25']});
  const scale=useTransform(scrollYProgress,[0,0.45,1],[0.92,1,1.08]);
  const y=useTransform(scrollYProgress,[0,1],[22,-10]);
  const backgroundPositionX=useTransform(scrollYProgress,[0,1],['0%','100%']);

  return (
    <motion.div
      ref={ref}
      className={'fb-metallic-text '+className}
      style={reduced?undefined:{scale,y,backgroundPositionX}}
    >
      {children}
    </motion.div>
  );
}

export function ParallaxHeadline({
  eyebrow,
  title,
  className='',
}:{
  eyebrow?:string;
  title:string;
  className?:string;
}) {
  const ref=useRef<HTMLDivElement|null>(null);
  const reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']});
  const backY=useTransform(scrollYProgress,[0,1],[60,-90]);
  const frontY=useTransform(scrollYProgress,[0,1],[22,-22]);

  return (
    <div ref={ref} className={'relative overflow-hidden '+className}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[clamp(4rem,12vw,10rem)] font-black tracking-[-0.07em] text-foreground/[0.035] select-none pointer-events-none"
        style={reduced?undefined:{y:backY}}
      >
        {title} · {title}
      </motion.div>
      <motion.div className="relative z-10" style={reduced?undefined:{y:frontY}}>
        {eyebrow&&<p className="fb-kicker text-primary">{eyebrow}</p>}
        <h2 className="fb-display text-4xl md:text-6xl mt-2">{title}</h2>
      </motion.div>
    </div>
  );
}

export function ScrollMarquee({
  items,
  className='',
}:{
  items:string[];
  className?:string;
}) {
  const ref=useRef<HTMLDivElement|null>(null);
  const reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']});
  const x=useTransform(scrollYProgress,[0,1],['3%','-26%']);

  return (
    <div ref={ref} className={'overflow-hidden '+className}>
      <motion.div
        className="flex w-max items-center gap-5 md:gap-8 whitespace-nowrap will-change-transform"
        style={reduced?undefined:{x}}
      >
        {[...items,...items].map((item,index)=>(
          <div key={item+'-'+index} className="flex items-center gap-5 md:gap-8">
            <span className="text-[clamp(1.6rem,4vw,4rem)] font-black tracking-[-0.055em] uppercase">{item}</span>
            <span className="w-2 h-2 rounded-full bg-[#D71921]" />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
