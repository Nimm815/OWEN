const header = document.querySelector("header");

// Highlight the menu item that matches the page currently being viewed.
const currentPage = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll("header nav a").forEach(link => {
    const linkPage = new URL(link.href, window.location.href).pathname.split("/").pop() || "index.html";

    if (linkPage === currentPage) {
        link.classList.add("nav-active");
        link.setAttribute("aria-current", "page");
    }
});

window.addEventListener("scroll",()=>{

if(window.scrollY>50){

header.classList.add("scrolled");

}else{

header.classList.remove("scrolled");

}

});

const observer = new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("active");

}

});

},{
threshold:0.2
});

document.querySelectorAll(".reveal").forEach(item=>{

observer.observe(item);

});

// Production serves the frontend and API from one origin. VS Code Live Server
// uses another port, so local pages must call the Node backend on port 3000.
const isLocalLiveServer = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port !== '3000';
const API_BASE_URL = isLocalLiveServer ? 'http://127.0.0.1:3000' : '';

async function readApiJson(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        throw new Error('Backend chưa được cập nhật hoặc đang không hoạt động.');
    }
    return response.json();
}

// ================= STOREFRONT PRODUCTS =================

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function productImageUrl(imageUrl) {
    if (!imageUrl) return '/Images/card_reveal1.jpg';
    if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('/')) return imageUrl;
    return `/${imageUrl.replace(/^\.\.\//, '')}`;
}

function formatPrice(price) {
    return `${Number(price || 0).toLocaleString('vi-VN')} đ`;
}

async function loadHomepageProducts() {
    const gallery = document.getElementById('productGallery');
    if (!gallery) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/products?limit=6`);
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.message || 'Không thể tải sản phẩm.');

        const products = data.products || [];
        if (!products.length) {
            gallery.innerHTML = '<p class="products-message">Chưa có sản phẩm nào để hiển thị.</p>';
            return;
        }

        gallery.innerHTML = products.map(product => `
            <article class="card product-card" data-product-id="${product.id}" tabindex="0" role="button">
                <img src="${escapeHtml(productImageUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}" loading="lazy">
                <div class="product-card-content">
                    <p class="product-category">${escapeHtml(product.categoryName || product.brandName || 'OWEN')}</p>
                    <h3>${escapeHtml(product.title)}</h3>
                    <p class="product-price">${formatPrice(product.price)}</p>
                </div>
            </article>`).join('');
    } catch (error) {
        console.error(error);
        gallery.innerHTML = '<p class="products-message">Không thể tải sản phẩm. Vui lòng thử lại sau.</p>';
    }
}

async function loadCategoryProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    const category = grid.dataset.storeCategory;
    const isShowcase = grid.dataset.displayMode === 'showcase';
    grid.innerHTML = '<p class="products-message">Đang tải sản phẩm...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?limit=48&category=${encodeURIComponent(category)}`);
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.message || 'Không thể tải sản phẩm.');

        const products = data.products || [];
        if (!products.length) {
            grid.innerHTML = `<p class="products-message">Chưa có sản phẩm nào trong mục ${escapeHtml(category)}.</p>`;
            return;
        }

        if (isShowcase) {
            grid.classList.remove('product-grid');
            grid.classList.add('lookbook');
            grid.innerHTML = products.map(product => `
                <article class="look-item collection-product">
                    <img src="${escapeHtml(productImageUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}" loading="lazy">
                    <h2>${escapeHtml(product.title)}</h2>
                </article>`).join('');
        } else {
            grid.classList.remove('lookbook');
            grid.classList.add('product-grid');
            grid.innerHTML = products.map(product => `
                <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button">
                    <img src="${escapeHtml(productImageUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}" loading="lazy">
                    <h3>${escapeHtml(product.title)}</h3>
                    <p>${formatPrice(product.price)}</p>
                </article>`).join('');
        }
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="products-message">Không thể tải sản phẩm. Vui lòng thử lại sau.</p>';
    }
}

function ensurePurchaseModal() {
    if (document.getElementById('purchaseModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="purchaseModal" class="purchase-modal" aria-hidden="true">
        <div class="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="purchaseTitle">
          <button class="purchase-close" type="button" aria-label="Đóng">&times;</button>
          <div id="purchaseContent"></div>
        </div>
      </div>`);
    const modal = document.getElementById('purchaseModal');
    modal.querySelector('.purchase-close').onclick = closePurchaseModal;
    modal.onclick = event => { if (event.target === modal) closePurchaseModal(); };
}

function closePurchaseModal() {
    const modal = document.getElementById('purchaseModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function openPurchaseModal(productId) {
    ensurePurchaseModal();
    const modal = document.getElementById('purchaseModal');
    const content = document.getElementById('purchaseContent');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<p class="products-message">Đang tải sản phẩm...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/products/${productId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải sản phẩm.');
        const product = data.product;
        const colors = [...new Map(product.variants.map(v => [String(v.colorId), v])).values()];
        content.innerHTML = `
          <div class="purchase-layout">
            <img class="purchase-image" src="${escapeHtml(productImageUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}">
            <form id="purchaseForm" class="purchase-form">
              <p class="product-category">${escapeHtml(product.categoryName || product.brandName)}</p>
              <h2 id="purchaseTitle">${escapeHtml(product.title)}</h2>
              <p class="purchase-description">${escapeHtml(product.description || '')}</p>
              ${product.variants.length ? `
                <label>Màu sắc<select id="purchaseColor" required>${colors.map(v => `<option value="${v.colorId}">${escapeHtml(v.colorName)}</option>`).join('')}</select></label>
                <label>Kích thước<select id="purchaseSize" required></select></label>
                <div class="purchase-quantity"><span>Số lượng</span><div class="quantity-stepper">
                  <button type="button" data-quantity-action="minus" aria-label="Giảm số lượng">−</button>
                  <input id="purchaseQuantity" type="number" value="1" min="1" inputmode="numeric" aria-label="Số lượng">
                  <button type="button" data-quantity-action="plus" aria-label="Tăng số lượng">+</button>
                </div></div>
                <p class="purchase-stock" id="purchaseStock"></p>
                <div class="purchase-summary"><span>Tạm tính</span><div class="purchase-price" id="purchasePrice"></div></div>
                <button class="purchase-button" type="submit">THÊM VÀO GIỎ HÀNG</button>
                <button class="purchase-buy-now" type="button">MUA NGAY</button>
                <p class="purchase-assurance">Miễn phí đổi size · Kiểm tra hàng trước khi nhận</p>` :
                `<div class="purchase-price">${formatPrice(product.price)}</div><p class="purchase-stock">Sản phẩm hiện chưa có màu và size khả dụng.</p><button class="purchase-button" type="button" disabled>HẾT HÀNG</button>`}
            </form>
          </div>`;
        if (!product.variants.length) return;
        const color = content.querySelector('#purchaseColor');
        const size = content.querySelector('#purchaseSize');
        const updateSizes = () => {
            const available = product.variants.filter(v => String(v.colorId) === color.value);
            size.innerHTML = available.map(v => `<option value="${v.id}">${escapeHtml(v.size)}</option>`).join('');
            updateVariant();
        };
        const quantity = content.querySelector('#purchaseQuantity');
        const updateVariant = () => {
            const variant = product.variants.find(v => String(v.id) === size.value);
            quantity.max = Math.max(1, Number(variant?.stockQty || 1));
            quantity.value = Math.min(Number(quantity.max), Math.max(1, Number(quantity.value) || 1));
            content.querySelector('#purchasePrice').textContent = formatPrice((variant?.price || product.price) * Number(quantity.value));
            content.querySelector('#purchaseStock').textContent = variant ? `Còn ${variant.stockQty} sản phẩm` : '';
        };
        color.onchange = updateSizes;
        size.onchange = updateVariant;
        quantity.oninput = updateVariant;
        content.querySelectorAll('[data-quantity-action]').forEach(button => {
            button.onclick = () => {
                quantity.value = Math.min(Number(quantity.max), Math.max(1, Number(quantity.value) + (button.dataset.quantityAction === 'plus' ? 1 : -1)));
                updateVariant();
            };
        });
        updateSizes();
        const addSelectedToCart = () => {
            const variant = product.variants.find(v => String(v.id) === size.value);
            addToCart({ variantId: variant.id, productId: product.id, title: product.title, imageUrl: product.imageUrl,
                colorName: variant.colorName, size: variant.size, unitPrice: Number(variant.price || product.price),
                quantity: Number(quantity.value), stockQty: Number(variant.stockQty) });
        };
        content.querySelector('#purchaseForm').onsubmit = event => {
            event.preventDefault();
            addSelectedToCart();
            closePurchaseModal();
            openCartDrawer();
        };
        content.querySelector('.purchase-buy-now').onclick = () => { addSelectedToCart(); closePurchaseModal(); openCartDrawer(true); };
    } catch (error) {
        content.innerHTML = `<p class="products-message">${escapeHtml(error.message)}</p>`;
    }
}

document.addEventListener('click', event => {
    const card = event.target.closest('.product-card[data-product-id]');
    if (card) openPurchaseModal(card.dataset.productId);
});
document.addEventListener('keydown', event => {
    const card = event.target.closest('.product-card[data-product-id]');
    if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openPurchaseModal(card.dataset.productId); }
    if (event.key === 'Escape') closePurchaseModal();
});

// ================= AUTH SYSTEM =================

// Initialize auth system
function initAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const isFirstVisit = !localStorage.getItem('authInitialized');
    
    if (isFirstVisit) {
        localStorage.setItem('authInitialized', 'true');
        openAuthModal();
    }
    
    updateAuthUI();
}

// Open auth modal
function openAuthModal() {
    document.getElementById('authModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close auth modal
function closeAuthModal() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        document.getElementById('authModal').classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Switch to register form
function switchToRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginError').innerHTML = '';
    document.getElementById('registerError').innerHTML = '';
}

// Switch to login form
function switchToLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginError').innerHTML = '';
    document.getElementById('registerError').innerHTML = '';
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.innerHTML = '';
    
    if (!email || !password) {
        showError(errorDiv, 'Vui lòng nhập email và password');
        return;
    }
    
    if (password.length < 6) {
        showError(errorDiv, 'Password phải có ít nhất 6 ký tự');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(errorDiv, data.message || 'Đăng nhập thất bại');
            return;
        }

        setAuthData(data.user, data.token);
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';

        if (['ADMIN', 'ROLE_ADMIN'].includes(data.user.role)) {
            window.location.href = '/admin/';
            return;
        }

        closeAuthModal();
        updateAuthUI();
        alert('Đăng nhập thành công! Chào mừng ' + data.user.name);
    } catch (error) {
        showError(errorDiv, 'Không thể kết nối tới server. Vui lòng thử lại sau.');
        console.error(error);
    }
}

// Handle register
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorDiv = document.getElementById('registerError');
    
    errorDiv.innerHTML = '';
    
    if (!name || !email || !password || !confirmPassword) {
        showError(errorDiv, 'Vui lòng điền đầy đủ tất cả các trường');
        return;
    }
    
    if (name.length < 3) {
        showError(errorDiv, 'Tên phải có ít nhất 3 ký tự');
        return;
    }
    
    if (password.length < 6) {
        showError(errorDiv, 'Password phải có ít nhất 6 ký tự');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(errorDiv, 'Password không trùng khớp');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(errorDiv, data.message || 'Đăng ký thất bại');
            return;
        }

        setAuthData(data.user, data.token);
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        switchToLogin();
        closeAuthModal();
        updateAuthUI();
        alert('Đăng ký thành công! Chào mừng ' + name);
    } catch (error) {
        showError(errorDiv, 'Không thể kết nối tới server. Vui lòng thử lại sau.');
        console.error(error);
    }
}

// Handle guest login
function handleGuestLogin() {
    const guestUser = {
        name: 'Khách',
        email: '',
        guest: true,
        loginTime: new Date().toISOString()
    };
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    localStorage.removeItem('authToken');
    updateAuthUI();
    closeAuthModal();
    alert('Bạn đang xem trang dưới tư cách Khách');
}

// Handle logout
function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        clearAuthData();
        window.location.href = 'index.html';
    }
}

function setAuthData(user, token) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', token);
}

function clearAuthData() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
}

// Update auth UI
function updateAuthUI() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const authBtn = document.getElementById('authBtn');
    const authSection = document.getElementById('authSection');
    
    if (currentUser) {
        authBtn.style.display = 'none';
        authSection.style.display = 'none';
        document.getElementById('userNameDisplay').textContent = currentUser.name;
        document.getElementById('userEmailDisplay').textContent = currentUser.email;
    } else {
        authBtn.style.display = 'none';
        authSection.style.display = 'none';
    }
    updateCartButton();
    updateAccountButton();
    updateNotificationButton();
    updateShopChatButton();
}

// ================= CART / CUSTOMER ORDERS =================

const orderStatusLabels = {
    UNPAID: 'Chưa thanh toán',
    PENDING: 'Chờ xác nhận',
    SHIPPING: 'Đang giao',
    DELIVERED: 'Đã giao',
    CANCELLED: 'Đã hủy'
};

const customerOrderUpdateChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('owen-order-updates')
    : null;

customerOrderUpdateChannel?.addEventListener('message', () => loadNotifications());
window.addEventListener('storage', event => {
    if (event.key === 'owenOrderUpdate') loadNotifications();
});
window.addEventListener('focus', () => loadNotifications());

function ensureCartDrawer() {
    if (document.getElementById('cartDrawer')) return;
    const headerElement = document.querySelector('header');
    const authSection = document.getElementById('authSection');
    const authButton = document.getElementById('authBtn');
    const menuButton = headerElement?.querySelector('.menu-btn');
    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';
    const cartButton = document.createElement('button');
    cartButton.id = 'cartButton';
    cartButton.className = 'cart-button';
    cartButton.type = 'button';
    cartButton.setAttribute('aria-label', 'Mở giỏ hàng');
    cartButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
      </svg>
      <span id="cartCount">0</span>`;
    cartButton.onclick = openCartDrawer;
    if (headerElement) {
        headerElement.appendChild(headerActions);
        headerActions.appendChild(cartButton);
        headerActions.insertAdjacentHTML('beforeend', `
          <div class="notification-menu-wrap">
            <button id="notificationButton" class="notification-button" type="button" aria-label="Thông báo" aria-expanded="false">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                <path d="M10 21h4"></path>
              </svg>
              <span id="notificationCount" hidden>0</span>
            </button>
            <div id="notificationDropdown" class="notification-dropdown" hidden>
              <div class="notification-heading">
                <strong>Thông báo</strong>
                <div>
                  <button type="button" id="notificationReadAll" class="notification-read-all">Đánh dấu đã đọc</button>
                  <button type="button" id="notificationClose" class="notification-close">&times;</button>
                </div>
              </div>
              <div id="notificationList" class="notification-list"></div>
            </div>
          </div>
          <div class="account-menu-wrap">
            <button id="accountButton" class="account-button" type="button" aria-label="Tài khoản" aria-expanded="false">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path>
              </svg>
            </button>
            <div id="accountDropdown" class="account-dropdown" hidden></div>
          </div>`);
        if (authSection) headerActions.appendChild(authSection);
        if (authButton) headerActions.appendChild(authButton);
        if (menuButton) headerActions.appendChild(menuButton);
    }
    document.getElementById('accountButton').onclick = toggleAccountMenu;
    document.getElementById('notificationButton').onclick = toggleNotificationMenu;
    document.getElementById('notificationClose').onclick = closeNotificationMenu;
    document.getElementById('notificationReadAll').onclick = markAllNotificationsRead;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="cartBackdrop" class="cart-backdrop" aria-hidden="true"></div>
      <aside id="cartDrawer" class="cart-drawer" aria-hidden="true" aria-labelledby="cartTitle">
        <div class="cart-heading">
          <div><p>OWEN</p><h2 id="cartTitle">Giỏ hàng của bạn</h2></div>
          <button id="cartClose" type="button" aria-label="Đóng">&times;</button>
        </div>
        <div id="cartContent" class="cart-content"></div>
      </aside>`);
    document.getElementById('cartClose').onclick = closeCartDrawer;
    document.getElementById('cartBackdrop').onclick = closeCartDrawer;
}

function updateNotificationButton(unreadCount) {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isSignedIn = user && !user.guest && localStorage.getItem('authToken');
    const wrap = document.querySelector('.notification-menu-wrap');
    if (wrap) wrap.hidden = !isSignedIn;
    const badge = document.getElementById('notificationCount');
    if (badge && Number.isInteger(unreadCount)) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = unreadCount === 0;
    }
}

function notificationTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

async function loadNotifications() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!token || !user || user.guest) {
        updateNotificationButton(0);
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải thông báo.');
        updateNotificationButton(Number(data.unreadCount || 0));
        const list = document.getElementById('notificationList');
        const notifications = data.notifications || [];
        list.innerHTML = notifications.length ? notifications.map(item => `
          <article class="notification-item ${item.isRead ? '' : 'unread'}">
            <span class="notification-icon notification-${escapeHtml(item.type.toLowerCase())}"></span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.message)}</p>
              <time>${notificationTime(item.createdAt)}</time>
            </div>
          </article>`).join('') : '<p class="notification-empty">Bạn chưa có thông báo nào.</p>';
    } catch (error) {
        const list = document.getElementById('notificationList');
        if (list) list.innerHTML = `<p class="notification-empty notification-error">${escapeHtml(error.message)}</p>`;
    }
}

async function toggleNotificationMenu(event) {
    event?.stopPropagation();
    const dropdown = document.getElementById('notificationDropdown');
    const willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    document.getElementById('notificationButton').setAttribute('aria-expanded', String(willOpen));
    document.getElementById('accountDropdown').hidden = true;
    if (!willOpen) return;
    await loadNotifications();
}

async function markAllNotificationsRead(event) {
    event?.stopPropagation();
    const button = document.getElementById('notificationReadAll');
    button.disabled = true;
    button.textContent = 'Đang cập nhật...';
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Không thể đánh dấu thông báo.');
        updateNotificationButton(0);
        document.querySelectorAll('.notification-item.unread').forEach(item => item.classList.remove('unread'));
    } catch (error) {
        window.alert(error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Đánh dấu đã đọc';
    }
}

function closeNotificationMenu() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) dropdown.hidden = true;
    document.getElementById('notificationButton')?.setAttribute('aria-expanded', 'false');
}

function updateAccountButton() {
    const button = document.getElementById('accountButton');
    const dropdown = document.getElementById('accountDropdown');
    if (!button || !dropdown) return;
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isSignedIn = user && !user.guest && localStorage.getItem('authToken');
    button.classList.toggle('signed-in', Boolean(isSignedIn));
    button.setAttribute('aria-label', isSignedIn ? 'Mở menu tài khoản' : 'Đăng nhập');
    dropdown.innerHTML = isSignedIn ? `
      <div class="account-summary">
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.email)}</span>
      </div>
      <button class="account-addresses" type="button">THÔNG TIN & ĐỊA CHỈ</button>
      <button class="account-logout" type="button">ĐĂNG XUẤT</button>` : '';
    dropdown.querySelector('.account-addresses')?.addEventListener('click', () => {
        dropdown.hidden = true;
        openAddressManager();
    });
    dropdown.querySelector('.account-logout')?.addEventListener('click', handleLogout);
}

function toggleAccountMenu(event) {
    event?.stopPropagation();
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isSignedIn = user && !user.guest && localStorage.getItem('authToken');
    if (!isSignedIn) {
        document.getElementById('accountDropdown').hidden = true;
        openAuthModal();
        return;
    }
    const dropdown = document.getElementById('accountDropdown');
    const willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    document.getElementById('accountButton').setAttribute('aria-expanded', String(willOpen));
}

function updateCartButton(count) {
    ensureCartDrawer();
    const button = document.getElementById('cartButton');
    if (button) button.hidden = false;
    if (Number.isInteger(count)) document.getElementById('cartCount').textContent = count;
}

const CART_STORAGE_KEY = 'owenShoppingCart';
function getShoppingCart() {
    try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveShoppingCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartButton(cart.reduce((sum, item) => sum + item.quantity, 0));
}
function addToCart(item) {
    const cart = getShoppingCart();
    const existing = cart.find(entry => String(entry.variantId) === String(item.variantId));
    if (existing) existing.quantity = Math.min(item.stockQty, existing.quantity + item.quantity);
    else cart.push(item);
    saveShoppingCart(cart);
}

function openCartDrawer(focusCheckout = false) {
    ensureCartDrawer();
    document.getElementById('cartTitle').textContent = 'Giỏ hàng của bạn';
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartBackdrop').classList.add('open');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderShoppingCart();
    if (focusCheckout) setTimeout(() => document.querySelector('.checkout-form')?.scrollIntoView({ behavior: 'smooth' }), 120);
}

function openAddressManager() {
    ensureCartDrawer();
    document.getElementById('cartTitle').textContent = 'Thông tin & địa chỉ';
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartBackdrop').classList.add('open');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const content = document.getElementById('cartContent');
    content.innerHTML = `<div class="address-manager-intro"><p>TÀI KHOẢN OWEN</p><h3>${escapeHtml(user?.name || '')}</h3>
      <span>${escapeHtml(user?.email || '')}</span><p>Lưu nhiều địa chỉ để thông tin được tự động điền khi mua hàng.</p></div>
      <form class="checkout-form address-manager-form">
        <div class="saved-addresses" aria-live="polite"></div>
        <label>Họ tên<input name="recipientName" value="${escapeHtml(user?.name || '')}" required autocomplete="name"></label>
        <label>Số điện thoại<input name="recipientPhone" required autocomplete="tel"></label>
        <label>Địa chỉ<textarea name="recipientAddress" required autocomplete="street-address"></textarea></label>
        <input type="hidden" name="addressLabel" value="Địa chỉ giao hàng">
        <button type="button" class="checkout-button save-address-button">LƯU ĐỊA CHỈ</button>
      </form>`;
    const form = content.querySelector('form');
    form.querySelector('.save-address-button').onclick = saveCheckoutAddress;
    loadSavedAddresses(form);
}

function closeCartDrawer() {
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.getElementById('cartBackdrop')?.classList.remove('open');
    document.getElementById('cartDrawer')?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function loadCartOrders() {
    ensureCartDrawer();
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!token || !user || user.guest) {
        return;
    }
    const content = document.getElementById('cartContent');
    content.innerHTML = '<p class="cart-message">Đang tải đơn hàng...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải giỏ hàng.');
        const orders = data.orders || [];
        if (!orders.length) {
            content.innerHTML = '';
            return;
        }
        content.innerHTML = `<section class="order-history"><h3>Đơn hàng gần đây</h3>${orders.map(order => `
          <article class="cart-order">
            <img src="${escapeHtml(productImageUrl(order.imageUrl))}" alt="${escapeHtml(order.productTitle)}">
            <div class="cart-order-info">
              <div class="cart-order-top">
                <span>${escapeHtml(order.orderCode)}</span>
                <strong class="status-${String(order.status).toLowerCase()}">${orderStatusLabels[order.status] || escapeHtml(order.status)}</strong>
              </div>
              <h3>${escapeHtml(order.productTitle)}</h3>
              <p>Màu ${escapeHtml(order.colorName)} · Size ${escapeHtml(order.size)} · SL ${order.quantity}</p>
              <div class="cart-order-bottom">
                <b>${formatPrice(order.totalAmount)}</b>
                ${['UNPAID', 'PENDING'].includes(order.status) ? `<button type="button" data-cancel-order="${order.id}">HỦY ĐƠN</button>` : ''}
              </div>
            </div>
          </article>`).join('')}</section>`;
    } catch (error) {
        content.innerHTML = `<p class="cart-message cart-error">${escapeHtml(error.message)}</p>`;
    }
}

async function loadOrderHistoryIntoDrawer() {
    const target = document.getElementById('orderHistory');
    const main = document.getElementById('cartContent');
    if (!target || !main || !localStorage.getItem('authToken')) return;
    main.id = 'cartContentActive';
    const temporary = document.createElement('div');
    temporary.id = 'cartContent';
    document.body.appendChild(temporary);
    await loadCartOrders();
    target.innerHTML = temporary.innerHTML;
    temporary.remove();
    main.id = 'cartContent';
}

function renderShoppingCart() {
    const content = document.getElementById('cartContent');
    const cart = getShoppingCart();
    updateCartButton(cart.reduce((sum, item) => sum + item.quantity, 0));
    if (!cart.length) {
        content.innerHTML = '<div class="cart-empty"><span>0</span><h3>Giỏ hàng đang trống</h3><p>Chọn một sản phẩm bạn yêu thích để bắt đầu.</p><button type="button" data-close-cart>TIẾP TỤC MUA SẮM</button></div><div id="orderHistory"></div>';
        loadOrderHistoryIntoDrawer();
        return;
    }
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    content.innerHTML = `
      <div class="cart-items">${cart.map(item => `
        <article class="shopping-cart-item">
          <img src="${escapeHtml(productImageUrl(item.imageUrl))}" alt="${escapeHtml(item.title)}">
          <div><button class="cart-remove" type="button" data-cart-remove="${item.variantId}" aria-label="Xóa sản phẩm">×</button>
            <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.colorName)} · Size ${escapeHtml(item.size)}</p>
            <div class="cart-item-bottom"><div class="quantity-stepper small">
              <button type="button" data-cart-minus="${item.variantId}">−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${item.variantId}">+</button>
            </div><strong>${formatPrice(item.unitPrice * item.quantity)}</strong></div>
          </div>
        </article>`).join('')}</div>
      <div class="cart-total"><span>Tạm tính</span><strong>${formatPrice(subtotal)}</strong><p>Phí vận chuyển được tính khi đặt hàng.</p></div>
      <form class="checkout-form">
        <p class="checkout-kicker">THÔNG TIN NHẬN HÀNG</p>
        <div class="saved-addresses" aria-live="polite"></div>
        <label>Họ tên<input name="recipientName" value="${escapeHtml(user?.guest ? '' : user?.name || '')}" required autocomplete="name"></label>
        <div class="checkout-row"><label>Số điện thoại<input name="recipientPhone" required autocomplete="tel"></label>
          <label>Thanh toán<select name="paymentMethod"><option value="COD">Khi nhận hàng</option><option value="VNPAY">VNPay</option></select></label></div>
        <label>Địa chỉ<textarea name="recipientAddress" required autocomplete="street-address"></textarea></label>
        <input type="hidden" name="addressLabel" value="Địa chỉ giao hàng">
        <button type="button" class="save-address-button checkout-save-address">LƯU ĐỊA CHỈ NÀY</button>
        <label>Ghi chú (không bắt buộc)<textarea name="note"></textarea></label>
        <button class="checkout-button" type="submit">MUA ${itemCount} SẢN PHẨM · ${formatPrice(subtotal)}</button>
        <p class="checkout-note">Thông tin của bạn chỉ được dùng để giao đơn hàng này.</p>
      </form><div id="orderHistory"></div>`;
    content.querySelector('.checkout-form').onsubmit = submitCartCheckout;
    content.querySelector('.save-address-button').onclick = saveCheckoutAddress;
    loadSavedAddresses(content.querySelector('.checkout-form'));
    loadOrderHistoryIntoDrawer();
}

async function loadSavedAddresses(form, selectId) {
    const container = form?.querySelector('.saved-addresses');
    const token = localStorage.getItem('authToken');
    if (!container) return;
    if (!token) {
        container.innerHTML = '<p class="address-hint">Đăng nhập để lưu và dùng lại thông tin giao hàng.</p>';
        return;
    }
    container.innerHTML = '<p class="address-hint">Đang tải địa chỉ đã lưu...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/addresses`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.message || 'Không thể tải địa chỉ.');
        const addresses = data.addresses || [];
        if (!addresses.length) {
            form.querySelector('.address-field-select')?.remove();
            form.elements.recipientAddress.hidden = false;
            container.innerHTML = '<p class="address-hint">Bạn chưa có địa chỉ đã lưu. Điền thông tin bên dưới và bấm “Lưu địa chỉ này”.</p>';
            return;
        }
        const isCheckout = !form.classList.contains('address-manager-form');
        const options = addresses.map(item => `<option value="${item.id}" ${String(item.id) === String(selectId) || (!selectId && item.isDefault) ? 'selected' : ''}>
          ${item.isDefault ? 'Mặc định — ' : ''}${escapeHtml(item.address)}</option>`).join('');
        container.innerHTML = `${isCheckout ? '' : `<label>Chọn địa chỉ giao hàng<select class="saved-address-select">${options}</select></label>`}
          <div class="address-actions"><button type="button" data-address-add>+ THÊM ĐỊA CHỈ KHÁC</button><button type="button" data-address-default>ĐẶT MẶC ĐỊNH</button><button type="button" data-address-delete>XÓA</button></div>`;
        const addressTextarea = form.elements.recipientAddress;
        let select = container.querySelector('select');
        if (isCheckout) {
            form.querySelector('.address-field-select')?.remove();
            select = document.createElement('select');
            select.className = 'saved-address-select address-field-select';
            select.innerHTML = options;
            addressTextarea.before(select);
            addressTextarea.hidden = true;
            const addressLabel = addressTextarea.closest('label');
            addressLabel.firstChild.textContent = 'Địa chỉ giao hàng';
            addressLabel.after(container);
        }
        const applyAddress = () => {
            const item = addresses.find(entry => String(entry.id) === select.value);
            if (!item) return;
            form.elements.recipientName.value = item.recipientName;
            form.elements.recipientPhone.value = item.phone;
            form.elements.recipientAddress.value = item.address;
        };
        select.onchange = applyAddress;
        applyAddress();
        container.querySelector('[data-address-add]').onclick = () => {
            form.elements.recipientPhone.value = '';
            form.elements.recipientAddress.value = '';
            if (isCheckout) {
                select.hidden = true;
                addressTextarea.hidden = false;
            }
            form.elements.recipientAddress.focus();
            form.querySelector('.save-address-button').textContent = 'LƯU ĐỊA CHỈ MỚI';
        };
        container.querySelector('[data-address-default]').onclick = async () => {
            await changeSavedAddress(`${select.value}/default`, 'PUT');
            loadSavedAddresses(form, select.value);
        };
        container.querySelector('[data-address-delete]').onclick = async () => {
            if (!window.confirm('Xóa địa chỉ đã chọn khỏi sổ địa chỉ?')) return;
            await changeSavedAddress(select.value, 'DELETE');
            loadSavedAddresses(form);
        };
    } catch (error) {
        container.innerHTML = `<p class="address-hint address-error">${escapeHtml(error.message)}</p>`;
    }
}

async function changeSavedAddress(path, method) {
    const response = await fetch(`${API_BASE_URL}/api/user/addresses/${path}`, {
        method, headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    });
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.message || 'Không thể cập nhật địa chỉ.');
}

async function saveCheckoutAddress(event) {
    const form = event.currentTarget.closest('form');
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.alert('Vui lòng đăng nhập để lưu địa chỉ.');
        closeCartDrawer(); openAuthModal(); return;
    }
    if (!form.reportValidity()) return;
    const button = event.currentTarget;
    button.disabled = true; button.textContent = 'ĐANG LƯU...';
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                label: form.elements.addressLabel.value || 'Địa chỉ mới',
                recipientName: form.elements.recipientName.value,
                phone: form.elements.recipientPhone.value,
                address: form.elements.recipientAddress.value
            })
        });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.message || 'Không thể lưu địa chỉ.');
        await loadSavedAddresses(form, data.id);
    } catch (error) {
        window.alert(error.message);
    } finally {
        button.disabled = false; button.textContent = 'LƯU ĐỊA CHỈ NÀY';
    }
}

async function submitCartCheckout(event) {
    event.preventDefault();
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const token = localStorage.getItem('authToken');
    if (!token || !user || user.guest) {
        window.alert('Vui lòng đăng nhập để hoàn tất đơn hàng. Giỏ hàng của bạn đã được lưu.');
        closeCartDrawer(); openAuthModal(); return;
    }
    const cart = getShoppingCart();
    const button = event.currentTarget.querySelector('.checkout-button');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    button.disabled = true; button.textContent = 'ĐANG ĐẶT HÀNG...';
    try {
        const codes = [];
        for (const item of cart) {
            const response = await fetch(`${API_BASE_URL}/api/orders`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...fields, productVariantId: item.variantId, quantity: item.quantity })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Không thể đặt ${item.title}.`);
            codes.push(result.orderCode);
            saveShoppingCart(getShoppingCart().filter(entry => String(entry.variantId) !== String(item.variantId)));
        }
        window.alert(`Đặt hàng thành công! Mã đơn: ${codes.join(', ')}`);
        renderShoppingCart();
    } catch (error) {
        window.alert(error.message); button.disabled = false; button.textContent = 'THỬ ĐẶT HÀNG LẠI';
    }
}

document.addEventListener('click', event => {
    if (event.target.closest('[data-close-cart]')) closeCartDrawer();
    const remove = event.target.closest('[data-cart-remove]');
    const minus = event.target.closest('[data-cart-minus]');
    const plus = event.target.closest('[data-cart-plus]');
    const control = remove || minus || plus;
    if (!control) return;
    const id = remove?.dataset.cartRemove || minus?.dataset.cartMinus || plus?.dataset.cartPlus;
    const cart = getShoppingCart();
    const item = cart.find(entry => String(entry.variantId) === String(id));
    if (remove) saveShoppingCart(cart.filter(entry => String(entry.variantId) !== String(id)));
    else if (item) { item.quantity = Math.min(item.stockQty, Math.max(1, item.quantity + (plus ? 1 : -1))); saveShoppingCart(cart); }
    renderShoppingCart();
});

document.addEventListener('click', async event => {
    const button = event.target.closest('[data-cancel-order]');
    if (!button) return;
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng vừa đặt?')) return;
    button.disabled = true;
    button.textContent = 'ĐANG HỦY...';
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${button.dataset.cancelOrder}/cancel`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể hủy đơn hàng.');
        renderShoppingCart();
    } catch (error) {
        window.alert(error.message);
        button.disabled = false;
        button.textContent = 'HỦY ĐƠN';
    }
});

// Show error message
function showError(errorDiv, message) {
    errorDiv.innerHTML = `<div class="error-message">${message}</div>`;
}

// ================= SHOP MESSAGING =================

function updateShopChatButton(unreadCount) {
    const widget = document.querySelector('.shop-chat-widget');
    if (!widget) return;
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const signedIn = user && !user.guest && localStorage.getItem('authToken');
    widget.hidden = !signedIn;
    const badge = document.getElementById('shopChatCount');
    if (badge && Number.isInteger(unreadCount)) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = unreadCount === 0;
    }
}

async function loadShopMessages(markRead = false) {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!token || !user || user.guest) {
        updateShopChatButton(0);
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/messages/shop`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải tin nhắn.');
        updateShopChatButton(Number(data.unreadCount || 0));
        const mount = document.getElementById('shopChatMessages');
        if (mount) {
            mount.innerHTML = (data.messages || []).length ? data.messages.map(message => `
              <article class="shop-message ${Number(message.senderId) === Number(user.id) ? 'sent' : 'received'}">
                <p>${escapeHtml(message.content)}</p>
                <time>${notificationTime(message.createdAt)}</time>
              </article>`).join('') : '<p class="shop-chat-empty">Hãy gửi lời nhắn đầu tiên cho OWEN.</p>';
            mount.scrollTop = mount.scrollHeight;
        }
        if (markRead && Number(data.unreadCount) > 0) {
            await fetch(`${API_BASE_URL}/api/messages/shop/read`, {
                method: 'PUT', headers: { Authorization: `Bearer ${token}` }
            });
            updateShopChatButton(0);
        }
    } catch (error) {
        const mount = document.getElementById('shopChatMessages');
        if (mount) mount.innerHTML = `<p class="shop-chat-empty shop-chat-error">${escapeHtml(error.message)}</p>`;
    }
}

function initShopChat() {
    const widget = document.createElement('section');
    widget.className = 'shop-chat-widget';
    widget.hidden = true;
    widget.innerHTML = `
      <button class="shop-chat-toggle" type="button" aria-label="Nhắn tin cho shop" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A8 8 0 1 1 21 15Z"></path>
        </svg>
        <span id="shopChatCount" hidden>0</span>
      </button>
      <div class="shop-chat-panel" aria-hidden="true">
        <header class="shop-chat-header">
          <div><strong>Nhắn tin với OWEN</strong><span>Shop sẽ phản hồi sớm nhất</span></div>
          <button type="button" class="shop-chat-close" aria-label="Đóng">&times;</button>
        </header>
        <div id="shopChatMessages" class="shop-chat-messages"></div>
        <form class="shop-chat-form">
          <textarea name="content" maxlength="1000" rows="1" placeholder="Nhập tin nhắn..." required></textarea>
          <button type="submit">Gửi</button>
        </form>
      </div>`;
    document.body.appendChild(widget);
    const toggle = widget.querySelector('.shop-chat-toggle');
    const panel = widget.querySelector('.shop-chat-panel');
    const close = widget.querySelector('.shop-chat-close');
    const form = widget.querySelector('.shop-chat-form');
    const setOpen = open => {
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
            loadShopMessages(true);
            form.elements.content.focus();
        }
    };
    toggle.onclick = () => setOpen(!panel.classList.contains('open'));
    close.onclick = () => setOpen(false);
    form.onsubmit = async event => {
        event.preventDefault();
        const input = form.elements.content;
        const content = input.value.trim();
        if (!content) return;
        const button = form.querySelector('button');
        button.disabled = true;
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/shop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
                body: JSON.stringify({ content })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Không thể gửi tin nhắn.');
            input.value = '';
            localStorage.setItem('owenMessageUpdate', String(Date.now()));
            await loadShopMessages();
        } catch (error) {
            window.alert(error.message);
        } finally {
            button.disabled = false;
            input.focus();
        }
    };
    updateShopChatButton();
    loadShopMessages();
}

window.addEventListener('storage', event => {
    if (event.key === 'owenMessageUpdate') loadShopMessages();
});

// ================= AI SHOPPING ASSISTANT =================

const aiChatHistory = [];

function addAiMessage(role, content) {
    const messages = document.getElementById('aiChatMessages');
    if (!messages) return;
    const item = document.createElement('div');
    item.className = `ai-chat-message ${role}`;
    item.textContent = content;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}

function initAiChat() {
    const widget = document.createElement('section');
    widget.className = 'ai-chat-widget';
    widget.innerHTML = `
        <button class="ai-chat-toggle" type="button" aria-label="Mở trợ lý AI" aria-expanded="false">AI</button>
        <div class="ai-chat-panel" aria-hidden="true">
            <div class="ai-chat-header">
                <div>
                    <strong>Trợ lý OWEN</strong>
                    <span>Tư vấn sản phẩm bằng AI</span>
                </div>
                <button class="ai-chat-close" type="button" aria-label="Đóng trợ lý">&times;</button>
            </div>
            <div id="aiChatMessages" class="ai-chat-messages" aria-live="polite"></div>
            <div class="ai-chat-suggestions">
                <button type="button">Có sản phẩm nào dưới 500.000đ không?</button>
                <button type="button">Gợi ý sản phẩm còn hàng</button>
            </div>
            <form class="ai-chat-form">
                <input type="text" maxlength="500" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi cho trợ lý AI" required>
                <button type="submit">Gửi</button>
            </form>
        </div>`;
    document.body.appendChild(widget);

    const toggle = widget.querySelector('.ai-chat-toggle');
    const panel = widget.querySelector('.ai-chat-panel');
    const close = widget.querySelector('.ai-chat-close');
    const form = widget.querySelector('.ai-chat-form');
    const input = form.querySelector('input');
    const submitButton = form.querySelector('button');

    function setOpen(open) {
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
        if (open) input.focus();
    }

    async function sendQuestion(question) {
        const cleanQuestion = question.trim();
        if (!cleanQuestion || submitButton.disabled) return;
        addAiMessage('user', cleanQuestion);
        input.value = '';
        input.disabled = true;
        submitButton.disabled = true;
        submitButton.textContent = '...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: cleanQuestion, history: aiChatHistory })
            });
            const responseText = await response.text();
            let data = {};
            if (responseText) {
                try {
                    data = JSON.parse(responseText);
                } catch {
                    throw new Error(`Backend trả về dữ liệu không hợp lệ (HTTP ${response.status}).`);
                }
            }
            if (!response.ok) throw new Error(data.message || 'Không thể nhận câu trả lời.');
            if (!data.answer) throw new Error('Backend không trả về nội dung từ trợ lý AI.');
            addAiMessage('assistant', data.answer);
            aiChatHistory.push(
                { role: 'user', content: cleanQuestion },
                { role: 'assistant', content: data.answer }
            );
            if (aiChatHistory.length > 12) aiChatHistory.splice(0, aiChatHistory.length - 12);
        } catch (error) {
            const message = error instanceof TypeError
                ? 'Không kết nối được backend. Hãy chạy npm start và thử lại.'
                : error.message;
            addAiMessage('error', message);
        } finally {
            input.disabled = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Gửi';
            input.focus();
        }
    }

    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    close.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', event => {
        event.preventDefault();
        sendQuestion(input.value);
    });
    widget.querySelectorAll('.ai-chat-suggestions button').forEach(button => {
        button.addEventListener('click', () => sendQuestion(button.textContent));
    });

    addAiMessage('assistant', 'Xin chào! Tôi có thể giúp bạn tìm sản phẩm theo giá, thương hiệu hoặc nhu cầu.');
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const accountWrap = event.target.closest('.account-menu-wrap');
    if (!accountWrap) {
        const dropdown = document.getElementById('accountDropdown');
        const button = document.getElementById('accountButton');
        if (dropdown) dropdown.hidden = true;
        if (button) button.setAttribute('aria-expanded', 'false');
    }
    if (!event.target.closest('.notification-menu-wrap')) closeNotificationMenu();
    const authModal = document.getElementById('authModal');
    const authContainer = document.querySelector('.auth-container');
    
    if (authModal && event.target === authModal) {
        // Prevent closing if user is not logged in
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            closeAuthModal();
        }
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    ensureCartDrawer();
    renderShoppingCart();
    loadNotifications();
    initShopChat();
    initAiChat();
    loadHomepageProducts();
    loadCategoryProducts();
    // Keep an already open homepage in sync with changes made in the admin area.
    if (document.getElementById('productGallery')) {
        window.setInterval(loadHomepageProducts, 30000);
    }
    window.setInterval(loadNotifications, 5000);
    window.setInterval(() => loadShopMessages(false), 5000);
});
