/**
 * Only the self-hosted face of a next/font family stack. The generated stack also names a metric
 * fallback face whose source is `local("Arial")`: Arial is absent on the Linux renderer, so loading
 * the whole stack rejected with « A network error occurred. » and failed every render.
 */
export const primaryFontFamily = (stack: string) => stack.split(",")[0].trim();

/**
 * Styles of the carousel slides (validated maquettes, docs/05-integrations/instagram-carousels.md).
 * Fonts come from CSS variables set by next/font on the strip root, so the capture can embed them.
 */
export const CAROUSEL_CSS = `
.cz{position:relative;overflow:hidden;font-family:var(--font-bricolage),'Bricolage Grotesque',sans-serif;color:#1F2410;-webkit-font-smoothing:antialiased}
.cz *{box-sizing:border-box}
.cz .mono{font-family:var(--font-jetbrains),'JetBrains Mono',monospace}
.cz .unit{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-weight:700;letter-spacing:.18em;font-size:.42em}
.cz .blaze{display:flex;flex-direction:column;width:22px;border-radius:3px;overflow:hidden}
.cz .blaze i{display:block}
.cz .plate{display:inline-flex;align-items:center;gap:14px;padding:14px 46px 14px 26px;background:linear-gradient(180deg,#4A7A2A 0%,#2D5016 70%);color:#FAF8F2;clip-path:polygon(0 0,calc(100% - 26px) 0,100% 50%,calc(100% - 26px) 100%,0 100%)}
.cz .bolt{width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#E5E2D8,#8A917E);flex:none}
.cz .grid{display:grid;grid-template-columns:200px repeat(3,minmax(0,1fr)) 196px;align-items:center}
.cz .grid3{display:grid;grid-template-columns:260px minmax(0,1fr) 300px;align-items:center}
.cz .grid3.row{height:100px}
.cz .head{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:19px;font-weight:800;letter-spacing:.12em;color:#5C6450;line-height:1.25;text-align:center}
.cz .headunit{display:block;font-weight:700;letter-spacing:.08em;color:#8A917E}
.cz .row{background:#FFFFFF;border:2px solid #E5E2D8;border-radius:18px;height:112px;overflow:hidden}
.cz .goal{display:flex;align-items:center;justify-content:center;height:100%;background:#F4F2EC;border-right:2px solid #E5E2D8}
.cz .plate2{display:inline-flex;align-items:center;gap:10px;padding:10px 34px 10px 16px;background:linear-gradient(180deg,#F4E7C8 0%,#E2CFA3 85%);color:#3B2E17;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%)}
.cz .bolt2{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#FFFFFF,#8A7A5A)}
.cz .goaltxt{font-size:42px;font-weight:800;white-space:nowrap}
.cz .cell{display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:50px;font-weight:800;line-height:1;border-right:2px solid #EFEDE6}
.cz .total{display:flex;align-items:center;justify-content:center;height:100%;background:#2D5016;color:#FAF8F2;font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:44px;font-weight:800;white-space:nowrap}
.cz .srow{display:flex;align-items:center;gap:24px;height:96px;padding:0 24px;background:#FFFFFF;border:2px solid #E5E2D8;border-radius:16px}
.cz .srow.dense{height:46px;gap:14px;padding:0 18px;border-radius:12px}
.cz .grams{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:52px;font-weight:800;color:#1F3810;width:170px;white-space:nowrap}
.cz .gauge{display:flex;flex-direction:column;gap:6px;margin-left:auto}
.cz .bar{display:flex;width:240px;height:16px;border-radius:8px;background:#E5E2D8;overflow:hidden}
.cz .bar .done{display:block;height:100%;background:#B5CC9A}
.cz .bar .now{display:block;height:100%;background:#2D5016}
.cz .cumul{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:17px;font-weight:700;color:#5C6450}
.cz .ticket{display:flex;align-items:stretch;background:#F6EBD0;border:2px solid #D9C9A3;border-radius:12px;color:#1F2410}
.cz .stub{display:flex;flex-direction:column;align-items:center;justify-content:center;width:180px;border-right:3px dashed #C2AE80;font-family:var(--font-jetbrains),'JetBrains Mono',monospace;color:#7A5A22}
.cz .chip{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:20px;font-weight:700;letter-spacing:.12em;padding:6px 14px;border-radius:999px}
.cz .sign{display:flex;align-items:center;gap:16px;height:104px;padding:0 64px 0 28px;background:linear-gradient(180deg,#F4E7C8 0%,#E2CFA3 85%);color:#3B2E17;clip-path:polygon(0 0,calc(100% - 34px) 0,100% 50%,calc(100% - 34px) 100%,0 100%);box-shadow:0 8px 0 rgba(0,0,0,.25)}
.cz .wbolt{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#FFFFFF,#8A7A5A);flex:none}
.cz .plank-r{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:4px;height:118px;padding:0 70px 0 30px;background:linear-gradient(180deg,#F4E7C8 0%,#E2CFA3 85%);color:#3B2E17;clip-path:polygon(0 0,calc(100% - 36px) 0,100% 50%,calc(100% - 36px) 100%,0 100%);box-shadow:0 8px 0 rgba(110,90,60,.3)}
.cz .plank-l{position:absolute;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:4px;height:118px;padding:0 30px 0 70px;background:linear-gradient(180deg,#F4E7C8 0%,#E2CFA3 85%);color:#3B2E17;clip-path:polygon(36px 0,100% 0,100% 100%,36px 100%,0 50%);box-shadow:0 8px 0 rgba(110,90,60,.3)}
.cz .cotes{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:24px;font-weight:700;letter-spacing:.08em;color:#2D5016}
.cz .day{display:inline-flex;align-items:center;gap:12px;padding:10px 40px 10px 20px;background:linear-gradient(180deg,#4A7A2A 0%,#2D5016 70%);color:#FAF8F2;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%);font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:26px;font-weight:800;letter-spacing:.14em}
.cz .wrow{display:flex;flex-direction:column;gap:10px;padding:10px 0 12px 22px;margin-left:24px;border-bottom:2px dotted #C9C5B8;border-left:4px solid #B5CC9A}
.cz .wname{font-size:42px;font-weight:800;line-height:1.05;letter-spacing:-0.01em;color:#1F3810}
.cz .wmeta{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#5C6450;letter-spacing:.1em}
.cz .tiles{display:flex;flex-wrap:wrap;gap:8px}
.cz .tile{display:flex;flex-direction:column;gap:0;padding:5px 10px;background:#EEF2E6;border-radius:8px}
.cz .km{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:21px;font-weight:800;color:#3F4632;line-height:1.1;white-space:nowrap}
.cz .dp{font-family:var(--font-jetbrains),'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#7A826C;letter-spacing:.04em;white-space:nowrap}
`;
