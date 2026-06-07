import db, { initDb } from './db.js';

async function seed() {
  await initDb();
  await db('volunteers').del();
  await db('tasks').del();
  await db('notifications').del();

  console.log('Database cleared and initialized for a fresh start.');
  process.exit(0);
}

seed();
