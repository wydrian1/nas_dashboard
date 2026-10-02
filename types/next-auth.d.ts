import 'next-auth';
import type { Role } from '../lib/users';
declare module 'next-auth' {
  interface Session {mobileDeviceId?:string;role:Role|null}
}
