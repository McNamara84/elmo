document.addEventListener('DOMContentLoaded', function () {
    // Aktiviere ScrollSpy
    var scrollSpy = new bootstrap.ScrollSpy(document.body, {
        target: '#offcanvasNavbar',
        offset: 100
    });

    // Füge Click-Handler für die Links hinzu
    const links = document.querySelectorAll('.offcanvas .nav-link');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault(); // Verhindere das Standard-Verhalten des Links
            const href = this.getAttribute('href');
            const bsOffcanvas = bootstrap.Offcanvas.getInstance('#offcanvasNavbar');

            if (bsOffcanvas) {
                // Warte bis das Offcanvas geschlossen ist, dann scrolle
                bsOffcanvas.hide();
                bsOffcanvas._element.addEventListener('hidden.bs.offcanvas', function handler() {
                    if (href.startsWith('#')) {
                        const targetElement = document.querySelector(href);
                        if (targetElement) {
                            targetElement.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                    // Entferne den Event-Listener nach einmaligem Ausführen
                    bsOffcanvas._element.removeEventListener('hidden.bs.offcanvas', handler);
                });
            }
        });
    });
});