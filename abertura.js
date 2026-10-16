/* =========================================================
   ABERTURA (letras)
   1. um ponto cai e quica        4. as outras letras caem girando
   2. uma haste cai e forma "!"   5. o nome vira a palavra, letra por letra
   3. a haste tomba               6. a palavra desce e o retrato se forma
   Animado com GSAP (carregado no index.html). As letras são
   posicionadas em "em", então crescem junto com o font-size.
   ========================================================= */

(function () {
  "use strict";

  const PAD_B = 0.14;    // espaço embaixo de cada letra (igual ao padding do .ch no CSS)
  const TRACK = -0.006;  // espaçamento entre letras, em em
  const rnd = (a, b) => a + Math.random() * (b - a);

  /**
   * Cria a abertura.
   * @param {object} op
   * @param {HTMLElement} op.stage  a <section id="inicio">
   * @param {object} op.config  window.Portfolio.config
   * @param {object} op.particulas  retrato criado em particulas.js
   * @param {() => boolean} op.movimento  false quando o sistema pede menos animação
   */
  function criarAbertura(op) {
    const { stage, config, particulas, movimento } = op;
    const $ = (s) => stage.querySelector(s);
    const iw = $(".iw"), iwIn = $(".iw-in"), dot = $(".idot"), glow = $(".iglow");
    const nav = $(".inav"), meta = $(".imeta");
    const NOME = config.nome, PALAVRA = config.palavra, FONTE = config.fonte;
    const gs = () => window.gsap;

    let M = null;          // medidas da fonte
    let slots = [];        // letras na tela
    let tl = null;         // linha do tempo do GSAP
    let fase = "idle";     // idle | intro | done

    /* ---------- medidas da fonte e posição das letras ---------- */

    function medir() {
      const c = document.createElement("canvas").getContext("2d");
      c.font = `900 100px ${FONTE}`;
      const adv = {};
      for (const ch of new Set(NOME + PALAVRA)) adv[ch] = c.measureText(ch).width / 100;
      const m = c.measureText("H");
      const fa = (m.fontBoundingBoxAscent || 97) / 100;
      const fd = (m.fontBoundingBoxDescent || 24) / 100;
      const baseFromBottom = 1 - ((1 - (fa + fd)) / 2 + fa);
      M = { adv, b: PAD_B + baseFromBottom };
      iw.style.setProperty("--b", M.b.toFixed(4));
    }

    // posição x (em em) de cada letra, com a palavra centrada no zero
    function layout(chars) {
      const ws = chars.map((ch) => M.adv[ch] || 0.62);
      const total = ws.reduce((a, b) => a + b, 0) + TRACK * (ws.length - 1);
      const xs = [];
      let x = -total / 2;
      for (const w of ws) { xs.push(x); x += w + TRACK; }
      return { xs, total };
    }

    function criarLetra(ch) {
      const c = document.createElement("span");
      c.className = "ch";
      c.textContent = ch;
      return c;
    }

    function criarSlot(ch, x) {
      const el = document.createElement("span");
      el.className = "slot";
      el.style.setProperty("--x", x.toFixed(4));
      el.style.transformOrigin = `${((M.adv[ch] || 0.6) / 2).toFixed(3)}em 0`; // gira pela base
      const c = criarLetra(ch);
      el.appendChild(c);
      iwIn.appendChild(el);
      return { el, c, ch, x };
    }

    function limparPalavra() {
      slots.forEach((s) => s.el.remove());
      slots = [];
    }

    function posicionarPalavra(left, top, fs) {
      iw.style.left = left + "px";
      iw.style.top = top + "px";
      iw.style.fontSize = fs + "px";
    }

    // tamanhos para a tela atual (centro durante a animação, embaixo no final)
    function medidas() {
      if (!M) medir();
      const W = stage.clientWidth, H = stage.clientHeight;
      const g = Math.min(48, Math.max(16, W * 0.033));
      const totB = layout([...PALAVRA]).total;
      const fsHero = Math.max(28, Math.min((W - 2 * g) / totB, H * 0.32));
      const fsCenter = Math.min(fsHero * (W < 700 ? 0.86 : 0.64), 200);
      const heroTop = H - meta.offsetHeight - fsHero * 0.06 - 2;
      return { W, H, g, fsHero, fsCenter, heroLeft: g + (totB * fsHero) / 2, heroTop, cx: W / 2, cy: H / 2 + fsCenter * 0.28 };
    }

    /* ---------- a animação ---------- */

    function tocar() {
      const G = gs();
      stage.classList.toggle("is-reduced", !!G && !movimento());
      if (!G || !movimento()) { finalizar(false); return; }
      if (tl) tl.kill();
      fase = "intro";
      stage.classList.add("is-intro");

      const S = medidas();
      const fs = S.fsCenter;
      limparPalavra();
      posicionarPalavra(S.cx, S.cy, fs);

      const A = [...NOME];
      const LA = layout(A);
      slots = A.map((ch, i) => criarSlot(ch, LA.xs[i]));
      const iIdx = Math.max(0, A.indexOf("I"));
      const iC = LA.xs[iIdx] + M.adv[A[iIdx]] / 2;
      G.set(iwIn, { "--shift": -iC }); // começa com o "I" no centro
      dot.style.setProperty("--dx", iC.toFixed(4));

      const I = slots[iIdx].el;
      const rest = slots.filter((_, i) => i !== iIdx);
      G.set(rest.map((s) => s.el), { opacity: 0 });
      G.set(I, { opacity: 0, rotation: 0, y: 0, scaleX: 1, scaleY: 1 });
      G.set(dot, { opacity: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, transformOrigin: "50% 100%" });
      const gx = S.cx, gy = S.cy + 0.3 * fs;
      G.set(glow, { x: gx, y: gy, opacity: 0, scale: 0.55 });
      G.set([nav, meta], { opacity: 0, y: 0 });

      // efeitos reaproveitados: achatar no impacto e piscar a luz
      const squash = (el, k) => G.timeline()
        .to(el, { scaleX: 1 + 0.45 * k, scaleY: 1 - 0.4 * k, duration: 0.07, ease: "power1.out" })
        .to(el, { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.35)" });
      const flash = (k) => G.timeline()
        .to(glow, { opacity: 0.4 + 0.6 * k, scale: 0.9 + 0.35 * k, duration: 0.08, ease: "power1.out" })
        .to(glow, { opacity: 0.32, scale: 0.85, duration: 0.7, ease: "power2.out" });

      tl = G.timeline({ onComplete: () => { fase = "done"; tl = null; } });
      let T = 0;

      // 1. o ponto cai e quica
      tl.to(glow, { opacity: 0.32, scale: 0.85, duration: 1, ease: "power1.out" }, 0);
      T = 0.25;
      tl.fromTo(dot, { y: -(gy + 40), opacity: 1 }, { y: 0, duration: 0.55, ease: "power2.in" }, T);
      T += 0.55;
      tl.add(squash(dot, 1), T).add(flash(1), T);
      tl.to(dot, { y: -0.6 * fs, duration: 0.28, ease: "power2.out" }, T + 0.04);
      tl.to(dot, { y: 0, duration: 0.28, ease: "power2.in" }, T + 0.32);
      T += 0.6;
      tl.add(squash(dot, 0.6), T).add(flash(0.5), T);
      tl.to(dot, { y: -0.2 * fs, duration: 0.17, ease: "power2.out" }, T + 0.03);
      tl.to(dot, { y: 0, duration: 0.17, ease: "power2.in" }, T + 0.2);
      T += 0.37;
      tl.add(squash(dot, 0.3), T).add(flash(0.25), T);

      // 2. a haste cai em cima e forma o "!"
      T += 0.22;
      tl.fromTo(I, { y: -(gy + fs * 1.5), opacity: 1 }, { y: 0, duration: 0.42, ease: "power3.in" }, T);
      T += 0.42;
      tl.add(squash(I, 0.3), T).add(squash(dot, 0.5), T).add(flash(0.9), T);

      // 3. a haste tomba
      T += 0.32;
      tl.to(I, { rotation: 76, duration: 0.42, ease: "power2.in" }, T);
      T += 0.42;
      tl.add(flash(0.35), T);
      tl.to(I, { rotation: 66, duration: 0.12, ease: "power1.out" }, T);
      tl.to(I, { rotation: 73, duration: 0.14, ease: "power1.in" }, T + 0.12);
      T += 0.1;

      // 4. as outras letras caem girando e a haste levanta como "I"
      rest.forEach((s, j) => {
        const at = T + j * 0.13;
        const cxj = s.x + M.adv[s.ch] / 2;
        const fromX = (iC - cxj) * fs * rnd(0.35, 0.7) + rnd(-0.12, 0.12) * fs;
        tl.fromTo(s.el,
          { x: fromX, y: -fs * rnd(0.7, 1.25), rotation: rnd(-160, 160), rotationX: rnd(-110, 110), rotationY: rnd(-70, 70), scale: 0.3, transformPerspective: fs * 4 },
          { x: 0, y: 0, rotation: 0, rotationX: 0, rotationY: 0, scale: 1, duration: 0.75, ease: "back.out(1.5)" }, at);
        tl.to(s.el, { opacity: 1, duration: 0.18, ease: "none" }, at);
        tl.add(flash(0.2), at + 0.5);
      });
      tl.to(iwIn, { "--shift": 0, duration: 1.0, ease: "power3.inOut" }, T + 0.05);
      tl.to(I, { rotation: -15, duration: 0.3, ease: "power2.out" }, T + 0.3);
      tl.to(I, { rotation: 0, duration: 1.1, ease: "elastic.out(1, 0.35)" }, T + 0.6);
      T += 1.05;
      tl.to(dot, { y: 0.45 * fs, scale: 0.15, opacity: 0, duration: 0.45, ease: "power2.in" }, T);
      tl.to(glow, { opacity: 0.16, scale: 1.6, duration: 1.2, ease: "power2.out" }, T);
      T += 0.7;

      // 5. o nome vira a palavra, letra por letra
      const B = [...PALAVRA];
      const atual = A.slice();
      B.forEach((_, k) => tl.call(trocarLetra, [k, atual, B, fs], T + k * 0.11));
      T += (B.length - 1) * 0.11 + 0.5 + 0.45;

      // 6. a palavra desce e cresce, o menu aparece e o retrato se forma
      tl.to(iw, { left: S.heroLeft, top: S.heroTop, fontSize: S.fsHero, duration: 1.15, ease: "power3.inOut" }, T);
      tl.to(glow, { opacity: 0, duration: 0.9 }, T);
      tl.call(() => stage.classList.remove("is-intro"), null, T);
      tl.call(() => { G.set(slots.map((s) => s.el), { clearProps: "transform" }); }, null, T + 1.2);
      tl.call(() => particulas.iniciar(false), null, T + 0.45);
      tl.fromTo(meta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, T + 0.75);
      tl.fromTo(nav, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, T + 0.9);
    }

    // vira a letra k (de cima para baixo) e reposiciona a palavra para ficar centrada
    function trocarLetra(k, atual, B, fs) {
      const G = gs();
      if (!G) return;
      atual[k] = B[k];
      const L = layout(atual);
      const persp = fs * 3.5;
      let s = slots[k];
      if (s) {
        const velha = s.c, nova = criarLetra(B[k]);
        s.el.appendChild(nova);
        s.c = nova; s.ch = B[k];
        G.to(velha, { rotationX: 95, yPercent: -16, opacity: 0, duration: 0.3, ease: "power2.in", transformPerspective: persp, onComplete: () => velha.remove() });
        G.fromTo(nova, { rotationX: -95, yPercent: 16, opacity: 0, transformPerspective: persp },
          { rotationX: 0, yPercent: 0, opacity: 1, duration: 0.42, delay: 0.1, ease: "power2.out", clearProps: "transform" });
      } else {
        s = criarSlot(B[k], L.xs[k]);
        slots[k] = s;
        G.fromTo(s.c, { rotationX: -95, yPercent: 16, opacity: 0, transformPerspective: persp },
          { rotationX: 0, yPercent: 0, opacity: 1, duration: 0.42, ease: "power2.out", clearProps: "transform" });
      }
      slots.forEach((sl, i) => {
        sl.x = L.xs[i];
        sl.el.style.transformOrigin = `${((M.adv[sl.ch] || 0.6) / 2).toFixed(3)}em 0`;
        G.to(sl.el, { "--x": L.xs[i], duration: 0.36, ease: "power2.out", overwrite: "auto" });
      });
    }

    // vai direto para o estado final (pular, sem animação ou sem GSAP)
    function finalizar(animar) {
      const G = gs();
      if (tl) { tl.kill(); tl = null; }
      if (G) G.killTweensOf([iw, iwIn, dot, glow, nav, meta]);
      fase = "done";
      stage.classList.remove("is-intro");
      limparPalavra();
      const S = medidas();
      posicionarPalavra(S.heroLeft, S.heroTop, S.fsHero);
      iwIn.style.setProperty("--shift", "0");
      const B = [...PALAVRA], L = layout(B);
      slots = B.map((ch, i) => criarSlot(ch, L.xs[i]));
      if (G) {
        G.set([dot, glow], { opacity: 0 });
        G.set([nav, meta], { opacity: 1, y: 0 });
      } else {
        dot.style.opacity = glow.style.opacity = "0";
        nav.style.opacity = meta.style.opacity = "1";
      }
      if (animar && G && movimento()) {
        G.from(slots.map((s) => s.c), { opacity: 0, yPercent: 22, rotationX: -70, transformPerspective: S.fsHero * 3.5, stagger: 0.035, duration: 0.55, ease: "power2.out", clearProps: "transform" });
      }
      particulas.iniciar(true);
    }

    // recalcula tamanho e posição da palavra final (ao redimensionar a janela)
    function reajustar() {
      const S = medidas();
      posicionarPalavra(S.heroLeft, S.heroTop, S.fsHero);
      const L = layout(slots.map((s) => s.ch));
      slots.forEach((s, i) => {
        s.x = L.xs[i];
        s.el.style.setProperty("--x", L.xs[i].toFixed(4));
        s.el.style.transformOrigin = `${((M.adv[s.ch] || 0.6) / 2).toFixed(3)}em 0`;
      });
    }

    return { medir, medidas, tocar, finalizar, reajustar, fase: () => fase };
  }

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.criarAbertura = criarAbertura;
})();
