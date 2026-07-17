const API_BASE_URL = 'http://localhost:3000';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Network error ${res.status}`);
  }
  return res.json();
}

const sidebar = document.getElementById('sidebar');
const pageTitle = document.getElementById('pageTitle');
const pageArea = document.getElementById('pageArea');
const toggleBtn = document.getElementById('toggleSidebar');

document.querySelectorAll('.sidebar nav li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('.sidebar nav li').forEach(n => n.classList.remove('active'));
    li.classList.add('active');
    loadPage(li.getAttribute('data-page'));
  });
});

toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

async function loadPage(page) {
  pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  pageArea.innerHTML = '<p>Loading...</p>';

  if (!await ensureAuth()) {
    return;
  }

  try {
    if (page === 'dashboard') {
      const stats = await fetchJSON(`${API_BASE_URL}/api/admin/stats`, {
        headers: { Authorization: getAuthHeader() }
      });
      document.getElementById('totalProducts').textContent = stats.totalProducts;
      document.getElementById('totalUsers').textContent = stats.totalUsers;
      pageArea.innerHTML = '<p>Quick statistics are shown above.</p>';
    } else if (page === 'products') {
      const data = await fetchJSON(`${API_BASE_URL}/api/admin/products`, {
        headers: { Authorization: getAuthHeader() }
      });
      renderProducts(data.products || []);
    } else if (page === 'orders') {
      const data = await fetchJSON(`${API_BASE_URL}/api/admin/orders`, {
        headers: { Authorization: getAuthHeader() }
      });
      renderOrders(data.orders || []);
    } else if (page === 'users') {
      const data = await fetchJSON(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: getAuthHeader() }
      });
      renderUsers(data.users || []);
    } else {
      pageArea.innerHTML = '<p>Not implemented yet.</p>';
    }
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('403')) {
      renderLogin(`Vui lï¿½ng dang nh?p admin d? truy c?p. ${escapeHtml(err.message)}`);
    } else {
      pageArea.innerHTML = `<p style="color:red">${escapeHtml(err.message)}</p>`;
    }
  }
}

async function ensureAuth() {
  const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  if (!token) {
    renderLogin('B?n c?n dang nh?p d? vï¿½o khu v?c Admin.');
    return false;
  }

  try {
    const profile = await fetchJSON(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!profile.user || (profile.user.role !== 'ADMIN' && profile.user.role !== 'ROLE_ADMIN')) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      renderLogin('Tï¿½i kho?n hi?n t?i khï¿½ng cï¿½ quy?n admin.');
      return false;
    }
    return true;
  } catch (err) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_token');
    renderLogin('Phiï¿½n dang nh?p khï¿½ng h?p l?. Vui lï¿½ng dang nh?p l?i.');
    return false;
  }
}

function renderLogin(message = '') {
  document.getElementById('totalProducts').textContent = 'ï¿½';
  document.getElementById('totalUsers').textContent = 'ï¿½';
  pageTitle.textContent = 'Admin Login';
  pageArea.innerHTML = `
    <div class="admin-login-box">
      <h2>Admin Login</h2>
      <p style="color:#d32f2f">${escapeHtml(message)}</p>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="adminEmail" placeholder="admin@owen.vn" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="adminPassword" placeholder="Password" />
      </div>
      <button id="adminLoginBtn" class="btn">Login</button>
    </div>
  `;
  document.getElementById('adminLoginBtn').addEventListener('click', handleAdminLogin);
}

async function handleAdminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  if (!email || !password) {
    renderLogin('Vui lï¿½ng nh?p email vï¿½ password admin.');
    return;
  }

  try {
    const data = await fetchJSON(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!data.user || !data.token) {
      renderLogin('ï¿½ang nh?p th?t b?i.');
      return;
    }
    if (data.user.role !== 'ADMIN' && data.user.role !== 'ROLE_ADMIN') {
      renderLogin('Tï¿½i kho?n khï¿½ng cï¿½ quy?n admin.');
      return;
    }
    localStorage.setItem('authToken', data.token);
    pageTitle.textContent = 'Dashboard';
    loadPage('dashboard');
  } catch (err) {
    renderLogin(err.message || 'ï¿½ang nh?p th?t b?i.');
  }
}

function renderProducts(products) {
  if (!products.length) return (pageArea.innerHTML = '<div class="no-data">No products yet</div>');
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>ID</th><th>Title</th><th>Price</th><th>Created</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${escapeHtml(p.title)}</td><td>${p.price}</td><td>${escapeHtml(p.createdAt)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  pageArea.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'table-responsive';
  wrapper.appendChild(table);
  pageArea.appendChild(wrapper);
}

function renderOrders(orders) {
  if (!orders.length) return (pageArea.innerHTML = '<div class="no-data">No orders found</div>');
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Order Code</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Created</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  orders.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(o.orderCode)}</td><td>${escapeHtml(o.customerName)}</td><td>${escapeHtml(o.status)}</td><td>${escapeHtml(o.paymentMethod)}</td><td>${escapeHtml(o.totalAmount)}</td><td>${escapeHtml(o.createdAt)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  pageArea.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'table-responsive';
  wrapper.appendChild(table);
  pageArea.appendChild(wrapper);
}

function renderUsers(users) {
  if (!users.length) return (pageArea.innerHTML = '<div class="no-data">No users</div>');
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  pageArea.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'table-responsive';
  wrapper.appendChild(table);
  pageArea.appendChild(wrapper);
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getAuthHeader() {
  const t = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  return t ? 'Bearer ' + t : '';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('authToken');
  window.location.href = '/';
});

loadPage('dashboard');

