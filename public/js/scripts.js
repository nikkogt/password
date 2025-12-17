// Constantes del DOM
const galleryGrid = document.getElementById('galleryGrid');
const carouselTrack = document.getElementById('carouselTrack');
const carouselDots = document.getElementById('carouselDots');
const prevButton = document.querySelector('.prev-button');
const nextButton = document.querySelector('.next-button');
const preloader = document.getElementById('preloader');
const contactForm = document.getElementById('contactForm');
const contactMessageStatus = document.getElementById('contactMessageStatus');

// --- 1. Preloader ---
function hidePreloader() {
    if (preloader) {
        // Asegura que se ha cargado el CSS antes de ocultar
        setTimeout(() => {
            preloader.classList.add('hidden');
        }, 300); // Pequeño retardo para asegurar que la página es visible
    }
}

// --- 2. Acordeón de Servicios ---
function setupAccordion() {
    const headers = document.querySelectorAll('.accordion-header');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const content = document.getElementById(header.getAttribute('aria-controls'));
            const isExpanded = header.getAttribute('aria-expanded') === 'true';

            // Cerrar todos los demás
            document.querySelectorAll('.accordion-header').forEach(h => {
                h.setAttribute('aria-expanded', 'false');
                document.getElementById(h.getAttribute('aria-controls')).classList.remove('open');
            });

            // Abrir o cerrar el actual
            if (!isExpanded) {
                header.setAttribute('aria-expanded', 'true');
                content.classList.add('open');
            } else {
                header.setAttribute('aria-expanded', 'false');
                content.classList.remove('open');
            }
        });
    });
}

// --- 3. Carga Dinámica de Contenido (Galería y Tips) ---

/**
 * Carga las imágenes desde la API y las distribuye en la galería y el carrusel.
 */
async function loadMedia() {
    try {
        // Asumiendo que esta API devuelve todas las imágenes (Galería y Tips)
        const response = await fetch(`/api/public/images?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        const images = data.images || [];

        // Limpiar contenedores antes de llenar
        galleryGrid.innerHTML = '';
        carouselTrack.innerHTML = '';
        carouselDots.innerHTML = '';

        // Filtrar y procesar datos
        const galleryImages = images.filter(img => img.category === 'gallery');
        const tipImages = images.filter(img => img.category === 'tips');

        // Cargar Galería
        if (galleryImages.length > 0) {
            galleryImages.forEach(image => {
                // image.url viene de la respuesta de la API (Blob URL)
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${image.url}" alt="${image.title || 'Imagen de Galería'}" loading="lazy">
                    <div class="overlay">
                        <p>${image.title || 'Proyecto PassWord S.A.S.'}</p>
                    </div>
                `;
                galleryGrid.appendChild(item);
            });
        } else {
            galleryGrid.innerHTML = '<p style="text-align:center; color: var(--color-text-light);">Galería de proyectos en construcción. ¡Vuelve pronto!</p>';
        }

        // Cargar Tips (Carrusel)
        if (tipImages.length > 0) {
            tipImages.forEach((image, index) => {
                const slide = document.createElement('div');
                slide.className = 'carousel-slide';
                slide.setAttribute('data-index', index);
                slide.innerHTML = `
                    <div class="tip-content">
                        <img src="${image.url}" alt="${image.title || 'Tip de Seguridad'}" class="tip-image" loading="lazy">
                        <div class="tip-text">
                            <h3>${image.title}</h3>
                            <p>${image.description}</p>
                        </div>
                    </div>
                `;
                carouselTrack.appendChild(slide);

                // Crear dots de navegación
                const dot = document.createElement('span');
                dot.className = 'dot';
                dot.setAttribute('data-slide-index', index);
                dot.addEventListener('click', () => moveToSlide(index));
                carouselDots.appendChild(dot);
            });

            // Iniciar el carrusel después de cargar los tips
            initCarousel();
        } else {
            carouselTrack.innerHTML = '<div style="padding: 20px;"><p style="text-align:center; color: var(--color-text-dark);">Aún no hay tips de seguridad cargados.</p></div>';
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        }

    } catch (error) {
        console.error('Error al cargar la media:', error);
        galleryGrid.innerHTML = '<p style="text-align:center; color: red;">No se pudo cargar la galería debido a un error de conexión.</p>';
    }
}

// --- 4. Funcionalidad del Carrusel ---
let currentSlide = 0;
let slides = []; // Almacenará los elementos '.carousel-slide'
let track; // Elemento .carousel-track

function initCarousel() {
    slides = Array.from(carouselTrack.querySelectorAll('.carousel-slide'));
    track = carouselTrack;

    if (slides.length === 0) return;

    // 4.1 Posicionar los slides inicialmente (Necesario para el cálculo)
    slides.forEach((slide, index) => {
        setSlidePosition(slide, index);
    });

    // 4.2 Establecer el dot activo inicial
    updateDots();

    // 4.3 Añadir Listeners de botones
    prevButton.addEventListener('click', showPrevSlide);
    nextButton.addEventListener('click', showNextSlide);

    // 4.4 Listener de redimensionamiento para recalcular posiciones
    window.addEventListener('resize', () => {
        slides.forEach((slide, index) => {
            setSlidePosition(slide, index);
        });
        updateTrackPosition();
    });
}

function setSlidePosition(slide, index) {
    // Calcula la posición horizontal de cada slide.
    // Aunque el CSS flex ya los coloca, esta función recalcula el ancho.
    slide.style.width = track.clientWidth + 'px';
}

function moveToSlide(targetIndex) {
    if (slides.length === 0) return;

    // Evita saltos si el índice no es válido
    if (targetIndex < 0 || targetIndex >= slides.length) {
        return;
    }

    currentSlide = targetIndex;
    updateTrackPosition();
    updateDots();
}

function updateTrackPosition() {
    if (slides.length === 0) return;

    // Mueve el track a la posición del slide actual
    const offset = slides[currentSlide].offsetLeft;
    track.style.transform = `translateX(-${offset}px)`;
}

function showPrevSlide() {
    const newIndex = (currentSlide === 0) ? slides.length - 1 : currentSlide - 1;
    moveToSlide(newIndex);
}

function showNextSlide() {
    const newIndex = (currentSlide === slides.length - 1) ? 0 : currentSlide + 1;
    moveToSlide(newIndex);
}

function updateDots() {
    document.querySelectorAll('.dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// --- 5. Formulario de Contacto ---

contactForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    // Recoger datos del formulario
    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const phone = document.getElementById('contactPhone').value;
    const message = document.getElementById('contactMessage').value;

    contactMessageStatus.textContent = 'Enviando mensaje...';
    contactMessageStatus.style.color = 'var(--color-accent)';

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, phone, message }),
        });

        const data = await response.json();

        if (response.ok) {
            contactMessageStatus.textContent = '¡Gracias! Mensaje enviado con éxito.';
            contactMessageStatus.style.color = 'lightgreen';
            contactForm.reset(); // Limpiar formulario
        } else {
            contactMessageStatus.textContent = data.message || 'Error al enviar el mensaje. Intenta de nuevo.';
            contactMessageStatus.style.color = 'red';
        }
    } catch (error) {
        console.error('Error de red:', error);
        contactMessageStatus.textContent = 'Error de conexión con el servidor.';
        contactMessageStatus.style.color = 'red';
    }
});


// --- Inicialización al cargar la ventana ---
window.addEventListener('load', async () => {
    // 1. Configurar el acordeón
    setupAccordion();

    // 2. Cargar media dinámica (inicia el carrusel internamente)
    await loadMedia();

    // 3. Ocultar el preloader después de todo
    hidePreloader();
});