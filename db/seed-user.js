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

  const name = 'Demo User';
  const email = 'demo@owen.vn';
  const password = 'Demo@123'; // mật khẩu demo (thay đổi nếu cần)
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const [rows] = await pool.execute('SELECT Id FROM Users WHERE Email = ?', [email]);
    if (rows.length) {
      console.log('User already exists:', email);
    } else {
      const [res] = await pool.execute('INSERT INTO Users (Name, Email, PasswordHash) VALUES (?, ?, ?)', [name, email, passwordHash]);
      console.log('Inserted demo user id =', res.insertId);
      console.log('Email:', email, 'Password:', password);
    }
  } catch (err) {
    console.error('Error seeding user:', err);
  } finally {
    await pool.end();
  }
}

run().catch(console.error);
