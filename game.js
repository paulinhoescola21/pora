(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menu");
  const gameScreen = document.getElementById("gameScreen");
  const modeText = document.getElementById("modeText");
  const p1Shirt = document.getElementById("p1Shirt");
  const p2Shirt = document.getElementById("p2Shirt");
  const onePlayer = document.getElementById("onePlayer");
  const twoPlayer = document.getElementById("twoPlayer");
  const restartBtn = document.getElementById("restart");
  const backMenu = document.getElementById("backMenu");
  const blueScoreEl = document.getElementById("blueScore");
  const redScoreEl = document.getElementById("redScore");
  const messageEl = document.getElementById("message");

  const W = canvas.width, H = canvas.height;
  const FIELD = { left: 45, right: W - 45, top: 45, bottom: H - 45 };
  const GOAL = { depth: 32 };
  const GOAL_TOP = H / 2 - 92;
  const GOAL_BOTTOM = H / 2 + 92;

  const keys = new Set();
  let twoPlayers = false;
  let paused = false;
  let blueScore = 0;
  let redScore = 0;
  let kickoffTimer = 0;
  let goalTextTimer = 0;
  let lastTime = performance.now();

  const SHIRTS = {
    blue:   { color: "#2688df", light: "#a8d6ff" },
    red:    { color: "#e74d55", light: "#ffd0d3" },
    green:  { color: "#20a56a", light: "#b9f2d5" },
    yellow: { color: "#e7c331", light: "#fff2a6" },
    white:  { color: "#f1f3f5", light: "#ffffff" },
    black:  { color: "#242a31", light: "#8e99a4" },
    purple: { color: "#874ed1", light: "#dec7ff" },
    orange: { color: "#e97927", light: "#ffd2b2" },
    cyan:   { color: "#18a9bb", light: "#b7f4fa" }
  };

  const p1 = {
    x: 280, y: H / 2, vx: 0, vy: 0, r: 25,
    color: "#2688df", light: "#a8d6ff",
    accel: 0.48, maxSpeed: 5.7, kickCooldown: 0,
    charge: 0, charging: false
  };

  const p2 = {
    x: W - 280, y: H / 2, vx: 0, vy: 0, r: 25,
    color: "#e74d55", light: "#ffd0d3",
    accel: 0.48, maxSpeed: 5.7, kickCooldown: 0,
    charge: 0, charging: false
  };

  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 14 };

  function resetPositions(direction = 0) {
    p1.x = 280; p1.y = H / 2; p1.vx = p1.vy = 0; p1.kickCooldown = 0; p1.charge = 0; p1.charging = false;
    p2.x = W - 280; p2.y = H / 2; p2.vx = p2.vy = 0; p2.kickCooldown = 0; p2.charge = 0; p2.charging = false;
    ball.x = W / 2; ball.y = H / 2;
    ball.vx = direction * 0.6;
    ball.vy = 0;
    kickoffTimer = 55;
  }

  function startGame(mode) {
    twoPlayers = mode === 2;
    const s1 = SHIRTS[p1Shirt.value];
    const s2 = SHIRTS[p2Shirt.value];
    p1.color = s1.color; p1.light = s1.light;
    p2.color = s2.color; p2.light = s2.light;

    blueScore = redScore = 0;
    blueScoreEl.textContent = "0";
    redScoreEl.textContent = "0";
    modeText.textContent = twoPlayers ? "2 PLAYERS" : "1 PLAYER";
    paused = false;
    menu.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    resetPositions(0);
  }

  function backToMenu() {
    gameScreen.classList.add("hidden");
    menu.classList.remove("hidden");
    keys.clear();
    paused = false;
  }

  function restartMatch() {
    blueScore = redScore = 0;
    blueScoreEl.textContent = "0";
    redScoreEl.textContent = "0";
    messageEl.classList.remove("show");
    resetPositions(0);
  }

  function axisFor(player) {
    let x = 0, y = 0;

    if (player === p1) {
      if (keys.has("a")) x--;
      if (keys.has("d")) x++;
      if (keys.has("w")) y--;
      if (keys.has("s")) y++;
    } else {
      if (keys.has("arrowleft")) x--;
      if (keys.has("arrowright")) x++;
      if (keys.has("arrowup")) y--;
      if (keys.has("arrowdown")) y++;
    }

    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  function movePlayer(p, ax, ay) {
    p.vx += ax * p.accel;
    p.vy += ay * p.accel;

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > p.maxSpeed) {
      p.vx = p.vx / speed * p.maxSpeed;
      p.vy = p.vy / speed * p.maxSpeed;
    }

    p.vx *= 0.88;
    p.vy *= 0.88;
    p.x += p.vx;
    p.y += p.vy;

    p.x = clamp(p.x, FIELD.left + p.r, FIELD.right - p.r);
    p.y = clamp(p.y, FIELD.top + p.r, FIELD.bottom - p.r);
  }

  function cpuAI() {
    const targetX = ball.x > W * 0.52 ? ball.x : W - 230;
    const targetY = ball.y;
    let dx = targetX - p2.x;
    let dy = targetY - p2.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    else { dx = dy = 0; }
    return { x: dx, y: dy };
  }

  function collidePlayers() {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.r + p2.r;

    if (dist > 0.001 && dist < minDist) {
      const nx = dx / dist, ny = dy / dist;
      const overlap = minDist - dist;
      p1.x -= nx * overlap * 0.5;
      p1.y -= ny * overlap * 0.5;
      p2.x += nx * overlap * 0.5;
      p2.y += ny * overlap * 0.5;

      // Colisão jogador-jogador não injeta força artificial na bola.
      const rel = (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.35;
        p1.vx -= nx * impulse;
        p1.vy -= ny * impulse;
        p2.vx += nx * impulse;
        p2.vy += ny * impulse;
      }
    }
  }

  function ballPlayerContact(p) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    let dist = Math.hypot(dx, dy);
    const minDist = ball.r + p.r;

    if (dist < minDist) {
      if (dist < 0.001) dist = 0.001;
      const nx = dx / dist, ny = dy / dist;

      // Apenas separa a bola do jogador.
      // NÃO altera a velocidade da bola.
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
    }
  }

  function chargeKick(p, active) {
    if (!active || p.kickCooldown > 0 || kickoffTimer > 0) {
      if (!active && p.charging) releaseKick(p);
      return;
    }

    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= p.r + ball.r + 29) {
      p.charging = true;
      p.charge = Math.min(p.charge + 1, 70);
    } else {
      p.charging = false;
      p.charge = 0;
    }
  }

  function releaseKick(p) {
    if (!p.charging) return;

    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= p.r + ball.r + 35) {
      const nx = dist > 0.01 ? dx / dist : (p === p1 ? 1 : -1);
      const ny = dist > 0.01 ? dy / dist : 0;

      // Mínimo 5.5, máximo 15.5 conforme ao tempo carregado.
      const power = 5.5 + (p.charge / 70) * 10.0;

      ball.x = p.x + nx * (p.r + ball.r + 3);
      ball.y = p.y + ny * (p.r + ball.r + 3);
      ball.vx = nx * power;
      ball.vy = ny * power;
      p.kickCooldown = 18;
    }

    p.charge = 0;
    p.charging = false;
  }

  function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.988;
    ball.vy *= 0.988;

    if (ball.y - ball.r < FIELD.top) {
      ball.y = FIELD.top + ball.r;
      ball.vy = Math.abs(ball.vy) * 0.82;
    }

    if (ball.y + ball.r > FIELD.bottom) {
      ball.y = FIELD.bottom - ball.r;
      ball.vy = -Math.abs(ball.vy) * 0.82;
    }

    const inGoalMouth = ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM;

    if (!inGoalMouth && ball.x - ball.r < FIELD.left) {
      ball.x = FIELD.left + ball.r;
      ball.vx = Math.abs(ball.vx) * 0.82;
    }

    if (!inGoalMouth && ball.x + ball.r > FIELD.right) {
      ball.x = FIELD.right - ball.r;
      ball.vx = -Math.abs(ball.vx) * 0.82;
    }

    if (ball.x < FIELD.left - GOAL.depth && inGoalMouth) score("red");
    if (ball.x > FIELD.right + GOAL.depth && inGoalMouth) score("blue");
  }

  function score(team) {
    if (kickoffTimer > 0) return;

    if (team === "blue") {
      blueScore++;
      blueScoreEl.textContent = blueScore;
      showMessage("⚽ GOL!");
      resetPositions(-1);
    } else {
      redScore++;
      redScoreEl.textContent = redScore;
      showMessage("⚽ GOL!");
      resetPositions(1);
    }
  }

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.classList.add("show");
    goalTextTimer = 70;
  }

  function update() {
    if (paused) return;

    if (kickoffTimer > 0) kickoffTimer--;

    const a1 = axisFor(p1);
    movePlayer(p1, a1.x, a1.y);

    if (twoPlayers) {
      const a2 = axisFor(p2);
      movePlayer(p2, a2.x, a2.y);
    } else {
      const ai = cpuAI();
      movePlayer(p2, ai.x, ai.y);
    }

    const p1Kick = keys.has("e");
    const p2Kick = twoPlayers ? (keys.has("control") || keys.has("ctrl")) : false;

    chargeKick(p1, p1Kick);

    if (twoPlayers) {
      chargeKick(p2, p2Kick);
    } else if (Math.hypot(ball.x - p2.x, ball.y - p2.y) < p2.r + ball.r + 25) {
      // CPU faz um carregamento curto e solta.
      p2.charging = true;
      p2.charge = Math.min(p2.charge + 1.8, 40);
      if (p2.charge >= 40) releaseKick(p2);
    }

    if (!p1Kick) releaseKick(p1);
    if (twoPlayers && !p2Kick) releaseKick(p2);

    if (p1.kickCooldown > 0) p1.kickCooldown--;
    if (p2.kickCooldown > 0) p2.kickCooldown--;

    collidePlayers();

    // Contato sem impulso: o jogador pode bloquear/encostar,
    // mas só o chute muda a velocidade da bola.
    ballPlayerContact(p1);
    ballPlayerContact(p2);

    updateBall();

    p1.x = clamp(p1.x, FIELD.left + p1.r, FIELD.right - p1.r);
    p1.y = clamp(p1.y, FIELD.top + p1.r, FIELD.bottom - p1.r);
    p2.x = clamp(p2.x, FIELD.left + p2.r, FIELD.right - p2.r);
    p2.y = clamp(p2.y, FIELD.top + p2.r, FIELD.bottom - p2.r);

    if (goalTextTimer > 0) {
      goalTextTimer--;
      if (goalTextTimer === 0) messageEl.classList.remove("show");
    }
  }

  function drawField() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0d141d";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#167447";
    ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

    for (let x = FIELD.left; x < FIELD.right; x += 90) {
      ctx.fillStyle = ((x - FIELD.left) / 90) % 2 === 0
        ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.025)";
      ctx.fillRect(x, FIELD.top, 90, FIELD.bottom - FIELD.top);
    }

    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

    ctx.beginPath();
    ctx.moveTo(W / 2, FIELD.top);
    ctx.lineTo(W / 2, FIELD.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(FIELD.left - GOAL.depth, GOAL_TOP, GOAL.depth, GOAL_BOTTOM - GOAL_TOP);
    ctx.fillRect(FIELD.right, GOAL_TOP, GOAL.depth, GOAL_BOTTOM - GOAL_TOP);

    ctx.strokeStyle = "#dfe8ef";
    ctx.lineWidth = 4;
    ctx.strokeRect(FIELD.left - GOAL.depth, GOAL_TOP, GOAL.depth, GOAL_BOTTOM - GOAL_TOP);
    ctx.strokeRect(FIELD.right, GOAL_TOP, GOAL.depth, GOAL_BOTTOM - GOAL_TOP);

    ctx.lineWidth = 2;
    ctx.strokeRect(FIELD.left, H / 2 - 135, 105, 270);
    ctx.strokeRect(FIELD.right - 105, H / 2 - 135, 105, 270);
  }

  function drawDisc(p, outline, chargeColor) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = outline;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x - p.r * .25, p.y - p.r * .25, p.r * .22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.fill();

    if (p.charging) {
      const pct = p.charge / 70;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.strokeStyle = chargeColor;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#f7f7f7";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#222b35";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ball.x - 4, ball.y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fill();
  }

  function drawLabels() {
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("P1", p1.x, p1.y - 34);
    ctx.fillText(twoPlayers ? "P2" : "CPU", p2.x, p2.y - 34);
  }

  function render() {
    drawField();
    drawBall();
    drawDisc(p1, "#d6ecff", "#ffffff");
    drawDisc(p2, "#ffd7da", "#ffffff");
    drawLabels();

    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,.48)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "900 52px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PAUSADO", W / 2, H / 2);
      ctx.font = "18px Arial";
      ctx.fillText("Pressione P para continuar", W / 2, H / 2 + 38);
    }
  }

  function loop(now) {
    const elapsed = Math.min(now - lastTime, 40);
    lastTime = now;
    const steps = Math.max(1, Math.min(2, Math.round(elapsed / 16.67)));
    for (let i = 0; i < steps; i++) update();
    render();
    requestAnimationFrame(loop);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    if (["arrowup","arrowdown","arrowleft","arrowright"," ","control"].includes(key)) {
      e.preventDefault();
    }

    if (key === "p" && !menu.classList.contains("hidden")) return;

    if (key === "p" && !gameScreen.classList.contains("hidden")) {
      paused = !paused;
      return;
    }

    if (key === "escape" && !gameScreen.classList.contains("hidden")) {
      backToMenu();
      return;
    }

    keys.add(key);

    if (key === "control") keys.add("control");
  });

  window.addEventListener("keyup", e => {
    keys.delete(e.key.toLowerCase());
    if (e.key.toLowerCase() === "control") keys.delete("control");
  });

  window.addEventListener("blur", () => {
    keys.clear();
    p1.charging = false;
    p1.charge = 0;
    p2.charging = false;
    p2.charge = 0;
  });

  onePlayer.addEventListener("click", () => startGame(1));
  twoPlayer.addEventListener("click", () => startGame(2));
  restartBtn.addEventListener("click", restartMatch);
  backMenu.addEventListener("click", backToMenu);

  resetPositions(0);
  requestAnimationFrame(loop);
})();
