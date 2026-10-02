// node:sqlite returns flat records with a null prototype. React Server
// Components cannot pass those records directly to Client Components.
export function plainSqlRow<T extends object>(row: T): T {
  return { ...row };
}
