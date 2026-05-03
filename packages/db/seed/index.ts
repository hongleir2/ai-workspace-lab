import 'dotenv/config';

if (process.env['NODE_ENV'] === 'production') {
  console.error('refusing to seed in production');
  process.exit(1);
}

// No product tables yet — seeds will land alongside the first migration.
console.warn('no seeds yet — first migration not landed');
