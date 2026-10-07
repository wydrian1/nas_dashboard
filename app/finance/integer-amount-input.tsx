"use client";
import { useState } from 'react';
import { integerMoneyInput, normalizeIntegerInput } from '@/lib/finance/input-types';

export default function IntegerAmountInput({name,minor,required}:{name:string;minor?:number;required?:boolean}) {
  const [value,setValue]=useState(integerMoneyInput(minor));
  return <input name={name} value={value} onChange={event=>{const normalized=normalizeIntegerInput(event.target.value);if(/^-?\d*$/.test(normalized))setValue(normalized);}} inputMode="numeric" pattern="[0-9]+" maxLength={24} required={required}/>;
}
