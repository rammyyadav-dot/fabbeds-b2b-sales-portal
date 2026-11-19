export const linkedId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
export function periodDates(start:string,end:string,weekdays:number[]){
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!valid(start)||!valid(end)||start>end)throw new Error('Select a valid date range.');
 const span=(Date.parse(end)-Date.parse(start))/86400000+1;
 if(span>366)throw new Error('Maximum validity is 366 calendar days.');
 if(!weekdays.length)throw new Error('Select at least one weekday.');
 const dates:string[]=[];
 for(let ms=Date.parse(start);ms<=Date.parse(end);ms+=86400000){const d=new Date(ms);if(weekdays.includes(d.getUTCDay()))dates.push(d.toISOString().slice(0,10));}
 if(!dates.length)throw new Error('No selected weekdays occur in this period.');
 return dates;
}
export function validatePrices(netAdult:number,netChild:number,retailAdult:number,retailChild:number){
 if([netAdult,netChild,retailAdult,retailChild].some(n=>!Number.isFinite(n)||n<0))throw new Error('Rates must be non-negative numbers.');
 if(netAdult<=0&&netChild<=0)throw new Error('At least one positive net rate is required.');
 if(retailAdult<netAdult||retailChild<netChild)throw new Error('Retail must be at least net for each age band.');
}
