/**
 * Offline Database Service
 * Simplified interface for React components to interact with the offline database
 * Uses CDN loading to avoid webpack issues
 */

class OfflineDatabaseService {
  constructor() {
    this.isInitialized = false;
    this.db = null;
    this.SQL = null;
    this.initPromise = null;
  }

  /**
   * Initialize the database (call once)
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('🔄 Initializing Offline Database Service...');

      // Load SQL.js from CDN
      if (!window.initSqlJs) {
        await this._loadSqlJs();
      }

      // Initialize SQL.js
      this.SQL = await window.initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });

      // Create database
      this.db = new this.SQL.Database();

      // Create tables
      await this._createTables();

      // Insert default data
      await this._insertDefaultData();

      this.isInitialized = true;
      console.log('✅ Offline Database Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing database service:', error);
      throw error;
    }
  }

  /**
   * Load SQL.js from CDN
   */
  async _loadSqlJs() {
    return new Promise((resolve, reject) => {
      if (window.initSqlJs) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Create database tables
   */
  async _createTables() {
    const createRoomsTable = `
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE NOT NULL,
        room_type TEXT NOT NULL,
        price_per_night DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'Available',
        amenities TEXT,
        max_occupancy INTEGER DEFAULT 2,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        needs_sync INTEGER DEFAULT 1
      )
    `;

    const createGuestsTable = `
      CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        needs_sync INTEGER DEFAULT 1
      )
    `;

    const createReservationsTable = `
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        check_in_date TEXT NOT NULL,
        check_out_date TEXT NOT NULL,
        total_amount DECIMAL(10,2),
        status TEXT DEFAULT 'Confirmed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        needs_sync INTEGER DEFAULT 1,
        FOREIGN KEY (guest_id) REFERENCES guests(id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        fullName TEXT NOT NULL,
        role TEXT DEFAULT 'staff',
        department TEXT,
        avatar_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        needs_sync INTEGER DEFAULT 1
      )
    `;

    this.db.run(createRoomsTable);
    this.db.run(createGuestsTable);
    this.db.run(createReservationsTable);
    this.db.run(createUsersTable);

    // Columns needed to tie a guest / reservation to a room and track its state
    this._addColumnIfMissing('guests', 'room_id', 'INTEGER');
    this._addColumnIfMissing('guests', 'status', "TEXT DEFAULT 'Checked In'");
    this._addColumnIfMissing('guests', 'gender', 'TEXT');
    this._addColumnIfMissing('guests', 'check_in', 'TEXT');
    this._addColumnIfMissing('guests', 'check_out', 'TEXT');
    this._addColumnIfMissing('reservations', 'guest_name', 'TEXT');
  }

  _addColumnIfMissing(table, column, definition) {
    const info = this.db.exec(`PRAGMA table_info(${table})`);
    const existing = info.length ? info[0].values.map(row => row[1]) : [];
    if (!existing.includes(column)) {
      this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  _rows(sql, params = []) {
    const result = this.db.exec(sql, params);
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  /**
   * Insert default room data
   */
  async _insertDefaultData() {
    // No mock data for production - rooms will be loaded from Supabase
    console.log('Production mode: No mock data inserted');
  }

  /**
   * Check if database is ready
   */
  isReady() {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Get all rooms
   */
  async getRooms() {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const result = this.db.exec("SELECT * FROM rooms ORDER BY room_number");
      if (result.length === 0) return [];

      const columns = result[0].columns;
      const rows = result[0].values;

      return rows.map(row => {
        const room = {};
        columns.forEach((col, index) => {
          room[col] = row[index];
        });
        
        // Parse amenities JSON
        if (room.amenities) {
          try {
            room.amenities = JSON.parse(room.amenities);
          } catch (e) {
            room.amenities = [];
          }
        }
        
        return room;
      });
    } catch (error) {
      console.error('Error getting rooms:', error);
      throw error;
    }
  }

  /**
   * Get rooms by status
   */
  async getRoomsByStatus(status) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const result = this.db.exec("SELECT * FROM rooms WHERE status = ? ORDER BY room_number", [status]);
      if (result.length === 0) return [];

      const columns = result[0].columns;
      const rows = result[0].values;

      return rows.map(row => {
        const room = {};
        columns.forEach((col, index) => {
          room[col] = row[index];
        });
        return room;
      });
    } catch (error) {
      console.error('Error getting rooms by status:', error);
      throw error;
    }
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId, status) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE rooms 
        SET status = ?, updated_at = ?, needs_sync = 1
        WHERE id = ?
      `);
      stmt.run([status, new Date().toISOString(), roomId]);
      stmt.free();

      console.log(`✅ Updated room ${roomId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating room status:', error);
      throw error;
    }
  }

  /**
   * Get room by number
   */
  async getRoomByNumber(roomNumber) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const result = this.db.exec("SELECT * FROM rooms WHERE room_number = ?", [roomNumber]);
      if (result.length === 0) return null;

      const columns = result[0].columns;
      const row = result[0].values[0];

      const room = {};
      columns.forEach((col, index) => {
        room[col] = row[index];
      });

      // Parse amenities JSON
      if (room.amenities) {
        try {
          room.amenities = JSON.parse(room.amenities);
        } catch (e) {
          room.amenities = [];
        }
      }

      return room;
    } catch (error) {
      console.error('Error getting room by number:', error);
      throw error;
    }
  }

  /**
   * Create a new guest (optionally assigned to a room)
   */
  async createGuest(guestData) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const fullName = (guestData.name || guestData.fullName || '').trim();
      const [first, ...rest] = fullName.split(' ').filter(Boolean);
      const firstName = guestData.first_name || guestData.firstName || first || 'Guest';
      const lastName = guestData.last_name || guestData.lastName || rest.join(' ') || '-';
      const toIso = (d) => (d ? new Date(d).toISOString() : null);
      const now = new Date().toISOString();

      this.db.run(
        `INSERT INTO guests (first_name, last_name, email, phone, address, gender, room_id, status, check_in, check_out, created_at, updated_at, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          firstName,
          lastName,
          guestData.email || null,
          guestData.phone || null,
          guestData.address || null,
          guestData.gender || null,
          guestData.room_id ?? guestData.room ?? null,
          guestData.status || 'Checked In',
          toIso(guestData.check_in || guestData.checkIn),
          toIso(guestData.check_out || guestData.checkOut),
          now,
          now
        ]
      );

      const insertedId = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      console.log(`✅ Created new guest with ID: ${insertedId}`);
      await this.reconcileRoomStatuses();
      return insertedId;
    } catch (error) {
      console.error('Error creating guest:', error);
      throw error;
    }
  }

  /**
   * Get all guests, shaped the way the guest screens expect
   */
  async getGuests() {
    if (!this.isReady()) {
      await this.initialize();
    }

    const rooms = this._rows('SELECT id, room_number FROM rooms');
    const roomNumberById = new Map(rooms.map(r => [r.id, r.room_number]));

    return this._rows('SELECT * FROM guests ORDER BY id DESC').map(g => ({
      ...g,
      name: `${g.first_name} ${g.last_name === '-' ? '' : g.last_name}`.trim(),
      room: g.room_id,
      room_name: g.room_id != null ? `Room ${roomNumberById.get(g.room_id) ?? g.room_id}` : null,
      checkIn: g.check_in,
      checkOut: g.check_out
    }));
  }

  /**
   * Update a guest and release / take rooms accordingly
   */
  async updateGuest(id, updates) {
    if (!this.isReady()) {
      await this.initialize();
    }

    const columns = {
      first_name: updates.first_name ?? updates.firstName,
      last_name: updates.last_name ?? updates.lastName,
      email: updates.email,
      phone: updates.phone,
      address: updates.address,
      gender: updates.gender,
      room_id: updates.room_id ?? updates.room,
      status: updates.status,
      check_in: updates.check_in ?? updates.checkIn,
      check_out: updates.check_out ?? updates.checkOut
    };
    ['check_in', 'check_out'].forEach(k => {
      if (columns[k]) columns[k] = new Date(columns[k]).toISOString();
    });

    const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      this.db.run(
        `UPDATE guests SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ?, needs_sync = 1 WHERE id = ?`,
        [...entries.map(([, v]) => v), new Date().toISOString(), id]
      );
    }
    await this.reconcileRoomStatuses();
    return true;
  }

  /**
   * Delete a guest (and any reservations that belong to them)
   */
  async deleteGuest(id) {
    if (!this.isReady()) {
      await this.initialize();
    }

    this.db.run('DELETE FROM reservations WHERE guest_id = ?', [id]);
    this.db.run('DELETE FROM guests WHERE id = ?', [id]);
    await this.reconcileRoomStatuses();
    return true;
  }

  /**
   * Create a new reservation
   */
  async createReservation(reservationData) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      if (reservationData.guest_id === undefined || reservationData.guest_id === null) {
        throw new Error('A reservation needs a guest (guest_id).');
      }

      const now = new Date().toISOString();
      this.db.run(
        `INSERT INTO reservations (guest_id, guest_name, room_id, check_in_date, check_out_date, total_amount, status, created_at, updated_at, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          reservationData.guest_id,
          reservationData.guest_name || null,
          reservationData.room_id,
          reservationData.check_in_date,
          reservationData.check_out_date,
          reservationData.total_amount ?? 0,
          reservationData.status || 'Confirmed',
          now,
          now
        ]
      );

      const insertedId = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      console.log(`✅ Created new reservation with ID: ${insertedId}`);
      await this.reconcileRoomStatuses();
      return insertedId;
    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  }

  async getReservations() {
    if (!this.isReady()) {
      await this.initialize();
    }
    return this._rows('SELECT * FROM reservations ORDER BY check_in_date DESC');
  }

  async updateReservation(id, updates) {
    if (!this.isReady()) {
      await this.initialize();
    }

    const allowed = ['guest_id', 'guest_name', 'room_id', 'check_in_date', 'check_out_date', 'total_amount', 'status'];
    const entries = Object.entries(updates || {}).filter(([k, v]) => allowed.includes(k) && v !== undefined);
    if (entries.length > 0) {
      this.db.run(
        `UPDATE reservations SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ?, needs_sync = 1 WHERE id = ?`,
        [...entries.map(([, v]) => v), new Date().toISOString(), id]
      );
    }
    await this.reconcileRoomStatuses();
    return true;
  }

  async deleteReservation(id) {
    if (!this.isReady()) {
      await this.initialize();
    }
    this.db.run('DELETE FROM reservations WHERE id = ?', [id]);
    await this.reconcileRoomStatuses();
    return true;
  }

  /**
   * Make every room's Occupied / Reserved / Available status agree with the
   * guests and reservations that exist. Maintenance is a manual state and is
   * never changed. Returns the number of rooms that were corrected.
   */
  async reconcileRoomStatuses() {
    if (!this.isReady()) {
      await this.initialize();
    }

    const norm = (v) => String(v ?? '').toLowerCase().replace(/[_-]/g, ' ').trim();
    const rooms = this._rows('SELECT id, status FROM rooms');
    const guests = this._rows('SELECT room_id, status FROM guests WHERE room_id IS NOT NULL');
    const reservations = this._rows('SELECT room_id, status FROM reservations');

    const occupied = new Set();
    const reserved = new Set();
    guests.forEach(g => {
      const st = norm(g.status);
      if (st === 'checked in') occupied.add(Number(g.room_id));
      else if (st === 'reserved') reserved.add(Number(g.room_id));
    });
    reservations.forEach(r => {
      const st = norm(r.status);
      if (st === 'checked in') occupied.add(Number(r.room_id));
      else if (st === 'reserved' || st === 'confirmed') reserved.add(Number(r.room_id));
    });

    const now = new Date().toISOString();
    let changed = 0;
    rooms.forEach(room => {
      if (norm(room.status) === 'maintenance') return;
      const expected = occupied.has(room.id) ? 'Occupied' : reserved.has(room.id) ? 'Reserved' : 'Available';
      if (room.status !== expected) {
        this.db.run('UPDATE rooms SET status = ?, updated_at = ?, needs_sync = 1 WHERE id = ?', [expected, now, room.id]);
        changed += 1;
      }
    });
    if (changed) console.log(`🔧 Reconciled ${changed} room status(es)`);
    return changed;
  }

  /**
   * Revenue summary (the offline database does not track payments yet)
   */
  async getRevenue() {
    return { total: 0, dates: [], values: [] };
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const roomCount = this.db.exec("SELECT COUNT(*) as count FROM rooms")[0].values[0][0];
      const availableRooms = this.db.exec("SELECT COUNT(*) as count FROM rooms WHERE status = 'Available'")[0].values[0][0];
      const occupiedRooms = this.db.exec("SELECT COUNT(*) as count FROM rooms WHERE status = 'Occupied'")[0].values[0][0];
      const guestCount = this.db.exec("SELECT COUNT(*) as count FROM guests")[0].values[0][0];
      const reservationCount = this.db.exec("SELECT COUNT(*) as count FROM reservations")[0].values[0][0];

      return {
        totalRooms: roomCount,
        availableRooms,
        occupiedRooms,
        totalGuests: guestCount,
        totalReservations: reservationCount,
        occupancyRate: roomCount > 0 ? ((occupiedRooms / roomCount) * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const result = this.db.exec("SELECT * FROM users WHERE email = ?", [email]);
      if (result.length === 0) return null;

      const columns = result[0].columns;
      const row = result[0].values[0];

      const user = {};
      columns.forEach((col, index) => {
        user[col] = row[index];
      });

      return user;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (email, fullName, role, department, avatar_url, created_at, updated_at, needs_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `);
      
      const now = new Date().toISOString();
      stmt.run([
        userData.email,
        userData.fullName,
        userData.role || 'staff',
        userData.department,
        userData.avatar_url || '',
        now,
        now
      ]);
      stmt.free();

      // Get the inserted user
      const insertedId = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      console.log(`✅ Created new user with ID: ${insertedId}`);
      
      return insertedId;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
}

// Create singleton instance
const offlineDatabaseService = new OfflineDatabaseService();

export default offlineDatabaseService; 