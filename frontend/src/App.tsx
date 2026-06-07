import React, { useState, useEffect, useMemo } from 'react'
import { Users, ClipboardList, Zap, Plus, Radio, Activity, LayoutDashboard, AlertTriangle, Database } from 'lucide-react'

// Types
type Skill = 'Medical' | 'Security' | 'Translation' | 'Logistics' | 'Crowd Control';
type Role = 'admin' | 'volunteer';

interface UserSession {
  id: number;
  name: string;
  role: Role;
  skills?: Skill[];
}

interface Volunteer {
  id: number;
  name: string;
  skills: Skill[];
  status: 'active' | 'off-duty';
  location_id: number | null;
  workload: number;
  sos_active?: boolean;
}

interface Analytics {
  busiestZone: string;
  avgResponse: string;
  utilization: string;
}

interface Sector {
  id: number;
  name: string;
  capacity: number;
  current_demand: number;
  volunteer_count: number;
  stress_level: number;
  x?: number;
  y?: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  required_skills: Skill[];
  sector_id: number;
  assigned_to: number | null;
  multi_assignment: number[];
  backup_requested: boolean;
  status: 'pending' | 'in-progress' | 'completed';
  created_at: string;
  started_at?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'emergency';
}

const PRIORITY_COLORS: Record<string, string> = {
  emergency: 'var(--accent)',
  high: '#f59e0b',
  medium: 'var(--primary)',
  low: '#10b981'
};

const parseUTCDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  let normalized = dateStr;
  if (normalized && !normalized.includes('Z') && !normalized.includes('+')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  return new Date(normalized);
};

const Timer = ({ startTime }: { startTime: string | null | undefined }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime) return;
    const update = () => {
      const start = parseUTCDate(startTime)?.getTime() || 0;
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;
  return <span style={{ color: 'var(--primary)', fontFamily: 'JetBrains Mono', fontSize: '0.7rem' }}>[{elapsed}]</span>;
};

const EquipmentList = ({ skills }: { skills: Skill[] }) => {
  const equipmentMap: Record<string, string[]> = {
    'MEDICAL': ['FIRST_AID_KIT', 'STRETCHER', 'OXYGEN_CAN'],
    'SECURITY': ['MEGAPHONE', 'HIGH_VIS_VEST', 'TWO_WAY_RADIO'],
    'TRANSLATION': ['LANGUAGE_GUIDE', 'ID_TAGS'],
    'LOGISTICS': ['WATER_PACKS', 'FLASHLIGHT', 'MAP_SET'],
    'CROWD CONTROL': ['BARRIERS', 'WHISTLE', 'DIRECTION_SIGN']
  };

  const items = Array.from(new Set(skills.flatMap(s => equipmentMap[s.toUpperCase().trim()] || [])));  
  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <div style={{ fontSize: '0.5rem', color: '#64748b', marginBottom: '0.5rem' }}>REQUIRED_EQUIPMENT:</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {items.map(item => (
          <span key={item} style={{ fontSize: '0.6rem', background: '#1e293b', padding: '2px 6px', border: '1px solid #334155' }}>{item}</span>
        ))}
      </div>
    </div>
  );
};

interface Notification {
  id: number;
  message: string;
  type: 'emergency' | 'info' | 'task';
  target_sector?: number;
  created_at: string;
}

// Map Sector Layout Constants
const SECTOR_COORDS: Record<number, { x: number, y: number, w: number, h: number }> = {
  1: { x: 50, y: 50, w: 200, h: 150 },   // Sangam
  2: { x: 300, y: 50, w: 150, h: 100 },  // Railway
  3: { x: 100, y: 250, w: 350, h: 200 }, // Mela Area
  4: { x: 500, y: 50, w: 200, h: 150 },  // Food Court
  5: { x: 500, y: 250, w: 200, h: 200 }, // Medical Camp
};

function App() {
  const [user, setUser] = useState<UserSession | null>(null)
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [dispatchResults, setDispatchResults] = useState<any[] | null>(null)
  const [loginForm, setLoginForm] = useState({ username: '', role: 'volunteer' as Role })
  const [error, setError] = useState('')
  const [volunteerSearch, setVolunteerSearch] = useState('')
  const [skillFilter, setSkillFilter] = useState<Skill | 'All'>('All')
  const [selectedSector, setSelectedSector] = useState<number | null>(null)
  const [analytics, setAnalytics] = useState<Analytics>({ busiestZone: 'N/A', avgResponse: '0 MIN', utilization: '0%' })

  const fetchData = async () => {
    try {
      const [vRes, sRes, tRes, nRes, aRes] = await Promise.all([
        fetch('http://localhost:3001/api/volunteers'),
        fetch('http://localhost:3001/api/sectors'),
        fetch('http://localhost:3001/api/tasks'),
        fetch('http://localhost:3001/api/notifications'),
        fetch('http://localhost:3001/api/analytics')
      ])
      setVolunteers(await vRes.json())
      setSectors(await sRes.json())
      setTasks(await tRes.json())
      setNotifications(await nRes.json())
      setAnalytics(await aRes.json())
    } catch (err) {
      console.error("Failed to fetch data", err)
    }
  }

  useEffect(() => {
    if (user) {
      fetchData()
      const interval = setInterval(fetchData, 3000) // Faster refresh for "Real-time" feel
      return () => clearInterval(interval)
    }
  }, [user])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Server connection failed')
    }
  }

  const optimizeDeployment = async () => {
    const res = await fetch('http://localhost:3001/api/optimize', { method: 'POST' })
    const data = await res.json()
    if (data.assignments && data.assignments.length > 0) {
      setDispatchResults(data.assignments)
    } else {
      alert("No optimal assignments found for current pending tasks.")
    }
    fetchData()
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    await fetch('http://localhost:3001/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: formData.get('message'),
        type: 'emergency',
        target_sector: formData.get('sector_id') ? Number(formData.get('sector_id')) : null
      })
    });
    setShowBroadcastModal(false);
    fetchData();
  }

  // Telemetry Calculations
  const stats = useMemo(() => {
    console.log("Admin: Calculating Stats", { volunteers, sectors, tasks });
    try {
      const activeVolunteers = (volunteers || []).filter(v => v.status === 'active').length;
      const totalStress = (sectors || []).reduce((acc, s) => acc + (Number(s.stress_level) || 0), 0);
      const avgStress = sectors.length ? Math.round(totalStress / sectors.length) : 0;
      const pendingTasks = (tasks || []).filter(t => t.status === 'pending').length;
      return { activeVolunteers, avgStress, pendingTasks, readiness: Math.round((activeVolunteers / Math.max(1, (volunteers || []).length)) * 100) };
    } catch (e) {
      console.error("Stats Calculation Failed", e);
      return { activeVolunteers: 0, avgStress: 0, pendingTasks: 0, readiness: 0 };
    }
  }, [volunteers, sectors, tasks]);

  // Safe Time Formatter
  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '00:00:00';
    try {
      if (dateStr.includes('T')) {
        return dateStr.split('T')[1].split('.')[0];
      }
      if (dateStr.includes(' ')) {
        return dateStr.split(' ')[1];
      }
      return dateStr;
    } catch (e) {
      return '00:00:00';
    }
  }

  // Pre-calculate current volunteer state for efficiency and safety
  const currentVolunteer = useMemo(() => {
    if (!user || user.role !== 'volunteer') return null;
    return volunteers.find(v => Number(v.id) === Number(user.id)) || null;
  }, [volunteers, user]);

  const activeVolunteerMissions = useMemo(() => {
    if (!user || user.role !== 'volunteer') return [];
    return tasks.filter(t => {
      if (t.status === 'completed') return false;
      
      const multi = t.multi_assignment || [];
      const isAssignedToMe = multi.includes(Number(user.id)) || (t.assigned_to !== null && Number(t.assigned_to) === Number(user.id));
      
      const currentVol = volunteers.find(v => Number(v.id) === Number(user.id));
      const isInMySector = currentVol?.location_id && Number(t.sector_id) === Number(currentVol.location_id);
      
      // Visibility Logic:
      // 1. If assigned to me, always show it.
      // 2. If it's a PENDING task in my sector, show it (so I can join it).
      // 3. If it's IN-PROGRESS but BACKUP is requested, show it even if I'm not assigned.
      // 4. Otherwise, hide it if someone else is already handling it.
      
      if (isAssignedToMe) return true;
      if (t.status === 'pending' && isInMySector) return true;
      if (t.status === 'in-progress' && isInMySector && t.backup_requested) return true;
      
      return false;
    });
  }, [tasks, user, volunteers]);
  if (!user) {
    return (
      <div className="min-h-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '3rem', border: '1px solid var(--primary)' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="logo" style={{ fontSize: '2rem' }}>VAHINI</div>
            <div style={{ color: 'var(--primary)', fontSize: '0.6rem', marginTop: '0.5rem', letterSpacing: '0.3em' }}>REAL-TIME COMMAND & CONTROL</div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className={loginForm.role === 'volunteer' ? '' : 'secondary'} style={{ flex: 1 }} onClick={() => setLoginForm({ username: '', role: 'volunteer' })}>Personnel</button>
                <button type="button" className={loginForm.role === 'admin' ? '' : 'secondary'} style={{ flex: 1 }} onClick={() => setLoginForm({ username: '', role: 'admin' })}>Admin</button>
              </div>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <input type="text" placeholder={loginForm.role === 'admin' ? 'OPERATOR_ID' : 'PERSONNEL_NAME'} style={{ width: '100%', padding: '0.75rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white', fontFamily: 'JetBrains Mono' }} value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
            </div>
            {error && <p style={{ color: 'var(--accent)', fontSize: '0.7rem', marginBottom: '1.5rem', textAlign: 'center' }}>SYSTEM_ERROR: {error}</p>}
            <button type="submit" style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'black' }}>Authenticate</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          <div className="logo">VAHINI_OS</div>
          <div style={{ display: 'flex', gap: '2rem' }}>
             <div style={{ fontSize: '0.6rem' }}>
               <div style={{ color: '#64748b' }}>STATUS</div>
               <div style={{ color: 'var(--success)' }}>SYSTEM_OPTIMAL</div>
             </div>
             <div style={{ fontSize: '0.6rem' }}>
               <div style={{ color: '#64748b' }}>OPERATOR</div>
               <div style={{ color: 'var(--primary)' }}>{user.name.toUpperCase()}</div>
             </div>
          </div>
        </div>
        <button onClick={() => setUser(null)} className="secondary" style={{ border: 'none', color: 'var(--accent)' }}>Terminate_Session</button>
      </header>

      <main style={{ padding: '1.5rem' }}>
        {user.role === 'admin' ? (
          <div className="admin-view">
            <div className="telemetry-grid">
               <div className="telemetry-item">
                  <div className="telemetry-value">{stats.activeVolunteers}</div>
                  <div className="telemetry-label">Active Force</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value" style={{ color: stats.avgStress > 50 ? 'var(--accent)' : 'var(--primary)' }}>{stats.avgStress}%</div>
                  <div className="telemetry-label">Global Stress</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value" style={{ color: 'var(--accent)' }}>{stats.pendingTasks}</div>
                  <div className="telemetry-label">Unresolved Incidents</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value" style={{ fontSize: '1rem' }}>{analytics.busiestZone}</div>
                  <div className="telemetry-label">Busiest Zone (24H)</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value">{analytics.avgResponse}</div>
                  <div className="telemetry-label">Avg. Resolution</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value">{analytics.utilization}</div>
                  <div className="telemetry-label">Force Utilization</div>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
               <div style={{ flex: 2 }}>
                  <div className="rt-map">
                     <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.6rem', color: 'var(--primary)', zIndex: 10 }}>[GIS_LAYER: ACTIVE]</div>
                     {sectors.map(s => {
                       const coords = SECTOR_COORDS[s.id] || { x: 0, y: 0, w: 100, h: 100 };
                       const isCritical = s.stress_level > 75;
                       const isUnderstaffed = s.stress_level >= 60 && s.volunteer_count < 2;
                       const hasSos = volunteers.some(v => Number(v.location_id) === Number(s.id) && v.sos_active);
                       
                       // Heatmap Color Logic
                       const getHeatmapColor = (stress: number) => {
                         if (stress > 80) return 'rgba(255, 0, 85, 0.4)';
                         if (stress > 50) return 'rgba(245, 158, 11, 0.3)';
                         if (stress > 20) return 'rgba(16, 185, 129, 0.2)';
                         return 'rgba(0, 242, 255, 0.05)';
                       };

                       return (
                         <div 
                           key={s.id} 
                           onClick={() => setSelectedSector(selectedSector === s.id ? null : s.id)}
                           className={`map-sector ${isCritical ? 'critical' : ''} ${isUnderstaffed ? 'pulse-alert' : ''} ${hasSos ? 'sos-alert' : ''}`}
                           style={{ 
                             left: `${coords.x}px`, 
                             top: `${coords.y}px`, 
                             width: `${coords.w}px`, 
                             height: `${coords.h}px`,
                             border: hasSos ? '3px solid var(--accent)' : (selectedSector === s.id ? '2px solid white' : (isUnderstaffed ? '2px solid var(--accent)' : (isCritical ? '1px solid var(--accent)' : '1px solid var(--border)'))),
                             boxShadow: hasSos ? '0 0 30px var(--accent)' : (selectedSector === s.id ? '0 0 20px rgba(255,255,255,0.4)' : undefined),
                             background: hasSos ? 'rgba(255, 0, 85, 0.3)' : (selectedSector === s.id ? 'rgba(0, 242, 255, 0.2)' : getHeatmapColor(s.stress_level)),
                             zIndex: hasSos ? 30 : (selectedSector === s.id ? 20 : undefined)
                           }}
                         >
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, marginBottom: '0.5rem', color: hasSos ? 'white' : 'inherit' }}>{s.name} {hasSos && '🚨'}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>STRESS: {Number(s.stress_level) || 0}%</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              FORCE: {s.volunteer_count}
                              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                                {volunteers.filter(v => Number(v.location_id) === Number(s.id) && v.status === 'active').map(v => (
                                  <div key={v.id} style={{ width: '4px', height: '4px', background: 'var(--primary)', borderRadius: '50%' }} title={v.name} />
                                ))}
                              </div>
                            </div>
                            {(Number(s.stress_level) || 0) > 80 && <AlertTriangle size={16} color="var(--accent)" style={{ marginTop: '0.5rem' }} />}
                         </div>
                       )
                     })}
                  </div>
               </div>

               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button onClick={optimizeDeployment} style={{ background: 'var(--primary)', color: 'black' }}><Zap size={14} style={{ marginRight: 8 }} /> Execute Smart Dispatch</button>                  <button className="danger" onClick={() => setShowBroadcastModal(true)}><Radio size={14} style={{ marginRight: 8 }} /> Broadcast Emergency</button>
                  <button onClick={() => setShowTaskModal(true)} className="secondary"><Plus size={14} style={{ marginRight: 8 }} /> Log New Incident</button>
                  <button onClick={() => setShowRegisterModal(true)} className="secondary"><Users size={14} style={{ marginRight: 8 }} /> Onboard Personnel</button>
                  
                  <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                     <div style={{ padding: '0.5rem', fontSize: '0.6rem', background: 'var(--border)', color: 'var(--primary)' }}>[SYSTEM_NOTIFICATIONS]</div>
                     <div className="notification-feed">
                        {notifications.map(n => (
                          <div key={n.id} className="notification-item">
                            <span className="notification-time">[{formatTime(n.created_at)}]</span>
                            <span>{n.message}</span>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
               <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ClipboardList size={16} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '0.9rem' }}>LIVE_OPERATIONS_LOG {selectedSector && `[ZONE_${sectors.find(s => s.id === selectedSector)?.name.split(' ')[1]}]`}</h3>
                    </div>
                    {selectedSector && (
                      <button 
                        onClick={() => setSelectedSector(null)} 
                        style={{ fontSize: '0.5rem', padding: '2px 8px', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                      >
                        CLEAR_FILTER
                      </button>
                    )}
                    <div style={{ fontSize: '0.6rem', color: '#64748b' }}>ACTIVE: {(tasks || []).filter(t => t.status !== 'completed').length}</div>
                  </div>
                  <div className="card" style={{ padding: 0, maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>INCIDENT</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>ZONE</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>HANDLED_BY</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tasks || []).filter(t => {
                          const isNotCompleted = t.status !== 'completed';
                          const matchesSector = !selectedSector || Number(t.sector_id) === Number(selectedSector);
                          return isNotCompleted && matchesSector;
                        }).map(task => (
                          <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: PRIORITY_COLORS[task.priority || 'medium'] }}></div>
                                <div style={{ fontWeight: 700 }}>{task.title || 'UNTITLED'} <Timer startTime={task.started_at} /></div>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{sectors.find(s => Number(s.id) === Number(task.sector_id))?.name || 'UNKNOWN'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {(task.multi_assignment || []).length > 0 
                                  ? (task.multi_assignment.map(vId => volunteers.find(v => Number(v.id) === Number(vId))?.name || 'Personnel').join(' & '))
                                  : <span style={{ color: '#64748b' }}>UNASSIGNED</span>}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <div className={`badge ${task.status === 'pending' ? 'badge-error' : 'badge-warning'}`}>
                                {(task.status || 'PENDING').toUpperCase()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Database size={16} color="#64748b" />
                      <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>MISSION_ARCHIVE (COMPLETED)</h3>
                    </div>
                  </div>
                  <div className="card" style={{ padding: 0, maxHeight: '200px', overflowY: 'auto', opacity: 0.7 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                      <tbody>
                        {(tasks || []).filter(t => t.status === 'completed').map(task => (
                          <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem' }}>{task.title}</td>
                            <td style={{ padding: '0.75rem' }}>{sectors.find(s => Number(s.id) === Number(task.sector_id))?.name}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {(task.multi_assignment || []).length > 0 
                                  ? (task.multi_assignment.map(vId => volunteers.find(v => Number(v.id) === Number(vId))?.name || 'Personnel').join(' & '))
                                  : 'COMPLETED'}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem' }}><div className="badge badge-success">ARCHIVED</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
               <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '0.9rem' }}>PERSONNEL_READINESS</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select 
                        value={skillFilter}
                        onChange={(e) => setSkillFilter(e.target.value as Skill | 'All')}
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'white', fontSize: '0.6rem', padding: '2px 4px' }}
                      >
                        <option value="All">ALL SKILLS</option>
                        {['Medical', 'Security', 'Translation', 'Logistics', 'Crowd Control'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                      <input 
                        type="text" 
                        placeholder="SEARCH..." 
                        value={volunteerSearch}
                        onChange={(e) => setVolunteerSearch(e.target.value)}
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'white', fontSize: '0.6rem', padding: '2px 8px', width: '80px' }}
                      />
                    </div>
                  </div>
                  <div className="card" style={{ padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                       <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                         <tr>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>NAME</th>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>SKILLS</th>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>STATUS</th>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>LOAD</th>
                         </tr>
                       </thead>
                       <tbody>
                         {(volunteers || []).filter(v => {
                           const matchesSearch = v.name.toLowerCase().includes(volunteerSearch.toLowerCase());
                           const matchesSkill = skillFilter === 'All' || (v.skills || []).includes(skillFilter as Skill);
                           return matchesSearch && matchesSkill;
                         }).map(v => (
                           <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                             <td style={{ padding: '0.5rem' }}>{v.name || 'UNKNOWN'}</td>
                             <td style={{ padding: '0.5rem' }}>
                               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                                 {(v.skills || []).map(s => (
                                   <span key={s} style={{ fontSize: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', border: '1px solid rgba(255,255,255,0.1)' }}>{s}</span>
                                 ))}
                               </div>
                             </td>
                             <td style={{ padding: '0.5rem', color: v.status === 'active' ? 'var(--success)' : '#64748b' }}>{(v.status || 'OFF-DUTY').toUpperCase()}</td>
                             <td style={{ padding: '0.5rem' }}>{v.workload || 0}</td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="volunteer-view">
             <div className="telemetry-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
               <div className="telemetry-item">
                  <div className="telemetry-value" style={{ color: currentVolunteer?.status === 'active' ? 'var(--success)' : '#64748b' }}>
                    {currentVolunteer?.status?.toUpperCase() || 'OFF-DUTY'}
                  </div>
                  <div className="telemetry-label">Duty Status</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value">
                    {sectors.find(s => Number(s.id) === Number(currentVolunteer?.location_id))?.name?.split(' ')[1] || 'NONE'}
                  </div>
                  <div className="telemetry-label">Assigned Sector</div>
               </div>
               <div className="telemetry-item">
                  <div className="telemetry-value">{activeVolunteerMissions.length}</div>
                  <div className="telemetry-label">Active Missions</div>
               </div>
             </div>

             <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                 <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>COMM_RELAY</h3>
                        <div className="pulse" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></div>
                      </div>
                      <div className="notification-feed" style={{ height: '350px' }}>
                        {notifications.filter(n => {
                          return !n.target_sector || Number(n.target_sector) === 0 || (currentVolunteer?.location_id && Number(n.target_sector) === Number(currentVolunteer.location_id));
                        }).map(n => (
                          <div key={n.id} className="notification-item" style={{ background: n.type === 'emergency' ? 'rgba(255,0,85,0.1)' : 'transparent', borderLeft: n.type === 'emergency' ? '2px solid var(--accent)' : 'none' }}>
                            <span className="notification-time">[{formatTime(n.created_at)}]</span>
                            <span style={{ color: n.type === 'emergency' ? 'var(--accent)' : 'inherit', fontWeight: n.type === 'emergency' ? 800 : 400 }}>{n.message}</span>
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="card" style={{ marginTop: '1.5rem' }}>
                      <h3 style={{ margin: '0 0 1rem 0' }}>DUTY_CONTROLS</h3>

                      {currentVolunteer?.status === 'active' ? (
                        <>
                          <button 
                            onClick={async () => {
                              await fetch(`http://localhost:3001/api/volunteers/${user.id}/checkout`, { method: 'POST' });
                              fetchData();
                            }}
                            className="secondary" 
                            style={{ width: '100%', marginBottom: '1rem' }}
                          >
                            End Shift / Go Inactive
                          </button>
                          
                          <button 
                            onClick={async () => {
                              const newSosState = !currentVolunteer.sos_active;
                              await fetch(`http://localhost:3001/api/volunteers/${user.id}/sos`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ active: newSosState })
                              });
                              fetchData();
                            }}
                            className={currentVolunteer.sos_active ? 'sos-active' : 'danger'}
                            style={{ width: '100%', padding: '1.5rem', fontWeight: 900 }}
                          >
                            {currentVolunteer.sos_active ? '🚨 CANCEL SOS 🚨' : '🔥 SEND SOS 🔥'}
                          </button>
                        </>
                      ) : (
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          await fetch(`http://localhost:3001/api/volunteers/${user.id}/checkin`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sector_id: Number(formData.get('sId')) })
                          });
                          fetchData();
                        }}>
                          <select name="sId" style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#0a0f1d', color: 'white', border: '1px solid var(--border)' }} required>
                            <option value="">Select Deployment Zone...</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name} (STRESS: {s.stress_level}%)</option>)}
                          </select>
                          <button type="submit" style={{ width: '100%' }}>ACTIVATE_DUTY_STATION</button>
                        </form>
                      )}
                   </div>
                </div>

                <div style={{ flex: 2 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Activity size={20} color="var(--primary)" />
                    <h2 style={{ margin: 0 }}>ACTIVE_MISSIONS</h2>
                   </div>
                   <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
                      {activeVolunteerMissions.map(task => {
                       const taskStart = parseUTCDate(task.started_at);
                       const isStalled = taskStart && (new Date().getTime() - taskStart.getTime() > 600000); // 10 mins
                       return (                        <div key={task.id} className="card" style={{ borderLeft: (task.multi_assignment || []).includes(Number(user.id)) ? '8px solid var(--primary)' : '8px solid #64748b', padding: '2rem', background: 'linear-gradient(90deg, rgba(0,242,255,0.05), transparent)', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <div style={{ color: (task.multi_assignment || []).includes(Number(user.id)) ? 'var(--primary)' : '#64748b', fontSize: '0.6rem', letterSpacing: '0.2em', marginBottom: '1rem' }}>
                                {task.backup_requested || isStalled ? <span style={{ color: 'var(--accent)' }}>⚠️ {isStalled ? 'STALLED_MISSION_CHECKIN_REQ' : 'BACKUP_REQUESTED_IN_ZONE'}</span> : ((task.multi_assignment || []).includes(Number(user.id)) ? `CURRENT_MISSION [${(task.priority || 'MEDIUM').toUpperCase()}]` : `AVAILABLE_IN_ZONE [${(task.priority || 'MEDIUM').toUpperCase()}]`)}
                              </div>
                              <h3 style={{ color: 'var(--primary)', fontSize: '0.6rem', margin: '0 0 0.5rem 0' }}>[MISSION_BRIEFING]</h3>
                              <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.1em' }}>{task.title.toUpperCase()} <Timer startTime={task.started_at} /></h1>
                              <p style={{ opacity: 0.7, fontSize: '0.8rem', maxWidth: '400px', lineHeight: '1.5', margin: '1rem 0' }}>{task.description}</p>
                              
                              <EquipmentList skills={Array.isArray(task.required_skills) ? task.required_skills : []} />

                              <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
                                {(task.multi_assignment || []).map((vId) => {
                                  const isLead = Number(task.assigned_to) === Number(vId);
                                  return (
                                    <div key={vId} style={{ fontSize: '0.6rem', color: isLead ? 'var(--primary)' : '#94a3b8', border: '1px solid', borderColor: isLead ? 'var(--primary)' : '#334155', padding: '2px 6px', borderRadius: '10px', fontWeight: isLead ? 800 : 400 }}>
                                      {volunteers.find(v => Number(v.id) === Number(vId))?.name || 'Personnel'} {isLead ? '[LEAD]' : ''}
                                    </div>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                {(task.multi_assignment || []).some(id => Number(id) === Number(user.id)) || (task.assigned_to !== null && Number(task.assigned_to) === Number(user.id)) ? (
                                  <>
                                    {Number(task.assigned_to) === Number(user.id) ? (
                                      <button 
                                        onClick={async () => {
                                          await fetch(`http://localhost:3001/api/tasks/${task.id}/complete`, { method: 'POST' });
                                          fetchData();
                                        }}
                                        style={{ background: 'var(--primary)', color: 'black', fontWeight: 900 }}
                                      >
                                        TERMINATE MISSION (LEAD)
                                      </button>
                                    ) : (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--success)', alignSelf: 'center', fontWeight: 700 }}>[ASSISTING_MISSION_LEAD]</div>
                                    )}
                                    
                                    {!task.backup_requested && (
                                      <button 
                                        className="danger"
                                        style={{ fontSize: '0.7rem', borderStyle: 'dashed' }}
                                        onClick={async () => {
                                          const volunteer = currentVolunteer?.name || 'Unknown Personnel';
                                          await fetch(`http://localhost:3001/api/tasks/${task.id}/request-backup`, { method: 'POST' });
                                          await fetch('http://localhost:3001/api/notifications', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              message: `BACKUP_REQUIRED: ${volunteer} needs immediate assistance with "${task.title}" in ${sectors.find(s => Number(s.id) === Number(task.sector_id))?.name}`,
                                              type: 'emergency',
                                              target_sector: task.sector_id
                                            })
                                          });
                                          fetchData();
                                        }}
                                      >
                                        REQ_BACKUP
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button 
                                    onClick={async () => {
                                      await fetch(`http://localhost:3001/api/tasks/${task.id}/assign`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ volunteer_id: user.id })
                                      });
                                      fetchData();
                                    }}
                                    style={{ background: 'var(--primary)', color: 'black', fontWeight: 900 }}
                                  >
                                    {task.backup_requested ? 'DEPLOY BACKUP SUPPORT' : 'ENGAGE MISSION'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <LayoutDashboard size={64} color="rgba(0,242,255,0.1)" />
                          </div>
                        </div>
                      )})}
                      {activeVolunteerMissions.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', padding: '5rem', background: 'rgba(255,255,255,0.02)', borderStyle: 'dashed' }}>
                          <Radio size={48} color="var(--border)" style={{ marginBottom: '1.5rem', animation: 'pulse 2s infinite' }} />
                          <p style={{ color: '#64748b', fontSize: '0.8rem', letterSpacing: '0.1em' }}>SCANNING_FOR_INCOMING_MESSAGES...</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Modals with RTCC styling */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--primary)' }}>
            <h2 style={{ color: 'var(--primary)' }}>[NEW_INCIDENT_REPORT]</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await fetch('http://localhost:3001/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: formData.get('title'),
                  description: formData.get('description'),
                  sector_id: Number(formData.get('sector_id')),
                  required_skills: [formData.get('skill')],
                  priority: formData.get('priority')
                })
              });
              setShowTaskModal(false);
              fetchData();
            }}>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>SUBJECT</label><input name="title" style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }} required /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>ZONE</label><select name="sector_id" style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }}>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div style={{ flex: 1, marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>PRIORITY</label><select name="priority" style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }} defaultValue="medium"><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option><option value="emergency">EMERGENCY</option></select></div>
              </div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>REQ_SPEC</label><select name="skill" style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }}><option>Medical</option><option>Security</option><option>Translation</option><option>Logistics</option><option>Crowd Control</option></select></div>
              <div style={{ marginBottom: '1.5rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>INTEL_SUMMARY</label><textarea name="description" rows={3} style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }}></textarea></div>
              <div style={{ display: 'flex', gap: '1rem' }}><button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'black' }}>Log Dispatch</button><button type="button" onClick={() => setShowTaskModal(false)} className="secondary" style={{ flex: 1 }}>Abort</button></div>
            </form>
          </div>
        </div>
      )}

      {showBroadcastModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,0,85,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--accent)' }}>
            <h2 style={{ color: 'var(--accent)' }}>[EMERGENCY_BROADCAST_INITIATED]</h2>
            <form onSubmit={handleBroadcast}>
              <div style={{ marginBottom: '1.5rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>PRIORITY_MESSAGE</label><textarea name="message" rows={4} style={{ width: '100%', padding: '0.75rem', background: '#0a0f1d', border: '1px solid var(--accent)', color: 'white' }} required></textarea></div>
              <div style={{ display: 'flex', gap: '1rem' }}><button type="submit" style={{ flex: 1, background: 'var(--accent)', color: 'white' }}>Transmit Now</button><button type="button" onClick={() => setShowBroadcastModal(false)} className="secondary" style={{ flex: 1 }}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--primary)' }}>
            <h2 style={{ color: 'var(--primary)' }}>[PERSONNEL_ONBOARDING]</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const skills = formData.getAll('skills');
              
              await fetch('http://localhost:3001/api/volunteers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: formData.get('name'),
                  skills: skills
                })
              });
              setShowRegisterModal(false);
              fetchData();
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>NAME</label>
                <input name="name" style={{ width: '100%', padding: '0.5rem', background: '#0a0f1d', border: '1px solid var(--border)', color: 'white' }} required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.6rem' }}>SKILL_SET</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {['Medical', 'Security', 'Translation', 'Logistics', 'Crowd Control'].map(skill => (
                    <label key={skill} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                      <input type="checkbox" name="skills" value={skill} /> {skill}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}><button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'black' }}>Register Personnel</button><button type="button" onClick={() => setShowRegisterModal(false)} className="secondary" style={{ flex: 1 }}>Abort</button></div>
            </form>
          </div>
        </div>
      )}

      {dispatchResults && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', border: '1px solid var(--primary)', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={24} /> [SMART_DISPATCH_REPORT]</h2>
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b' }}>OPTIMIZATION_ENGINE HAS SUCCESSFULLY CALCULATED {dispatchResults.length} BEST-MATCH DISPATCHES BASED ON PROXIMITY AND SKILLS.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dispatchResults.map((res, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{res.task_title}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--primary)' }}>DIST: MINIMAL</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                    <span style={{ color: 'var(--primary)' }}>{res.volunteer_name}</span> is moving from <span style={{ color: '#f59e0b' }}>{res.from_sector}</span> to <span style={{ color: 'var(--success)' }}>{res.to_sector}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDispatchResults(null)} style={{ width: '100%', marginTop: '2rem', background: 'var(--primary)', color: 'black' }}>Confirm & Monitor</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
