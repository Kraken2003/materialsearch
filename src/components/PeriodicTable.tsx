'use client';
import { ELEMENTS } from '@/lib/elements';
import { useRef } from 'react';
interface Props { include: string[]; exclude: string[]; selection: 'include' | 'exclude'; onToggle: (symbol:string)=>void }
export default function PeriodicTable({include,exclude,selection,onToggle}:Props) {
 const buttons = useRef(new Map<string,HTMLButtonElement>());
 function navigate(event: React.KeyboardEvent, element: typeof ELEMENTS[number]) {
   const directions: Record<string,[number,number]> = {ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]};
   const direction=directions[event.key]; if(!direction) return;
   event.preventDefault();
   let row=element.row; let column=element.column;
   for(let i=0;i<18;i++) {
     row+=direction[0];column+=direction[1]; if(row<1 || row>9 || column<1 || column>18) break;
     const target=ELEMENTS.find(e=>e.row===row && e.column===column);
     if(target) {buttons.current.get(target.symbol)?.focus();break;}
   }
 }
 return <div className="table-scroll" tabIndex={0} aria-label="Periodic table, scroll horizontally on smaller screens">
   <div className="periodic-table" role="group" aria-label={'Periodic table. Click elements to '+selection+'. Use arrow keys to move between elements.'}>
     <div className="table-note">
       <strong>Choose elements<br/>for your search.</strong>
       <span>Click an element to {selection} it.<br/>Click it again to remove the selection.</span>
     </div>
     <div className="series-marker" style={{gridRow:6,gridColumn:3}}>57–71<br/><span>La–Lu</span></div>
     <div className="series-marker" style={{gridRow:7,gridColumn:3}}>89–103<br/><span>Ac–Lr</span></div>
     <div className="series-label" style={{gridRow:8,gridColumn:'1 / 4'}}>Lanthanides</div>
     <div className="series-label" style={{gridRow:9,gridColumn:'1 / 4'}}>Actinides</div>
     {ELEMENTS.map(e=>{
       const included=include.includes(e.symbol); const excluded=exclude.includes(e.symbol);
       return <button key={e.symbol} ref={node=>{if(node) buttons.current.set(e.symbol,node);else buttons.current.delete(e.symbol);}}
         type="button" className={'element '+e.category+(included?' included':'')+(excluded?' excluded':'')}
         style={{gridRow:e.row,gridColumn:e.column}} aria-pressed={included || excluded}
         aria-label={e.name+' ('+e.symbol+'), atomic number '+e.number+(included?', included':excluded?', excluded':'')}
         title={e.name+(included?' · included':excluded?' · excluded':'')}
         onClick={()=>onToggle(e.symbol)} onKeyDown={event=>navigate(event,e)}>
         <span className="atomic-number">{e.number}</span><strong>{e.symbol}</strong><span className="element-name">{e.name}</span>
         {(included || excluded) && <span className="element-mark" aria-hidden="true">{included?'✓':'−'}</span>}
       </button>;
     })}
   </div>
 </div>;
}
