"use client";
import { useState } from 'react';
import type { FinanceSnapshot } from '@/lib/finance/types';
import type { FinanceMarket } from '@/lib/finance/market-types';
import type { LegoSnapshot } from '@/lib/finance/lego-types';
import type { PokemonCollectionSnapshot } from '@/lib/finance/pokemon-collection-types';
import CollectionGrowthSection from './collection-growth';
import FinanceEditor from './finance-editor';

export default function FinanceWorkspace({snapshot,latest,lego,pokemon,market:initialMarket}:{snapshot:FinanceSnapshot;latest:FinanceSnapshot;lego:LegoSnapshot;pokemon:PokemonCollectionSnapshot;market:FinanceMarket}) {
  const [market,setMarket]=useState(initialMarket);
  return <>
    <CollectionGrowthSection snapshot={latest} lego={lego} pokemon={pokemon} market={market}/>
    {snapshot.selected && latest.selected && <FinanceEditor accounts={snapshot.accounts} selected={snapshot.selected} balances={snapshot.balances} latest={latest.selected} latestBalances={latest.balances} previous={snapshot.previous} previousBalances={snapshot.previousBalances} market={market} onMarketRefresh={setMarket}/>}
  </>;
}
