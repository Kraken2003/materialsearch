export default function Formula({value}:{value:string}) {
 return <>{value.split(/(\d+(?:\.\d+)?)/).map((part,i)=>/^\d/.test(part)?<sub key={i}>{part}</sub>:<span key={i}>{part}</span>)}</>;
}
