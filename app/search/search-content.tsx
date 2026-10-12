import type {SearchResult} from '@/lib/global-search';
export default function SearchContent({query,results,action='/search',compact=false}:{query:string;results:SearchResult[];action?:string;compact?:boolean}){
  return <><form className={compact?'dashboard-search-form':'tools-form'} action={action} method="get" role="search" aria-label="Keresés az elérhető modulokban">
    <label>Keresett szöveg<input name="q" type="search" minLength={2} maxLength={80} required defaultValue={query} placeholder="Legalább két karakter…"/></label><button className="primary-button">Keresés</button>
  </form><div className={compact?'dashboard-search-results':undefined}>
    {query.trim().length>=2?<><p role="status">{results.length} találat · legfeljebb 50, modulonként legfeljebb 10.</p>{results.map((result,index)=><a className="search-result" href={result.href} key={index}><small>{result.kind}</small><strong> · {result.title}</strong><p>{result.preview}</p></a>)}</>:<p>Csak az elérhető modulokban keresünk; fájltartalomban, titkokban és megosztási tokenekben nem.</p>}
  </div></>;
}
