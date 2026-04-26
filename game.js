const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");

let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

const COLORS = ["#ff008c", "#00d9ff", "#ffe600", "#8a00ff"];

// さらに引きで表示
const VIEW_ZOOM = 0.78;

let state = "ready";
let score = 0;
let bestScore = Number(localStorage.getItem("colopeeBest") || 0);

let ball;
let obstacles = [];
let cameraY = 0;
let targetCameraY = 0;
let gameOverColor = "#00d9ff";

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function randomDirection() {
  return Math.random() < 0.5 ? -1 : 1;
}

function resetGame() {
  state = "ready";
  score = 0;
  cameraY = 0;
  targetCameraY = 0;
  gameOverColor = "#00d9ff";

  ball = {
    x: W / 2,
    y: H * 0.84,
    r: 14,
    color: randomColor(),
    vy: 0
  };

  createObstacles();

  scoreEl.textContent = score;
  scoreEl.style.display = "block";
  messageEl.textContent = "";
}

function createObstacles() {
  obstacles = [];

  const startY = H * 0.33;
  const gap = 620;

  const randomTypes = ["circle", "doubleCircle", "bar", "cross"];

  for (let i = 0; i < 32; i++) {
    let type;

    if (i < 2) {
      type = "circle";
    } else {
      type = randomTypes[Math.floor(Math.random() * randomTypes.length)];
    }

    let speed = 0.026;
    let speed2 = -0.034;
    let barSpeed = 0.040;

    if (type === "circle") {
      speed = 0.026 * randomDirection();
    }

    if (type === "doubleCircle") {
      speed = 0.024;
      speed2 = -0.036;
    }

    if (type === "cross") {
      speed = -0.026;
    }

    obstacles.push({
      type,
      x: W / 2,
      y: startY - i * gap,
      rotation: Math.random() * Math.PI * 2,
      rotation2: Math.random() * Math.PI * 2,
      speed,
      speed2,

      barPhase: Math.random() * Math.PI * 2,
      barSpeed,

      pointTaken: false,
      colorChangerTaken: false
    });
  }
}

resetGame();

function tap() {
  if (state === "ready") {
    state = "playing";
    messageEl.textContent = "";
  }

  if (state === "gameover") {
    resetGame();
    return;
  }

  if (state === "playing") {
    ball.vy = -6.9;
  }
}

window.addEventListener("mousedown", tap);
window.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    tap();
  },
  { passive: false }
);

function update() {
  if (state !== "playing") return;

  ball.vy += 0.33;
  ball.y += ball.vy;

  if (ball.y - cameraY < H * 0.42) {
    targetCameraY = ball.y - H * 0.42;
  }

  cameraY += (targetCameraY - cameraY) * 0.10;

  for (const obs of obstacles) {
    obs.rotation += obs.speed;
    obs.rotation2 += obs.speed2;

    if (obs.type === "bar") {
      obs.barPhase += obs.barSpeed;
    }

    checkObstacleCollision(obs);
    checkPointItem(obs);
    checkColorChanger(obs);
  }

  const ballScreenY = H / 2 + VIEW_ZOOM * ((ball.y - cameraY) - H / 2);

  if (ballScreenY > H + 80) {
    gameOver();
  }
}

function getBarX(obs) {
  // 移動域をかなり広げる
  return W * 0.5 + Math.sin(obs.barPhase) * W * 0.50;
}

function getCrossCenter(obs) {
  return {
    x: W * 0.08,
    y: obs.y + 35
  };
}

function getCrossArmLength(obs) {
  const center = getCrossCenter(obs);
  return W / 2 - center.x + 28;
}

function checkObstacleCollision(obs) {
  if (obs.type === "circle") {
    checkCircleCollision(obs, 145, 13, obs.rotation);
  }

  if (obs.type === "doubleCircle") {
    checkCircleCollision(obs, 154, 13, obs.rotation);
    checkCircleCollision(obs, 104, 13, obs.rotation2);
  }

  if (obs.type === "bar") {
    checkBarCollision(obs);
  }

  if (obs.type === "cross") {
    checkCrossCollision(obs);
  }
}

function checkCircleCollision(obs, radius, thickness, rotation) {
  const dx = ball.x - obs.x;
  const dy = ball.y - obs.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;

  if (dist + ball.r > inner && dist - ball.r < outer) {
    const angle = Math.atan2(dy, dx);
    const hitColor = getColorByAngle(angle, rotation);

    if (ball.color !== hitColor) {
      gameOver();
    }
  }
}

function getColorByAngle(angle, rotation) {
  let a = angle - rotation;

  while (a < 0) a += Math.PI * 2;
  while (a >= Math.PI * 2) a -= Math.PI * 2;

  const segment = Math.floor(a / (Math.PI / 2));
  return COLORS[segment];
}

function checkBarCollision(obs) {
  const barY = obs.y;
  const barH = 18;

  const segmentW = W * 0.46;
  const totalW = segmentW * 4;
  const barX = getBarX(obs);
  const startX = barX - totalW / 2;

  if (Math.abs(ball.y - barY) < ball.r + barH / 2) {
    for (let i = 0; i < 4; i++) {
      const x1 = startX + i * segmentW;
      const x2 = x1 + segmentW;

      if (ball.x + ball.r > x1 && ball.x - ball.r < x2) {
        const hitColor = COLORS[i];

        if (ball.color !== hitColor) {
          gameOver();
        }
      }
    }
  }
}

function checkCrossCollision(obs) {
  const center = getCrossCenter(obs);
  const armLength = getCrossArmLength(obs);
  const thickness = 16;

  for (let i = 0; i < 4; i++) {
    const angle = obs.rotation + i * Math.PI / 2;
    const color = COLORS[i];

    const cx = center.x + Math.cos(angle) * (armLength / 2);
    const cy = center.y + Math.sin(angle) * (armLength / 2);

    if (pointNearRotatedRect(ball.x, ball.y, cx, cy, armLength, thickness, angle)) {
      if (ball.color !== color) {
        gameOver();
      }
    }
  }
}

function pointNearRotatedRect(px, py, rx, ry, rw, rh, angle) {
  const dx = px - rx;
  const dy = py - ry;

  const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
  const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);

  return (
    Math.abs(localX) < rw / 2 + ball.r &&
    Math.abs(localY) < rh / 2 + ball.r
  );
}

function checkPointItem(obs) {
  if (obs.pointTaken) return;

  const item = getPointPosition(obs);
  const dx = ball.x - item.x;
  const dy = ball.y - item.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ball.r + 18) {
    obs.pointTaken = true;
    score++;
    scoreEl.textContent = score;
  }
}

function getPointPosition(obs) {
  if (obs.type === "circle" || obs.type === "doubleCircle") {
    return { x: obs.x, y: obs.y };
  }

  if (obs.type === "bar") {
    return { x: W / 2, y: obs.y };
  }

  if (obs.type === "cross") {
    return { x: W / 2, y: obs.y };
  }

  return { x: obs.x, y: obs.y };
}

function getColorChangerPosition(obs) {
  return {
    x: W / 2,
    y: obs.y + 285,
    r: 20
  };
}

function checkColorChanger(obs) {
  if (obs.colorChangerTaken) return;

  if (obstacles.indexOf(obs) === 0) return;

  const item = getColorChangerPosition(obs);

  const dx = ball.x - item.x;
  const dy = ball.y - item.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ball.r + item.r) {
    obs.colorChangerTaken = true;

    let newColor = randomColor();
    while (newColor === ball.color) {
      newColor = randomColor();
    }

    ball.color = newColor;
  }
}

function gameOver() {
  state = "gameover";
  gameOverColor = ball.color;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("colopeeBest", bestScore);
  }

  scoreEl.style.display = "none";
  messageEl.textContent = "";
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();

  ctx.translate(W / 2, H / 2);
  ctx.scale(VIEW_ZOOM, VIEW_ZOOM);
  ctx.translate(-W / 2, -H / 2);

  ctx.translate(0, -cameraY);

  for (const obs of obstacles) {
    drawObstacle(obs);
    drawPointItem(obs);
    drawColorChanger(obs);
  }

  drawBall();

  ctx.restore();

  if (state === "gameover") {
    drawGameOverScreen();
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
}

function drawObstacle(obs) {
  if (obs.type === "circle") {
    drawCircle(obs, 145, 13, obs.rotation);
  }

  if (obs.type === "doubleCircle") {
    drawCircle(obs, 154, 13, obs.rotation);
    drawCircle(obs, 104, 13, obs.rotation2);
  }

  if (obs.type === "bar") {
    drawBar(obs);
  }

  if (obs.type === "cross") {
    drawCross(obs);
  }
}

function drawCircle(obs, radius, thickness, rotation) {
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(
      obs.x,
      obs.y,
      radius,
      rotation + i * Math.PI / 2,
      rotation + (i + 1) * Math.PI / 2
    );
    ctx.strokeStyle = COLORS[i];
    ctx.lineWidth = thickness;
    ctx.lineCap = "butt";
    ctx.stroke();
  }
}

function drawBar(obs) {
  const barH = 18;

  const segmentW = W * 0.46;
  const totalW = segmentW * 4;
  const barX = getBarX(obs);
  const startX = barX - totalW / 2;

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = COLORS[i];
    ctx.fillRect(startX + i * segmentW, obs.y - barH / 2, segmentW, barH);
  }
}

function drawCross(obs) {
  const center = getCrossCenter(obs);
  const armLength = getCrossArmLength(obs);
  const thickness = 16;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(obs.rotation);

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 2);

    ctx.fillStyle = COLORS[i];
    ctx.fillRect(0, -thickness / 2, armLength, thickness);

    ctx.restore();
  }

  ctx.restore();
}

function drawPointItem(obs) {
  if (obs.pointTaken) return;

  const item = getPointPosition(obs);

  ctx.save();
  ctx.translate(item.x, item.y);

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(7, -6);
  ctx.lineTo(24, 0);
  ctx.lineTo(7, 6);
  ctx.lineTo(0, 22);
  ctx.lineTo(-7, 6);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-7, -6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawColorChanger(obs) {
  if (obs.colorChangerTaken) return;

  if (obstacles.indexOf(obs) === 0) return;

  const item = getColorChangerPosition(obs);
  const x = item.x;
  const y = item.y;
  const r = item.r;

  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, i * Math.PI / 2, (i + 1) * Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = COLORS[i];
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.68)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "52px Arial";
  ctx.fillText("SCORE", W / 2, H * 0.42);

  ctx.fillStyle = gameOverColor;
  ctx.font = "120px Arial";
  ctx.fillText(score, W / 2, H * 0.55);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "36px Arial";
  ctx.fillText("TAP TO RESTART", W / 2, H * 0.69);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "20px Arial";
  ctx.fillText("BEST " + bestScore, W / 2, H * 0.75);
}

function drawStartText() {
  if (state !== "ready") return;

  ctx.fillStyle = "white";
  ctx.textAlign = "center";

  ctx.font = "68px Arial";
  ctx.fillText("COLOPEE2", W / 2, H * 0.35);

  ctx.font = "32px Arial";
  ctx.fillText("TAP TO START", W / 2, H * 0.50);

  ctx.font = "22px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("MATCH THE COLOR", W / 2, H * 0.57);
}

function loop() {
  update();
  draw();

  if (state === "ready") {
    drawStartText();
  }

  requestAnimationFrame(loop);
}

loop();
