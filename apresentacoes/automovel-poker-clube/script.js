/**
 * Apresentação Premium — Automóvel Poker Clube
 * Script de interatividade
 */

document.addEventListener('DOMContentLoaded', () => {

    // ---- Scroll Reveal ----
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Don't unobserve — allow re-reveal on scroll back
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // ---- Navbar scroll effect ----
    const navBar = document.querySelector('.nav-bar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        
        if (currentScroll > 80) {
            navBar.classList.add('scrolled');
        } else {
            navBar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });

    // ---- Mobile menu toggle ----
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
        });

        // Close menu on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                navToggle.textContent = '☰';
            });
        });
    }

    // ---- Smooth scroll for anchor links ----
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ---- Animated number counters ----
    const counters = document.querySelectorAll('.stat-number[data-target]');
    
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));

    function animateCounter(element) {
        const target = parseInt(element.dataset.target);
        const suffix = element.dataset.suffix || '';
        const prefix = element.dataset.prefix || '';
        const duration = 2000;
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * eased);
            
            element.textContent = prefix + current.toLocaleString('pt-BR') + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ---- Parallax effect on hero floats ----
    const heroFloats = document.querySelectorAll('.hero-float');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        heroFloats.forEach((float, i) => {
            const speed = (i + 1) * 0.05;
            float.style.transform = `translateY(${scrollY * speed}px)`;
        });
    });

    // ---- Mock dashboard live data simulation ----
    const mockValues = document.querySelectorAll('.mock-live-value');
    
    if (mockValues.length > 0) {
        setInterval(() => {
            mockValues.forEach(el => {
                const min = parseInt(el.dataset.min) || 0;
                const max = parseInt(el.dataset.max) || 100;
                const prefix = el.dataset.prefix || '';
                const val = Math.floor(Math.random() * (max - min + 1)) + min;
                el.textContent = prefix + val.toLocaleString('pt-BR');
            });
        }, 4000);
    }

    // ---- Card tilt effect on hover ----
    const tiltCards = document.querySelectorAll('.solution-card');
    
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });

    // ---- Keyboard navigation (for presentation mode) ----
    const sections = document.querySelectorAll('.section, .hero');
    let currentSection = 0;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            currentSection = Math.min(currentSection + 1, sections.length - 1);
            sections[currentSection].scrollIntoView({ behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            currentSection = Math.max(currentSection - 1, 0);
            sections[currentSection].scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Update currentSection on manual scroll
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = Array.from(sections).indexOf(entry.target);
                if (idx !== -1) currentSection = idx;
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(s => sectionObserver.observe(s));

    console.log('🎴 Apresentação Automóvel Poker Clube carregada com sucesso.');
});
