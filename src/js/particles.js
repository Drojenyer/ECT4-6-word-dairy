/**
 * 背景粒子特效系统
 * - PC 端：点击产生粒子扩散效果
 * - 移动端：轻量级效果，减少粒子数量
 */
class ParticleSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.effect = 'none';
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.maxParticles = this.isMobile ? 30 : 80;
    this.animationId = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // 创建 canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particle-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.initialized = true;

    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resize());

    // 监听点击事件
    if (this.effect === 'click' || this.effect === 'trail') {
      this.attachClickHandler();
    }

    // 启动动画循环
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setEffect(effect) {
    const validEffects = ['none', 'click', 'trail', 'float'];
    if (!validEffects.includes(effect)) return;

    this.effect = effect;

    // 初始化 canvas
    if (effect !== 'none' && !this.initialized) {
      this.init();
    }

    // 清除现有粒子
    if (effect === 'none') {
      this.particles = [];
    }

    // 浮动效果自动生成粒子
    if (effect === 'float' && this.initialized) {
      this.generateFloatingParticles();
    }

    // 点击和拖尾效果绑定点击事件
    if ((effect === 'click' || effect === 'trail') && this.initialized) {
      this.attachClickHandler();
    }
  }

  attachClickHandler() {
    if (this.clickHandlerAttached) return;
    this.clickHandlerAttached = true;

    document.addEventListener('click', (e) => {
      if (this.effect === 'click') {
        this.createClickEffect(e.clientX, e.clientY);
      } else if (this.effect === 'trail') {
        this.createTrailEffect(e.clientX, e.clientY);
      }
    });
  }

  createClickEffect(x, y) {
    const count = this.isMobile ? 15 : 30;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;
      const size = 3 + Math.random() * 4;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        alpha: 1,
        color: primaryColor,
        life: 1,
        decay: 0.02 + Math.random() * 0.01
      });
    }

    // 限制粒子数量
    if (this.particles.length > this.maxParticles) {
      this.particles = this.particles.slice(-this.maxParticles);
    }
  }

  createTrailEffect(x, y) {
    const count = this.isMobile ? 8 : 15;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const size = 2 + Math.random() * 3;

      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size,
        alpha: 1,
        color: primaryColor,
        life: 1,
        decay: 0.015 + Math.random() * 0.01
      });
    }

    if (this.particles.length > this.maxParticles) {
      this.particles = this.particles.slice(-this.maxParticles);
    }
  }

  generateFloatingParticles() {
    this.particles = [];
    const count = this.isMobile ? 20 : 50;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.4,
        color: primaryColor,
        life: 1,
        decay: 0,
        floating: true
      });
    }
  }

  animate() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 更新和绘制粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // 更新位置
      p.x += p.vx;
      p.y += p.vy;

      // 浮动效果：超出边界后从另一侧出现
      if (p.floating) {
        if (p.y < -10) p.y = this.canvas.height + 10;
        if (p.x < -10) p.x = this.canvas.width + 10;
        if (p.x > this.canvas.width + 10) p.x = -10;
      } else {
        // 普通效果：衰减生命
        p.life -= p.decay;
        p.alpha = p.life;

        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      }

      // 绘制粒子
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = this.hexToRgba(p.color, p.alpha);
      this.ctx.fill();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${alpha})`;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas) {
      this.canvas.remove();
    }
    this.initialized = false;
  }
}

// 创建全局实例
window.particleSystem = new ParticleSystem();
