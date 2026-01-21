const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const speedInput = document.getElementById("speed");
const countInput = document.getElementById("count");
const toggleButton = document.getElementById("toggle");

let running = true;
let tracks = [];
let kinks = [];
let lastTime = 0;

const palette = {
  electron: "#78f7ff",
  positron: "#ffd166",
  muon: "#7b8cff",
  antimuon: "#ff7bbd",
};

const resizeCanvas = () => {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const resetScene = () => {
  tracks = [];
  kinks = [];
  lastTime = 0;
};

const createTrack = ({ type, charge, angle, origin }) => {
  const isMuon = type === "muon";
  const baseRadius = isMuon ? 230 : 150;
  const radius = baseRadius + Math.random() * (isMuon ? 120 : 90);
  const sign = charge > 0 ? 1 : -1;
  const center = {
    x: origin.x + sign * radius * -Math.sin(angle),
    y: origin.y + sign * radius * Math.cos(angle),
  };
  const phi0 = Math.atan2(origin.y - center.y, origin.x - center.x);
  const angularSpeed = (isMuon ? 0.45 : 0.75) * (0.7 + Math.random() * 0.6);
  const lifetime = isMuon ? 7 + Math.random() * 3 : 9 + Math.random() * 4;
  const decayTime = isMuon ? 2 + Math.random() * 3.5 : null;

  return {
    type,
    charge,
    sign,
    origin,
    center,
    radius,
    phi0,
    phi: phi0,
    angularSpeed,
    age: 0,
    lifetime,
    decayTime,
    decayed: false,
  };
};

const spawnPair = (center) => {
  const type = Math.random() < 0.6 ? "electron" : "muon";
  const angle = Math.random() * Math.PI * 2;
  tracks.push(
    createTrack({
      type,
      charge: -1,
      angle,
      origin: { ...center },
    })
  );
  tracks.push(
    createTrack({
      type,
      charge: 1,
      angle: angle + Math.PI + (Math.random() - 0.5) * 0.4,
      origin: { ...center },
    })
  );
};

const drawDetector = (centerX, centerY, maxRadius) => {
  ctx.strokeStyle = "rgba(119, 242, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let r = 40; r < maxRadius; r += 40) {
    ctx.beginPath();
    ctx.setLineDash([4, 10]);
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(120, 140, 190, 0.25)";
  ctx.moveTo(centerX - maxRadius, centerY);
  ctx.lineTo(centerX + maxRadius, centerY);
  ctx.moveTo(centerX, centerY - maxRadius);
  ctx.lineTo(centerX, centerY + maxRadius);
  ctx.stroke();
};

const drawKinks = (delta) => {
  kinks = kinks.filter((kink) => kink.life > 0);
  kinks.forEach((kink) => {
    kink.life -= delta;
    const alpha = Math.max(0, kink.life / 1.4);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.arc(kink.x, kink.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
};

const render = (time) => {
  if (!running) {
    requestAnimationFrame(render);
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.45;

  const t = time * 0.001;
  const delta = lastTime ? t - lastTime : 0.016;
  lastTime = t;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(7, 10, 18, 0.92)";
  ctx.fillRect(0, 0, width, height);

  drawDetector(centerX, centerY, maxRadius);

  const targetTracks = Number(countInput.value);
  while (tracks.length < targetTracks) {
    spawnPair({ x: centerX, y: centerY });
  }

  tracks = tracks.filter((track) => track.age < track.lifetime);

  tracks.forEach((track) => {
    track.age += delta * Number(speedInput.value);
    track.phi =
      track.phi0 + track.sign * track.angularSpeed * track.age * 2;

    const opacity = Math.max(0, 1 - track.age / track.lifetime);
    const color =
      track.type === "electron"
        ? track.charge > 0
          ? palette.positron
          : palette.electron
        : track.charge > 0
        ? palette.antimuon
        : palette.muon;

    ctx.beginPath();
    ctx.strokeStyle = `${color}${Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0")}`;
    ctx.lineWidth = 2;
    ctx.arc(
      track.center.x,
      track.center.y,
      track.radius,
      track.phi0,
      track.phi,
      track.sign < 0
    );
    ctx.stroke();

    const x = track.center.x + Math.cos(track.phi) * track.radius;
    const y = track.center.y + Math.sin(track.phi) * track.radius;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (track.type === "muon" && !track.decayed && track.age > track.decayTime) {
      track.decayed = true;
      kinks.push({ x, y, life: 1.2 });

      const tangent = track.phi + (track.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
      tracks.push(
        createTrack({
          type: "electron",
          charge: track.charge,
          angle: tangent + (Math.random() - 0.5) * 0.3,
          origin: { x, y },
        })
      );
    }
  });

  drawKinks(delta);
  requestAnimationFrame(render);
};

toggleButton.addEventListener("click", () => {
  running = !running;
  toggleButton.textContent = running ? "Pause" : "Play";
});

window.addEventListener("resize", () => {
  resizeCanvas();
  resetScene();
});

resizeCanvas();
resetScene();
requestAnimationFrame(render);
