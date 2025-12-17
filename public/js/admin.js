// --- CONFIG ---
const API_BASE = '/api';

// --- STATE ---
const state = {
    isLoggedIn: false,
    images: [],
    currentPage: 1,
    limit: 20
};

// --- DOM ELEMENTS ---
const elements = {
    loginView: document.getElementById('loginView'),
    adminView: document.getElementById('adminView'),
    loginForm: document.getElementById('loginForm'),
    imageUploadForm: document.getElementById('imageUploadForm'),
    imagesList: document.getElementById('currentImagesList'),
    categorySelect: document.getElementById('categorySelect'),
    // Messages
    loginMessage: document.getElementById('message'),
    uploadMessage: document.getElementById('uploadMessage'),
    // Inputs
    galleryTitle: document.getElementById('galleryTitle'),
    tipsTitle: document.getElementById('tipsTitle'),
    tipsDescription: document.getElementById('tipsDescription'),
    galleryFields: document.getElementById('galleryFields'),
    tipsFields: document.getElementById('tipsFields')
};

// --- INITIALIZATION ---
window.addEventListener('load', init);

async function init() {
    await checkLogin();
    setupEventListeners();
}

function setupEventListeners() {
    // Login
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(
            document.getElementById('username').value,
            document.getElementById('password').value
        );
    });

    // Logout
    document.getElementById('logoutButton').addEventListener('click', logout);

    // Filter Toggle
    if (elements.categorySelect) {
        elements.categorySelect.addEventListener('change', toggleCategoryFields);
        toggleCategoryFields(); // Init state
    }

    // Upload
    elements.imageUploadForm.addEventListener('submit', uploadImage);
}

// --- AUTHENTICATION ---

async function checkLogin() {
    try {
        const res = await fetch(`${API_BASE}/check-login`);
        const data = await res.json();
        toggleView(data.loggedIn);
    } catch (e) {
        console.error('Auth check failed', e);
        toggleView(false);
    }
}

async function login(username, password) {
    elements.loginMessage.textContent = 'Verificando...';
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            elements.loginMessage.textContent = '';
            toggleView(true);
        } else {
            elements.loginMessage.textContent = data.message || 'Error de acceso';
        }
    } catch (e) {
        elements.loginMessage.textContent = 'Error de conexión';
    }
}

async function logout() {
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    toggleView(false);
}

function toggleView(isLoggedIn) {
    state.isLoggedIn = isLoggedIn;
    elements.loginView.style.display = isLoggedIn ? 'none' : 'block';
    elements.adminView.style.display = isLoggedIn ? 'block' : 'none';
    document.body.style.display = isLoggedIn ? 'block' : 'flex';

    if (isLoggedIn) fetchImages();
}

// --- IMAGES LOGIC ---

async function fetchImages(page = 1) {
    try {
        // Cache busting to ensure we see the latest state
        const res = await fetch(`${API_BASE}/imagenes?page=${page}&t=${Date.now()}`);
        const data = await res.json();
        state.images = data.images || [];
        renderImages();
    } catch (e) {
        console.error('Fetch error', e);
        elements.imagesList.innerHTML = '<li style="color:red">Error cargando imágenes</li>';
    }
}

function renderImages() {
    elements.imagesList.innerHTML = '';

    if (state.images.length === 0) {
        elements.imagesList.innerHTML = '<li style="text-align:center">No hay imágenes.</li>';
        return;
    }

    state.images.forEach(img => {
        const li = document.createElement('li');
        li.className = 'image-item'; // Ensure CSS class exists or uses default styling
        li.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center;">
                    <img src="${img.url}" alt="tb" style="width: 50px; height: 50px; object-fit: cover; margin-right: 10px; border-radius: 4px;">
                    <div>
                        <strong>${img.category === 'gallery' ? 'Galería' : 'Tip'}</strong>
                        <span style="color:#666; font-size:0.9em"> - ${img.title || img.originalName}</span>
                    </div>
                </div>
                <button class="btn danger delete-btn" data-id="${img._id}">Eliminar</button>
            </div>
        `;

        // Bind delete event directly
        li.querySelector('.delete-btn').addEventListener('click', (e) => deleteImage(img._id, e.target));

        elements.imagesList.appendChild(li);
    });
}

// Optimization: Instant Delete from UI
async function deleteImage(id, btnElement) {
    if (!confirm('¿Eliminar imagen permanentemente?')) return;

    // Optimistic UI
    const li = btnElement.closest('li');
    li.style.opacity = '0.3';
    li.style.pointerEvents = 'none';

    try {
        const res = await fetch(`${API_BASE}/imagenes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            li.remove();
            // Silent refetch to sync just in case
            fetchImages(state.currentPage);
        } else {
            alert('Error al eliminar');
            li.style.opacity = '1';
            li.style.pointerEvents = 'all';
        }
    } catch (e) {
        alert('Error de red');
        li.style.opacity = '1';
        li.style.pointerEvents = 'all';
    }
}

// Optimization: Instant Upload Feedback
async function uploadImage(e) {
    e.preventDefault();
    const formData = new FormData(elements.imageUploadForm);

    // Validar archivo
    const fileInput = document.getElementById('imageFile');
    if (fileInput.files.length === 0) return;

    elements.uploadMessage.textContent = 'Subiendo...';
    elements.uploadMessage.className = 'info-message';

    // Optimistic UI: Add temp item
    const tempLi = document.createElement('li');
    tempLi.innerHTML = `
        <div style="display: flex; align-items: center; padding: 10px;">
            <span style="margin-right: 10px;">⏳</span> 
            <span>Subiendo ${fileInput.files[0].name}...</span>
        </div>
    `;
    elements.imagesList.prepend(tempLi);

    try {
        const res = await fetch(`${API_BASE}/imagenes/subir`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            elements.uploadMessage.textContent = '¡Éxito!';
            elements.uploadMessage.style.color = 'green';
            elements.imageUploadForm.reset();
            tempLi.remove(); // Remove interaction placeholder
            fetchImages(); // Refresh real list
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        tempLi.remove();
        elements.uploadMessage.textContent = 'Error: ' + e.message;
        elements.uploadMessage.style.color = 'red';
    }
}

// UI Utilities
function toggleCategoryFields() {
    const isGallery = elements.categorySelect.value === 'gallery';
    elements.galleryFields.style.display = isGallery ? 'block' : 'none';
    elements.tipsFields.style.display = isGallery ? 'none' : 'block';

    // Enable/Disable to declutter FormData
    elements.galleryTitle.disabled = !isGallery;
    elements.tipsTitle.disabled = isGallery;
    elements.tipsDescription.disabled = isGallery;
}