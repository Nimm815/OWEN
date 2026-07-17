async function fetchJSON(url, opts={}){
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

// Sidebar navigation handling
const sidebar = document.getElementById('sidebar');
const pageTitle = document.getElementById('pageTitle');
const pageArea = document.getElementById('pageArea');
const toggleBtn = document.getElementById('toggleSidebar');

document.querySelectorAll('.sidebar nav li').forEach(li=>{
  li.addEventListener('click', ()=>{
    document.querySelectorAll('.sidebar nav li').forEach(n=>n.classList.remove('active'));
    li.classList.add('active');
    loadPage(li.getAttribute('data-page'));
  })
});

toggleBtn.addEventListener('click', ()=>{
  sidebar.classList.toggle('open');
});

async function loadPage(page){
  pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  pageArea.innerHTML = '<p>Loading...</p>';

  try{
    if (page === 'dashboard'){
      const stats = await fetchJSON('/api/admin/stats',{headers:{'Authorization': getAuthHeader()}});
      document.getElementById('totalProducts').textContent = stats.totalProducts;
      document.getElementById('totalUsers').textContent = stats.totalUsers;
      pageArea.innerHTML = '<p>Quick statistics are shown above.</p>';
    } else if (page === 'products'){
      const data = await fetchJSON('/api/admin/products',{headers:{'Authorization': getAuthHeader()}});
      renderProducts(data.products || []);
    } else if (page === 'users'){
      const data = await fetchJSON('/api/admin/users',{headers:{'Authorization': getAuthHeader()}});
      renderUsers(data.users || []);
    } else {
      pageArea.innerHTML = '<p>Not implemented yet.</p>';
    }
  }catch(err){
    pageArea.innerHTML = `<p style="color:red">${err.message}</p>`;
  }
}

function renderProducts(products){
  if (!products.length) return pageArea.innerHTML = '<p>No products yet</p>';
  const table = document.createElement('table');
  table.style.width='100%';
  table.innerHTML = `<thead><tr><th>ID</th><th>Title</th><th>Price</th><th>Created</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  products.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${escapeHtml(p.title)}</td><td>${p.price}</td><td>${p.createdAt}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  pageArea.innerHTML='';
  pageArea.appendChild(table);
}

function renderUsers(users){
  if (!users.length) return pageArea.innerHTML = '<p>No users</p>';
  const table = document.createElement('table');
  table.style.width='100%';
  table.innerHTML = `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  users.forEach(u=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${u.role}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  pageArea.innerHTML='';
  pageArea.appendChild(table);
}

function escapeHtml(s){
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getAuthHeader(){
  // Admin pages expect a Bearer token in localStorage set by login flow from main site.
  const t = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  return t ? `Bearer ${t}` : '';
}

// Logout: clear token and redirect to public site
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  localStorage.removeItem('auth_token');
  window.location.href = '/';
});

// Initial load
loadPage('dashboard');