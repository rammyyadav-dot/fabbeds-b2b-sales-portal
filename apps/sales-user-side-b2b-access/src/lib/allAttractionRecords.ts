// Exhaust paginated SDK reads so calendar, pricing and inventory never use a partial result.
export async function allAttractionRecords(client:any,params:any={}):Promise<{records:any[]}>{
 const records:any[]=[];
 for(let offset=0;;){
 const page=await client.findAll({...params,offset,limit:2000});
 records.push(...page.records);
 if(!page.hasMore&&page.records.length<2000)break;
 if(!page.records.length)break;
 offset+=page.records.length;
 }
 return{records};
}
