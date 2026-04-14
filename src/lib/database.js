let db = null;

// Инициализация базы данных
export async function initDatabase() {
  if (db) return db;
  
  const loadSqlJs = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/sql-wasm.js';
      script.onload = () => {
        window.initSqlJs({
          locateFile: () => '/sql-wasm.wasm'
        }).then(resolve).catch(reject);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };
  
  const SQL = await loadSqlJs();
  const savedDb = localStorage.getItem('studio_db');
  
  if (savedDb) {
    const uint8Array = new Uint8Array(JSON.parse(savedDb));
    db = new SQL.Database(uint8Array);
  } else {
    db = new SQL.Database();
    await createTables(db);
    await insertTestData(db);
  }
  
  saveDatabase();
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const json = JSON.stringify([...data]);
  localStorage.setItem('studio_db', json);
}

async function createTables(db) {
  // 1. Таблица студий
  db.run(`
    CREATE TABLE IF NOT EXISTS studios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Таблица услуг
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studio_id INTEGER REFERENCES studios(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      service_type TEXT CHECK (service_type IN ('offline', 'online')) NOT NULL,
      estimated_duration_minutes INTEGER NOT NULL,
      media_urls TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Таблица слотов (для оффлайн записи)
  db.run(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_booked INTEGER DEFAULT 0,
      worker_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Таблица заказов
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      studio_name TEXT,
      title TEXT,
      description TEXT,
      reference_link TEXT,
      deadline_date TEXT,
      comments TEXT,
      booking_date TEXT,
      start_time TEXT,
      end_time TEXT,
      total_price REAL,
      prepaid_amount REAL,
      is_prepaid INTEGER DEFAULT 0,
      worker_id TEXT,
      worker_earnings REAL,
      status TEXT DEFAULT 'awaiting_payment',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Таблица профилей пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_phone TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      avatar TEXT,
      role TEXT DEFAULT 'client',
      worker_percentage REAL DEFAULT 30.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function insertTestData(db) {
  // Студии
  db.run(`
    INSERT OR IGNORE INTO studios (id, name, slug, description) VALUES 
      (1, 'Студия звукозаписи Mini', 'mini', 'Компактная студия для быстрой записи'),
      (2, 'Студия звукозаписи Pro', 'pro', 'Профессиональная студия для качественной записи'),
      (3, 'Видеостудия', 'video', 'Зеленый экран и 4K камеры'),
      (4, 'Студия монтажа', 'editing', 'Мощные компьютеры для монтажа')
  `);

  // Услуги
  db.run(`
    INSERT OR IGNORE INTO services (id, studio_id, name, description, price, service_type, estimated_duration_minutes, is_active) 
    VALUES 
      (1, 1, 'Запись вокала', 'Профессиональная запись вокала с звукорежиссером', 3000, 'offline', 60, 1),
      (2, 1, 'Экспресс сведение', 'Быстрое сведение вашей песни за 24 часа', 700, 'online', 1440, 1),
      (3, 1, 'Аренда студии', 'Аренда студии с оборудованием', 2000, 'offline', 60, 1),
      (4, 2, 'Сведение трека', 'Чистовое сведение', 5000, 'online', 120, 1),
      (5, 2, 'Мастеринг', 'Финальная обработка', 3000, 'online', 60, 1),
      (6, 3, 'Съемка клипа', 'Профессиональная видеосъемка', 15000, 'offline', 240, 1),
      (7, 3, 'Съемка интервью', 'Студийная съемка', 8000, 'offline', 120, 1),
      (8, 4, 'Монтаж видео', 'Монтаж любой сложности', 7000, 'online', 180, 1),
      (9, 4, 'Цветокоррекция', 'Профессиональная цветокоррекция', 4000, 'online', 60, 1)
  `);

  // Тестовые слоты для "Запись вокала"
  const existingSlots = db.exec("SELECT COUNT(*) as count FROM slots");
  if (existingSlots[0]?.values[0][0] === 0) {
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const slotsData = [
        { start: '10:00', end: '13:00' },
        { start: '13:00', end: '16:00' },
        { start: '16:00', end: '19:00' },
        { start: '19:00', end: '22:00' }
      ];
      
      for (const slot of slotsData) {
        db.run(`
          INSERT INTO slots (service_id, date, start_time, end_time, is_booked)
          VALUES (1, '${dateStr}', '${slot.start}', '${slot.end}', 0)
        `);
      }
    }
  }

  // Тестовые пользователи с ролями
  const existingProfiles = db.exec("SELECT COUNT(*) as count FROM user_profiles");
  if (existingProfiles[0]?.values[0][0] === 0) {
    db.run(`
      INSERT INTO user_profiles (user_phone, username, role, worker_percentage) VALUES 
        ('+76767676767', 'Работник Сергей', 'worker', 40.0),
        ('+75252525252', 'Админ Евгений', 'admin', 50.0)
    `);
  }
}

export async function query(sql, params = []) {
  const dbInstance = await initDatabase();
  try {
    const result = dbInstance.exec(sql, params);
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i] });
      return obj;
    });
  } catch (error) {
    console.error('SQL Error:', error);
    return [];
  }
}

export async function run(sql, params = []) {
  const dbInstance = await initDatabase();
  dbInstance.run(sql, params);
  saveDatabase();
}

export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}