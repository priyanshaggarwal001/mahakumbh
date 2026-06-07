import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, '../../database.sqlite'),
  },
  useNullAsDefault: true,
});

export async function initDb() {
  const hasVolunteers = await db.schema.hasTable('volunteers');
  if (!hasVolunteers) {
    await db.schema.createTable('volunteers', (table) => {
      table.increments('id');
      table.string('name');
      table.json('skills');
      table.string('status');
      table.integer('location_id').nullable();
      table.integer('workload').defaultTo(0);
    });
  }

  const hasSectors = await db.schema.hasTable('sectors');
  if (!hasSectors) {
    await db.schema.createTable('sectors', (table) => {
      table.increments('id');
      table.string('name');
      table.integer('capacity');
      table.integer('current_demand').defaultTo(0);
      table.integer('volunteer_count').defaultTo(0);
      table.integer('stress_level').defaultTo(0);
    });

    await db('sectors').insert([
      { name: 'Sector A (Sangam)', capacity: 500, stress_level: 45 },
      { name: 'Sector B (Railway Stn)', capacity: 300, stress_level: 60 },
      { name: 'Sector C (Mela Area)', capacity: 1000, stress_level: 30 },
      { name: 'Sector D (Food Court)', capacity: 200, stress_level: 20 },
      { name: 'Sector E (Medical Camp)', capacity: 150, stress_level: 10 },
    ]);
  } else {
    // Check for missing columns in existing sectors table
    const hasStressLevel = await db.schema.hasColumn('sectors', 'stress_level');
    if (!hasStressLevel) {
      await db.schema.table('sectors', (table) => {
        table.integer('stress_level').defaultTo(0);
      });
    }
  }

  const hasTasks = await db.schema.hasTable('tasks');
  if (!hasTasks) {
    await db.schema.createTable('tasks', (table) => {
      table.increments('id');
      table.string('title');
      table.string('description');
      table.json('required_skills');
      table.integer('sector_id');
      table.integer('assigned_to').nullable(); // Keep for backward compatibility
      table.json('multi_assignment'); // New: Store array of volunteer IDs
      table.string('status');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  } else {
    const hasCreatedAt = await db.schema.hasColumn('tasks', 'created_at');
    if (!hasCreatedAt) {
      await db.schema.table('tasks', (table) => {
        table.timestamp('created_at').nullable();
      });
    }
    const hasMulti = await db.schema.hasColumn('tasks', 'multi_assignment');
    if (!hasMulti) {
      await db.schema.table('tasks', (table) => {
        table.json('multi_assignment').nullable();
      });
    }
    const hasBackupReq = await db.schema.hasColumn('tasks', 'backup_requested');
    if (!hasBackupReq) {
      await db.schema.table('tasks', (table) => {
        table.boolean('backup_requested').defaultTo(false);
      });
    }
    const hasStartedAt = await db.schema.hasColumn('tasks', 'started_at');
    if (!hasStartedAt) {
      await db.schema.table('tasks', (table) => {
        table.timestamp('started_at').nullable();
      });
    }
    const hasPriority = await db.schema.hasColumn('tasks', 'priority');
    if (!hasPriority) {
      await db.schema.table('tasks', (table) => {
        table.string('priority').defaultTo('medium'); // low, medium, high, emergency
      });
    }
  }

  // Update sectors with coordinates for geofencing
  const hasLat = await db.schema.hasColumn('sectors', 'lat');
  if (!hasLat) {
    await db.schema.table('sectors', (table) => {
      table.float('lat').nullable();
      table.float('lng').nullable();
      table.float('radius').defaultTo(0.005); // Simulated radius in degrees
    });

    // Update existing sectors with some dummy coordinates (centered around Sangam, Prayagraj ~25.42, 81.88)
    await db('sectors').where({ id: 1 }).update({ lat: 25.428, lng: 81.887 });
    await db('sectors').where({ id: 2 }).update({ lat: 25.448, lng: 81.851 });
    await db('sectors').where({ id: 3 }).update({ lat: 25.420, lng: 81.865 });
    await db('sectors').where({ id: 4 }).update({ lat: 25.435, lng: 81.875 });
    await db('sectors').where({ id: 5 }).update({ lat: 25.415, lng: 81.890 });
  }

  const hasVolunteerLat = await db.schema.hasColumn('volunteers', 'lat');
  if (!hasVolunteerLat) {
    await db.schema.table('volunteers', (table) => {
      table.float('lat').nullable();
      table.float('lng').nullable();
      table.timestamp('last_seen').nullable();
    });
  }
  const hasSos = await db.schema.hasColumn('volunteers', 'sos_active');
  if (!hasSos) {
    await db.schema.table('volunteers', (table) => {
      table.boolean('sos_active').defaultTo(false);
    });
  }

  const hasNotifications = await db.schema.hasTable('notifications');
  if (!hasNotifications) {
    await db.schema.createTable('notifications', (table) => {
      table.increments('id');
      table.string('message');
      table.string('type'); 
      table.integer('target_sector').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  } else {
    const hasCreatedAt = await db.schema.hasColumn('notifications', 'created_at');
    if (!hasCreatedAt) {
      await db.schema.table('notifications', (table) => {
        table.timestamp('created_at').nullable();
      });
    }
  }
}

export default db;
