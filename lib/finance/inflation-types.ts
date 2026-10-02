export type InflationSeries={annual:{year:number;rate:number}[];monthly:{month:string;yoy:number;mom:number|null}[];fetchedAt:string};
export const KSH_ANNUAL_URL='https://www.ksh.hu/stadat_files/ara/hu/ara0002.html';
export const KSH_MONTHLY_URL='https://www.ksh.hu/stadat_files/ara/hu/ara0040.html';
