document.addEventListener("DOMContentLoaded", () => {
  const svgs = document.querySelectorAll(".svg-wrap svg");
  if (svgs.length < 2) return;

  const hourglassSvg = svgs[0];
  const dnaSvg = svgs[1];

  /* ---------------------------------
     HOURGLASS ANIMATION
  --------------------------------- */
  const topSand = hourglassSvg.querySelector("#topSand");
  const bottomSand = hourglassSvg.querySelector("#bottomSand");
  const grains = [...hourglassSvg.querySelectorAll("circle")];

  if (topSand && bottomSand) {
    // Make transforms behave properly inside SVG
    [topSand, bottomSand, hourglassSvg].forEach((el) => {
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = "center center";
    });

    topSand.style.transformOrigin = "center bottom";
    bottomSand.style.transformOrigin = "center bottom";

    const HOURGLASS_CYCLE = 7000; // ms

    function animateHourglass(now) {
      const t = now % HOURGLASS_CYCLE;
      const p = t / HOURGLASS_CYCLE;

      // Split cycle into:
      // 0.00 - 0.42  drain
      // 0.42 - 0.58  flip
      // 0.58 - 1.00  drain opposite side
      let rotation = 0;
      let topScale = 1;
      let bottomScale = 0.55;

      if (p < 0.42) {
        // Normal draining
        const q = p / 0.42;
        topScale = 1 - q * 0.82;
        bottomScale = 0.45 + q * 0.9;
        rotation = 0;
      } else if (p < 0.58) {
        // Flip animation
        const q = (p - 0.42) / 0.16;
        rotation = q * 180;

        // Hold near end/start fill during rotation
        topScale = 0.18;
        bottomScale = 1.25;
      } else {
        // After flip, reverse which sand visually drains/fills
        const q = (p - 0.58) / 0.42;
        rotation = 180;
        topScale = 0.18 + q * 1.05;     // DOM top becomes visual bottom after rotation
        bottomScale = 1.25 - q * 0.82;  // DOM bottom becomes visual top after rotation
      }

      topSand.style.transform = `scaleY(${Math.max(0.12, topScale)})`;
      bottomSand.style.transform = `scaleY(${Math.max(0.2, bottomScale)})`;
      hourglassSvg.style.transform = `rotate(${rotation}deg)`;

      // Falling grain animation
      grains.forEach((grain, i) => {
        const local = ((t + i * 230) % 1200) / 1200; // stagger each grain
        const y = 150 + local * 34;
        const xBase = i === 0 ? 110 : i === 1 ? 108 : 112;
        const x = xBase + Math.sin(local * Math.PI * 2 + i) * 1.5;
        const opacity =
          p >= 0.42 && p < 0.58
            ? 0.05 // grains nearly disappear during flip
            : 0.2 + (1 - local) * 0.9;

        grain.setAttribute("cx", x.toFixed(2));
        grain.setAttribute("cy", y.toFixed(2));
        grain.setAttribute("opacity", opacity.toFixed(2));
      });

      requestAnimationFrame(animateHourglass);
    }

    requestAnimationFrame(animateHourglass);
  }

  /* ---------------------------------
     DNA ANIMATION
  --------------------------------- */
  const dnaPaths = dnaSvg.querySelectorAll("path");
  const leftBackbone = dnaPaths[0];
  const rightBackbone = dnaPaths[1];

  const rungLines = [...dnaSvg.querySelectorAll("line")];
  const baseRects = [...dnaSvg.querySelectorAll('g[font-family="monospace"] rect')];
  const baseTexts = [...dnaSvg.querySelectorAll('g[font-family="monospace"] text')];
  const sequencePanel = document.querySelector(".sequence");

  // Energy-flow look on backbones
  [leftBackbone, rightBackbone].forEach((p) => {
    if (!p) return;
    p.style.strokeDasharray = "12 10";
    p.style.filter = "drop-shadow(0 0 3px rgba(125, 211, 252, 0.25))";
  });

  if (sequencePanel) {
    sequencePanel.style.position = "relative";
    sequencePanel.style.overflow = "hidden";

    // Create scanning highlight overlay
    const scanner = document.createElement("div");
    scanner.style.position = "absolute";
    scanner.style.inset = "0 auto 0 -30%";
    scanner.style.width = "30%";
    scanner.style.pointerEvents = "none";
    scanner.style.background =
      "linear-gradient(90deg, transparent, rgba(255,209,102,0.22), transparent)";
    scanner.style.filter = "blur(6px)";
    scanner.style.mixBlendMode = "screen";
    sequencePanel.appendChild(scanner);

    const textOnly = sequencePanel.textContent.replace(/\s+/g, " ").trim();
    const seqInner = document.createElement("span");
    seqInner.textContent = textOnly;
    seqInner.style.position = "relative";
    seqInner.style.zIndex = "1";

    // Preserve the existing look but rebuild content so we can animate it cleanly
    sequencePanel.innerHTML = "";
    sequencePanel.appendChild(seqInner);
    sequencePanel.appendChild(scanner);

    function animateSequence(now) {
      const cycle = 2600;
      const p = (now % cycle) / cycle;
      scanner.style.left = `${-30 + p * 140}%`;

      // subtle text glow pulse
      const glow = 8 + Math.sin(now * 0.003) * 4;
      seqInner.style.textShadow = `0 0 ${glow}px rgba(125, 211, 252, 0.18)`;

      requestAnimationFrame(animateSequence);
    }

    requestAnimationFrame(animateSequence);
  }

  function animateDNA(now) {
    const time = now * 0.0022;

    // Move dash offset to create flowing strands
    if (leftBackbone) leftBackbone.style.strokeDashoffset = `${-now * 0.02}`;
    if (rightBackbone) rightBackbone.style.strokeDashoffset = `${now * 0.02}`;

    // Animate rung lines to simulate helix twist
    rungLines.forEach((line, i) => {
      const y = parseFloat(line.getAttribute("y1"));
      const phase = time + i * 0.55;
      const twist = Math.sin(phase) * 14;
      const depth = (Math.cos(phase) + 1) / 2; // 0..1

      // base X positions from original SVG
      const x1Base = [68, 72, 64, 76, 60, 80, 68, 76, 64, 72][i] ?? 68;
      const x2Base = [252, 248, 256, 244, 260, 240, 252, 244, 256, 248][i] ?? 252;

      line.setAttribute("x1", (x1Base + twist).toFixed(2));
      line.setAttribute("x2", (x2Base - twist).toFixed(2));
      line.setAttribute("opacity", (0.35 + depth * 0.75).toFixed(2));
      line.setAttribute("stroke-width", (2 + depth * 2.2).toFixed(2));

      // Slight vertical shimmer
      const yShift = Math.sin(phase * 1.3) * 0.8;
      line.setAttribute("y1", (y + yShift).toFixed(2));
      line.setAttribute("y2", (y + yShift).toFixed(2));
    });

    // Float base pair blocks and letters slightly
    baseRects.forEach((rect, i) => {
      const baseY = 24 + i * 28;
      const wobbleY = Math.sin(time * 1.4 + i * 0.75) * 1.8;
      const wobbleX = Math.cos(time * 1.1 + i * 0.45) * 2.5;
      rect.setAttribute("x", (120 + wobbleX).toFixed(2));
      rect.setAttribute("y", (baseY + wobbleY).toFixed(2));
      rect.setAttribute("opacity", (0.85 + Math.sin(time + i) * 0.1).toFixed(2));
    });

    baseTexts.forEach((text, i) => {
      const baseY = 38 + i * 28;
      const wobbleY = Math.sin(time * 1.4 + i * 0.75) * 1.8;
      const wobbleX = Math.cos(time * 1.1 + i * 0.45) * 2.5;
      text.setAttribute("x", (132 + wobbleX).toFixed(2));
      text.setAttribute("y", (baseY + wobbleY).toFixed(2));
    });

    requestAnimationFrame(animateDNA);
  }

  requestAnimationFrame(animateDNA);
});