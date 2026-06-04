/**
 * database.js – SQLite (better-sqlite3) schema, seed data, query helpers
 *
 * Drop-in replacement for the Mongoose version.
 * Exports the same { connect, Bins, Trucks, Reports, Notifications } interface
 * so server.js needs zero changes.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'optibin.db');
let db;

/* ── CONNECT ── */
async function connect() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  await seed();
  console.log('✅ Connected to SQLite:', DB_PATH);
}

/* ── CREATE TABLES ── */
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bins (
      id        TEXT PRIMARY KEY,
      location  TEXT,
      zone      TEXT DEFAULT 'East Delhi',
      fill      REAL DEFAULT 0,
      capacity  REAL DEFAULT 120,
      lat       REAL,
      lng       REAL,
      fillRate  REAL DEFAULT 1.5
    );
    CREATE TABLE IF NOT EXISTS trucks (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      driverName TEXT DEFAULT 'Unassigned',
      color      TEXT DEFAULT '#6b7280',
      lat        REAL,
      lng        REAL,
      depotLat   REAL,
      depotLng   REAL,
      zone       TEXT DEFAULT 'All',
      status     TEXT DEFAULT 'idle',
      route      TEXT DEFAULT '[]',
      routeIndex INTEGER DEFAULT 0,
      collected  INTEGER DEFAULT 0,
      speed      REAL DEFAULT 0.0018
    );
    CREATE TABLE IF NOT EXISTS reports (
      id           TEXT PRIMARY KEY,
      binId        TEXT,
      binLocation  TEXT,
      type         TEXT,
      description  TEXT DEFAULT '',
      reporterName TEXT DEFAULT 'Anonymous',
      status       TEXT DEFAULT 'open',
      urgent       INTEGER DEFAULT 0,
      timestamp    TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id        TEXT PRIMARY KEY,
      title     TEXT,
      message   TEXT DEFAULT '',
      ntype     TEXT DEFAULT 'info',
      binId     TEXT,
      reportId  TEXT,
      forRole   TEXT DEFAULT 'all',
      forDriver TEXT,
      read      INTEGER DEFAULT 0,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      username  TEXT PRIMARY KEY,
      password  TEXT NOT NULL,
      role      TEXT NOT NULL,
      name      TEXT NOT NULL,
      truckId   TEXT,
      status    TEXT DEFAULT 'active'
    );
  `);
}

/* ── SEED DATA ── */
async function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM bins').get().c;
  if (count === 0) {
    const ins = db.prepare(`INSERT INTO bins (id, location, zone, fill, capacity, lat, lng, fillRate)
                            VALUES (@id, @location, @zone, @fill, @capacity, @lat, @lng, @fillRate)`);
    const insertMany = db.transaction((rows) => { for (const r of rows) ins.run(r); });
    insertMany([
      { id:'BIN-001', location:'Rohini Sector 7 Market', zone:'North Delhi', fill:78, capacity:120, lat:28.7185, lng:77.1146, fillRate:2.1 },
      { id:'BIN-002', location:'Pitampura Metro Gate', zone:'North Delhi', fill:45, capacity:100, lat:28.6985, lng:77.1305, fillRate:1.6 },
      { id:'BIN-003', location:'Shalimar Bagh Main Market', zone:'North Delhi', fill:62, capacity:150, lat:28.7132, lng:77.1686, fillRate:1.8 },
      { id:'BIN-004', location:'Model Town Metro Station', zone:'North Delhi', fill:91, capacity:120, lat:28.7010, lng:77.1948, fillRate:2.5 },
      { id:'BIN-005', location:'Burari Main Road Chowk', zone:'North Delhi', fill:33, capacity:100, lat:28.7403, lng:77.2012, fillRate:1.2 },
      { id:'BIN-006', location:'Paschim Vihar Market', zone:'West Delhi', fill:70, capacity:120, lat:28.6694, lng:77.1050, fillRate:2.0 },
      { id:'BIN-007', location:'Uttam Nagar West Market', zone:'West Delhi', fill:55, capacity:150, lat:28.6210, lng:77.0533, fillRate:1.5 },
      { id:'BIN-008', location:'Rajouri Garden Metro', zone:'West Delhi', fill:83, capacity:120, lat:28.6473, lng:77.1229, fillRate:2.3 },
      { id:'BIN-009', location:'Janakpuri C Block Market', zone:'West Delhi', fill:40, capacity:100, lat:28.6290, lng:77.0878, fillRate:1.3 },
      { id:'BIN-010', location:'Dwarka Sector 10 Market', zone:'West Delhi', fill:67, capacity:150, lat:28.5929, lng:77.0484, fillRate:1.9 },
      { id:'BIN-011', location:'Saket Select Citywalk Gate', zone:'South Delhi', fill:88, capacity:200, lat:28.5273, lng:77.2181, fillRate:2.8 },
      { id:'BIN-012', location:'Hauz Khas Village Market', zone:'South Delhi', fill:52, capacity:120, lat:28.5535, lng:77.2006, fillRate:1.7 },
      { id:'BIN-013', location:'Lajpat Nagar Central Mkt', zone:'South Delhi', fill:76, capacity:150, lat:28.5675, lng:77.2432, fillRate:2.2 },
      { id:'BIN-014', location:'Greater Kailash I M Block', zone:'South Delhi', fill:44, capacity:120, lat:28.5486, lng:77.2449, fillRate:1.4 },
      { id:'BIN-015', location:'Vasant Kunj Shopping Ctr', zone:'South Delhi', fill:95, capacity:100, lat:28.5209, lng:77.1525, fillRate:3.0 },
      { id:'BIN-016', location:'Malviya Nagar Market', zone:'South Delhi', fill:61, capacity:120, lat:28.5318, lng:77.2089, fillRate:1.8 },
      { id:'BIN-017', location:'Connaught Place Inner Ring', zone:'Central Delhi', fill:73, capacity:200, lat:28.6315, lng:77.2167, fillRate:2.6 },
      { id:'BIN-018', location:'Chandni Chowk Main Bazar', zone:'Central Delhi', fill:89, capacity:150, lat:28.6505, lng:77.2303, fillRate:2.9 },
      { id:'BIN-019', location:'Sarojini Nagar Market', zone:'Central Delhi', fill:57, capacity:120, lat:28.5770, lng:77.1983, fillRate:1.6 },
      { id:'BIN-020', location:'Paharganj Main Bazar', zone:'Central Delhi', fill:81, capacity:100, lat:28.6435, lng:77.2122, fillRate:2.4 },
      { id:'BIN-021', location:'Laxmi Nagar Market', zone:'East Delhi', fill:85, capacity:120, lat:28.6319, lng:77.2771, fillRate:2.2 },
      { id:'BIN-022', location:'Preet Vihar Metro Gate', zone:'East Delhi', fill:60, capacity:100, lat:28.6272, lng:77.2912, fillRate:1.8 },
      { id:'BIN-023', location:'Shahdara Bus Terminal', zone:'East Delhi', fill:92, capacity:120, lat:28.6704, lng:77.2871, fillRate:2.8 },
      { id:'BIN-024', location:'Karkardooma Court Road', zone:'East Delhi', fill:48, capacity:100, lat:28.6492, lng:77.3002, fillRate:1.5 },
      { id:'BIN-025', location:'Patparganj Industrial Area', zone:'East Delhi', fill:71, capacity:150, lat:28.6225, lng:77.3038, fillRate:2.0 },
      { id:'BIN-026', location:'Sector 18 Market, Noida', zone:'Noida', fill:77, capacity:120, lat:28.5672, lng:77.3212, fillRate:2.5 },
      { id:'BIN-027', location:'Sector 62 Tech Park Gate', zone:'Noida', fill:30, capacity:150, lat:28.6273, lng:77.3739, fillRate:1.0 },
      { id:'BIN-028', location:'Sector 44 Noida Market', zone:'Noida', fill:88, capacity:100, lat:28.5390, lng:77.3540, fillRate:2.0 },
      { id:'BIN-029', location:'Botanical Garden Road', zone:'Noida', fill:20, capacity:120, lat:28.5640, lng:77.3282, fillRate:0.9 },
      { id:'BIN-030', location:'Sector 15 Noida', zone:'Noida', fill:65, capacity:100, lat:28.5830, lng:77.3190, fillRate:1.7 },
      { id:'BIN-031', location:'Kaushambi Main Market', zone:'Ghaziabad', fill:95, capacity:120, lat:28.6362, lng:77.3270, fillRate:3.0 },
      { id:'BIN-032', location:'Indirapuram Alpha 1', zone:'Ghaziabad', fill:48, capacity:150, lat:28.6487, lng:77.3700, fillRate:1.4 },
      { id:'BIN-033', location:'Vaishali Sector 4 Market', zone:'Ghaziabad', fill:72, capacity:120, lat:28.6454, lng:77.3378, fillRate:1.9 },
      { id:'BIN-034', location:'Mohan Nagar Chowk', zone:'Ghaziabad', fill:81, capacity:150, lat:28.7009, lng:77.4342, fillRate:2.3 },
      { id:'BIN-035', location:'DLF Cyber City Gate', zone:'Gurugram', fill:64, capacity:200, lat:28.4950, lng:77.0890, fillRate:2.1 },
      { id:'BIN-036', location:'MG Road Gurugram Metro', zone:'Gurugram', fill:87, capacity:150, lat:28.4796, lng:77.0892, fillRate:2.6 },
      { id:'BIN-037', location:'Sector 14 Gurugram Market', zone:'Gurugram', fill:39, capacity:120, lat:28.4683, lng:77.0328, fillRate:1.1 },
      { id:'BIN-038', location:'Golf Course Road Market', zone:'Gurugram', fill:74, capacity:100, lat:28.4605, lng:77.1050, fillRate:2.0 },
      { id:'BIN-039', location:'Udyog Vihar Phase 4', zone:'Gurugram', fill:56, capacity:120, lat:28.5035, lng:77.0912, fillRate:1.6 },
      { id:'BIN-040', location:'NIT Faridabad Market', zone:'Faridabad', fill:68, capacity:120, lat:28.3833, lng:77.3142, fillRate:1.8 },
    ]);
    console.log('  Seeded 40 bins');
  }

  const truckCount = db.prepare('SELECT COUNT(*) AS c FROM trucks').get().c;
  if (truckCount === 0) {
    const ins = db.prepare(`INSERT INTO trucks (id, name, driverName, color, lat, lng, depotLat, depotLng, zone)
                            VALUES (@id, @name, @driverName, @color, @lat, @lng, @depotLat, @depotLng, @zone)`);
    const insertMany = db.transaction((rows) => { for (const r of rows) ins.run(r); });
    insertMany([
      { id:'TRK-A', name:'Truck Alpha', driverName:'Ramesh Kumar', color:'#0d9488', lat:28.7185, lng:77.1146, depotLat:28.7185, depotLng:77.1146, zone:'North Delhi' },
      { id:'TRK-B', name:'Truck Beta', driverName:'Suresh Yadav', color:'#ea580c', lat:28.6473, lng:77.1229, depotLat:28.6473, depotLng:77.1229, zone:'West Delhi' },
      { id:'TRK-C', name:'Truck Gamma', driverName:'Pradeep Singh', color:'#7c3aed', lat:28.6315, lng:77.2167, depotLat:28.6315, depotLng:77.2167, zone:'Central Delhi' },
      { id:'TRK-D', name:'Truck Delta', driverName:'Vijay Sharma', color:'#dc2626', lat:28.5273, lng:77.2181, depotLat:28.5273, depotLng:77.2181, zone:'South Delhi' },
      { id:'TRK-E', name:'Truck Echo', driverName:'Mohan Lal', color:'#0891b2', lat:28.6319, lng:77.2771, depotLat:28.6319, depotLng:77.2771, zone:'East Delhi' },
      { id:'TRK-F', name:'Truck Foxtrot', driverName:'Ajay Verma', color:'#2563eb', lat:28.5672, lng:77.3212, depotLat:28.5672, depotLng:77.3212, zone:'Noida' },
      { id:'TRK-G', name:'Truck Golf', driverName:'Rakesh Gupta', color:'#c026d3', lat:28.6362, lng:77.3270, depotLat:28.6362, depotLng:77.3270, zone:'Ghaziabad' },
      { id:'TRK-H', name:'Truck Hotel', driverName:'Sanjay Mehra', color:'#ca8a04', lat:28.4950, lng:77.0890, depotLat:28.4950, depotLng:77.0890, zone:'Gurugram' },
    ]);
    console.log('  Seeded 8 trucks');
  }

  // Always randomize bin fill levels on startup for fresh data
  const allBins = db.prepare('SELECT * FROM bins').all();
  const updateFill = db.prepare('UPDATE bins SET fill = ? WHERE id = ?');
  const randomizeTxn = db.transaction(() => {
    for (const b of allBins) {
      updateFill.run(Math.floor(5 + Math.random() * 95), b.id);
    }
  });
  randomizeTxn();
  console.log(`  Randomized fill levels for ${allBins.length} bins`);

  // Seed default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    db.prepare(`INSERT INTO users (username, password, role, name, truckId, status)
                VALUES (@username, @password, @role, @name, @truckId, @status)`)
      .run({ username: 'admin', password: 'admin123', role: 'admin', name: 'Admin', truckId: null, status: 'active' });
    console.log('  Seeded default admin user (admin / admin123)');
  }
}

/* ── QUERY HELPERS ── */

/** Parse route JSON safely */
function parseTruck(row) {
  if (!row) return null;
  try { row.route = JSON.parse(row.route || '[]'); } catch { row.route = []; }
  row.urgent = !!row.urgent;
  row.read = !!row.read;
  return row;
}

const Bins = {
  getAll:     async () => db.prepare('SELECT * FROM bins ORDER BY id').all(),
  getById:    async (id) => db.prepare('SELECT * FROM bins WHERE id = ?').get(id) || null,
  insert:     async (data) => {
    db.prepare(`INSERT INTO bins (id, location, zone, fill, capacity, lat, lng, fillRate)
                VALUES (@id, @location, @zone, @fill, @capacity, @lat, @lng, @fillRate)`)
      .run({ id: data.id, location: data.location, zone: data.zone || 'East Delhi',
             fill: data.fill || 0, capacity: data.capacity || 120,
             lat: data.lat, lng: data.lng, fillRate: data.fillRate || 1.5 });
    return db.prepare('SELECT * FROM bins WHERE id = ?').get(data.id);
  },
  updateFill: async (id, fill) => { db.prepare('UPDATE bins SET fill = ? WHERE id = ?').run(fill, id); },
  delete:     async (id) => { db.prepare('DELETE FROM bins WHERE id = ?').run(id); },
  collect:    async (id, fill) => { db.prepare('UPDATE bins SET fill = ? WHERE id = ?').run(fill, id); },
  tick:       async () => {
    const bins = db.prepare('SELECT * FROM bins').all();
    const update = db.prepare('UPDATE bins SET fill = ? WHERE id = ?');
    const txn = db.transaction(() => {
      for (const b of bins) {
        update.run(Math.min(100, b.fill + (b.fillRate || 1.5)), b.id);
      }
    });
    txn();
    return db.prepare('SELECT * FROM bins ORDER BY id').all();
  },
  randomize:  async () => {
    const bins = db.prepare('SELECT * FROM bins').all();
    const update = db.prepare('UPDATE bins SET fill = ? WHERE id = ?');
    const txn = db.transaction(() => {
      for (const b of bins) {
        update.run(Math.floor(5 + Math.random() * 95), b.id);
      }
    });
    txn();
    return db.prepare('SELECT * FROM bins ORDER BY id').all();
  },
};

const Trucks = {
  getAll:   async () => db.prepare('SELECT * FROM trucks ORDER BY id').all().map(parseTruck),
  getById:  async (id) => parseTruck(db.prepare('SELECT * FROM trucks WHERE id = ?').get(id)),
  insert:   async (data) => {
    db.prepare(`INSERT INTO trucks (id, name, driverName, color, lat, lng, depotLat, depotLng, zone)
                VALUES (@id, @name, @driverName, @color, @lat, @lng, @depotLat, @depotLng, @zone)`)
      .run({ id: data.id, name: data.name, driverName: data.driverName || 'Unassigned',
             color: data.color || '#6b7280', lat: data.lat, lng: data.lng,
             depotLat: data.lat, depotLng: data.lng, zone: data.zone || 'All' });
    return parseTruck(db.prepare('SELECT * FROM trucks WHERE id = ?').get(data.id));
  },
  update:   async (id, data) => {
    const fields = [];
    const values = {};
    if (data.lat !== undefined)        { fields.push('lat = @lat');             values.lat = data.lat; }
    if (data.lng !== undefined)        { fields.push('lng = @lng');             values.lng = data.lng; }
    if (data.status !== undefined)     { fields.push('status = @status');       values.status = data.status; }
    if (data.route !== undefined)      { fields.push('route = @route');         values.route = JSON.stringify(data.route); }
    if (data.routeIndex !== undefined) { fields.push('routeIndex = @routeIndex'); values.routeIndex = data.routeIndex; }
    if (data.collected !== undefined)  { fields.push('collected = @collected'); values.collected = data.collected; }
    if (fields.length > 0) {
      values.id = id;
      db.prepare(`UPDATE trucks SET ${fields.join(', ')} WHERE id = @id`).run(values);
    }
  },
  delete:   async (id) => { db.prepare('DELETE FROM trucks WHERE id = ?').run(id); },
  reset:    async () => {
    db.prepare(`UPDATE trucks SET lat = depotLat, lng = depotLng, status = 'idle',
                route = '[]', routeIndex = 0, collected = 0`).run();
  },
};

const Reports = {
  getAll:       async () => db.prepare('SELECT * FROM reports ORDER BY timestamp DESC').all().map(r => { r.urgent = !!r.urgent; return r; }),
  getById:      async (id) => { const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(id); if (r) r.urgent = !!r.urgent; return r || null; },
  insert:       async (data) => {
    db.prepare(`INSERT INTO reports (id, binId, binLocation, type, description, reporterName, status, urgent, timestamp)
                VALUES (@id, @binId, @binLocation, @type, @description, @reporterName, @status, @urgent, @timestamp)`)
      .run({ id: data.id, binId: data.binId, binLocation: data.binLocation, type: data.type,
             description: data.description || '', reporterName: data.reporterName || 'Anonymous',
             status: data.status || 'open', urgent: data.urgent ? 1 : 0,
             timestamp: data.timestamp || new Date().toISOString() });
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(data.id);
    if (r) r.urgent = !!r.urgent;
    return r;
  },
  updateStatus: async (id, status) => { db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id); },
};

const Notifications = {
  getAll: async (role, driverId) => {
    const all = db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 60').all();
    return all
      .filter(n => n.forRole === 'all' || n.forRole === role || (role === 'driver' && n.forDriver === driverId))
      .map(n => { n.type = n.ntype; delete n.ntype; n.read = !!n.read; return n; });
  },
  insert: async (data) => {
    db.prepare(`INSERT INTO notifications (id, title, message, ntype, binId, reportId, forRole, forDriver, timestamp)
                VALUES (@id, @title, @message, @ntype, @binId, @reportId, @forRole, @forDriver, @timestamp)`)
      .run({ id: data.id, title: data.title, message: data.message || '',
             ntype: data.type || 'info', binId: data.binId || null, reportId: data.reportId || null,
             forRole: data.forRole || 'all', forDriver: data.forDriver || null,
             timestamp: data.timestamp || new Date().toISOString() });
    const obj = db.prepare('SELECT * FROM notifications WHERE id = ?').get(data.id);
    if (obj) { obj.type = obj.ntype; delete obj.ntype; obj.read = !!obj.read; }
    return obj;
  },
  markRead:    async (id) => { db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id); },
  markAllRead: async (role, driverId) => {
    db.prepare(`UPDATE notifications SET read = 1
                WHERE forRole = 'all' OR forRole = ? OR forDriver = ?`)
      .run(role || 'all', driverId || '');
  },
};

const Users = {
  findByCredentials: async (username, password) => {
    return db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) || null;
  },
  getByUsername: async (username) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  },
  insert: async (data) => {
    db.prepare(`INSERT INTO users (username, password, role, name, truckId, status)
                VALUES (@username, @password, @role, @name, @truckId, @status)`)
      .run({ username: data.username, password: data.password, role: data.role,
             name: data.name, truckId: data.truckId || null,
             status: data.status || 'active' });
    return db.prepare('SELECT * FROM users WHERE username = ?').get(data.username);
  },
  getPending: async () => {
    return db.prepare("SELECT * FROM users WHERE status = 'pending' ORDER BY name").all();
  },
  approve: async (username) => {
    db.prepare("UPDATE users SET status = 'active' WHERE username = ?").run(username);
  },
  reject: async (username) => {
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
  },
  getAll: async () => {
    return db.prepare('SELECT username, role, name, truckId, status FROM users ORDER BY role, name').all();
  },
};

module.exports = { connect, Bins, Trucks, Reports, Notifications, Users };
