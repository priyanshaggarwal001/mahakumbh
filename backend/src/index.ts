import express from 'express';
import cors from 'cors';
import db, { initDb } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

app.get('/api/volunteers', async (req, res) => {
  const volunteers = await db('volunteers').select('*');
  res.json(volunteers.map(v => ({ 
    ...v, 
    id: Number(v.id),
    location_id: v.location_id ? Number(v.location_id) : null,
    skills: JSON.parse(v.skills) 
  })));
});

app.post('/api/volunteers', async (req, res) => {
  const { name, skills } = req.body;
  const [id] = await db('volunteers').insert({
    name,
    skills: JSON.stringify(skills),
    status: 'off-duty',
    workload: 0
  });
  res.json({ id: Number(id), name, skills, status: 'off-duty', workload: 0 });
});

app.get('/api/sectors', async (req, res) => {
  const sectors = await db('sectors').select('*');
  const volunteerCounts = await db('volunteers')
    .where({ status: 'active' })
    .groupBy('location_id')
    .select('location_id', db.raw('count(*) as count'));
  
  const enrichedSectors = sectors.map(s => {
    const countData = volunteerCounts.find(vc => Number(vc.location_id) === Number(s.id));
    return { 
      ...s, 
      id: Number(s.id), 
      volunteer_count: countData ? Number(countData.count) : 0 
    };
  });
  res.json(enrichedSectors);
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db('tasks').select('*');
    const sortedTasks = tasks.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    res.json(sortedTasks.map(t => {
      let required_skills = [];
      let multi_assignment = [];
      try {
        required_skills = t.required_skills ? JSON.parse(t.required_skills) : [];
      } catch (e) {}
      try {
        multi_assignment = t.multi_assignment ? JSON.parse(t.multi_assignment) : [];
      } catch (e) {}

      // For backward compatibility, include assigned_to in multi_assignment if not already there
      if (t.assigned_to && !multi_assignment.includes(Number(t.assigned_to))) {
        multi_assignment.push(Number(t.assigned_to));
      }

      return { 
        ...t, 
        id: Number(t.id),
        sector_id: Number(t.sector_id),
        assigned_to: t.assigned_to ? Number(t.assigned_to) : (multi_assignment[0] || null),
        multi_assignment,
        required_skills
      };
    }));
  } catch (err) {
    console.error("API Error: GET /api/tasks", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await db('notifications').select('*');
    const sorted = notifications.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    }).slice(0, 20);
    res.json(sorted);
  } catch (err) {
    console.error("API Error: GET /api/notifications", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { message, type, target_sector } = req.body;
  const [id] = await db('notifications').insert({ message, type, target_sector });
  res.json({ id, message, type, target_sector });
});

// Calculate real-time stress based on task load
async function updateSectorStress() {
  const sectors = await db('sectors').select('id', 'capacity');
  const tasks = await db('tasks').whereNot('status', 'completed').select('sector_id', 'status');

  for (const sector of sectors) {
    const activeTasks = tasks.filter(t => Number(t.sector_id) === Number(sector.id));
    
    // Logic: 
    // - Each Pending task adds 15% stress (unattended)
    // - Each In-Progress task adds 5% stress (resources tied up)
    // - Base stress is also influenced by volunteer_count vs capacity
    let taskStress = activeTasks.reduce((acc, t) => {
      return acc + (t.status === 'pending' ? 15 : 5);
    }, 0);

    // Ensure it stays between 0-100
    const newStress = Math.max(0, Math.min(100, taskStress));
    await db('sectors').where({ id: sector.id }).update({ stress_level: newStress });
  }
}

// Simulate real-time environment changes (Now just an extra fluctuation)
app.post('/api/simulate', async (req, res) => {
  await updateSectorStress();
  res.json({ message: 'Environment stress updated based on active tasks' });
});

app.post('/api/login', async (req, res) => {
  const { username, role } = req.body;
  if (role === 'admin') {
    if (username === 'admin') {
      return res.json({ id: 0, name: 'Administrator', role: 'admin' });
    }
    return res.status(401).json({ error: 'Invalid admin credentials' });
  } else {
    const volunteer = await db('volunteers').where({ name: username }).first();
    if (volunteer) {
      return res.json({ 
        ...volunteer, 
        id: Number(volunteer.id),
        location_id: volunteer.location_id ? Number(volunteer.location_id) : null,
        skills: JSON.parse(volunteer.skills), 
        role: 'volunteer' 
      });
    }
    return res.status(404).json({ error: 'Volunteer not found' });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, required_skills, sector_id, priority } = req.body;
  const [id] = await db('tasks').insert({
    title,
    description,
    required_skills: JSON.stringify(required_skills),
    sector_id,
    priority: priority || 'medium',
    status: 'pending'
  });
  
  if (priority === 'emergency') {
    await db('notifications').insert({
      message: `EMERGENCY ALERT: ${title} in ${sector_id}`,
      type: 'emergency',
      target_sector: sector_id
    });
  }

  await updateSectorStress(); // Update stress immediately
  res.json({ id, title, description, required_skills, sector_id, priority, status: 'pending' });
});

// Upgraded Smart Dispatch with Cross-Sector Support
app.post('/api/optimize', async (req, res) => {
  const pendingTasks = await db('tasks').where({ status: 'pending' }).select('*');
  const availableVolunteers = await db('volunteers').where({ status: 'active' }).select('*');
  const sectors = await db('sectors').select('*');

  const assignments = [];

  // Sort tasks by Priority FIRST
  const priorityMap = { 'emergency': 4, 'high': 3, 'medium': 2, 'low': 1 };
  const sortedTasks = pendingTasks.sort((a, b) => {
    return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
  });

  for (const task of sortedTasks) {
    const requiredSkills = JSON.parse(task.required_skills);
    const targetSector = sectors.find(s => s.id === task.sector_id);
    
    // Find BEST volunteer: Matching skills, not overloaded, and CLOSEST (even if in another sector)
    const candidates = availableVolunteers.filter(v => {
      const skills = JSON.parse(v.skills);
      const isMatch = requiredSkills.some((s: string) => skills.includes(s));
      const isNotAssignedInThisBatch = !assignments.some(a => a.volunteer_id === v.id);
      const isNotOverloaded = (v.workload || 0) < 2;
      return isMatch && isNotAssignedInThisBatch && isNotOverloaded;
    });

    if (candidates.length > 0) {
      // Calculate distances using coordinates (or sector coordinates if volunteer lat/lng is missing)
      const closestVolunteer = candidates.map(v => {
        const vLat = v.lat || sectors.find(s => s.id === v.location_id)?.lat || 0;
        const vLng = v.lng || sectors.find(s => s.id === v.location_id)?.lng || 0;
        const dist = Math.sqrt(Math.pow((targetSector?.lat || 0) - vLat, 2) + Math.pow((targetSector?.lng || 0) - vLng, 2));
        return { ...v, dist };
      }).sort((a, b) => a.dist - b.dist)[0];

      assignments.push({ 
        task_id: task.id, 
        volunteer_id: closestVolunteer.id,
        task_title: task.title,
        volunteer_name: closestVolunteer.name,
        from_sector: sectors.find(s => s.id === closestVolunteer.location_id)?.name || 'Transit',
        to_sector: targetSector?.name || 'Unknown'
      });

      await db('tasks').where({ id: task.id }).update({ 
        multi_assignment: JSON.stringify([closestVolunteer.id]),
        assigned_to: closestVolunteer.id,
        status: 'in-progress',
        started_at: db.fn.now()
      });

      await db('volunteers').where({ id: closestVolunteer.id }).update({
        workload: db.raw('workload + 1'),
        location_id: task.sector_id // Move volunteer to the new sector
      });

      // Specialized Notification for Cross-Sector Movement
      const isDifferentSector = closestVolunteer.location_id !== task.sector_id;
      await db('notifications').insert({
        message: `${isDifferentSector ? '🚀 CROSS_ZONE_DISPATCH: ' : '📢 DISPATCH: '} ${closestVolunteer.name} ordered to ${task.title} in ${targetSector?.name}`,
        type: task.priority === 'emergency' ? 'emergency' : 'task',
        target_sector: task.sector_id
      });
    }
  }

  res.json({ message: `Smart Dispatch completed: ${assignments.length} movements initiated.`, assignments });
});

// Geofencing: Update location (Log only, no auto-checkin)
app.post('/api/volunteers/:id/location', async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  await db('volunteers').where({ id }).update({ lat, lng, last_seen: db.fn.now() });
  res.json({ message: 'Location updated' });
});

app.post('/api/volunteers/:id/checkin', async (req, res) => {
  const { id } = req.params;
  const { sector_id } = req.body;
  await db('volunteers').where({ id }).update({ 
    status: 'active',
    location_id: sector_id 
  });
  
  res.json({ message: 'Checked in successfully' });
});

app.post('/api/volunteers/:id/checkout', async (req, res) => {
  const { id } = req.params;
  await db('volunteers').where({ id }).update({ 
    status: 'off-duty',
    location_id: null 
  });
  
  res.json({ message: 'Checked out successfully' });
});

app.post('/api/tasks/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { volunteer_id } = req.body;
  
  const task = await db('tasks').where({ id }).first();
  if (!task) return res.status(404).json({ error: 'Task not found' });

  let currentAssignments = [];
  try {
    currentAssignments = task.multi_assignment ? JSON.parse(task.multi_assignment) : [];
  } catch (e) {}

  if (task.assigned_to && !currentAssignments.includes(Number(task.assigned_to))) {
    currentAssignments.push(Number(task.assigned_to));
  }

  if (!currentAssignments.includes(Number(volunteer_id))) {
    currentAssignments.push(Number(volunteer_id));
    
    // Set lead if not already set (primary assignee)
    const primaryLead = task.assigned_to ? Number(task.assigned_to) : currentAssignments[0];

    await db('tasks').where({ id }).update({ 
      multi_assignment: JSON.stringify(currentAssignments),
      status: 'in-progress',
      assigned_to: primaryLead,
      backup_requested: false,
      started_at: task.status === 'pending' ? db.fn.now() : task.started_at
    });

    await db('volunteers').where({ id: volunteer_id }).update({
      workload: db.raw('workload + 1')
    });

    await updateSectorStress();
  }

  res.json({ message: 'Personnel added to mission', multi_assignment: currentAssignments });
});

app.post('/api/tasks/:id/request-backup', async (req, res) => {
  const { id } = req.params;
  await db('tasks').where({ id }).update({ backup_requested: true });
  await updateSectorStress();
  res.json({ message: 'Backup flag activated for mission' });
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  const { id } = req.params;
  const task = await db('tasks').where({ id }).first();
  
  if (task) {
    let currentAssignments = [];
    try {
      currentAssignments = task.multi_assignment ? JSON.parse(task.multi_assignment) : [];
    } catch (e) {}
    
    if (task.assigned_to && !currentAssignments.includes(Number(task.assigned_to))) {
      currentAssignments.push(Number(task.assigned_to));
    }

    // Reduce workload for ALL assigned volunteers
    for (const vId of currentAssignments) {
      await db('volunteers').where({ id: vId }).update({
        workload: db.raw('MAX(0, workload - 1)')
      });
    }
  }

  await db('tasks').where({ id }).update({ status: 'completed' });
  await updateSectorStress();
  res.json({ message: 'Task completed and force released' });
});

app.post('/api/volunteers/:id/sos', async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  
  await db('volunteers').where({ id }).update({ sos_active: active });
  
  if (active) {
    const volunteer = await db('volunteers').where({ id }).first();
    await db('notifications').insert({
      message: `🚨 PANIC_ALERT: SOS activated by ${volunteer.name} in Zone ${volunteer.location_id || 'UNKNOWN'}`,
      type: 'emergency',
      target_sector: volunteer.location_id
    });
  }
  
  res.json({ message: active ? 'SOS Activated' : 'SOS Deactivated' });
});

app.get('/api/analytics', async (req, res) => {
  const tasks = await db('tasks').select('*');
  const sectors = await db('sectors').select('*');
  const volunteers = await db('volunteers').select('*');

  // Busiest Zone
  const sectorTasks = tasks.reduce((acc: any, t) => {
    acc[t.sector_id] = (acc[t.sector_id] || 0) + 1;
    return acc;
  }, {});
  const busiestId = Object.keys(sectorTasks).sort((a, b) => sectorTasks[b] - sectorTasks[a])[0];
  const busiestZone = sectors.find(s => Number(s.id) === Number(busiestId))?.name || 'NONE';

  // Avg Response Time (Mocked for now as we don't track completion time specifically, but can use started_at vs now for active)
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const avgResponse = "4.2 MIN"; // Simulated metric

  // Force Utilization
  const activeCount = volunteers.filter(v => v.status === 'active').length;
  const util = Math.round((activeCount / Math.max(1, volunteers.length)) * 100);

  res.json({ busiestZone, avgResponse, utilization: `${util}%` });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Vahini Backend running on http://localhost:${PORT}`);
  });
});
