/* =========================================================
   MAIN
   Liga as peças: cria o retrato e a abertura, conecta os botões,
   o mouse, a rolagem e o redimensionamento, e dá a partida.
   ========================================================= */

(function () {
  "use strict";

  const { config, criarRetratoParticulas, criarAbertura } = window.Portfolio;
  const stage = document.getElementById("inicio");
  if (!stage) return;

  // Com "efeitos de animação" desligados no sistema, a abertura não roda sozinha:
  // aparece o botão "Ver animação" e ela só toca se a pessoa pedir.
  let reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const movimento = () => !reduzir;

  let abertura = null;
  const particulas = criarRetratoParticulas({
    canvas: stage.querySelector(".icanvas"),
    area: () => abertura.medidas(),
    movimento,
  });
  abertura = criarAbertura({ stage, config, particulas, movimento });

  /* ---------- botões ---------- */

  function rever() {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "auto" });
    particulas.parar();
    abertura.tocar();
  }

  stage.querySelector(".iskip").addEventListener("click", () => abertura.finalizar(true));
  stage.querySelector("[data-replay]").addEventListener("click", rever);
  stage.querySelector("[data-play]").addEventListener("click", () => { reduzir = false; rever(); });

  /* ---------- rolagem, mouse e arrastar foto ---------- */

  // se a pessoa rolar a página no meio da abertura, pula para o final
  window.addEventListener("scroll", () => {
    if (abertura.fase() === "intro" && window.scrollY > 40) abertura.finalizar(false);
  }, { passive: true });

  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    particulas.ponteiro(e.clientX - r.left, e.clientY - r.top, true);
  });
  stage.addEventListener("pointerleave", () => particulas.ponteiro(0, 0, false));
  stage.addEventListener("pointercancel", () => particulas.ponteiro(0, 0, false));

  // arraste uma foto para cima da abertura para testar (só no seu navegador)
  stage.addEventListener("dragover", (e) => e.preventDefault());
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const ok = particulas.usarImagem(img);
      URL.revokeObjectURL(url);
      if (!ok) return;
      if (abertura.fase() !== "done") abertura.finalizar(false);
      else particulas.iniciar(true);
    };
    img.src = url;
  });

  /* ---------- tamanho da janela ---------- */

  let W = 0, H = 0, timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (Math.abs(w - W) < 2 && Math.abs(h - H) < 2) return;
      W = w; H = h;
      particulas.redimensionar(w, h);
      if (abertura.fase() === "idle") return;
      if (abertura.fase() === "intro") { rever(); return; } // recomeça no tamanho novo
      abertura.reajustar();
      particulas.reposicionar();
    }, 160);
  });

  // pausa o desenho quando a abertura sai da tela ou a aba fica escondida
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => particulas.visivel(en.isIntersecting)).observe(stage);
  }
  document.addEventListener("visibilitychange", particulas.retomar);

  /* ---------- partida ---------- */

  function fontesProntas() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const p = Promise.all([
      document.fonts.load(`900 100px ${config.fonte}`),
      document.fonts.load(`italic 400 16px ${config.fonte}`),
      document.fonts.load(`700 16px ${config.fonte}`),
    ]).catch(() => {});
    return Promise.race([p, new Promise((r) => setTimeout(r, 2500))]);
  }

  // GSAP vem do cdnjs; se não carregar, tenta o jsDelivr
  function garantirGsap() {
    if (window.gsap) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  // só começa quando a página está visível e já tem o tamanho final
  function quandoVisivel(cb) {
    const ok = () => stage.clientWidth > 120 && stage.clientHeight > 120 && !document.hidden;
    if (ok()) { cb(); return; }
    let feito = false, ro = null, iv = 0;
    const tentar = () => {
      if (feito || !ok()) return;
      feito = true;
      if (ro) ro.disconnect();
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tentar);
      setTimeout(cb, 120);
    };
    if ("ResizeObserver" in window) { ro = new ResizeObserver(tentar); ro.observe(stage); }
    document.addEventListener("visibilitychange", tentar);
    iv = setInterval(tentar, 300);
  }

  Promise.all([fontesProntas(), garantirGsap()]).then(() => quandoVisivel(() => {
    abertura.medir();
    W = stage.clientWidth;
    H = stage.clientHeight;
    particulas.redimensionar(W, H);
    particulas.carregar(config.foto);
    abertura.tocar();

    // se a fonte terminar de carregar depois, remede as letras
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", () => {
        abertura.medir();
        if (abertura.fase() === "done") abertura.reajustar();
      });
    }
  }));
})();
