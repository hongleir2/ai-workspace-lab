import { env } from '@/lib/env';
import { Axiom } from '@axiomhq/js';

// Soft-fail when Axiom is not configured (local dev without env vars).
// The logger in server.ts will have no transports and become a no-op.
const axiomClient = env.AXIOM_TOKEN ? new Axiom({ token: env.AXIOM_TOKEN }) : null;

export default axiomClient;
