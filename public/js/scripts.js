// --- CONFIG ---
const API_URL = '/api/public/images';

// --- DOM ELEMENTS ---
const dom = {
    galleryGrid: document.getElementById('galleryGrid'),
    carouselTrack: document.getElementById('carouselTrack'),
    carouselDots: document.getElementById('carouselDots'),
    preloader: document.getElementById('preloader'),
    prevBtn: document.querySelector('.prev-button'),
    nextBtn: document.querySelector('.next-button')
};

// --- INITIALIZATION ---
window.addEventListener('load', async () => {
    setupAccordion(); // UI logic

    // Critical: Load media before removing preloader
    try {
        await loadMedia();
    } catch (e) {
        console.error('Media load failed', e);
        // Ensure site is still usable
        if (dom.galleryGrid) dom.galleryGrid.innerHTML = '<p>No se pudo cargar la galería.</p>';
    } finally {
        hidePreloader();
    }
});

// Failsafe: Force hide preloader after 4s no matter what
setTimeout(hidePreloader, 4000);

function hidePreloader() {
    if (dom.preloader && !dom.preloader.classList.contains('hidden')) {
        dom.preloader.classList.add('hidden');
    }
}

// --- MEDIA LOGIC ---

async function loadMedia() {
    // 1. Fetch with strict No-Cache to ensure fresh content from Vercel
    const res = await fetch(`${API_URL}?nocache=${Math.random()}`);
    if (!res.ok) throw new Error('API Error');

    const data = await res.json();
    const images = data.images || [];

    // 2. Clear Containers
    if (dom.galleryGrid) dom.galleryGrid.innerHTML = '';
    if (dom.carouselTrack) dom.carouselTrack.innerHTML = '';
    if (dom.carouselDots) dom.carouselDots.innerHTML = '';

    // 3. Filter Categories
    const galleryItems = images.filter(img => img.category === 'gallery');
    const tipsItems = images.filter(img => img.category === 'tips');

    // 4. Render Gallery
    if (galleryItems.length > 0) {
        galleryItems.forEach(img => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${img.url}" alt="${img.title || 'Proyecto'}" loading="lazy">
                <div class="overlay">
                    <p>${img.title || 'Proyecto PassWord S.A.S.'}</p>
                </div>
            `;
            dom.galleryGrid.appendChild(div);
        });
    } else {
        dom.galleryGrid.innerHTML = '<p style="text-align:center; color:#888;">Galería próximamente...</p>';
    }

    // 5. Render Tips (Carousel)
    if (tipsItems.length > 0) {
        tipsItems.forEach((img, index) => {
            // Slide
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.innerHTML = `
                <div class="tip-content">
                    <img src="${img.url}" alt="Tip" class="tip-image" loading="lazy">
                    <div class="tip-text">
                        <h3>${img.title || 'Consejo'}</h3>
                        <p>${img.description || ''}</p>
                    </div>
                </div>
            `;
            dom.carouselTrack.appendChild(slide);

            // Dot
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.addEventListener('click', () => goToSlide(index));
            dom.carouselDots.appendChild(dot);
        });

        initCarousel();
    } else {
        if (dom.carouselTrack) dom.carouselTrack.innerHTML = '<p style="text-align:center; padding:20px;">Pronto más consejos.</p>';
        if (dom.prevBtn) dom.prevBtn.style.display = 'none';
        if (dom.nextBtn) dom.nextBtn.style.display = 'none';
    }
}

// --- CAROUSEL LOGIC ---
let currentSlide = 0;
let slides = [];

function initCarousel() {
    slides = Array.from(document.querySelectorAll('.carousel-slide'));
    if (slides.length === 0) return;

    updateCarousel();

    if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => moveSlide(-1));
    if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => moveSlide(1));

    window.addEventListener('resize', updateCarousel);
}

function moveSlide(dir) {
    if (slides.length === 0) return;
    currentSlide = (currentSlide + dir + slides.length) % slides.length;
    updateCarousel();
}

function goToSlide(index) {
    currentSlide = index;
    updateCarousel();
}

function updateCarousel() {
    if (!dom.carouselTrack || slides.length === 0) return;

    const width = dom.carouselTrack.parentElement.clientWidth;
    // Resize slides to fit track
    slides.forEach(slide => slide.style.width = `${width}px`);

    // Move track
    dom.carouselTrack.style.transform = `translateX(-${currentSlide * width}px)`;

    // Update dots
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

// --- UI UTILS ---
function setupAccordion() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const content = document.getElementById(header.getAttribute('aria-controls'));
            const isOpen = header.getAttribute('aria-expanded') === 'true';

            // Close all
            document.querySelectorAll('.accordion-header').forEach(h => {
                h.setAttribute('aria-expanded', 'false');
                document.getElementById(h.getAttribute('aria-controls')).classList.remove('open');
            });

            // Toggle current
            if (!isOpen) {
                header.setAttribute('aria-expanded', 'true');
                content.classList.add('open');
            }
        });
    });
}