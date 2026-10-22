// 外观主题：主题色 / 背景色 / 界面圆角 / 预设样式
// 所有颜色都通过覆盖 :root 上的 CSS 变量生效，无需改动各页面的样式表。

const THEME_ACCENTS = {
  blue:   { label: '经典蓝', primary: '#0f6cbd', dark: '#0b5394', bright: '#4a9ee0', light: '#e8f1fa', rgb: '15, 108, 189' },
  teal:   { label: '青碧',   primary: '#0f8b8d', dark: '#0b6b6d', bright: '#45b6b8', light: '#e4f4f4', rgb: '15, 139, 141' },
  green:  { label: '松绿',   primary: '#1a7f52', dark: '#136040', bright: '#47b380', light: '#e7f4ee', rgb: '26, 127, 82' },
  purple: { label: '罗兰紫', primary: '#7a4fd6', dark: '#5f3aae', bright: '#a583e8', light: '#f0eafc', rgb: '122, 79, 214' },
  rose:   { label: '玫红',   primary: '#d1477d', dark: '#a83463', bright: '#ec7ba6', light: '#fcebf2', rgb: '209, 71, 125' },
  orange: { label: '暖橙',   primary: '#d97a1f', dark: '#ab5f14', bright: '#ef9f4e', light: '#fdf1e4', rgb: '217, 122, 31' },
  slate:  { label: '素雅灰', primary: '#55657a', dark: '#414e5f', bright: '#8296ad', light: '#eef1f5', rgb: '85, 101, 122' },
  // 新增预制颜色
  indigo: { label: '靛青', primary: '#4b5fd6', dark: '#3a4bb0', bright: '#7b8ce8', light: '#edf0fc', rgb: '75, 95, 214' },
  cyan:   { label: '湖蓝', primary: '#00a6c7', dark: '#008299', bright: '#4dc4dd', light: '#e6f7fb', rgb: '0, 166, 199' },
  emerald:{ label: '翡翠', primary: '#10b981', dark: '#0d9668', bright: '#5cd3a7', light: '#e8f8f2', rgb: '16, 185, 129' },
  amber:  { label: '琥珀', primary: '#f59e0b', dark: '#d97706', bright: '#fbbf24', light: '#fef3c7', rgb: '245, 158, 11' },
  pink:   { label: '桃粉', primary: '#ec4899', dark: '#db2777', bright: '#f472b6', light: '#fce7f3', rgb: '236, 72, 153' },
  red:    { label: '朱砂', primary: '#ef4444', dark: '#dc2626', bright: '#f87171', light: '#fee2e2', rgb: '239, 68, 68' }
};

const THEME_BACKGROUNDS = {
  gray: {
    label: '浅灰', scheme: 'light',
    'bg-primary': '#f6f7f9',
    'bg-secondary': '#ffffff',
    'bg-card': '#ffffff',
    'bg-hover': '#f0f2f5',
    'bg-active': '#e7eaee',
    'bg-sidebar': '#fbfbfc',
    'text-primary': '#1b1f24',
    'text-secondary': '#5c6672',
    'text-tertiary': '#98a1ac',
    'border': '#e3e6ea',
    'border-light': '#eef0f3',
    'shadow': '0 1px 2px rgba(16, 24, 40, 0.06)',
    'shadow-md': '0 2px 8px rgba(16, 24, 40, 0.08)',
    'shadow-lg': '0 8px 24px rgba(16, 24, 40, 0.1)',
    'shadow-xl': '0 16px 40px rgba(16, 24, 40, 0.14)'
  },
  snow: {
    label: '纯白', scheme: 'light',
    'bg-primary': '#ffffff',
    'bg-secondary': '#ffffff',
    'bg-card': '#ffffff',
    'bg-hover': '#f5f6f8',
    'bg-active': '#eceef1',
    'bg-sidebar': '#ffffff',
    'text-primary': '#1b1f24',
    'text-secondary': '#5c6672',
    'text-tertiary': '#98a1ac',
    'border': '#e3e6ea',
    'border-light': '#eef0f3',
    'shadow': '0 1px 2px rgba(16, 24, 40, 0.05)',
    'shadow-md': '0 2px 8px rgba(16, 24, 40, 0.07)',
    'shadow-lg': '0 8px 24px rgba(16, 24, 40, 0.09)',
    'shadow-xl': '0 16px 40px rgba(16, 24, 40, 0.12)'
  },
  warm: {
    label: '暖米', scheme: 'light',
    'bg-primary': '#faf7f2',
    'bg-secondary': '#ffffff',
    'bg-card': '#ffffff',
    'bg-hover': '#f4efe6',
    'bg-active': '#ece4d6',
    'bg-sidebar': '#fdfbf7',
    'text-primary': '#2a241c',
    'text-secondary': '#6b6155',
    'text-tertiary': '#a1958a',
    'border': '#e8e0d3',
    'border-light': '#f1ebe0',
    'shadow': '0 1px 2px rgba(80, 62, 32, 0.06)',
    'shadow-md': '0 2px 8px rgba(80, 62, 32, 0.08)',
    'shadow-lg': '0 8px 24px rgba(80, 62, 32, 0.1)',
    'shadow-xl': '0 16px 40px rgba(80, 62, 32, 0.14)'
  },
  eye: {
    label: '护眼绿', scheme: 'light',
    'bg-primary': '#eef4ed',
    'bg-secondary': '#ffffff',
    'bg-card': '#ffffff',
    'bg-hover': '#e4ede2',
    'bg-active': '#d9e6d7',
    'bg-sidebar': '#f4f8f3',
    'text-primary': '#20291f',
    'text-secondary': '#586455',
    'text-tertiary': '#8e9a8b',
    'border': '#d5e2d3',
    'border-light': '#e4ede2',
    'shadow': '0 1px 2px rgba(30, 50, 28, 0.06)',
    'shadow-md': '0 2px 8px rgba(30, 50, 28, 0.08)',
    'shadow-lg': '0 8px 24px rgba(30, 50, 28, 0.1)',
    'shadow-xl': '0 16px 40px rgba(30, 50, 28, 0.14)'
  },
  dark: {
    label: '暗夜', scheme: 'dark',
    'bg-primary': '#1a1d21',
    'bg-secondary': '#22262b',
    'bg-card': '#22262b',
    'bg-hover': '#2a2f35',
    'bg-active': '#32383f',
    'bg-sidebar': '#1e2226',
    'text-primary': '#e8eaed',
    'text-secondary': '#a8b0ba',
    'text-tertiary': '#78828d',
    'border': '#333941',
    'border-light': '#2b3037',
    'shadow': '0 1px 2px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 2px 8px rgba(0, 0, 0, 0.35)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.4)',
    'shadow-xl': '0 16px 40px rgba(0, 0, 0, 0.45)'
  }
};

/**
 * 新增底色共用现有明暗方案里的文字色与阴影，只覆盖背景与描边，
 * 免得每个底色都把十几个变量抄一遍。
 */
function lightSurface(overrides) {
  return Object.assign({}, THEME_BACKGROUNDS.gray, overrides, { scheme: 'light' });
}

function darkSurface(overrides) {
  return Object.assign({}, THEME_BACKGROUNDS.dark, overrides, { scheme: 'dark' });
}

/**
 * 渐变底：页面底色改用渐变（--bg-app），
 * 卡片与侧边栏做成半透明，让渐变透出来，同时保证文字对比度。
 */
function gradientBackground(label, background, options) {
  const dark = Boolean(options && options.dark);
  const surface = dark ? '32, 36, 43' : '255, 255, 255';

  return Object.assign(dark ? darkSurface({}) : lightSurface({}), {
    label,
    appBackground: background,
    // 页面底色由 --bg-app 单独负责，这里留透明
    'bg-primary': 'transparent',
    'bg-secondary': `rgba(${surface}, 0.72)`,
    'bg-card': `rgba(${surface}, 0.78)`,
    'bg-sidebar': `rgba(${surface}, 0.55)`,
    'bg-hover': `rgba(${surface}, 0.5)`,
    'bg-active': `rgba(${surface}, 0.42)`,
    // 半透明面板上的描边要淡一些，否则像贴了黑框
    'border': dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(16, 24, 40, 0.1)',
    'border-light': dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(16, 24, 40, 0.06)'
  });
}

Object.assign(THEME_BACKGROUNDS, {
  /* ---------- 纯色 ---------- */
  sky: lightSurface({
    label: '天蓝',
    'bg-primary': '#eaf2fc',
    'bg-sidebar': '#f2f7fd',
    'bg-hover': '#dfeaf8',
    'bg-active': '#d3e2f5',
    'border': '#d5e1f0',
    'border-light': '#e3ecf9'
  }),
  mint: lightSurface({
    label: '薄荷绿',
    'bg-primary': '#e9f6ef',
    'bg-sidebar': '#f1faf5',
    'bg-hover': '#ddeee5',
    'bg-active': '#cfe6da',
    'border': '#d2e5da',
    'border-light': '#e2f1e9'
  }),
  rose: lightSurface({
    label: '樱粉',
    'bg-primary': '#fdeef3',
    'bg-sidebar': '#fef5f8',
    'bg-hover': '#f7e2ea',
    'bg-active': '#f0d5e0',
    'border': '#efd7df',
    'border-light': '#f7e6ec'
  }),
  sand: lightSurface({
    label: '米砂',
    'bg-primary': '#f8f3e9',
    'bg-sidebar': '#fbf8f1',
    'bg-hover': '#f1e9db',
    'bg-active': '#e9dfcd',
    'border': '#e7dcc9',
    'border-light': '#f1e9dc'
  }),
  navy: darkSurface({
    label: '深海',
    'bg-primary': '#141a24',
    'bg-secondary': '#1c232f',
    'bg-card': '#1c232f',
    'bg-hover': '#232c3a',
    'bg-active': '#2a3444',
    'bg-sidebar': '#171e28',
    'border': '#2b3442',
    'border-light': '#232b37'
  }),

  /* ---------- 渐变（配色参考 Web Gradients，柔和、不刺眼）---------- */
  'grad-sky': gradientBackground('晴空', 'linear-gradient(135deg, #eef5ff 0%, #dbe9fb 55%, #eef4ff 100%)'),
  'grad-mint': gradientBackground('薄荷', 'linear-gradient(135deg, #eafff5 0%, #d6f3e6 55%, #eafaf1 100%)'),
  'grad-peach': gradientBackground('蜜桃', 'linear-gradient(135deg, #fff3e8 0%, #ffe1e1 55%, #fff2ea 100%)'),
  'grad-lavender': gradientBackground('薰衣草', 'linear-gradient(135deg, #f4f1ff 0%, #e6e1ff 55%, #f3efff 100%)'),
  'grad-aurora': gradientBackground('极光', 'linear-gradient(135deg, #e8f7ff 0%, #e4fbf3 45%, #f1e9ff 100%)'),
  'grad-sunset': gradientBackground('晚霞', 'linear-gradient(135deg, #ffeeef 0%, #ffe4d4 45%, #f6e8ff 100%)'),
  'grad-night': gradientBackground('深夜', 'linear-gradient(160deg, #171b22 0%, #232a35 55%, #1a1f27 100%)', { dark: true })
});

const THEME_RADII = {
  compact:  { label: '紧凑', radius: '4px',  sm: '3px', lg: '8px',  xl: '12px' },
  standard: { label: '标准', radius: '8px',  sm: '6px', lg: '12px', xl: '16px' },
  round:    { label: '圆润', radius: '12px', sm: '9px', lg: '18px', xl: '24px' }
};

// 卡片密度：学习页与错题本的留白、间距。标准档即当前默认外观。
const THEME_DENSITIES = {
  compact:     { label: '紧凑', barGap: '3px' },
  standard:    { label: '标准', barGap: '5px' },
  comfortable: { label: '宽松', barGap: '8px' }
};

// 状态色：浅色 / 深色两套。
// 深色模式下半透明的浅色底（-light）与更亮的前景色（-text）搭配，
// 避免浅色块直接压在深色界面上导致颜色错乱。
const THEME_STATUS_COLORS = {
  light: {
    'success': '#107c10',
    'success-dark': '#0b5e0b',
    'success-light': '#e6f4e6',
    'success-text': '#107c10',
    'danger': '#d13438',
    'danger-dark': '#a4262c',
    'danger-light': '#fdecec',
    'danger-text': '#d13438',
    'warning': '#c77700',
    'warning-dark': '#9a5b00',
    'warning-light': '#fdf3e3',
    'warning-text': '#c77700'
  },
  dark: {
    'success': '#238636',
    'success-dark': '#2ea043',
    'success-light': 'rgba(63, 185, 80, 0.18)',
    'success-text': '#3fb950',
    'danger': '#da3633',
    'danger-dark': '#f85149',
    'danger-light': 'rgba(248, 81, 73, 0.18)',
    'danger-text': '#f85149',
    'warning': '#9e6a03',
    'warning-dark': '#d29922',
    'warning-light': 'rgba(210, 153, 34, 0.18)',
    'warning-text': '#e3b341'
  }
};

const THEME_PRESETS = {
  classic: { label: '简约蓝', accent: 'blue',   background: 'gray',   radius: 'standard' },
  fresh:   { label: '清新绿', accent: 'teal',   background: 'eye',    radius: 'round' },
  warm:    { label: '暖阳橙', accent: 'orange', background: 'warm',   radius: 'standard' },
  elegant: { label: '素雅灰', accent: 'slate',  background: 'snow',   radius: 'compact' },
  night:   { label: '暗夜深色', accent: 'blue', background: 'dark',   radius: 'standard' },
  aurora:  { label: '极光渐变', accent: 'teal', background: 'grad-aurora', radius: 'round' }
};

const DEFAULT_THEME = {
  theme_accent: 'blue',
  theme_background: 'gray',
  theme_radius: 'standard',
  theme_density: 'standard',
  // 窗口亚克力材质（桌面端专属）：开启后界面半透明，透出桌面
  window_material: 'default',
  // 自定义主题色（色谱选择器）
  custom_accent: null,
  custom_background_start: '#e8f2ff',
  custom_background_end: '#f5eaff',
  // 背景粒子特效开关
  particle_effect: 'none'
};

class ThemeManager {
  constructor() {
    this.state = Object.assign({}, DEFAULT_THEME);
  }

  // 从设置对象读取并应用主题
  applyFromSettings(settings) {
    const source = settings || {};
    const validColor = value => /^#[0-9a-fA-F]{6}$/.test(value || '');
    const customAccent = validColor(source.custom_accent) ? source.custom_accent : null;
    const customBackgroundStart = validColor(source.custom_background_start)
      ? source.custom_background_start : DEFAULT_THEME.custom_background_start;
    const customBackgroundEnd = validColor(source.custom_background_end)
      ? source.custom_background_end : DEFAULT_THEME.custom_background_end;
    this.state = {
      theme_accent: source.theme_accent === 'custom' && customAccent
        ? 'custom' : (THEME_ACCENTS[source.theme_accent] ? source.theme_accent : DEFAULT_THEME.theme_accent),
      theme_background: source.theme_background === 'custom' ? 'custom' : THEME_BACKGROUNDS[source.theme_background]
        ? source.theme_background
        : DEFAULT_THEME.theme_background,
      theme_radius: THEME_RADII[source.theme_radius] ? source.theme_radius : DEFAULT_THEME.theme_radius,
      theme_density: THEME_DENSITIES[source.theme_density]
        ? source.theme_density
        : DEFAULT_THEME.theme_density,
      window_material: ['default', 'none', 'acrylic', 'transparent'].includes(source.window_material)
        ? (source.window_material === 'none' ? 'default' : source.window_material)
        : 'default',
      custom_accent: customAccent,
      custom_background_start: customBackgroundStart,
      custom_background_end: customBackgroundEnd,
      particle_effect: source.particle_effect || 'none'
    };

    this.apply();
    this.applyParticleEffect();
  }

  // 设置自定义主题色（色谱选择器）
  async setCustomAccent(hexColor) {
    if (!hexColor || !/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
      return;
    }

    this.state.custom_accent = hexColor;
    this.state.theme_accent = 'custom';
    this.applyCustomAccent(hexColor);
    this.syncUI();

    try {
      await api.updateSettings({
        custom_accent: hexColor,
        theme_accent: 'custom'
      });
    } catch (error) {
      console.error('保存自定义颜色失败:', error);
    }
  }

  async setCustomBackground() {
    const start = document.getElementById('custom-background-start').value;
    const end = document.getElementById('custom-background-end').value;
    if (!/^#[0-9a-fA-F]{6}$/.test(start) || !/^#[0-9a-fA-F]{6}$/.test(end)) return;

    this.state.custom_background_start = start;
    this.state.custom_background_end = end;
    this.state.theme_background = 'custom';
    this.apply();
    this.syncUI();
    try {
      await api.updateSettings({
        custom_background_start: start,
        custom_background_end: end,
        theme_background: 'custom'
      });
    } catch (error) {
      console.error('保存自定义背景失败:', error);
    }
  }

  // 应用自定义颜色到 CSS 变量
  applyCustomAccent(hex) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.hexToHsl(hex);
    const root = document.documentElement;

    root.style.setProperty('--primary', hex);
    root.style.setProperty('--primary-dark', this.adjustBrightness(hex, -20));
    root.style.setProperty('--primary-light', `rgba(${rgb}, 0.12)`);
    root.style.setProperty('--primary-text', this.adjustBrightness(hex, -30));
    root.style.setProperty('--primary-grad-start', this.adjustBrightness(hex, 15));
    root.style.setProperty('--primary-soft', `rgba(${rgb}, 0.08)`);
    root.style.setProperty('--info', hex);
    root.style.setProperty('--info-dark', this.adjustBrightness(hex, -20));
    root.style.setProperty('--info-light', `rgba(${rgb}, 0.12)`);
  }

  // 设置粒子特效
  async setParticleEffect(effect) {
    const validEffects = ['none', 'click', 'trail', 'float'];
    if (!validEffects.includes(effect)) {
      return;
    }

    this.state.particle_effect = effect;
    this.applyParticleEffect();

    try {
      await api.updateSettings({ particle_effect: effect });
    } catch (error) {
      console.error('保存粒子特效设置失败:', error);
    }
  }

  // 应用粒子特效
  applyParticleEffect() {
    if (window.particleSystem) {
      window.particleSystem.setEffect(this.state.particle_effect);
    }
  }

  // 只改其中一项（用户在设置页点击色块时）
  async set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.state, key)) {
      return;
    }

    this.state[key] = value;
    this.apply();
    this.syncUI();

    try {
      await api.updateSettings({ [key]: value });
    } catch (error) {
      console.error('保存外观设置失败:', error);
    }
  }

  // 套用预设：一次性设置主题色 + 背景色 + 圆角（不影响卡片密度）
  async applyPreset(presetKey) {
    const preset = THEME_PRESETS[presetKey];
    if (!preset) {
      return;
    }

    this.state.theme_accent = preset.accent;
    this.state.theme_background = preset.background;
    this.state.theme_radius = preset.radius;
    this.apply();
    this.syncUI();

    try {
      await api.updateSettings({
        theme_accent: preset.accent,
        theme_background: preset.background,
        theme_radius: preset.radius
      });
    } catch (error) {
      console.error('保存预设样式失败:', error);
    }
  }

  // 当前组合命中的预设（用于高亮）
  matchedPreset() {
    const found = Object.keys(THEME_PRESETS).find(key => {
      const p = THEME_PRESETS[key];
      return p.accent === this.state.theme_accent
        && p.background === this.state.theme_background
        && p.radius === this.state.theme_radius;
    });
    return found || null;
  }

  // 预设清单（含色值），供首启向导展示可选外观
  listPresets() {
    return Object.keys(THEME_PRESETS).map(key => {
      const preset = THEME_PRESETS[key];
      const accent = THEME_ACCENTS[preset.accent] || THEME_ACCENTS.blue;
      const background = THEME_BACKGROUNDS[preset.background] || THEME_BACKGROUNDS.gray;

      return {
        key,
        label: preset.label,
        primary: accent.primary,
        surface: background['bg-primary']
      };
    });
  }

  apply() {
    const customBackground = this.state.theme_background === 'custom';
    const start = this.state.custom_background_start;
    const end = this.state.custom_background_end;
    const colors = [start, end].map(hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)));
    const average = colors.flat().reduce((sum, channel) => sum + channel, 0) / 6;
    const bg = customBackground
      ? gradientBackground('自定义渐变', `linear-gradient(135deg, ${start}, ${end})`, { dark: average < 140 })
      : (THEME_BACKGROUNDS[this.state.theme_background] || THEME_BACKGROUNDS.gray);
    const radius = THEME_RADII[this.state.theme_radius] || THEME_RADII.standard;
    const isDark = bg.scheme === 'dark';
    const root = document.documentElement;
    const set = (name, value) => root.style.setProperty(name, value);

    // 主题色：优先使用自定义颜色
    if (this.state.theme_accent === 'custom' && this.state.custom_accent) {
      this.applyCustomAccent(this.state.custom_accent);
    } else {
      const accent = THEME_ACCENTS[this.state.theme_accent] || THEME_ACCENTS.blue;
      set('--primary', accent.primary);
      set('--primary-dark', accent.dark);
      set('--primary-light', isDark ? `rgba(${accent.rgb}, 0.18)` : accent.light);
      set('--primary-text', isDark ? accent.bright : accent.dark);
      set('--primary-grad-start', accent.bright);
      set('--primary-soft', `rgba(${accent.rgb}, ${isDark ? 0.14 : 0.07})`);
      set('--info', accent.primary);
      set('--info-dark', accent.dark);
      set('--info-light', isDark ? `rgba(${accent.rgb}, 0.18)` : accent.light);
    }
    set('--secondary', isDark ? '#a8b0ba' : '#475467');

    // 状态色：深色模式下换成半透明底 + 更亮的前景
    const status = THEME_STATUS_COLORS[isDark ? 'dark' : 'light'];
    Object.keys(status).forEach(key => set(`--${key}`, status[key]));

    // 背景与文字
    Object.keys(bg).forEach(key => {
      if (key === 'label' || key === 'scheme' || key === 'appBackground') {
        return;
      }
      set(`--${key}`, bg[key]);
    });

    // 页面底色：渐变底走 --bg-app，纯色底就沿用 bg-primary
    const glass = this.state.window_material === 'acrylic';
    const transparentTitlebar = this.state.window_material === 'transparent';
    const surface = isDark ? '28, 32, 38' : '255, 255, 255';

    if (glass) {
      // 亚克力模式：页面与面板都留出透明度，系统材质才透得出来
      set('--bg-app', `rgba(${surface}, 0.3)`);
      set('--bg-secondary', `rgba(${surface}, 0.55)`);
      set('--bg-card', `rgba(${surface}, 0.62)`);
      set('--bg-sidebar', `rgba(${surface}, 0.45)`);
      set('--bg-hover', `rgba(${surface}, 0.42)`);
      set('--bg-active', `rgba(${surface}, 0.34)`);
    } else {
      set('--bg-app', bg.appBackground || bg['bg-primary']);
    }

    const titlebar = document.getElementById('desktop-titlebar');
    if (titlebar) {
      titlebar.dataset.material = this.state.window_material;
      titlebar.style.setProperty('--desktop-titlebar-background', transparentTitlebar
        ? 'var(--bg-app, var(--bg-primary))'
        : this.state.window_material === 'acrylic'
          ? (isDark ? 'rgba(25, 28, 32, 0.55)' : 'rgba(255, 255, 255, 0.62)')
          : 'var(--bg-secondary)');
      titlebar.style.setProperty('--desktop-titlebar-foreground', isDark
        ? '#f3f4f6' : 'var(--text-primary)');
    }

    // 圆角
    set('--radius', radius.radius);
    set('--radius-sm', radius.sm);
    set('--radius-lg', radius.lg);
    set('--radius-xl', radius.xl);

    root.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.dataset.themeMode = isDark ? 'dark' : 'light';
    document.body.dataset.density = this.state.theme_density;
  }

  // 渲染设置页里的色块选项
  renderControls() {
    const accentBox = document.getElementById('theme-accents');
    const bgBox = document.getElementById('theme-backgrounds');
    const radiusBox = document.getElementById('theme-radii');
    const presetBox = document.getElementById('theme-presets');
    const customPicker = document.getElementById('custom-accent-picker');
    const particleBox = document.getElementById('particle-effects');

    if (accentBox) {
      accentBox.innerHTML = Object.keys(THEME_ACCENTS).map(key => {
        const accent = THEME_ACCENTS[key];
        return `
          <button class="theme-swatch" data-accent="${key}" title="${accent.label}">
            <span class="theme-swatch-dot" style="background: ${accent.primary};"></span>
            <span class="theme-swatch-label">${accent.label}</span>
          </button>
        `;
      }).join('');

      accentBox.querySelectorAll('[data-accent]').forEach(btn => {
        btn.addEventListener('click', () => this.set('theme_accent', btn.dataset.accent));
      });
    }

    // 自定义颜色选择器
    if (customPicker) {
      if (this.state.custom_accent) {
        customPicker.value = this.state.custom_accent;
      }
      customPicker.onchange = (e) => {
        this.setCustomAccent(e.target.value);
      };
    }

    for (const id of ['custom-background-start', 'custom-background-end']) {
      const picker = document.getElementById(id);
      if (picker) picker.onchange = () => this.setCustomBackground();
    }

    // 粒子特效选项
    if (particleBox) {
      const effects = [
        { key: 'none', label: '无', icon: 'fa-circle' },
        { key: 'click', label: '点击扩散', icon: 'fa-hand-pointer' },
        { key: 'trail', label: '点击拖尾', icon: 'fa-wand-magic-sparkles' },
        { key: 'float', label: '浮动粒子', icon: 'fa-wind' }
      ];

      particleBox.innerHTML = effects.map(effect => `
        <button class="particle-effect-btn" data-particle="${effect.key}" title="${effect.label}">
          <span class="particle-effect-icon"><i class="fa-solid ${effect.icon}"></i></span>
          <span class="particle-effect-label">${effect.label}</span>
        </button>
      `).join('');

      particleBox.querySelectorAll('[data-particle]').forEach(btn => {
        btn.addEventListener('click', () => this.setParticleEffect(btn.dataset.particle));
      });

      // 同步当前选中状态
      particleBox.querySelectorAll('[data-particle]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.particle === this.state.particle_effect);
      });
    }

    if (bgBox) {
      bgBox.innerHTML = Object.keys(THEME_BACKGROUNDS).map(key => {
        const bg = THEME_BACKGROUNDS[key];
        // 渐变底用渐变本身做预览，纯色底用底色
        const preview = bg.appBackground || bg['bg-primary'];
        return `
          <button class="theme-swatch" data-background="${key}" title="${bg.label}">
            <span class="theme-swatch-dot theme-swatch-square"
                  style="background: ${preview}; border-color: ${bg['border']};">
              <span class="theme-swatch-inner" style="background: ${bg['bg-card']};"></span>
            </span>
            <span class="theme-swatch-label">${bg.label}</span>
          </button>
        `;
      }).join('');

      bgBox.querySelectorAll('[data-background]').forEach(btn => {
        btn.addEventListener('click', () => this.set('theme_background', btn.dataset.background));
      });
    }

    if (radiusBox) {
      radiusBox.innerHTML = Object.keys(THEME_RADII).map(key => {
        const radius = THEME_RADII[key];
        return `
          <button class="theme-swatch" data-radius="${key}" title="${radius.label}">
            <span class="theme-swatch-dot theme-swatch-square"
                  style="border-radius: ${radius.radius};"></span>
            <span class="theme-swatch-label">${radius.label}</span>
          </button>
        `;
      }).join('');

      radiusBox.querySelectorAll('[data-radius]').forEach(btn => {
        btn.addEventListener('click', () => this.set('theme_radius', btn.dataset.radius));
      });
    }

    const densityBox = document.getElementById('theme-densities');
    if (densityBox) {
      densityBox.innerHTML = Object.keys(THEME_DENSITIES).map(key => {
        const density = THEME_DENSITIES[key];
        return `
          <button class="theme-swatch" data-density="${key}" title="${density.label}">
            <span class="density-preview" style="gap: ${density.barGap};">
              <span class="density-bar"></span>
              <span class="density-bar"></span>
              <span class="density-bar"></span>
            </span>
            <span class="theme-swatch-label">${density.label}</span>
          </button>
        `;
      }).join('');

      densityBox.querySelectorAll('[data-density]').forEach(btn => {
        btn.addEventListener('click', () => this.set('theme_density', btn.dataset.density));
      });
    }

    if (presetBox) {
      presetBox.innerHTML = Object.keys(THEME_PRESETS).map(key => {
        const preset = THEME_PRESETS[key];
        const accent = THEME_ACCENTS[preset.accent];
        const bg = THEME_BACKGROUNDS[preset.background];
        return `
          <button class="theme-preset" data-preset="${key}">
            <span class="theme-preset-preview" style="background: ${bg.appBackground || bg['bg-primary']};">
              <span class="theme-preset-bar" style="background: ${accent.primary};"></span>
              <span class="theme-preset-card" style="background: ${bg['bg-card']}; border-color: ${bg['border']};"></span>
            </span>
            <span class="theme-preset-label">${preset.label}</span>
          </button>
        `;
      }).join('');

      presetBox.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset));
      });
    }

    this.syncUI();
  }

  // 同步高亮状态
  syncUI() {
    const matched = this.matchedPreset();

    document.querySelectorAll('[data-accent]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.accent === this.state.theme_accent);
    });

    document.querySelectorAll('[data-background]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.background === this.state.theme_background);
    });

    document.querySelectorAll('[data-radius]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.radius === this.state.theme_radius);
    });

    document.querySelectorAll('[data-density]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.density === this.state.theme_density);
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === matched);
    });

    // 同步色谱选择器
    const colorPicker = document.getElementById('custom-accent-picker');
    if (colorPicker && this.state.custom_accent) {
      colorPicker.value = this.state.custom_accent;
    }
    const startPicker = document.getElementById('custom-background-start');
    const endPicker = document.getElementById('custom-background-end');
    if (startPicker) startPicker.value = this.state.custom_background_start;
    if (endPicker) endPicker.value = this.state.custom_background_end;
    const backgroundPicker = document.querySelector('.custom-background-picker');
    if (backgroundPicker) backgroundPicker.classList.toggle('active', this.state.theme_background === 'custom');
  }

  // 辅助方法：HEX 转 RGB 字符串
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
  }

  // 辅助方法：HEX 转 HSL
  hexToHsl(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // 辅助方法：调整颜色亮度
  adjustBrightness(hex, amount) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;

    const adjust = (value) => {
      const num = parseInt(value, 16);
      const adjusted = Math.max(0, Math.min(255, num + amount));
      return adjusted.toString(16).padStart(2, '0');
    };

    return `#${adjust(result[1])}${adjust(result[2])}${adjust(result[3])}`;
  }
}

window.theme = new ThemeManager();
