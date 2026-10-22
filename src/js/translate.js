class Translator {
  constructor() {
    this.timer = null;
    this.requestId = 0;
    this.lastResult = '';
    this.lastDirection = '';
    this.bound = false;
  }

  activate() {
    if (!this.bound) this.bind();
  }

  bind() {
    this.bound = true;
    const localCredentials = api.usesLocalTranslationCredentials === true;
    const config = document.getElementById('translate-config');
    if (config) config.hidden = localCredentials;
    const input = document.getElementById('translate-input');
    const appId = document.getElementById('translate-app-id');
    const key = document.getElementById('translate-api-key');
    const clear = document.getElementById('translate-clear');
    const copy = document.getElementById('translate-copy');
    const speak = document.getElementById('translate-speak');
    input.addEventListener('input', () => this.schedule());
    if (!localCredentials) {
      appId.addEventListener('change', () => this.schedule());
      key.addEventListener('change', () => this.schedule());
    }
    clear.addEventListener('click', () => {
      input.value = '';
      this.schedule();
      input.focus();
    });
    copy.addEventListener('click', async () => {
      if (!this.lastResult) return;
      try {
        await navigator.clipboard.writeText(this.lastResult);
        this.status('已复制');
      } catch {
        this.status('复制失败，请手动选择结果');
      }
    });
    speak.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        this.status('当前设备不支持英文朗读');
        return;
      }
      const english = this.lastDirection === 'ZH→EN' ? this.lastResult : input.value.trim();
      if (!english) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(english);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    });
  }

  status(message) {
    document.getElementById('translate-status').textContent = message;
  }

  schedule() {
    clearTimeout(this.timer);
    const id = ++this.requestId;
    const input = document.getElementById('translate-input').value.trim();
    const output = document.getElementById('translate-output');
    const speak = document.getElementById('translate-speak');
    this.lastResult = '';
    document.getElementById('translate-copy').disabled = true;
    speak.hidden = true;
    if (!input) {
      output.textContent = '翻译结果会显示在这里';
      this.status('等待输入');
      document.getElementById('translate-direction').textContent = '自动识别中英文';
      return;
    }
    const chinese = /[\u3400-\u9fff]/.test(input);
    this.lastDirection = chinese ? 'ZH→EN' : 'EN→ZH';
    document.getElementById('translate-direction').textContent = this.lastDirection;
    this.status('准备翻译…');
    this.timer = setTimeout(() => this.translate(input, chinese ? 'EN-US' : 'ZH', id), 1200);
  }

  async translate(text, targetLang, id) {
    const localCredentials = api.usesLocalTranslationCredentials === true;
    const appId = document.getElementById('translate-app-id').value.trim();
    const key = document.getElementById('translate-api-key').value.trim();
    if (!localCredentials && (!appId || !key)) {
      this.status('请先输入百度翻译 APP ID 和配套密钥');
      return;
    }
    this.status('翻译中…');
    try {
      const payload = {
        text,
        target_lang: targetLang === 'ZH' ? 'zh' : 'en'
      };
      if (!localCredentials) {
        payload.app_id = appId;
        payload.api_key = key;
      }
      const result = await api.translateText(payload);
      if (id !== this.requestId) return;
      this.lastResult = result.text || '';
      document.getElementById('translate-output').textContent = this.lastResult || '没有收到翻译结果';
      document.getElementById('translate-copy').disabled = !this.lastResult;
      document.getElementById('translate-speak').hidden = !this.lastResult || !('speechSynthesis' in window);
      this.status(this.lastResult ? '翻译完成' : '没有收到翻译结果');
    } catch (error) {
      if (id !== this.requestId) return;
      document.getElementById('translate-output').textContent = '暂时无法翻译';
      this.status(error.message || '请求失败，请检查网络或更换 API');
    }
  }
}

window.translator = new Translator();
