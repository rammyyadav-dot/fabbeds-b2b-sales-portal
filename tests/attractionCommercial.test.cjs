const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const root=process.cwd(),store={},cache={};let sequence=0,failRateAt=0,rateCreates=0;
const zite={};
for(const name of ['attractionRatePlans','attractionRatePeriods','ticketOptions','attractionRates','attractionInventoryHolds','attractionRateAuditEvents','attractionBlackouts','attractionEvents','attractionMealPlans','attractions','attractionAvailability']){
 store[name]=[];
 zite[name]={
 findOne:async({id,filters})=>id?store[name].find(r=>r.id===id):store[name].find(r=>Object.entries(filters||{}).every(([k,v])=>r[k]===v)),
 findAll:async({filters={},offset=0,limit=2000}={})=>({records:store[name].filter(r=>Object.entries(filters).every(([k,v])=>{
 if(v&&typeof v==='object')return Object.entries(v).every(([op,n])=>op==='in'?n.includes(r[k]):op==='gte'?String(r[k])>=String(n):op==='lte'?String(r[k])<=String(n):true);
 return r[k]===v;
 })).slice(offset,offset+limit)}),
 create:async({record})=>{if(name==='attractionRates'&&failRateAt&&++rateCreates===failRateAt)throw new Error('Injected write failure');const row={...record,id:'row-'+(++sequence),rateId:sequence};store[name].push(row);return row;},
 update:async({id,record})=>{const row=store[name].find(r=>r.id===id);if(!row)throw new Error('Missing row');Object.assign(row,record);return row;}
 };
}
zite.sql=async({query,params})=>{
 if(query.startsWith('SELECT r.*'))return{rows:store.attractionRates.filter(r=>r.ratePlan===params[0]&&r.date>=params[1]&&r.date<=params[2])};
 if(query.includes('COUNT(')){const rows=store.attractionRates.filter(r=>r.ratePeriod===params[0]);return{rows:[{count:rows.length,days:new Set(rows.map(r=>r.date)).size}]};}
 if(query.includes('LOWER(p.'))return{rows:store.attractionRatePlans.filter(p=>p.ticketProduct===params[0]&&p.planName.toLowerCase()===params[1].toLowerCase())};
 throw new Error('Unhandled SQL: '+query);
};
class ZiteError extends Error{constructor(o){super(o.message);this.code=o.code;}}
function load(file){
 file=path.resolve(root,file);if(cache[file])return cache[file].exports;
 const module={exports:{}};cache[file]=module;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const req=(id)=>{
 if(id==='zitejs/db')return{zite};
 if(id==='zitejs/backend')return{createEndpoint:x=>x,ZiteError};
 if(id.endsWith('/requireAdmin'))return{requireAdmin:async(c)=>{if(!c.user?.email)throw new ZiteError({code:'UNAUTHORIZED',message:'Verified Admin session required'});return{email:c.user.email};}};
 if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'));
 return require(id);
 };
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,Date,Map,Set,Number,String,Error})(req,module,module.exports);
 return module.exports;
}
const admin='apps/admin-extranet/src/';
const operations=load(admin+'api/saveAttractionOperation.ts').default;
const rules=load(admin+'lib/attractionCommercialRules.ts'),bulk=load(admin+'api/bulkLoadAttractionRates.ts').default,period=load(admin+'api/updateAttractionRatePeriod.ts').default;
const visible=load('apps/sales-user-side-b2b-access/src/lib/attractionCommercial.ts').commercialRates;
const context={user:{email:'admin@example.test'}};
const call=(endpoint,input)=>endpoint.execute({input:endpoint.inputSchema.parse(input),context});
const base={ticketOptionId:'ticket',ratePlanId:'standard',startDate:'2027-01-03',endDate:'2027-01-09',selectedWeekdays:[0,1,2,3,4,5,6],netAdult:100,netChild:50,retailAdult:120,retailChild:60,totalCapacity:20,inventoryStatus:'Available',stopSale:false,cutoffHours:4,rateLayer:'BASE',priority:0};
(async()=>{
 assert.equal(rules.periodDates('2028-02-28','2028-03-01',[0,1,2,3,4,5,6]).length,3);
 assert.equal(rules.periodDates(base.startDate,base.endDate,[1,2,3,4,5]).length,5);
 assert.throws(()=>rules.periodDates('2027-02-30','2027-03-01',[1]),/valid date/);
 assert.throws(()=>rules.periodDates('2027-01-01','2028-01-02',[1]),/366/);
 assert.throws(()=>rules.periodDates(base.startDate,base.endDate,[]),/weekday/);
 assert.throws(()=>rules.validatePrices(100,50,99,60),/Retail/);
 store.attractions.push({id:'attr'});
 store.ticketOptions.push({id:'ticket',status:'Active',attraction:'attr'});
 store.attractionRatePlans.push({id:'standard',ticketProduct:'ticket',planName:'Standard',status:'Active',cancellationPolicy:'Non-Refundable'},{id:'prime',ticketProduct:'ticket',planName:'Prime',status:'Active'});
 await assert.rejects(()=>bulk.execute({input:bulk.inputSchema.parse(base),context:{}}),/Admin/);
 const first=await call(bulk,base);assert.equal(first.created,7);assert.equal(store.attractionRates.length,7);assert.equal((await visible(store.attractionRates)).length,7);
 await assert.rejects(()=>call(bulk,base),/Overlapping/);assert.equal(store.attractionRates.length,7);
 const separate=await call(bulk,{...base,ratePlanId:'prime'});assert.equal(separate.created,7);
 const old=store.attractionRates.find(r=>r.ratePlan==='standard');old.soldCount=3;
 store.attractionInventoryHolds.push({id:'hold',attractionRate:old.id,status:'ACTIVE',expiresAt:new Date(Date.now()+600000).toISOString(),heldPax:2});
 await assert.rejects(()=>call(bulk,{...base,totalCapacity:4,overlapAction:'override'}),/sold \+ held/);assert.equal(old.totalCapacity,20);
 const changed=await call(bulk,{...base,netAdult:110,overlapAction:'override'});assert.equal(changed.updated,7);assert.equal(old.soldCount,3);assert.equal(old.netCostAdult,110);
 await call(period,{periodId:changed.periodId,action:'stop'});assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePlan==='standard').length,0);assert.equal(old.totalCapacity,20);assert.equal(old.netCostAdult,110);
 await call(period,{periodId:changed.periodId,action:'resume'});assert.equal((await visible(store.attractionRates)).length,14);
 await assert.rejects(()=>call(bulk,{...base,overlapAction:'secondary'}),/unused/);
 const secondary=await call(bulk,{...base,priority:1,overlapAction:'secondary'});assert.equal(secondary.created,7);assert.equal((await visible(store.attractionRates)).length,14);
 await call(period,{periodId:secondary.periodId,action:'stop'});assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePlan==='standard').length,0,'no fallback when higher tier is stopped');
 await call(period,{periodId:secondary.periodId,action:'resume'});
 const draft=await call(bulk,{...base,startDate:'2027-02-01',endDate:'2027-02-02',publish:false});assert.equal(draft.status,'Draft');assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePeriod===draft.periodId).length,0);
 await call(period,{periodId:draft.periodId,action:'publish'});assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePeriod===draft.periodId).length,2);
 const prime=store.attractionRatePlans.find(p=>p.id==='prime');prime.markets='AE,SA';prime.promoCode='TEST';
 assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePlan==='prime').length,0);
 assert.equal((await visible(store.attractionRates,{market:'AE',promoCode:'TEST'})).filter(r=>r.ratePlan==='prime').length,7);
 failRateAt=2;rateCreates=0;
 await assert.rejects(()=>call(bulk,{...base,startDate:'2027-03-01',endDate:'2027-03-03'}),/failed after 1 rows/);
 const failed=store.attractionRatePeriods.find(p=>p.status==='Failed');assert.ok(failed);assert.equal((await visible(store.attractionRates)).filter(r=>r.ratePeriod===failed.id).length,0);
 failRateAt=0;
 const retried=await call(bulk,{...base,startDate:'2027-03-01',endDate:'2027-03-03',periodId:failed.id});assert.equal(retried.created+retried.updated,3);assert.equal(store.attractionRates.filter(r=>r.ratePeriod===failed.id).length,3);

 await assert.rejects(()=>call(operations,{attractionId:'attr',kind:'blackout',name:'Invalid',start:'2027-02-30',end:'2027-03-01'}),/valid inclusive/);
 store.ticketOptions.push({id:'other-ticket',attraction:'other-attr',status:'Active'});
 await assert.rejects(()=>call(operations,{attractionId:'attr',ticketId:'other-ticket',kind:'event',name:'Event',start:'2027-01-03',end:'2027-01-04'}),/another attraction/);
 const blackout=await call(operations,{attractionId:'attr',kind:'blackout',name:'Supplier closure',start:'2027-01-03',end:'2027-01-04'});
 assert.equal((await visible(store.attractionRates,{market:'AE',promoCode:'TEST'})).filter(r=>r.date==='2027-01-03'||r.date==='2027-01-04').length,0);
 await call(operations,{id:blackout.id,attractionId:'attr',kind:'blackout',name:'Supplier closure',start:'2027-01-03',end:'2027-01-04',status:'Inactive'});
 assert.equal((await visible(store.attractionRates,{market:'AE',promoCode:'TEST'})).filter(r=>r.date==='2027-01-03').length,2);
 const scoped=await call(operations,{attractionId:'attr',ticketId:'ticket',kind:'blackout',name:'Single SKU',start:'2027-02-01',end:'2027-02-01'});
 assert.equal((await visible(store.attractionRates)).filter(r=>r.date==='2027-02-01').length,0);
 await call(operations,{attractionId:'attr',kind:'meal',name:'Buffet',code:'BUFFET',notes:'Lunch included'});
 await assert.rejects(()=>call(operations,{attractionId:'attr',kind:'meal',name:'Duplicate Buffet',code:'buffet'}),/already exists/);
 await call(operations,{attractionId:'attr',kind:'event',name:'Festival',start:'2027-01-03',end:'2027-01-04',notes:'Plan rates separately'});

 const calendar=load(admin+'api/getAttractionRateCalendar.ts').default;
 const feb=await call(calendar,{ticketOptionId:'ticket',month:'2027-02'});
 assert.equal(feb.days.find(d=>d.date==='2027-02-01').status,'Stop Sale');
 assert.equal(feb.days.find(d=>d.date==='2027-02-01').sellable,0);
 const jan=await call(calendar,{ticketOptionId:'ticket',month:'2027-01'});
 assert.equal(jan.days.find(d=>d.date==='2027-01-03').rows.length,2,'effective tiers only; no duplicate allocation totals');
 store.attractionRates.push({id:'adult-only',ticketOption:'ticket',date:'2027-04-01',netCostAdult:100,netCostChild:0,totalCapacity:10,inventoryStatus:'Available'});
 const april=await call(calendar,{ticketOptionId:'ticket',month:'2027-04'});
 assert.equal(april.days.find(d=>d.date==='2027-04-01').minChild,null);
 calendar.outputSchema.parse(april);

 const revision=load('shared/attractionPolicy.ts').attractionRateRevision;
 const saveCells=load(admin+'api/saveAttractionCalendarRates.ts').default;
 const adultRow=store.attractionRates.find(r=>r.id==='adult-only');
 const beforeRevision=revision(adultRow);
 const edited=await call(saveCells,{attractionId:'attr',ticketId:'ticket',edits:[{rateId:adultRow.id,revision:beforeRevision,adult:125}]});
 assert.equal(edited.saved.length,1);assert.equal(adultRow.netCostAdult,125);assert.equal(adultRow.retailAdult,125);
 await assert.rejects(()=>call(saveCells,{attractionId:'attr',ticketId:'ticket',edits:[{rateId:adultRow.id,revision:beforeRevision,adult:140}]}),/row changed/);
 await assert.rejects(()=>call(saveCells,{attractionId:'attr',ticketId:'other-ticket',edits:[{rateId:adultRow.id,revision:revision(adultRow),adult:140}]}),/this attraction/);
 const currentRate=store.attractionRates.find(r=>r.ratePlan==='standard'&&r.priority===0&&r.date==='2027-01-03');
 await assert.rejects(()=>call(saveCells,{attractionId:'attr',ticketId:'ticket',planId:'standard',edits:[{rateId:currentRate.id,revision:revision(currentRate),allocation:4}]}),/sold \+ active holds/);
 const bulkChange=load(admin+'api/bulkChangeAttractionCalendarRates.ts').default;
 const changedCells=await call(bulkChange,{attractionId:'attr',ticketId:'ticket',planId:'standard',start:'2027-03-01',end:'2027-03-03',weekdays:[0,1,2,3,4,5,6],operation:'percent',adjustment:10});
 assert.equal(changedCells.saved,3);assert.equal(store.attractionRates.find(r=>r.date==='2027-03-01').netCostAdult,110);
 const paint=load(admin+'api/saveAttractionAvailability.ts').default;
 const painted=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-04-01',status:'Stop Sale',revision:''}]});
 assert.equal(painted.saved.length,1);assert.equal((await visible(store.attractionRates)).filter(r=>r.date==='2027-04-01').length,0);assert.equal(adultRow.netCostAdult,125);
 const limited=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-04-01',status:'Limited',allocation:3,revision:painted.saved[0].revision}]});
 assert.equal(limited.saved.length,1);assert.equal((await visible(store.attractionRates)).find(r=>r.date==='2027-04-01').totalCapacity,3);assert.equal(adultRow.totalCapacity,10,'contracted allocation preserved');
 const restored=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-04-01',status:'Free Sale',revision:limited.saved[0].revision}]});
 assert.equal(restored.saved.length,1);assert.equal((await visible(store.attractionRates)).find(r=>r.date==='2027-04-01').totalCapacity,10);
 const stalePaint=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-04-01',status:'Stop Sale',revision:''}]});assert.equal(stalePaint.failed.length,1);
 const tooLow=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-01-03',status:'Limited',allocation:4,revision:''}]});assert.equal(tooLow.failed.length,1);
 const blackoutPaint=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-02-01',status:'Free Sale',revision:''}]});assert.equal(blackoutPaint.saved.length,1);assert.equal((await visible(store.attractionRates)).filter(r=>r.date==='2027-02-01').length,0,'paint cannot bypass blackout');
 const gridEndpoint=load(admin+'api/getAttractionAvailabilityGrid.ts').default;
 const grid=await call(gridEndpoint,{attractionId:'attr',start:'2027-04-01',days:7});gridEndpoint.outputSchema.parse(grid);assert.equal(grid.tickets.find(t=>t.id==='ticket').cells[0].rateCount,1);
 const limitedAgain=await call(paint,{attractionId:'attr',changes:[{ticketId:'ticket',date:'2027-04-01',status:'Limited',allocation:2,revision:restored.saved[0].revision}]});
 const limitedGrid=await call(gridEndpoint,{attractionId:'attr',start:'2027-04-01',days:7});assert.equal(limitedGrid.tickets[0].cells[0].status,'Limited');assert.equal(limitedGrid.tickets[0].cells[0].remaining,2);
 console.log('PASS: calendar cell save, retail margin, stale row rejection, allocation guards, bulk uplift, paint persistence, stop/resume, limited capacity, stale paint rejection, B2B overlay and blackout precedence.');
 console.log('PASS: calendar blackout status, zero sellable allocation, tier deduplication and adult-only calendar output.');
 console.log('PASS: blackout boundaries, ticket scope, inactive blackout release, event persistence and unique meal codes.');
 console.log('PASS: dates, weekdays, retail/net, Admin guard, generation, overlaps, distinct plans, sold/holds, stop/resume, precedence, drafts, publication, market/promo, partial failure and retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
