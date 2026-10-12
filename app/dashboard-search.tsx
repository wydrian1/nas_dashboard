import type {SearchResult} from '@/lib/global-search';
import SearchContent from './search/search-content';
import './dashboard-search.css';
export default function DashboardSearch({query,results}:{query:string;results:SearchResult[]}){
  return <details id="dashboard-search" className="dashboard-search" open={query.trim().length>=2}>
    <summary><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span>Keresés</span><svg className="dashboard-search-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
    <div className="dashboard-search-body"><SearchContent query={query} results={results} action="/#dashboard-search" compact/></div>
  </details>;
}
