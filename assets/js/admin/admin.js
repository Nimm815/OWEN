// Live Server commonly serves this page on port 5500, while the Express API runs on 3000.
const API_BASE_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : window.location.origin;
const pageTitle = document.getElementById('pageTitle');
const pageArea = document.getElementById('pageArea');
const sidebar = document.getElementById('sidebar');
let catalog = { brands: [], categories: [], colors: [], sizes: [] };

function getAuthHeader() {
  const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  return token ? `Bearer ${token}` : '';
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: getAuthHeader(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '-';
}

function actionButton(label, className, action, id) {
  return `<button class="btn btn-small ${className}" data-action="${action}" data-id="${id}">${label}</button>`;
}

function renderToolbar(title, createLabel) {
  pageArea.innerHTML = `<div class="page-toolbar"><h2>${title}</h2><button id="createBtn" class="btn btn-primary">+ ${createLabel}</button></div><div id="tableMount"></div>`;
}

function showForm(title, fields, onSubmit) {
  const inputs = fields.map(field => {
    const value = escapeHtml(field.value ?? '');
    if (field.type === 'select') return `<label>${field.label}<select name="${field.name}" ${field.required ? 'required' : ''}>${field.options.map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(field.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
    if (field.type === 'textarea') return `<label class="form-full">${field.label}<textarea name="${field.name}" ${field.required ? 'required' : ''}>${value}</textarea></label>`;
    if (field.type === 'checkbox') return `<label class="check-field"><input type="checkbox" name="${field.name}" ${field.value ? 'checked' : ''}> ${field.label}</label>`;
    return `<label>${field.label}<input name="${field.name}" type="${field.type || 'text'}" value="${value}" ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''} ${field.required ? 'required' : ''}></label>`;
  }).join('');
  pageArea.insertAdjacentHTML('beforeend', `<div class="modal-backdrop"><form class="admin-modal"><div class="modal-header"><h2>${title}</h2><button type="button" class="modal-close">&times;</button></div><div class="form-grid">${inputs}</div><p class="form-error" aria-live="polite"></p><div class="modal-actions"><button type="button" class="btn cancel-btn">Cancel</button><button class="btn btn-primary">Save</button></div></form></div>`);
  const backdrop = pageArea.querySelector('.modal-backdrop');
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').onclick = close;
  backdrop.querySelector('.cancel-btn').onclick = close;
  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  backdrop.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    fields.filter(field => field.type === 'checkbox').forEach(field => values[field.name] = form.elements[field.name].checked);
    try { await onSubmit(values); close(); } catch (error) { form.querySelector('.form-error').textContent = error.message; }
  };
}

async function loadPage(page) {
  pageTitle.textContent = page[0].toUpperCase() + page.slice(1);
  pageArea.innerHTML = '<p>Loading...</p>';
  try {
    if (page === 'dashboard') {
      const stats = await request('/api/admin/stats');
      document.getElementById('totalProducts').textContent = stats.totalProducts;
      document.getElementById('totalUsers').textContent = stats.totalUsers;
      pageArea.innerHTML = '<p>Use the menu to manage products, orders and users.</p>';
    } else if (page === 'products') renderProducts((await request('/api/admin/products')).products || []);
    else if (['colors', 'sizes', 'categories'].includes(page)) renderCatalogPage(page, (await request(`/api/admin/${page}`))[page] || []);
    else if (page === 'variants') renderVariants((await request('/api/admin/variants')).variants || []);
    else if (page === 'orders') renderOrders((await request('/api/admin/orders')).orders || []);
    else if (page === 'users') renderUsers((await request('/api/admin/users')).users || []);
    else pageArea.innerHTML = '<p>This page is not available yet.</p>';
  } catch (error) {
    if (/401|403/.test(error.message)) return renderLogin('Please log in with an admin account.');
    pageArea.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
  }
}

function renderCatalogPage(resource, rows) {
  const config = {
    colors: { title: 'Màu sắc', singular: 'màu', columns: [['code', 'Mã màu'], ['name', 'Tên màu']] },
    sizes: { title: 'Kích thước', singular: 'size', columns: [['value', 'Kích thước']] },
    categories: { title: 'Kiểu loại', singular: 'kiểu loại', columns: [['name', 'Tên kiểu loại']] }
  }[resource];
  renderToolbar(config.title, `Thêm ${config.singular}`);
  const mount = document.getElementById('tableMount');
  mount.innerHTML = rows.length ? `<div class="table-responsive"><table><thead><tr>${config.columns.map(([, label]) => `<th>${label}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(row => `<tr>${config.columns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join('')}<td class="row-actions">${actionButton('Sửa', '', 'edit', row.id)}${actionButton('Xóa', 'btn-danger', 'delete', row.id)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="no-data">Chưa có ${config.singular}.</div>`;
  const openForm = (row = {}) => showForm(row.id ? `Sửa ${config.singular}` : `Thêm ${config.singular}`, config.columns.map(([name, label]) => ({ name, label, value: row[name], required: true })), async data => {
    await request(`/api/admin/${resource}${row.id ? `/${row.id}` : ''}`, { method: row.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    catalog = { brands: [], categories: [], colors: [], sizes: [] };
    loadPage(resource);
  });
  document.getElementById('createBtn').onclick = () => openForm();
  mount.onclick = event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const row = rows.find(item => item.id === Number(button.dataset.id));
    if (button.dataset.action === 'edit') openForm(row);
    else deleteRecord(config.singular, row.id, row[config.columns[0][0]], `/api/admin/${resource}`, resource);
  };
}

async function renderVariants(variants) {
  renderToolbar('Biến thể sản phẩm', 'Thêm biến thể');
  const mount = document.getElementById('tableMount');
  mount.innerHTML = variants.length ? `<div class="table-responsive"><table><thead><tr><th>Sản phẩm</th><th>Màu</th><th>Size</th><th>Tồn kho</th><th>Giá riêng</th><th></th></tr></thead><tbody>${variants.map(v => `<tr><td>${escapeHtml(v.productName)}</td><td>${escapeHtml(v.colorName)}</td><td>${escapeHtml(v.size)}</td><td>${v.stockQty}</td><td>${v.price == null ? 'Theo giá sản phẩm' : `${Number(v.price).toLocaleString('vi-VN')} đ`}</td><td class="row-actions">${actionButton('Sửa', '', 'edit', v.id)}${actionButton('Xóa', 'btn-danger', 'delete', v.id)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="no-data">Chưa có biến thể.</div>';
  if (!catalog.brands.length) catalog = await request('/api/admin/catalog');
  const products = (await request('/api/admin/products')).products || [];
  const openForm = (variant = {}) => showForm(variant.id ? 'Sửa biến thể' : 'Thêm biến thể', [
    { name: 'productId', label: 'Sản phẩm', type: 'select', value: variant.productId || products[0]?.id, required: true, options: products.map(x => ({ value: x.id, label: x.title })) },
    { name: 'colorId', label: 'Màu', type: 'select', value: variant.colorId || catalog.colors[0]?.id, required: true, options: catalog.colors.map(x => ({ value: x.id, label: x.name })) },
    { name: 'sizeId', label: 'Size', type: 'select', value: variant.sizeId || catalog.sizes[0]?.id, required: true, options: catalog.sizes.map(x => ({ value: x.id, label: x.value })) },
    { name: 'stockQty', label: 'Số lượng tồn', type: 'number', value: variant.stockQty ?? 0, required: true },
    { name: 'price', label: 'Giá riêng (để trống dùng giá sản phẩm)', type: 'number', value: variant.price }
  ], async data => {
    await request(`/api/admin/variants${variant.id ? `/${variant.id}` : ''}`, { method: variant.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    loadPage('variants');
  });
  document.getElementById('createBtn').onclick = () => openForm();
  mount.onclick = event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const variant = variants.find(item => item.id === Number(button.dataset.id));
    if (button.dataset.action === 'edit') openForm(variant);
    else deleteRecord('biến thể', variant.id, `${variant.productName} - ${variant.colorName}/${variant.size}`, '/api/admin/variants', 'variants');
  };
}

async function renderProducts(products) {
  renderToolbar('Products', 'Add product');
  const mount = document.getElementById('tableMount');
  mount.innerHTML = products.length ? `<div class="table-responsive"><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Thương hiệu</th><th>Giá</th><th>Tồn kho</th><th>Hoạt động</th><th></th></tr></thead><tbody>${products.map(p => `<tr><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.title)}</td><td>${escapeHtml(p.brandName)}</td><td>${Number(p.price).toLocaleString('vi-VN')} đ</td><td><span class="stock-quantity ${Number(p.stockQty) <= 0 ? 'out-of-stock' : Number(p.stockQty) <= 5 ? 'low-stock' : ''}">${Number(p.stockQty).toLocaleString('vi-VN')}</span></td><td>${p.isActive ? 'Có' : 'Không'}</td><td class="row-actions">${actionButton('Sửa', '', 'edit', p.id)}${actionButton('Xóa', 'btn-danger', 'delete', p.id)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="no-data">Chưa có sản phẩm.</div>';
  if (!catalog.brands.length) catalog = await request('/api/admin/catalog');
  document.getElementById('createBtn').onclick = () => productForm();
  mount.onclick = event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const product = products.find(item => item.id === Number(button.dataset.id));
    if (button.dataset.action === 'edit') productForm(product);
    if (button.dataset.action === 'delete') deleteRecord('product', product.id, product.title, '/api/admin/products', 'products');
  };
}

function productForm(product = {}) {
  showForm(product.id ? 'Edit product' : 'Add product', [
    { name: 'sku', label: 'SKU', value: product.sku, required: true }, { name: 'title', label: 'Name', value: product.title, required: true },
    { name: 'price', label: 'Price', type: 'number', value: product.price, required: true }, { name: 'imageUrl', label: 'Image URL', value: product.imageUrl },
    { name: 'brandId', label: 'Brand', type: 'select', value: product.brandId || catalog.brands[0]?.id, required: true, options: catalog.brands.map(x => ({ value: x.id, label: x.name })) },
    { name: 'categoryId', label: 'Display page', type: 'select', value: product.categoryId || catalog.categories[0]?.id, required: true, options: catalog.categories.map(x => ({ value: x.id, label: x.name })) },
    { name: 'description', label: 'Description', type: 'textarea', value: product.description }, { name: 'isActive', label: 'Active product', type: 'checkbox', value: product.id ? Boolean(product.isActive) : true }
  ], async data => { await request(`/api/admin/products${product.id ? `/${product.id}` : ''}`, { method: product.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); loadPage('products'); });
}

function renderUsers(users) {
  renderToolbar('Users', 'Add user');
  const mount = document.getElementById('tableMount');
  mount.innerHTML = users.length ? `<div class="table-responsive"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr></thead><tbody>${users.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td><td>${formatDate(u.createdAt)}</td><td class="row-actions">${actionButton('Edit', '', 'edit', u.id)}${actionButton('Delete', 'btn-danger', 'delete', u.id)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="no-data">No users yet.</div>';
  document.getElementById('createBtn').onclick = () => userForm();
  mount.onclick = event => { const button = event.target.closest('[data-action]'); if (!button) return; const user = users.find(item => item.id === Number(button.dataset.id)); if (button.dataset.action === 'edit') userForm(user); else deleteRecord('user', user.id, user.name, '/api/admin/users', 'users'); };
}

function userForm(user = {}) {
  showForm(user.id ? 'Edit user' : 'Add user', [
    { name: 'name', label: 'Name', value: user.name, required: true }, { name: 'email', label: 'Email', type: 'email', value: user.email, required: true },
    { name: 'password', label: user.id ? 'New password (leave blank to keep)' : 'Password', type: 'password', required: !user.id },
    { name: 'role', label: 'Role', type: 'select', value: user.role || 'ROLE_USER', options: [{ value: 'ROLE_USER', label: 'User' }, { value: 'ADMIN', label: 'Admin' }] }
  ], async data => { await request(`/api/admin/users${user.id ? `/${user.id}` : ''}`, { method: user.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); loadPage('users'); });
}

function renderOrders(orders) {
  pageArea.innerHTML = '<div class="page-toolbar"><h2>Đơn hàng khách đặt</h2></div><div id="tableMount"></div>';
  const mount = document.getElementById('tableMount');
  const statusLabels = { UNPAID: 'Chưa thanh toán', PENDING: 'Chờ xác nhận', SHIPPING: 'Đang giao hàng', DELIVERED: 'Đã hoàn thành', CANCELLED: 'Đã hủy' };
  const buttons = order => {
    if (order.status === 'PENDING' || order.status === 'UNPAID') return `${actionButton('Xác nhận', 'btn-primary', 'confirm', order.id)}${actionButton('Hủy đơn', 'btn-danger', 'cancel', order.id)}`;
    if (order.status === 'SHIPPING') return `${actionButton('Hoàn thành', 'btn-primary', 'complete', order.id)}${actionButton('Hủy đơn', 'btn-danger', 'cancel', order.id)}`;
    return '';
  };
  mount.innerHTML = orders.length ? `<div class="table-responsive"><table><thead><tr><th>Mã đơn</th><th>Người nhận</th><th>Điện thoại</th><th>Địa chỉ</th><th>Trạng thái</th><th>Thanh toán</th><th>Tổng tiền</th><th>Ngày đặt</th><th></th></tr></thead><tbody>${orders.map(o => `<tr><td>${escapeHtml(o.orderCode)}</td><td>${escapeHtml(o.recipientName || o.customerName)}</td><td>${escapeHtml(o.recipientPhone)}</td><td>${escapeHtml(o.recipientAddress)}</td><td><span class="order-status status-${o.status.toLowerCase()}">${statusLabels[o.status] || escapeHtml(o.status)}</span></td><td>${escapeHtml(o.paymentMethod)}</td><td>${Number(o.totalAmount).toLocaleString('vi-VN')} đ</td><td>${formatDate(o.createdAt)}</td><td class="row-actions">${buttons(o)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="no-data">Chưa có đơn hàng nào.</div>';
  mount.onclick = async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const order = orders.find(item => item.id === Number(button.dataset.id));
    const nextStatus = button.dataset.action === 'confirm'
      ? (order.status === 'UNPAID' ? 'PENDING' : 'SHIPPING')
      : { complete: 'DELIVERED', cancel: 'CANCELLED' }[button.dataset.action];
    if (!nextStatus) return;
    if (button.dataset.action === 'cancel' && !window.confirm(`Hủy đơn ${order.orderCode}? Số lượng sản phẩm sẽ được hoàn lại kho.`)) return;
    try {
      await request(`/api/admin/orders/${order.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      loadPage('orders');
    } catch (error) { window.alert(error.message); }
  };
}

async function deleteRecord(type, id, label, endpoint, page) {
  if (!window.confirm(`Delete ${type} “${label}”? This cannot be undone.`)) return;
  try { await request(`${endpoint}/${id}`, { method: 'DELETE' }); loadPage(page); } catch (error) { window.alert(error.message); }
}

function renderLogin(message = '') {
  document.getElementById('totalProducts').textContent = '-'; document.getElementById('totalUsers').textContent = '-'; pageTitle.textContent = 'Admin Login';
  pageArea.innerHTML = `<div class="admin-login-box"><h2>Admin Login</h2><p class="form-error">${escapeHtml(message)}</p><label>Email<input type="email" id="adminEmail"></label><label>Password<input type="password" id="adminPassword"></label><button id="adminLoginBtn" class="btn btn-primary">Login</button></div>`;
  document.getElementById('adminLoginBtn').onclick = async () => { try { const data = await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('adminEmail').value.trim(), password: document.getElementById('adminPassword').value }) }).then(r => r.json()); if (!data.token || !['ADMIN', 'ROLE_ADMIN'].includes(data.user?.role)) throw new Error(data.message || 'Admin account required.'); localStorage.setItem('authToken', data.token); loadPage('dashboard'); } catch (error) { renderLogin(error.message); } };
}

document.querySelectorAll('.sidebar nav li').forEach(li => li.onclick = () => { document.querySelectorAll('.sidebar nav li').forEach(x => x.classList.remove('active')); li.classList.add('active'); loadPage(li.dataset.page); });
document.getElementById('toggleSidebar').onclick = () => sidebar.classList.toggle('open');
document.getElementById('logoutBtn').onclick = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authInitialized');
  window.location.href = '/';
};
loadPage('dashboard');
