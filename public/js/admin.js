const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const messageElement = document.getElementById('message');
const uploadMessageElement = document.getElementById('uploadMessage');
const currentImagesList = document.getElementById('currentImagesList');
const categorySelect = document.getElementById('categorySelect');
const galleryFields = document.getElementById('galleryFields');
const tipsFields = document.getElementById('tipsFields');
const galleryTitle = document.getElementById('galleryTitle');
const tipsTitle = document.getElementById('tipsTitle');
const tipsDescription = document.getElementById('tipsDescription');

// --- Funciones de Interfaz ---

// Muestra u oculta las vistas
function toggleViews(isLoggedIn) {
    loginView.style.display = isLoggedIn ? 'none' : 'block';
    adminView.style.display = isLoggedIn ? 'block' : 'none';
    document.body.style.display = isLoggedIn ? 'block' : 'flex';
    document.body.style.justifyContent = isLoggedIn ? '' : 'center';
    document.body.style.alignItems = isLoggedIn ? '' : 'center';
    document.body.style.height = isLoggedIn ? '' : '100vh';
    if (isLoggedIn) {
        fetchImages(1); // Cargar la lista de imágenes al iniciar sesión
    }
}

// Verificar si ya está logueado al cargar la página
async function checkLogin() {
    try {
        const response = await fetch('/api/check-login', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            if (data.loggedIn) {
                toggleViews(true);
                return;
            }
        }
    } catch (error) {
        console.error('Error verificando login:', error);
    }
    toggleViews(false);
}

// --- Manejo del Login ---
document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    messageElement.textContent = 'Intentando iniciar sesión...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            messageElement.textContent = 'Login exitoso. Redirigiendo...';
            toggleViews(true);
        } else {
            const data = await response.json();
            messageElement.textContent = data.message || 'Error de autenticación.';
        }
    } catch (error) {
        messageElement.textContent = 'Error de conexión con el servidor.';
    }
});

// --- Carga de Imágenes ---
// Toggle fields when category changes
if (categorySelect) {
    categorySelect.addEventListener('change', () => {
        const val = categorySelect.value;
        if (val === 'gallery') {
            galleryFields.style.display = 'block';
            tipsFields.style.display = 'none';
            // enable/disable inputs to ensure FormData contains only relevant fields
            galleryTitle.disabled = false;
            tipsTitle.disabled = true;
            tipsDescription.disabled = true;
        } else {
            galleryFields.style.display = 'none';
            tipsFields.style.display = 'block';
            galleryTitle.disabled = true;
            tipsTitle.disabled = false;
            tipsDescription.disabled = false;
        }
    });
    // initialize proper state
    categorySelect.dispatchEvent(new Event('change'));
}

document.getElementById('imageUploadForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    // FormData se usa para enviar archivos (multipart/form-data)
    const formData = new FormData(this);
    uploadMessageElement.textContent = 'Subiendo archivo...';
    uploadMessageElement.style.color = 'var(--color-accent)';

    // Optimistic UI: Show progress
    const fileInput = document.getElementById('imageFile');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fakeItem = document.createElement('li');
        fakeItem.style.opacity = '0.7';
        fakeItem.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div style="width: 50px; height: 50px; margin-right: 15px; border: 1px solid var(--color-accent); display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 20px;">⏳</span>
                </div>
                <div>
                    <div style="font-size:0.85em">${file.name} (Subiendo...)</div>
                    <div style="font-size:0.75em; color:#bbb">Por favor espere</div>
                </div>
            </div>
        `;
        // Insert at top
        if (currentImagesList.firstChild) {
            currentImagesList.insertBefore(fakeItem, currentImagesList.firstChild);
        } else {
            currentImagesList.appendChild(fakeItem);
        }
    }

    try {
        const response = await fetch('/api/imagenes/subir', {
            method: 'POST',
            credentials: 'include',
            // ¡IMPORTANTE! No establecemos 'Content-Type' aquí. 
            // El navegador lo hace automáticamente para FormData.
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            uploadMessageElement.textContent = data.message;
            uploadMessageElement.style.color = 'lightgreen';
            document.getElementById('imageFile').value = ''; // Limpiar el campo
            // Aggressive re-fetch with cache busting
            fetchImages(1);
        } else {
            uploadMessageElement.textContent = data.message || 'Error al subir la imagen.';
            uploadMessageElement.style.color = 'red';
        }
    } catch (error) {
        uploadMessageElement.textContent = 'Error de conexión durante la subida.';
        uploadMessageElement.style.color = 'red';
    }
});

// --- Cargar Lista de Imágenes (Faltan las rutas GET y DELETE en el Back-end) ---
// Esta función se completará en el siguiente paso, por ahora solo muestra un mensaje
let currentPage = 1;
const imagesPerPage = 20;

async function fetchImages(page = 1) {
    currentPage = page;
    currentImagesList.innerHTML = '<li>Cargando lista de imágenes...</li>';

    try {
        const response = await fetch(`/api/imagenes?page=${page}&limit=${imagesPerPage}&t=${Date.now()}`, { credentials: 'include' });
        const data = await response.json();
        const images = data.images;
        const pagination = data.pagination;

        currentImagesList.innerHTML = ''; // Limpiar la lista

        if (images.length === 0) {
            currentImagesList.innerHTML = '<li style="color: var(--color-accent);">No hay imágenes subidas aún.</li>';
            return;
        }

        images.forEach(image => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.marginBottom = '10px';
            li.style.borderBottom = '1px solid #333';
            li.style.paddingBottom = '10px';
            // Show category and any metadata (title/description)
            const metaParts = [];
            if (image.category) metaParts.push(`<strong>${image.category}</strong>`);
            if (image.title) metaParts.push(`Title: ${image.title}`);
            if (image.description) metaParts.push(`Desc: ${image.description}`);

            li.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <img src="${image.url}" alt="${image.originalName}" style="width: 50px; height: 50px; object-fit: cover; margin-right: 15px; border: 1px solid var(--color-accent);" loading="lazy">
                    <div>
                        <div style="font-size:0.85em">${image.originalName} (ID: ${image._id})</div>
                        <div style="font-size:0.75em; color:#bbb">${metaParts.join(' — ')}</div>
                    </div>
                </div>
                <button class="delete-btn" data-id="${image._id}" style="background-color: var(--color-primary); color: white; border: none; padding: 5px 10px; cursor: pointer;">Eliminar</button>
            `;
            currentImagesList.appendChild(li);
        });

        // Add pagination controls
        const paginationDiv = document.createElement('div');
        paginationDiv.style.marginTop = '20px';
        paginationDiv.style.textAlign = 'center';

        if (pagination.totalPages > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Anterior';
            prevButton.disabled = page === 1;
            prevButton.style.marginRight = '10px';
            prevButton.className = 'btn secondary';
            prevButton.onclick = () => fetchImages(page - 1);
            paginationDiv.appendChild(prevButton);

            const pageInfo = document.createElement('span');
            pageInfo.textContent = `Página ${pagination.currentPage} de ${pagination.totalPages}`;
            pageInfo.style.margin = '0 10px';
            paginationDiv.appendChild(pageInfo);

            const nextButton = document.createElement('button');
            nextButton.textContent = 'Siguiente';
            nextButton.disabled = page === pagination.totalPages;
            nextButton.className = 'btn secondary';
            nextButton.onclick = () => fetchImages(page + 1);
            paginationDiv.appendChild(nextButton);
        }

        currentImagesList.appendChild(paginationDiv);

        // Añadir el evento click a los nuevos botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                deleteImage(id, e.target);
            });
        });

    } catch (error) {
        console.error('Error al obtener la lista de imágenes:', error);
        currentImagesList.innerHTML = '<li style="color: red;">Error al cargar imágenes. Verifique la conexión a la Base de Datos.</li>';
        // Solo cerrar sesión si el error es explícitamente de autenticación (lo cual sabríamos si checkeramos status antes)
        // Por falta de chequeo detallado aquí, evitaremos toggleViews(false) para no cerrar el panel
        // toggleViews(false); 
    }
}

// --- Inicialización (Verificar si ya estamos logueados, aunque sin DB es difícil) ---
async function deleteImage(id, btnElement) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
        return;
    }

    // Optimistic UI: Remove immediately
    const li = btnElement.closest('li');
    if (li) {
        li.style.opacity = '0.5'; // Visual feedback
        li.style.pointerEvents = 'none';
    }

    try {
        const response = await fetch(`/api/imagenes/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Remove completely
            if (li) li.remove();

            // Re-fetch to keep pagination in sync, but silently
            fetchImages(currentPage);
        } else {
            alert(data.message || 'Error al eliminar la imagen.');
            // Revert changes if failed
            if (li) {
                li.style.opacity = '1';
                li.style.pointerEvents = 'all';
            }
        }
    } catch (error) {
        console.error('Error de red al eliminar:', error);
        alert('Error de conexión con el servidor al intentar eliminar.');
        if (li) {
            li.style.opacity = '1';
            li.style.pointerEvents = 'all';
        }
    }
}

// Event listener para logout
document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
    toggleViews(false);
});

// Inicialización
window.addEventListener('load', checkLogin);