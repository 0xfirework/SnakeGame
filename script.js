// 贪吃蛇 Snake - 纯前端实现
// 控制：方向键/WASD，空格开始/暂停，R重开；手机触控方向键

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const recordsList = document.getElementById('recordsList');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const speedInput = document.getElementById('speed');
  const speedVal = document.getElementById('speedVal');

  // 配置
  const GRID = 21; // 21x21
  const INITIAL_LEN = 4;
  const STORAGE_KEY = 'snake.highscore';
  const RECORDS_KEY = 'snake.records.v1';

  // 状态枚举
  const State = Object.freeze({ Ready: 'ready', Running: 'running', Paused: 'paused', Over: 'over' });

  // 工具
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const key = (x, y) => `${x},${y}`;

  // 自适应缩放画布，依据可用宽度保持 1:1
  function resizeCanvas() {
    const wrap = canvas.parentElement; // .board-wrap
    const cssSize = Math.min(520, wrap.clientWidth);
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    // 使画布尺寸对齐到 GRID 的整数倍，避免右/下方出现未绘制的空白
    const px = Math.floor(cssSize * dpr);
    const aligned = Math.max(GRID, Math.floor(px / GRID) * GRID);
    canvas.width = aligned;
    canvas.height = aligned;
  }

  class Game {
    constructor() {
      this.state = State.Ready;
      this.speed = Number(speedInput.value); // 格/秒
      this.interval = 1000 / this.speed;
      this.acc = 0;
      this.last = performance.now();

      this.snake = [];
      this.dir = { x: 1, y: 0 }; // 当前方向
      this.nextDir = { x: 1, y: 0 }; // 待应用方向
      this.occupy = new Set(); // 记录蛇身占用
      this.food = { x: 10, y: 10 };
      this.score = 0;
      this.highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
      highScoreEl.textContent = this.highScore;
      speedVal.textContent = this.speed;

      this.init();
      renderRecords();
    }

    init() {
      // 初始化蛇位置（靠左中间）
      this.snake = [];
      this.occupy.clear();
      const mid = Math.floor(GRID / 2);
      // 使蛇头位于最右侧，朝右前进不碰到自身
      for (let i = 0; i < INITIAL_LEN; i++) {
        const seg = { x: i + 2, y: mid };
        this.snake.push(seg);
        this.occupy.add(key(seg.x, seg.y));
      }
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.score = 0;
      scoreEl.textContent = this.score;
      this.placeFood();
      this.updateOverlay();
      this.draw();
    }

    placeFood() {
      // 随机生成不与蛇重叠的食物
      let tries = 0;
      do {
        this.food.x = randInt(0, GRID - 1);
        this.food.y = randInt(0, GRID - 1);
        tries++;
        if (tries > 1000) break; // 极端防御
      } while (this.occupy.has(key(this.food.x, this.food.y)));
    }

    setSpeed(v) {
      this.speed = v;
      this.interval = 1000 / this.speed;
    }

    start() {
      if (this.state === State.Running) return;
      if (this.state === State.Over) this.init();
      this.state = State.Running;
      this.updateOverlay();
    }

    pause() {
      if (this.state !== State.Running) return;
      this.state = State.Paused;
      this.updateOverlay();
    }

    toggle() {
      if (this.state === State.Running) this.pause();
      else this.start();
    }

    restart() {
      this.state = State.Ready;
      this.acc = 0;
      this.last = performance.now();
      this.init();
    }

    updateOverlay() {
      if (this.state === State.Running) {
        overlay.classList.add('hidden');
        startPauseBtn.textContent = '暂停';
        return;
      }
      startPauseBtn.textContent = this.state === State.Over ? '再来一局' : '开始';
      overlay.classList.remove('hidden');
      if (this.state === State.Ready) {
        overlayTitle.textContent = '准备开始';
        overlaySub.textContent = '按 空格 或 点击开始';
      } else if (this.state === State.Paused) {
        overlayTitle.textContent = '暂停';
        overlaySub.textContent = '按 空格 继续';
      } else if (this.state === State.Over) {
        overlayTitle.textContent = '游戏结束';
        overlaySub.textContent = `分数 ${this.score} · 最高 ${this.highScore} · 按 R 重开`;
      }
    }

    tick(dt) {
      if (this.state !== State.Running) return;
      this.acc += dt;
      while (this.acc >= this.interval) {
        this.step();
        this.acc -= this.interval;
      }
    }

    step() {
      // 应用输入方向（禁止直接反向）
      if (!this.isOpposite(this.dir, this.nextDir)) {
        this.dir = { ...this.nextDir };
      }
      const head = this.snake[this.snake.length - 1];
      const nx = head.x + this.dir.x;
      const ny = head.y + this.dir.y;

      // 撞墙
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
        return this.gameOver();
      }
      // 撞自己（允许移动到当前尾巴所在格，因本回合会移除尾巴）
      const willGrow = nx === this.food.x && ny === this.food.y;
      const tailNow = this.snake[0];
      if (this.occupy.has(key(nx, ny))) {
        const hitsTail = tailNow && tailNow.x === nx && tailNow.y === ny;
        if (!(hitsTail && !willGrow)) {
          return this.gameOver();
        }
      }

      // 前进
      const newHead = { x: nx, y: ny };
      this.snake.push(newHead);
      this.occupy.add(key(nx, ny));

      // 吃到食物
      if (willGrow) {
        this.score += 10;
        scoreEl.textContent = this.score;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem(STORAGE_KEY, String(this.highScore));
          highScoreEl.textContent = this.highScore;
        }
        this.placeFood();
      } else {
        // 普通移动：去掉尾巴
        const tail = this.snake.shift();
        this.occupy.delete(key(tail.x, tail.y));
      }

      this.draw();
    }

    setDirection(dir) {
      // dir: {x,y}
      if (this.isOpposite(this.dir, dir)) return; // 当前帧禁止立即反向
      this.nextDir = { ...dir };
    }

    isOpposite(a, b) {
      return a.x + b.x === 0 && a.y + b.y === 0;
    }

    gameOver() {
      this.state = State.Over;
      this.updateOverlay();
      this.draw();
      // 记录成绩
      if (this.score > 0) {
        updateRecords(this.score);
      }
    }

    draw() {
      // 以设备像素绘制：计算单元格像素尺寸
      const cell = Math.floor(canvas.width / GRID);
      const size = cell * GRID; // 保证整数网格

      // 清屏
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 背景
      const grd = ctx.createLinearGradient(0, 0, 0, size);
      grd.addColorStop(0, 'rgba(255,255,255,0.02)');
      grd.addColorStop(1, 'rgba(255,255,255,0.01)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);

      // 网格
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = Math.max(1, Math.floor(cell / 12));
      ctx.beginPath();
      for (let i = 1; i < GRID; i++) {
        const p = i * cell;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
      }
      ctx.stroke();

      // 食物（黄金金币）
      const fx = this.food.x * cell;
      const fy = this.food.y * cell;
      const pad = Math.floor(cell * 0.12);
      const cx = fx + cell / 2;
      const cy = fy + cell / 2;
      const r = Math.max(4, Math.floor(cell * 0.36));
      ctx.save();
      // 外圈金色基底
      const gOuter = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.55, r * 0.2, cx, cy, r);
      gOuter.addColorStop(0, '#fde68a'); // 亮
      gOuter.addColorStop(1, '#f59e0b'); // 深
      ctx.fillStyle = gOuter;
      ctx.strokeStyle = 'rgba(120,53,15,0.55)';
      ctx.lineWidth = Math.max(1, Math.floor(cell / 12));
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = Math.floor(cell * 0.14);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 内盘
      const rin = Math.floor(r * 0.72);
      const gInner = ctx.createLinearGradient(cx, cy - rin, cx, cy + rin);
      gInner.addColorStop(0, '#fff7c2');
      gInner.addColorStop(1, '#fbbf24');
      ctx.shadowBlur = 0;
      ctx.fillStyle = gInner;
      ctx.beginPath();
      ctx.arc(cx, cy, rin, 0, Math.PI * 2);
      ctx.fill();
      // 高光弧
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, Math.floor(r * 0.18));
      ctx.beginPath();
      ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.65, -Math.PI * 0.9, -Math.PI * 0.4);
      ctx.stroke();
      ctx.restore();

      // 蛇身
      for (let i = 0; i < this.snake.length; i++) {
        const s = this.snake[i];
        const x = s.x * cell + pad;
        const y = s.y * cell + pad;
        const w = cell - pad * 2;
        const h = cell - pad * 2;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#6dd6ff');
        g.addColorStop(1, '#22c55e');
        ctx.fillStyle = g;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = Math.max(1, Math.floor(cell / 12));
        roundRect(ctx, x, y, w, h, Math.floor(cell * 0.25));
        ctx.fill();
      }

      // 蛇头高亮 + 方向箭头 + 眼睛
      const head = this.snake[this.snake.length - 1];
      if (head) {
        const hx = head.x * cell + pad;
        const hy = head.y * cell + pad;
        const w = cell - pad * 2;
        const h = cell - pad * 2;
        // 头部专属填充与脉冲光晕
        const headR = Math.floor(cell * 0.25);
        const gHead = ctx.createLinearGradient(hx, hy, hx, hy + h);
        gHead.addColorStop(0, '#ffd166');
        gHead.addColorStop(1, '#ff8a00');
        const t = (Date.now() % 1000) / 1000;
        const glow = 0.25 + 0.2 * Math.sin(t * Math.PI * 2);
        ctx.save();
        ctx.fillStyle = gHead;
        ctx.shadowColor = `rgba(255,214,102,${glow})`;
        ctx.shadowBlur = Math.floor(cell * 0.6);
        roundRect(ctx, hx, hy, w, h, headR);
        ctx.fill();
        ctx.restore();

        // 高亮描边
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1, Math.floor(cell / 14));
        roundRect(ctx, hx, hy, w, h, headR);
        ctx.stroke();

        // 方向箭头（使蛇头更醒目）
        const cx = hx + w / 2;
        const cy = hy + h / 2;
        const aw = Math.max(6, Math.floor(cell * 0.48));  // 箭头长度
        const ah = Math.max(4, Math.floor(cell * 0.18));  // 箭头半宽
        const edgeOff = Math.max(3, Math.floor(cell * 0.10));
        let p1, p2, p3;
        if (this.dir.x === 1) { // 右
          p1 = [hx + w - edgeOff, cy];
          p2 = [cx - aw / 2, cy - ah];
          p3 = [cx - aw / 2, cy + ah];
        } else if (this.dir.x === -1) { // 左
          p1 = [hx + edgeOff, cy];
          p2 = [cx + aw / 2, cy - ah];
          p3 = [cx + aw / 2, cy + ah];
        } else if (this.dir.y === 1) { // 下
          p1 = [cx, hy + h - edgeOff];
          p2 = [cx - ah, cy - aw / 2];
          p3 = [cx + ah, cy - aw / 2];
        } else { // 上
          p1 = [cx, hy + edgeOff];
          p2 = [cx - ah, cy + aw / 2];
          p3 = [cx + ah, cy + aw / 2];
        }
        ctx.save();
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(1, Math.floor(cell / 16));
        ctx.shadowColor = 'rgba(255,214,102,0.55)';
        ctx.shadowBlur = Math.floor(cell * 0.18);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 眼睛位置依据方向
        const eyeOffset = Math.max(2, Math.floor(cell * 0.12));
        const eyeR = Math.max(1, Math.floor(cell * 0.08));
        let ex1 = hx + w / 2, ey1 = hy + h / 2;
        let ex2 = ex1, ey2 = ey1;
        if (this.dir.x === 1) { ex1 = hx + w - eyeOffset; ey1 = hy + eyeOffset; ex2 = hx + w - eyeOffset; ey2 = hy + h - eyeOffset; }
        else if (this.dir.x === -1) { ex1 = hx + eyeOffset; ey1 = hy + eyeOffset; ex2 = hx + eyeOffset; ey2 = hy + h - eyeOffset; }
        else if (this.dir.y === 1) { ex1 = hx + eyeOffset; ey1 = hy + h - eyeOffset; ex2 = hx + w - eyeOffset; ey2 = hy + h - eyeOffset; }
        else if (this.dir.y === -1) { ex1 = hx + eyeOffset; ey1 = hy + eyeOffset; ex2 = hx + w - eyeOffset; ey2 = hy + eyeOffset; }
        ctx.fillStyle = '#0f1222';
        ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 绘制圆角矩形路径
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // 实例化游戏并主循环
  resizeCanvas();
  const game = new Game();

  function loop(now) {
    const dt = now - game.last;
    game.last = now;
    game.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 事件绑定
  window.addEventListener('resize', () => { resizeCanvas(); game.draw(); });
  overlay.addEventListener('click', () => game.start());
  startPauseBtn.addEventListener('click', () => game.toggle());
  restartBtn.addEventListener('click', () => game.restart());
  speedInput.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    speedVal.textContent = v;
    game.setSpeed(v);
  });

  // 方向输入映射
  const DIR = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
    W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 },
  };

  document.addEventListener('keydown', (e) => {
    if (e.key in DIR) {
      e.preventDefault();
      game.setDirection(DIR[e.key]);
    } else if (e.key === ' ') {
      e.preventDefault();
      game.toggle();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      game.restart();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      game.start();
    }
  });

  // 触控方向键
  document.querySelectorAll('.pad').forEach((btn) => {
    const dir = btn.dataset.dir;
    const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const d = map[dir];
    const handler = (ev) => { ev.preventDefault(); game.setDirection(d); game.start(); };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
  });
})();

// ===== 最高分记录（Top N） =====
const RECORDS_KEY = 'snake.records.v1';
const RECORDS_LIMIT = 10;
function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecords(list) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
  } catch {}
}

function updateRecords(score) {
  const list = loadRecords();
  list.push({ score, time: Date.now() });
  list.sort((a, b) => (b.score - a.score) || (a.time - b.time));
  if (list.length > RECORDS_LIMIT) list.length = RECORDS_LIMIT;
  saveRecords(list);
  renderRecords();
}

function renderRecords() {
  const list = loadRecords();
  const listEl = document.getElementById('recordsList');
  if (!listEl) return;
  if (!list.length) {
    listEl.innerHTML = '<li class="empty">暂无记录</li>';
    return;
  }
  const fmt = (ts) => new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  listEl.innerHTML = list
    .map(r => `<li><span class="score">${r.score}</span><span class="time">${fmt(r.time)}</span></li>`) 
    .join('');
}
