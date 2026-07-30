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

// An empty base URL calls the API from the same domain in both local and deployed environments.
const API_BASE_URL = '';

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
        const data = await response.json();
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
    grid.innerHTML = '<p class="products-message">Đang tải sản phẩm...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?limit=48&category=${encodeURIComponent(category)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải sản phẩm.');

        const products = data.products || [];
        if (!products.length) {
            grid.innerHTML = `<p class="products-message">Chưa có sản phẩm nào trong mục ${escapeHtml(category)}.</p>`;
            return;
        }

        grid.classList.remove('lookbook');
        grid.classList.add('product-grid');
        grid.innerHTML = products.map(product => `
            <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button">
                <img src="${escapeHtml(productImageUrl(product.imageUrl))}" alt="${escapeHtml(product.title)}" loading="lazy">
                <h3>${escapeHtml(product.title)}</h3>
                <p>${formatPrice(product.price)}</p>
            </article>`).join('');
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
                <label>Họ tên người nhận<input name="recipientName" required autocomplete="name"></label>
                <label>Số điện thoại<input name="recipientPhone" required autocomplete="tel"></label>
                <label>Địa chỉ nhận hàng<textarea name="recipientAddress" required autocomplete="street-address"></textarea></label>
                <label>Thanh toán<select name="paymentMethod"><option value="COD">Thanh toán khi nhận hàng</option><option value="VNPAY">VNPay</option></select></label>
                <label>Ghi chú<textarea name="note"></textarea></label>
                <p class="purchase-stock" id="purchaseStock"></p>
                <div class="purchase-price" id="purchasePrice"></div>
                <button class="purchase-button" type="submit">MUA HÀNG</button>` :
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
        const updateVariant = () => {
            const variant = product.variants.find(v => String(v.id) === size.value);
            content.querySelector('#purchasePrice').textContent = formatPrice(variant?.price || product.price);
            content.querySelector('#purchaseStock').textContent = variant ? `Còn ${variant.stockQty} sản phẩm` : '';
        };
        color.onchange = updateSizes;
        size.onchange = updateVariant;
        updateSizes();
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (currentUser?.name && !currentUser.guest) content.querySelector('[name="recipientName"]').value = currentUser.name;
        content.querySelector('#purchaseForm').onsubmit = async event => {
            event.preventDefault();
            const authToken = localStorage.getItem('authToken');
            const signedInUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (!authToken || !signedInUser || signedInUser.guest) {
                window.alert('Bạn cần đăng nhập tài khoản để mua hàng.');
                closePurchaseModal();
                if (signedInUser?.guest) {
                    localStorage.removeItem('currentUser');
                    updateAuthUI();
                }
                openAuthModal();
                return;
            }
            const variant = product.variants.find(v => String(v.id) === size.value);
            const form = event.currentTarget;
            const button = form.querySelector('.purchase-button');
            const fields = Object.fromEntries(new FormData(form));
            button.disabled = true;
            button.textContent = 'ĐANG TẠO ĐƠN...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ ...fields, productVariantId: variant.id, quantity: 1 })
                });
                const result = await response.json();
                if (response.status === 401 || response.status === 403) {
                    clearAuthData();
                    updateAuthUI();
                    closePurchaseModal();
                    openAuthModal();
                    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                }
                if (!response.ok) throw new Error(result.message || 'Không thể đặt hàng.');
                window.alert(`Đặt hàng thành công!\nMã đơn: ${result.orderCode}\nĐơn hàng đang chờ cửa hàng xác nhận.`);
                closePurchaseModal();
            } catch (error) {
                window.alert(error.message);
                button.disabled = false;
                button.textContent = 'MUA HÀNG';
            }
        };
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
        authSection.style.display = 'block';
        document.getElementById('userNameDisplay').textContent = currentUser.name;
        document.getElementById('userEmailDisplay').textContent = currentUser.email;
    } else {
        authBtn.style.display = 'block';
        authSection.style.display = 'none';
    }
}

// Show error message
function showError(errorDiv, message) {
    errorDiv.innerHTML = `<div class="error-message">${message}</div>`;
}

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
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Không thể nhận câu trả lời.');
            addAiMessage('assistant', data.answer);
            aiChatHistory.push(
                { role: 'user', content: cleanQuestion },
                { role: 'assistant', content: data.answer }
            );
            if (aiChatHistory.length > 12) aiChatHistory.splice(0, aiChatHistory.length - 12);
        } catch (error) {
            addAiMessage('error', error.message);
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
    initAiChat();
    loadHomepageProducts();
    loadCategoryProducts();
    // Keep an already open homepage in sync with changes made in the admin area.
    if (document.getElementById('productGallery')) {
        window.setInterval(loadHomepageProducts, 30000);
    }
});
