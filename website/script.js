document.addEventListener('DOMContentLoaded', () => {
  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Initialize animations when DOM is fully loaded and fonts are ready
  // Using a small timeout or waiting for fonts ensures the layout is stable
  document.fonts.ready.then(() => {
    initAnimations();
  });
});

function initAnimations() {
  // Remove loading state
  document.body.classList.add('loaded');
  // 0. Mobile Navigation Toggle
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });

    // Close menu when a link is clicked (useful for anchor links)
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('no-scroll');
      });
    });
  }

  // 1. Navbar Reveal
  gsap.from(".gs-reveal-nav", {
    y: -100,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    delay: 0.2
  });

  // 2. Hero Content Stagger Reveal
  gsap.from(".gs-reveal", {
    y: 50,
    opacity: 0,
    duration: 1,
    stagger: 0.15,
    ease: "power3.out",
    delay: 0.4
  });

  // 3. Scroll Reveal Animations (Upward fade)
  const revealElements = document.querySelectorAll(".gs-reveal-up");
  revealElements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none"
      },
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out"
    });
  });

  // 4. Animated Counter on Scroll
  const counters = document.querySelectorAll('.stat-number');
  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    if (!Number.isFinite(target)) return;

    ScrollTrigger.create({
      trigger: counter,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        const duration = 2;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration,
          ease: 'power2.out',
          onUpdate: () => {
            counter.textContent = Math.round(obj.val);
          },
        });
      },
    });
  });

  // 5. Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 6. Back to top button
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 600) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 7. Cursor Glow effect (desktop only)
  const cursorGlow = document.getElementById('cursorGlow');
  if (cursorGlow && window.innerWidth > 968) {
    document.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = e.clientX + 'px';
      cursorGlow.style.top = e.clientY + 'px';
      if (!cursorGlow.classList.contains('active')) {
        cursorGlow.classList.add('active');
      }
    });

    document.addEventListener('mouseleave', () => {
      cursorGlow.classList.remove('active');
    });
  }

  // 8. Parallax effect for the Hero Visual Card on Mouse Move
  const heroSection = document.querySelector('.hero');
  const visualCard = document.querySelector('.visual-card');

  if (heroSection && visualCard && window.innerWidth > 968) {
    heroSection.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const xPos = (clientX / window.innerWidth - 0.5) * 20; // max rotation degrees
      const yPos = (clientY / window.innerHeight - 0.5) * 20;

      gsap.to(visualCard, {
        rotationY: xPos,
        rotationX: -yPos,
        ease: "power2.out",
        duration: 0.5
      });
    });

    heroSection.addEventListener('mouseleave', () => {
      gsap.to(visualCard, {
        rotationY: -5,
        rotationX: 5,
        ease: "power2.out",
        duration: 1
      });
    });
  }
}
