const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const cache={},root=process.cwd();
function primitive(tag){return React.forwardRef((props,ref)=>{const {asChild,variant,size,onValueChange,onOpenChange,open,...rest}=props;return React.createElement(tag,{...rest,ref});});}
const ui={Button:primitive('button'),Input:primitive('input'),Textarea:primitive('textarea'),Badge:primitive('span'),Label:primitive('label'),Skeleton:primitive('div'),Dialog:({open,children})=>open?React.createElement('div',null,children):null};
for(const name of ['Select','SelectTrigger','SelectValue','SelectContent','SelectItem','DialogContent','DialogHeader','DialogTitle'])ui[name]=primitive('div');
function load(file){
 file=path.resolve(root,file);if(cache[file])return cache[file].exports;
 const module={exports:{}};cache[file]=module;
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const req=id=>{
  if(id==='zitejs/api')return{};
  if(id==='@project/components/lib/utils')return{cn:(...args)=>args.filter(Boolean).join(' ')};
  if(id.startsWith('@project/components/ui/'))return ui;
  if(id.startsWith('.')){const p=path.resolve(path.dirname(file),id);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx');}
  return require(id);
 };
 vm.runInNewContext('(function(require,module,exports){'+compiled+'\n})',{console,Date,Map,Set,Number,String,Error})(req,module,module.exports);
 return module.exports;
}
const Component=load('apps/admin-extranet/src/components/AttractionProfileWorkspace.tsx').default;
const attraction={id:'a',title:'Sample Attraction',slug:'sample',city:'Dubai',category:'Observation Decks',status:'Active',description:'Profile content',shortDescription:'',address:'Downtown',instantConfirmation:false,cancellationPolicy:'Non-Refundable'};
const html=renderToStaticMarkup(React.createElement(Component,{attraction,allAttractions:[attraction],directoryTickets:[],tickets:[],rates:[],onBack:()=>{},onSwitch:()=>{},onSaved:()=>{}}));
for(const text of ['Attraction Profile','Ticket Product','Rate Plan','SKU Types','Deals &amp; Promos','Rate Grid','Event Master','Blackout Dates','Availability Calendar','Rate Calendar','Edit Profile','Sample Attraction','Downtown'])assert.ok(html.includes(text),text);
assert.ok(html.includes('aria-label="Attraction workflow"'));
assert.ok(html.includes('aria-label="Search attraction product"'));
assert.ok(html.includes('flex-wrap'));
assert.ok(!html.includes('Rate Period'));assert.ok(!html.includes('Meal Plans'));
console.log('PASS: all 10 navigation tabs, selected attraction header, profile fields, edit action, accessible product search and wrapped property-style navigation.');
