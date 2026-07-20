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

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function isValidOrderStatus(value) {
  return ['UNPAID', 'PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED'].includes(value);
}

// Public storefront: only expose products that are available to customers.
// This endpoint is intentionally separate from the admin API, which includes
// inactive products so they can still be edited or restored by an administrator.
app.get('/api/products', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48);
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const parameters = [];
    let categoryFilter = '';
    if (category) {
      categoryFilter = ' AND c.Name = ?';
      parameters.push(category);
    }
    const [products] = await pool.execute(
      `SELECT p.Id AS id,
              p.SKU AS sku,
              p.Title AS title,
              p.Description AS description,
              p.Price AS price,
              p.ImageUrl AS imageUrl,
              b.Name AS brandName,
              c.Name AS categoryName
       FROM Products p
       INNER JOIN Brands b ON b.Id = p.BrandId
       LEFT JOIN Categories c ON c.Id = p.CategoryId
       WHERE p.IsActive = 1
       ${categoryFilter}
       ORDER BY p.CreatedAt DESC, p.Id DESC
       LIMIT ${limit}`,
      parameters
    );
    return res.json({ products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Không thể tải sản phẩm.' });
  }
});

// Admin product management
app.get('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT p.Id as id, p.SKU as sku, p.Title as title, p.Description as description, p.Price as price, p.ImageUrl as imageUrl, p.BrandId as brandId, p.CategoryId as categoryId, p.IsActive as isActive, p.CreatedAt as createdAt, b.Name as brandName, c.Name as categoryName FROM Products p JOIN Brands b ON b.Id = p.BrandId LEFT JOIN Categories c ON c.Id = p.CategoryId ORDER BY p.Id DESC`);
    return res.json({ products: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi lấy sản phẩm.' });
  }
});

app.post('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  const { sku, title, description, price, imageUrl, brandId, categoryId, isActive } = req.body;
  let connection;
  if (!title || typeof price === 'undefined') return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' });
  try {
    if (!sku || !isPositiveNumber(price) || !brandId) return res.status(400).json({ message: 'SKU, price and brand are required.' });
    const primaryImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO Products (SKU, Title, Description, Price, ImageUrl, BrandId, CategoryId, IsActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [sku.trim(), title.trim(), description || null, Number(price), primaryImageUrl || null, Number(brandId), categoryId ? Number(categoryId) : null, isActive === false || isActive === 0 ? 0 : 1]);
    if (primaryImageUrl) await connection.execute('INSERT INTO ProductImages (ProductId, ImageUrl, Position) VALUES (?, ?, 1)', [result.insertId, primaryImageUrl]);
    await connection.commit();
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi tạo sản phẩm.' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  const id = req.params.id;
  const { sku, title, description, price, imageUrl, brandId, categoryId, isActive } = req.body;
  let connection;
  try {
    if (!sku || !title || !isPositiveNumber(price) || !brandId) return res.status(400).json({ message: 'SKU, title, price and brand are required.' });
    const primaryImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute('UPDATE Products SET SKU = ?, Title = ?, Description = ?, Price = ?, ImageUrl = ?, BrandId = ?, CategoryId = ?, IsActive = ? WHERE Id = ?', [sku.trim(), title.trim(), description || null, Number(price), primaryImageUrl || null, Number(brandId), categoryId ? Number(categoryId) : null, isActive === false || isActive === 0 ? 0 : 1, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    if (primaryImageUrl) {
      await connection.execute('INSERT INTO ProductImages (ProductId, ImageUrl, Position) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE ImageUrl = VALUES(ImageUrl)', [id, primaryImageUrl]);
    } else {
      await connection.execute('DELETE FROM ProductImages WHERE ProductId = ? AND Position = 1', [id]);
    }
    await connection.commit();
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
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi xóa sản phẩm.' });
  }
});

app.get('/api/admin/catalog', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [brands] = await pool.execute('SELECT Id as id, Name as name FROM Brands ORDER BY Name');
    const [categories] = await pool.execute("SELECT Id as id, Name as name FROM Categories WHERE Name IN ('Men', 'Women', 'Collection') ORDER BY FIELD(Name, 'Men', 'Women', 'Collection')");
    return res.json({ brands, categories });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to load product catalog.' });
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

app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'Name, email and password (at least 6 characters) are required.' });
  if (!['ADMIN', 'ROLE_ADMIN', 'ROLE_USER'].includes(role || 'ROLE_USER')) return res.status(400).json({ message: 'Invalid role.' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute('INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)', [name.trim(), email.trim(), passwordHash, role || 'ROLE_USER']);
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists.' });
    console.error(err);
    return res.status(500).json({ message: 'Unable to create user.' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !['ADMIN', 'ROLE_ADMIN', 'ROLE_USER'].includes(role)) return res.status(400).json({ message: 'Name, email and a valid role are required.' });
  if (password && password.length < 6) return res.status(400).json({ message: 'Password must have at least 6 characters.' });
  try {
    const params = [name.trim(), email.trim(), role];
    let sql = 'UPDATE Users SET Name = ?, Email = ?, Role = ?';
    if (password) { sql += ', PasswordHash = ?'; params.push(await bcrypt.hash(password, 10)); }
    sql += ' WHERE Id = ?'; params.push(req.params.id);
    const [result] = await pool.execute(sql, params);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists.' });
    console.error(err);
    return res.status(500).json({ message: 'Unable to update user.' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
  try {
    const [result] = await pool.execute('DELETE FROM Users WHERE Id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to delete user.' });
  }
});

// Admin orders list
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT o.Id as id,
             o.OrderCode as orderCode,
             COALESCE(u.Name, 'Khách vãng lai') as customerName,
             o.RecipientName as recipientName,
             o.RecipientPhone as recipientPhone,
             o.RecipientAddress as recipientAddress,
             o.Note as note,
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

app.post('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  const { orderCode, recipientName, recipientPhone, recipientAddress, paymentMethod, status, totalAmount, note } = req.body;
  if (!orderCode || !recipientName || !recipientPhone || !recipientAddress || !['COD', 'VNPAY'].includes(paymentMethod) || !isValidOrderStatus(status) || !isPositiveNumber(totalAmount)) return res.status(400).json({ message: 'Please provide all required order details.' });
  try {
    const [result] = await pool.execute('INSERT INTO Orders (OrderCode, RecipientName, RecipientPhone, RecipientAddress, PaymentMethod, Status, TotalAmount, Note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [orderCode.trim(), recipientName.trim(), recipientPhone.trim(), recipientAddress.trim(), paymentMethod, status, Number(totalAmount), note || null]);
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Order code already exists.' });
    console.error(err);
    return res.status(500).json({ message: 'Unable to create order.' });
  }
});

app.put('/api/admin/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  const { recipientName, recipientPhone, recipientAddress, paymentMethod, status, totalAmount, note } = req.body;
  if (!recipientName || !recipientPhone || !recipientAddress || !['COD', 'VNPAY'].includes(paymentMethod) || !isValidOrderStatus(status) || !isPositiveNumber(totalAmount)) return res.status(400).json({ message: 'Please provide all required order details.' });
  try {
    const [result] = await pool.execute('UPDATE Orders SET RecipientName = ?, RecipientPhone = ?, RecipientAddress = ?, PaymentMethod = ?, Status = ?, TotalAmount = ?, Note = ? WHERE Id = ?', [recipientName.trim(), recipientPhone.trim(), recipientAddress.trim(), paymentMethod, status, Number(totalAmount), note || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to update order.' });
  }
});

app.delete('/api/admin/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM Orders WHERE Id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
    return res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to delete order.' });
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


