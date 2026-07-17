const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'ChangeThisSecret';

const htmlPages = ['index.html', 'men.html', 'women.html', 'collection.html', 'stories.html', 'about.html'];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTML', 'index.html'));
});

htmlPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'HTML', page));
  });
});

app.use('/Images', express.static(path.join(__dirname, 'Images')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/script.js', express.static(path.join(__dirname, 'script.js')));

// Admin static assets and admin UI
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/assets/css/admin', express.static(path.join(__dirname, 'assets', 'css', 'admin')));
app.use('/assets/js/admin', express.static(path.join(__dirname, 'assets', 'js', 'admin')));

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;
(async function initPool(){
  try {
    pool = mysql.createPool(poolConfig);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('Database Connection Failed! Bad Config: ', err);
    process.exit(1);
  }
})();

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role || 'ROLE_USER' }, jwtSecret, { expiresIn: '12h' });
}

async function getUserByEmail(email) {
  const [rows] = await pool.execute('SELECT Id as id, Name as name, Email as email, PasswordHash as passwordHash, Role as role FROM Users WHERE Email = ?', [email]);
  return rows[0];
}

async function createUser(name, email, passwordHash, role = 'ROLE_USER') {
  const [result] = await pool.execute('INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role]);
  return { id: result.insertId };
}

function buildUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'ROLE_USER'
  };
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Tên, email và password là bắt buộc.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password phải có ít nhất 6 ký tự.' });
  }

  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email này đã được đăng ký.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await createUser(name, email, passwordHash);
    const user = { id: inserted.id, name: name, email: email };
    const token = generateToken(user);
    return res.status(201).json({ user: buildUserResponse(user), token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email và password là bắt buộc.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc password không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc password không chính xác.' });
    }

    const token = generateToken(user);
    return res.json({ user: buildUserResponse(user), token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
}

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT Id as id, Name as name, Email as email, Role as role FROM Users WHERE Id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

// Admin check middleware
async function isAdmin(req, res, next) {
  if (!req.user || !req.user.id) return res.sendStatus(401);
  try {
    const [rows] = await pool.execute('SELECT Role as role FROM Users WHERE Id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || (user.role !== 'ADMIN' && user.role !== 'ROLE_ADMIN')) {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// Admin product management (basic CRUD)
app.get('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT Id as id, Title as title, Description as description, Price as price, ImageUrl as imageUrl, CreatedAt as createdAt FROM Products ORDER BY Id DESC');
    return res.json({ products: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi lấy sản phẩm.' });
  }
});

app.post('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  const { title, description, price, imageUrl } = req.body;
  if (!title || typeof price === 'undefined') return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' });
  try {
    const [result] = await pool.execute('INSERT INTO Products (Title, Description, Price, ImageUrl) VALUES (?, ?, ?, ?)', [title, description || null, price, imageUrl || null]);
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi tạo sản phẩm.' });
  }
});

app.put('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const id = req.params.id;
  const { title, description, price, imageUrl } = req.body;
  try {
    const [result] = await pool.execute('UPDATE Products SET Title = ?, Description = ?, Price = ?, ImageUrl = ? WHERE Id = ?', [title, description, price, imageUrl, id]);
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm.' });
  }
});

app.delete('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await pool.execute('DELETE FROM Products WHERE Id = ?', [id]);
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi xóa sản phẩm.' });
  }
});

// Admin - list users
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT Id as id, Name as name, Email as email, Role as role, CreatedAt as createdAt FROM Users ORDER BY Id DESC');
    return res.json({ users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách người dùng.' });
  }
});

// Admin orders list
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT o.Id as id,
             o.OrderCode as orderCode,
             COALESCE(u.Name, 'Khách vãng lai') as customerName,
             o.Status as status,
             o.PaymentMethod as paymentMethod,
             o.TotalAmount as totalAmount,
             o.CreatedAt as createdAt
      FROM Orders o
      LEFT JOIN Users u ON u.Id = o.UserId
      ORDER BY o.CreatedAt DESC
    `);
    return res.json({ orders: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng.' });
  }
});

// Admin stats (basic)
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [[{ cnt: totalProducts }]] = await pool.query('SELECT COUNT(*) as cnt FROM Products');
    const [[{ cnt: totalUsers }]] = await pool.query('SELECT COUNT(*) as cnt FROM Users');
    return res.json({ totalProducts, totalUsers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi lấy thống kê.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


