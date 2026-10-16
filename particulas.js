/* =========================================================
   RETRATO EM PARTÍCULAS
   Lê o brilho de uma imagem e desenha milhares de pontos num
   <canvas>. Os pontos começam espalhados como poeira e se juntam
   para formar o rosto. Sem bibliotecas: só Canvas 2D.
   ========================================================= */

(function () {
  "use strict";

  // Cores dos pontos: branco, azul-claro e azul (como no vídeo de referência)
  const CORES = ["255,255,255", "214,225,255", "158,182,255"];
  const NIVEIS = 6; // níveis de transparência por cor
  const ESTILOS = [];
  CORES.forEach((c) => {
    for (let l = 0; l < NIVEIS; l++) ESTILOS.push(`rgba(${c},${((l + 0.6) / NIVEIS).toFixed(3)})`);
  });

  const agora = () => performance.now() / 1000;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /**
   * Cria o retrato.
   * @param {object} op
   * @param {HTMLCanvasElement} op.canvas  onde desenhar
   * @param {() => {heroTop:number, fsHero:number}} op.area  posição da palavra PORTFÓLIO
   * @param {() => boolean} op.movimento  false quando o sistema pede menos animação
   */
  function criarRetratoParticulas(op) {
    const canvas = op.canvas;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let P = null;              // dados das partículas (arrays tipados)
    let field = null;          // mapa de brilho da imagem
    let wantStart = false;     // pediram para começar antes da foto carregar
    let running = false, visible = true;
    const ptr = { x: -9999, y: -9999, on: false };

    /* ---------- tamanho ---------- */

    function redimensionar(w, h) {
      W = w; H = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function quantidade() {
      return Math.round(Math.min(10000, Math.max(W < 700 ? 4200 : 3200, (W * H) / 100)));
    }

    /* ---------- partículas ---------- */

    function espalhar(i) {
      P.x0[i] = Math.random() * W;
      P.y0[i] = Math.random() * H;
    }

    function alocar(n) {
      const F = () => new Float32Array(n);
      P = {
        n, nT: Math.round(n * 0.93), // 93% formam o rosto, o resto fica de poeira
        x0: F(), y0: F(), vx: F(), vy: F(), ph: F(),     // poeira
        tx: F(), ty: F(), a: F(), sz: F(), col: new Uint8Array(n), // alvo no rosto
        dl: F(), du: F(), sw: F(), fx: F(), fy: F(),     // atraso, duração, curva, origem
        sx: F(), sy: F(), ox: F(), oy: F(),              // dispersão na rolagem, desvio do mouse
        lx: F(), ly: F(), px: F(), py: F(),              // última posição calculada / desenhada
        buckets: ESTILOS.map(() => new Int32Array(n)), counts: new Int32Array(ESTILOS.length),
        on: false, drawn: false, t0: 0, fadeT0: 0, fadeDur: 1, formT0: -1, fromDust: true,
      };
      for (let i = 0; i < n; i++) {
        espalhar(i);
        P.vx[i] = rnd(-7, 7);
        P.vy[i] = rnd(-9, 3);
        P.ph[i] = Math.random() * Math.PI * 2;
        const ang = Math.random() * Math.PI * 2, m = rnd(0.35, 1.1);
        P.sx[i] = Math.cos(ang) * m * 0.9;
        P.sy[i] = Math.sin(ang) * m - 0.55;
        P.a[i] = rnd(0.25, 0.75);
        P.sz[i] = rnd(0.8, 1.6);
        P.col[i] = Math.random() < 0.6 ? 1 : 2;
      }
    }

    /* ---------- imagem → mapa de brilho ---------- */

    function criarMapa(fonte, sw, sh, vinheta, foto) {
      const s = Math.min(1, 230 / Math.max(sw, sh));
      const w = Math.max(16, Math.round(sw * s)), h = Math.max(16, Math.round(sh * s));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(fonte, 0, 0, w, h);
      let d;
      try {
        d = g.getImageData(0, 0, w, h).data;
      } catch (e) {
        console.warn("Não deu para ler a foto. Abra o site por um servidor (ex.: Live Server) em vez de abrir o arquivo direto.");
        return null;
      }
      const n = w * h, v = new Float32Array(n), hist = new Uint32Array(256);
      for (let i = 0; i < n; i++) {
        const L = ((0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) * d[i * 4 + 3]) / 255;
        v[i] = L / 255;
        hist[Math.min(255, L | 0)]++;
      }
      // níveis automáticos: o mais escuro vira 0 e o mais claro vira 1
      let acc = 0, lo = 0, hi = 255;
      for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc > n * 0.02) { lo = k; break; } }
      acc = 0;
      for (let k = 255; k >= 0; k--) { acc += hist[k]; if (acc > n * 0.01) { hi = k; break; } }
      const base = lo / 255, span = Math.max(30, hi - lo) / 255;
      const cum = new Float32Array(n);
      let total = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let val = clamp01((v[i] - base) / span);
          if (foto) val = Math.pow(val, 0.85) * clamp01((1 - y / h) / 0.22); // some suave embaixo
          if (vinheta) {
            const nx = (x / w - 0.5) / 0.5, ny = (y / h - 0.48) / 0.52;
            const r = Math.sqrt(nx * nx * 0.9 + ny * ny * 0.8);
            val *= 1 - clamp01((r - 0.78) / 0.3);
          }
          v[i] = val;
          total += val > 0.05 ? 0.12 + Math.pow(val, 1.2) : 0; // mais claro = mais pontos
          cum[i] = total;
        }
      }
      return total > 0 ? { w, h, v, cum, total, foto: !!foto } : null;
    }

    // Silhueta provisória (cabeça, pescoço e terno) caso a foto não carregue
    function desenharSilhueta() {
      const w = 400, h = 500;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      let gr;

      // paletó
      g.beginPath();
      g.moveTo(-10, h);
      g.bezierCurveTo(-6, 408, 42, 356, 132, 336);
      g.lineTo(268, 336);
      g.bezierCurveTo(358, 356, 406, 408, 410, h);
      g.closePath();
      gr = g.createLinearGradient(0, 330, 0, h);
      gr.addColorStop(0, "#8f94a0"); gr.addColorStop(0.45, "#555963"); gr.addColorStop(1, "#2a2c33");
      g.fillStyle = gr;
      g.fill();

      // camisa e gravata
      g.beginPath();
      g.moveTo(152, 336); g.lineTo(248, 336); g.lineTo(200, 500); g.closePath();
      g.fillStyle = "#e4e6ec";
      g.fill();
      g.beginPath();
      g.moveTo(186, 338); g.lineTo(214, 338); g.lineTo(208, 364); g.lineTo(219, 468); g.lineTo(200, 496); g.lineTo(181, 468); g.lineTo(192, 364); g.closePath();
      g.fillStyle = "#7f879a";
      g.fill();

      // pescoço
      g.fillStyle = "#7d828c";
      g.fillRect(166, 250, 68, 90);

      // cabeça, com luz vindo do alto à esquerda
      gr = g.createRadialGradient(176, 168, 8, 196, 190, 104);
      gr.addColorStop(0, "#fbfcfd"); gr.addColorStop(0.5, "#cfd3da"); gr.addColorStop(0.85, "#7d828c"); gr.addColorStop(1, "#4d515a");
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(200, 186, 71, 92, 0, 0, Math.PI * 2); g.fill();

      // cabelo
      g.fillStyle = "#3a3d45";
      g.beginPath();
      g.moveTo(124, 192);
      g.bezierCurveTo(112, 120, 150, 86, 202, 86);
      g.bezierCurveTo(256, 86, 290, 122, 276, 192);
      g.bezierCurveTo(262, 150, 230, 136, 200, 140);
      g.bezierCurveTo(166, 136, 138, 150, 124, 192);
      g.closePath();
      g.fill();
      return c;
    }

    /* ---------- onde o rosto fica ---------- */

    function caixaDoRetrato(S) {
      const asp = field.w / field.h;
      if (field.foto) {
        // rosto acima da palavra; só ombro e camisa passam atrás das letras
        const wordTop = S.heroTop - S.fsHero * 0.72;
        const k = 0.1, topMin = Math.max(56, H * 0.07);
        let bh = Math.min(H * 0.92, (wordTop - topMin) / (1 - k)), bw = bh * asp;
        const maxW = W < 700 ? W * 1.2 : W * 0.62;
        if (bw > maxW) { bw = maxW; bh = bw / asp; }
        let bottom = wordTop + k * bh;
        const sobra = bottom - bh - topMin;
        if (sobra > 0) bottom -= sobra * 0.5; // celular: centraliza no espaço livre
        return { x: (W - bw) / 2, y: bottom - bh, w: bw, h: bh };
      }
      let bh = H * 0.9, bw = bh * asp;
      const maxW = W < 700 ? W * 1.4 : W * 0.62;
      if (bw > maxW) { bw = maxW; bh = bw / asp; }
      const bottom = W < 700 ? Math.min(H, S.heroTop + bh * 0.12) : H;
      return { x: (W - bw) / 2, y: bottom - bh, w: bw, h: bh };
    }

    // Sorteia um ponto do rosto para cada partícula (mais pontos onde é mais claro)
    function definirAlvos(daPoeira, rapido) {
      const reduzir = !op.movimento();
      const box = caixaDoRetrato(op.area());
      const { w, h, v, cum, total } = field;
      if (!daPoeira) for (let i = 0; i < P.nT; i++) { P.fx[i] = P.lx[i]; P.fy[i] = P.ly[i]; }
      for (let i = 0; i < P.nT; i++) {
        const r = Math.random() * total;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        const px = lo % w, py = (lo / w) | 0, val = v[lo];
        P.tx[i] = box.x + ((px + Math.random()) / w) * box.w;
        P.ty[i] = box.y + ((py + Math.random()) / h) * box.h;
        P.a[i] = 0.28 + 0.72 * val;
        P.sz[i] = val > 0.75 ? rnd(1.3, 2) : rnd(0.9, 1.6);
        P.col[i] = val > 0.72 ? (Math.random() < 0.8 ? 0 : 1) : val > 0.4 ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.6 ? 2 : 1);
        const yn = (P.ty[i] - box.y) / box.h; // o topo da cabeça se forma primeiro
        if (reduzir) { P.dl[i] = 0; P.du[i] = 0.001; }
        else if (rapido) { P.dl[i] = yn * 0.35 + Math.random() * 0.25; P.du[i] = rnd(0.7, 1.1); }
        else { P.dl[i] = yn * 0.9 + Math.random() * 0.6; P.du[i] = rnd(1.2, 2.1); }
        P.sw[i] = reduzir ? 0 : rnd(-1, 1) * (daPoeira ? 60 : 14);
      }
      P.formT0 = agora();
      P.fromDust = daPoeira;
    }

    /* ---------- controle ---------- */

    function iniciar(rapido) {
      wantStart = rapido ? "rapido" : "lento";
      if (!field) return; // começa quando a foto terminar de carregar
      if (!P) alocar(quantidade());
      const t = agora();
      if (P.on && P.drawn && P.formT0 >= 0) { definirAlvos(false, true); loop(); return; }
      if (!P.on) {
        P.on = true; P.t0 = t; P.fadeT0 = t;
        P.fadeDur = !op.movimento() ? 0 : rapido ? 0.35 : 1.1;
      }
      definirAlvos(true, rapido);
      if (!rapido && op.movimento()) P.formT0 = t + 0.6; // um tempo de poeira antes de juntar
      loop();
    }

    function parar() {
      wantStart = false;
      if (!P) return;
      P.on = false; P.drawn = false; P.formT0 = -1;
      for (let i = 0; i < P.n; i++) { espalhar(i); P.ox[i] = P.oy[i] = 0; }
      ctx.clearRect(0, 0, W, H);
    }

    function reposicionar() {
      if (P && P.on && field) definirAlvos(!P.drawn, true);
    }

    function quandoMapaPronto() {
      if (P && P.on) definirAlvos(!P.drawn, true);
      else if (wantStart) iniciar(wantStart === "rapido");
    }

    function carregar(url) {
      const usarSilhueta = () => {
        const s = desenharSilhueta();
        field = criarMapa(s, s.width, s.height, false, false);
        quandoMapaPronto();
      };
      if (!url) { usarSilhueta(); return; }
      const img = new Image();
      img.onload = () => {
        const m = criarMapa(img, img.naturalWidth, img.naturalHeight, false, true);
        if (!m) { usarSilhueta(); return; }
        field = m;
        quandoMapaPronto();
      };
      img.onerror = usarSilhueta;
      img.src = url;
    }

    // Troca a imagem na hora (usado ao arrastar uma foto para a abertura)
    function usarImagem(img) {
      const m = criarMapa(img, img.naturalWidth, img.naturalHeight, true, true);
      if (m) field = m;
      return !!m;
    }

    function ponteiro(x, y, on) { ptr.x = x; ptr.y = y; ptr.on = on; }
    function visivel(v) { visible = v; if (v) loop(); }

    /* ---------- desenho (60 vezes por segundo) ---------- */

    function loop() {
      if (!running && P && P.on && visible && !document.hidden) {
        running = true;
        requestAnimationFrame(quadro);
      }
    }

    function quadro() {
      if (!P || !P.on || !visible || document.hidden) { running = false; return; }
      requestAnimationFrame(quadro);
      const reduzir = !op.movimento();
      const t = agora(), dt = t - P.t0;
      const fade = P.fadeDur ? clamp01((t - P.fadeT0) / P.fadeDur) : 1;
      const sp = clamp01(window.scrollY / (H * 0.85)); // rolagem: o rosto se desfaz
      const scat = Math.pow(sp, 1.5) * H * 0.9;
      const gA = fade * Math.pow(1 - sp, 1.2);
      ctx.clearRect(0, 0, W, H);
      if (gA <= 0.003) return;
      const cnt = P.counts;
      cnt.fill(0);
      const R = W < 700 ? 60 : 95, R2 = R * R, pOn = ptr.on && !reduzir;
      const forming = P.formT0 >= 0, drift = reduzir ? 0 : 1;

      for (let i = 0; i < P.n; i++) {
        const ph = P.ph[i];
        // posição de poeira (flutuando)
        let x = P.x0[i] + (P.vx[i] * dt + Math.sin(dt * 0.6 + ph) * 7) * drift;
        let y = P.y0[i] + (P.vy[i] * dt + Math.cos(dt * 0.45 + ph) * 7) * drift;
        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;
        let al = P.a[i] * (0.32 + 0.18 * Math.sin(dt * 1.3 + ph));

        // caminho da poeira até o ponto do rosto
        if (i < P.nT && forming) {
          let k = (t - P.formT0 - P.dl[i]) / P.du[i];
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          if (k > 0) {
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const sx = P.fromDust ? x : P.fx[i], sy = P.fromDust ? y : P.fy[i];
            const tx = P.tx[i] + Math.sin(dt * 1.7 + ph) * 0.7 * drift;
            const ty = P.ty[i] + Math.cos(dt * 1.4 + ph) * 0.7 * drift;
            const ddx = tx - sx, ddy = ty - sy, len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            const sw = Math.sin(e * Math.PI) * P.sw[i];
            x = sx + ddx * e - (ddy / len) * sw;
            y = sy + ddy * e + (ddx / len) * sw;
            const aT = P.a[i] * (0.84 + 0.16 * Math.sin(dt * 2.3 + ph * 3) * drift);
            al = P.fromDust ? al + (aT - al) * e : aT;
          } else if (!P.fromDust) {
            x = P.fx[i]; y = P.fy[i]; al = P.a[i];
          }
        }
        P.lx[i] = x; P.ly[i] = y;

        // rolagem espalha os pontos; o mouse empurra os pontos próximos
        if (scat > 0) { x += P.sx[i] * scat; y += P.sy[i] * scat; }
        if (pOn) {
          const qx = x - ptr.x, qy = y - ptr.y, d2 = qx * qx + qy * qy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1, f = 1 - d / R;
            P.ox[i] += ((qx / d) * f * 34 - P.ox[i]) * 0.22;
            P.oy[i] += ((qy / d) * f * 34 - P.oy[i]) * 0.22;
          } else { P.ox[i] *= 0.9; P.oy[i] *= 0.9; }
        } else if (P.ox[i] || P.oy[i]) { P.ox[i] *= 0.9; P.oy[i] *= 0.9; }
        x += P.ox[i]; y += P.oy[i];

        // agrupa por cor/transparência para desenhar tudo de uma vez
        const fa = al * gA;
        if (fa < 0.03) continue;
        let lv = (fa * NIVEIS) | 0;
        if (lv >= NIVEIS) lv = NIVEIS - 1;
        const b = P.col[i] * NIVEIS + lv;
        P.buckets[b][cnt[b]++] = i;
        P.px[i] = x; P.py[i] = y;
      }

      for (let b = 0; b < ESTILOS.length; b++) {
        const c = cnt[b];
        if (!c) continue;
        const arr = P.buckets[b];
        ctx.fillStyle = ESTILOS[b];
        ctx.beginPath();
        for (let j = 0; j < c; j++) {
          const i = arr[j], s = P.sz[i];
          ctx.rect(P.px[i] - s / 2, P.py[i] - s / 2, s, s);
        }
        ctx.fill();
      }
      P.drawn = true;
    }

    return { redimensionar, carregar, usarImagem, iniciar, parar, reposicionar, ponteiro, visivel, retomar: loop };
  }

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.criarRetratoParticulas = criarRetratoParticulas;
})();
