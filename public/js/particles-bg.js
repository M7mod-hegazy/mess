function resizeParticlesBg() {
  const footer = document.querySelector('footer');
  const bg = document.getElementById('interactive-bg');
  if (footer && bg) {
    const footerHeight = footer.offsetHeight;
    bg.style.height = `calc(100vh - ${footerHeight}px)`;
    bg.style.width = '100vw';
    bg.style.position = 'fixed';
    bg.style.top = 0;
    bg.style.left = 0;
    bg.style.zIndex = 0;
    bg.style.pointerEvents = 'none';
    bg.style.background = 'transparent';
  }
}
window.addEventListener('resize', resizeParticlesBg);
window.addEventListener('DOMContentLoaded', resizeParticlesBg); 