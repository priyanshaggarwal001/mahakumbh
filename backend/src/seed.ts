import db, { initDb } from './db.js';

async function seed() {
  await initDb();
  await db('volunteers').del();
  await db('tasks').del();

  const mockVolunteers = [
    { name: 'Arjun Sharma', skills: JSON.stringify(['Medical', 'Translation']), status: 'active', location_id: 1, workload: 0 },
    { name: 'Priya Verma', skills: JSON.stringify(['Security', 'Crowd Control']), status: 'active', location_id: 1, workload: 0 },
    { name: 'Rohan Gupta', skills: JSON.stringify(['Logistics']), status: 'active', location_id: 2, workload: 0 },
    { name: 'Sanya Malhotra', skills: JSON.stringify(['Medical']), status: 'off-duty', location_id: null, workload: 0 },
    { name: 'Vikram Singh', skills: JSON.stringify(['Crowd Control']), status: 'active', location_id: 3, workload: 0 },
  ];

  await db('volunteers').insert(mockVolunteers);

  const mockTasks = [
    { title: 'Medical Aid at Bathing Ghat', description: 'Elderly pilgrim needs assistance', required_skills: JSON.stringify(['Medical']), sector_id: 1, status: 'pending' },
    { title: 'Lost & Found Coordination', description: 'Help child find parents', required_skills: JSON.stringify(['Translation', 'Crowd Control']), sector_id: 3, status: 'pending' },
  ];

  await db('tasks').insert(mockTasks);

  console.log('Seed data inserted successfully');
  process.exit(0);
}

seed();
