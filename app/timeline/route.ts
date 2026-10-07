import {timelineResponse} from '@/lib/timeline-site';

export const dynamic='force-static';

// Public, self-contained HTML generated at build time, without the authenticated app shell.
export function GET(){return timelineResponse();}
