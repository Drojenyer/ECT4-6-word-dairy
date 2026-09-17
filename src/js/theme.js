// 外观主题：主题色 / 背景色 / 界面圆角 / 预设样式
// 所有颜色都通过覆盖 :root 上的 CSS 变量生效，无需改动各页面的样式表。

const THEME_ACCENTS = {
  blue:   { label: '经典蓝', primary: '#0f6cbd', dark: '#0b5394', bright: '#4a9ee0', light: '#e8f1fa', rgb: '15, 108, 189' },
  teal:   { label: '青碧',   primary: '#0f8b8d', dark: '#0b6b6d', bright: '#45b6b8', light: '#e4f4f4', rgb: '15, 139, 141' },
  green:  { label: '松绿',   primary: '#1a7f52', dark: '#136040', bright: '#47b380', light: '#e7f4ee', rgb: '26, 127, 82' },
  purple: { label: '罗兰紫', primary: '#7a4fd6', dark: '#5f3aae', bright: '#a583e8', light: '#f0eafc', rgb: '122, 79, 214' },
  rose:   { label: '玫红',   primary: '#d1477d', dark: '#a83463', bright: '#ec7ba6', light: '#fcebf2', rgb: '209, 71, 125' },
  orange: { label: '暖橙',   primary: '#d97a1f', dark: '#ab5f14', bright: '#ef9f4e', light: '#fdf1e4', rgb: '217, 122, 31' },
  slate:  { label: '素雅灰', primary: '#55657a', dark: '#414e5f', bright: '#8296ad', light: '#eef1f5', rgb: '85, 101, 122' }
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
  classic: { label: '简约蓝', accent: 'blue',   background: 'gray', radius: 'standard' },
  fresh:   { label: '清新绿', accent: 'teal',   background: 'eye',  radius: 'round' },
  warm:    { label: '暖阳橙', accent: 'orange', background: 'warm', radius: 'standard' },
  elegant: { label: '素雅灰', accent: 'slate',  background: 'snow', radius: 'compact' },
  night:   { label: '暗夜深色', accent: 'blue', background: 'dark', radius: 'standard' }
};

const DEFAULT_THEME = {
  theme_accent: 'blue',
  theme_background: 'gray',
  theme_radius: 'standard',
  theme_density: 'standard'
};

class ThemeManager {
  constructor() {
    this.state = Object.assign({}, DEFAULT_THEME);
  }

  // 从设置对象读取并应用主题
  applyFromSettings(settings) {
    const source = settings || {};
    this.state = {
      theme_accent: THEME_ACCENTS[source.theme_accent] ? source.theme_accent : DEFAULT_THEME.theme_accent,
      theme_background: THEME_BACKGROUNDS[source.theme_background]
        ? source.theme_background
        : DEFAULT_THEME.theme_background,
      theme_radius: THEME_RADII[source.theme_radius] ? source.theme_radius : DEFAULT_THEME.theme_radius,
      theme_density: THEME_DENSITIES[source.theme_density]
        ? source.theme_density
        : DEFAULT_THEME.theme_density
    };

    this.apply();
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

  apply() {
    const accent = THEME_ACCENTS[this.state.theme_accent] || THEME_ACCENTS.blue;
    const bg = THEME_BACKGROUNDS[this.state.theme_background] || THEME_BACKGROUNDS.gray;
    const radius = THEME_RADII[this.state.theme_radius] || THEME_RADII.standard;
    const isDark = bg.scheme === 'dark';
    const root = document.documentElement;
    const set = (name, value) => root.style.setProperty(name, value);

    // 主题色。--primary-dark 用于实心背景（配白字），两种模式下都保持较深的色调
    set('--primary', accent.primary);
    set('--primary-dark', accent.dark);
    set('--primary-light', isDark ? `rgba(${accent.rgb}, 0.18)` : accent.light);
    set('--primary-text', isDark ? accent.bright : accent.dark);
    set('--primary-grad-start', accent.bright);
    set('--primary-soft', `rgba(${accent.rgb}, ${isDark ? 0.14 : 0.07})`);
    set('--info', accent.primary);
    set('--info-dark', accent.dark);
    set('--info-light', isDark ? `rgba(${accent.rgb}, 0.18)` : accent.light);
    set('--secondary', isDark ? '#a8b0ba' : '#475467');

    // 状态色：深色模式下换成半透明底 + 更亮的前景
    const status = THEME_STATUS_COLORS[isDark ? 'dark' : 'light'];
    Object.keys(status).forEach(key => set(`--${key}`, status[key]));

    // 背景与文字
    Object.keys(bg).forEach(key => {
      if (key === 'label' || key === 'scheme') {
        return;
      }
      set(`--${key}`, bg[key]);
    });

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

    if (bgBox) {
      bgBox.innerHTML = Object.keys(THEME_BACKGROUNDS).map(key => {
        const bg = THEME_BACKGROUNDS[key];
        return `
          <button class="theme-swatch" data-background="${key}" title="${bg.label}">
            <span class="theme-swatch-dot theme-swatch-square"
                  style="background: ${bg['bg-primary']}; border-color: ${bg['border']};">
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
            <span class="theme-preset-preview" style="background: ${bg['bg-primary']};">
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
  }
}

window.theme = new ThemeManager();
