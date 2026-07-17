const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
  });

  const users = [
    { name: 'Admin User', email: 'admin@owen.vn', password: 'Admin@123', role: 'ADMIN' },
    { name: 'Demo User', email: 'demo@owen.vn', password: 'Demo@123', role: 'ROLE_USER' }
  ];

  try {
    for (const item of users) {
      const passwordHash = await bcrypt.hash(item.password, 10);
      const [rows] = await pool.execute('SELECT Id FROM Users WHERE Email = ?', [item.email]);
      if (rows.length) {
        console.log('User already exists:', item.email);
      } else {
        const [res] = await pool.execute('INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)', [item.name, item.email, passwordHash, item.role]);
        console.log('Inserted user id =', res.insertId, 'email =', item.email, 'role =', item.role);
      }
    }
  } catch (err) {
    console.error('Error seeding users:', err);
  } finally {
    await pool.end();
  }
}

run().catch(console.error);
