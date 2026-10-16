# Portfólio — Isac Daniel

Site pessoal com abertura animada (um ponto quica, vira "!", o nome **ISAC** se
transforma em **PORTFÓLIO** e as partículas formam o meu rosto), seguida dos
projetos, formação e contato.

## Estrutura

```
portfolio-isac/
├── index.html            estrutura da página (só HTML)
├── css/
│   ├── base.css          cores, fontes, reset, botões e chips
│   ├── abertura.css      tela de abertura animada
│   ├── secoes.css        sobre, faixa de tecnologias, formação e contato
│   ├── projetos.css      cards dos projetos e telas de exemplo
│   └── sem-js.css        ajuste para quando o JavaScript está desligado
├── js/
│   ├── config.js         foto, nome e palavra da abertura (é aqui que se troca)
│   ├── particulas.js     retrato em partículas (Canvas 2D, sem biblioteca)
│   ├── abertura.js       animação das letras (GSAP)
│   └── main.js           liga tudo: botões, mouse, rolagem e início
└── img/
    └── isac-retrato.png  foto com o fundo recortado
```

Os scripts são carregados no fim do `index.html` nesta ordem:
GSAP → `config.js` → `particulas.js` → `abertura.js` → `main.js`.

## Como rodar no computador

Abra a pasta no VS Code e use a extensão **Live Server** (botão direito no
`index.html` → *Open with Live Server*).

Abrindo o `index.html` direto com dois cliques, o navegador bloqueia a leitura
da foto por segurança e aparece uma silhueta no lugar do rosto. Por um servidor
(Live Server, GitHub Pages) a foto aparece normal.

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `portfolio`) e envie esta pasta.
2. No repositório: **Settings → Pages → Branch: `main` / pasta `/ (root)` → Save**.
3. Em alguns minutos o site fica em `https://isacd6559.github.io/portfolio/`.

## Trocar a foto ou os textos da abertura

Tudo fica em `js/config.js`:

- `foto`: caminho da imagem. PNG com fundo transparente fica melhor.
- `nome`: palavra que aparece primeiro (com "I", porque a haste do "!" vira o I).
- `palavra`: palavra em que o nome se transforma.

## Tecnologias

HTML, CSS e JavaScript puro, [GSAP 3](https://gsap.com/) (pelo CDN) e
Canvas 2D para as partículas. Fontes do Google Fonts.

Se o sistema estiver com "efeitos de animação" desligados, a abertura não toca
sozinha e aparece o botão **Ver animação**.
