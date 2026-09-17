class Quiz {
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.correctAnswers = 0;
    this.wrongAnswers = 0;
    this.quizMode = 'word_to_translation';
    this.settings = {};
    this.currentWord = null;
    this.isFlipped = false;
    this.isAnswered = false;
    this.reviewMode = false;
    this.spellingEnabled = true;
    this.spellingHints = 0;
  }

  // 开始一局全新的测验
  async startQuiz(mode, settings) {
    this.quizMode = mode;
    this.settings = settings || {};
    this.spellingEnabled = this.settings.high_freq_spelling !== false;
    this.currentIndex = 0;
    this.correctAnswers = 0;
    this.wrongAnswers = 0;
    this.reviewMode = false;

    await this.loadVocabulary();
    this.words = this.applySpellingQuota(await this.enrichWords(this.words));
    this.updateModeBadge();
    await this.saveSession();
    this.renderQuiz();
  }

  // 继续上次未完成的进度
  async resumeSession(session, settings) {
    this.quizMode = session.mode || 'word_to_translation';
    this.settings = settings || {};
    this.spellingEnabled = this.settings.high_freq_spelling !== false;
    this.currentIndex = session.index || 0;
    this.correctAnswers = session.correct || 0;
    this.wrongAnswers = session.wrong || 0;
    this.reviewMode = false;

    // 会话里存的词可能来自旧版本（没有音标/高频标记），恢复时重新补一次。
    // 默写配额是按频次挑选的，重复执行结果一致，不会改变已定的题目类型。
    this.words = this.applySpellingQuota(await this.enrichWords(session.words || []));

    this.updateModeBadge();
    this.renderQuiz();
  }

  // 错词测试：题目全部来自错题本，答对推进艾宾浩斯阶段
  async startWrongQuiz(mode, settings) {
    this.quizMode = mode;
    this.settings = settings || {};
    this.spellingEnabled = this.settings.high_freq_spelling !== false;
    this.currentIndex = 0;
    this.correctAnswers = 0;
    this.wrongAnswers = 0;
    this.reviewMode = true;

    const stats = await api.getStats();
    const all = (stats.wrong_words || []).filter(item => item.word);
    const due = all.filter(item => this.isReviewDue(item));

    // 有到期的错词时只复习到期的，否则把全部错词过一遍
    this.words = this.shuffleArray(await this.enrichWords(due.length > 0 ? due : all));
    this.updateModeBadge();

    if (this.words.length === 0) {
      document.getElementById('learn-area').innerHTML = `
        <div class="loading-state">
          <p>错题本还是空的，先去学习几道题吧。</p>
          <button class="btn btn-secondary" onclick="ui.navigateTo('mistakes')">返回错题本</button>
        </div>
      `;
      return;
    }

    this.renderQuiz();
  }

  // 给题目补上音标；开启默写时再补上高频标记（真题累计出现次数）
  async enrichWords(words) {
    if (!words.length) {
      return words;
    }

    const phoneticMap = await this.safePhoneticMap();
    const freqMap = await this.safeHighFreqMap();

    return words.map(item => {
      const key = String(item.word).trim().toLowerCase();
      return Object.assign({}, item, {
        phonetic: phoneticMap[key] || item.phonetic || '',
        highFreq: freqMap[key] || 0
      });
    });
  }

  // 词表读不到时降级：不给音标
  async safePhoneticMap() {
    try {
      return await api.getPhoneticMap();
    } catch (error) {
      console.error('加载音标表失败:', error);
      return {};
    }
  }

  // 词表读不到时降级：不走默写
  async safeHighFreqMap() {
    if (!this.spellingEnabled) {
      return {};
    }

    try {
      return await api.getHighFreqMap();
    } catch (error) {
      console.error('加载高频词表失败，本次跳过默写模式:', error);
      return {};
    }
  }

  // 音标统一用斜杠包裹显示；词表里查不到这个单词时不显示
  phoneticHtml(item) {
    const text = item && item.phonetic ? String(item.phonetic).trim() : '';
    return text ? `<span class="phonetic">/${text}/</span>` : '';
  }

  /**
   * 日常学习里不该全被默写占满，每局只挑约 1/3 的题目改默写，
   * 挑选顺序按真题频次从高到低 —— 最高频的词最值得动笔。
   * 错词复习不走这个配额，高频错词全数默写。
   */
  applySpellingQuota(words) {
    if (!this.spellingEnabled) {
      return words;
    }

    const quota = Math.max(1, Math.ceil(words.length / 3));
    const picked = new Set(
      words
        .filter(item => item.highFreq)
        .sort((a, b) => b.highFreq - a.highFreq)
        .slice(0, quota)
        .map(item => item.word)
    );

    return words.map(item => Object.assign({}, item, { spelling: picked.has(item.word) }));
  }

  // 本题是否走「见中写英」默写
  isSpellingQuestion() {
    if (!this.spellingEnabled || !this.currentWord) {
      return false;
    }

    // 错词复习：高频错词一律默写
    if (this.reviewMode) {
      return Boolean(this.currentWord.highFreq);
    }

    // 日常学习：只有被配额挑中的词才默写
    return Boolean(this.currentWord.spelling);
  }

  // 是否到了该复习的日期
  isReviewDue(item) {
    if (item.graduated) {
      return false;
    }
    return !item.next_review || item.next_review <= this.todayKey();
  }

  todayKey() {
    return new Date().toISOString().split('T')[0];
  }

  // 把当前进度写入本地数据，关闭软件后可继续
  async saveSession() {
    // 错词测试属于临时复习，不覆盖日常学习进度
    if (this.reviewMode) {
      return;
    }

    if (!this.words.length || this.currentIndex >= this.words.length) {
      return;
    }

    try {
      await api.saveSession({
        date: this.todayKey(),
        mode: this.quizMode,
        words: this.words,
        index: this.currentIndex,
        correct: this.correctAnswers,
        wrong: this.wrongAnswers
      });
    } catch (error) {
      console.error('保存学习进度失败:', error);
    }
  }

  async loadVocabulary() {
    try {
      let allWords = [];
      const source = this.settings.vocab_source || 'all';

      if (source === 'all' || source === 'cet4') {
        const cet4Data = await api.getCET4Vocab();
        allWords = allWords.concat(cet4Data);
      }

      if (source === 'all' || source === 'cet6') {
        const cet6Data = await api.getCET6Vocab();
        allWords = allWords.concat(cet6Data);
      }

      const stats = await api.getStats();
      const masteredWords = new Set(stats.mastered_words || []);

      let filteredWords = allWords;

      if (this.settings.exclude_mastered !== false) {
        filteredWords = allWords.filter(word => !masteredWords.has(word.word));
      }

      if (filteredWords.length === 0) {
        filteredWords = allWords;
      }

      const desiredCount = Number(this.settings.daily_count) || 100;
      const quizCount = Math.min(Math.max(10, desiredCount), filteredWords.length);
      this.words = this.shuffleArray(filteredWords).slice(0, quizCount);
    } catch (error) {
      console.error('加载词汇失败:', error);
      throw error;
    }
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  updateModeBadge() {
    const modeBadge = document.getElementById('mode-badge');
    const modeNames = {
      'word_to_translation': '看词选义',
      'translation_to_word': '看义选词',
      'flashcard': '词卡浏览'
    };

    if (this.isSpellingQuestion()) {
      modeBadge.textContent = this.reviewMode ? '错词复习 · 高频默写' : '高频默写 · 见中写英';
      return;
    }

    const modeName = modeNames[this.quizMode] || this.quizMode;
    modeBadge.textContent = this.reviewMode ? `错词复习 · ${modeName}` : modeName;
  }

  renderQuiz() {
    if (this.currentIndex >= this.words.length) {
      this.renderResult();
      return;
    }

    this.currentWord = this.words[this.currentIndex];
    this.isFlipped = false;
    this.isAnswered = false;
    this.spellingHints = 0;
    this.updateProgress();
    this.updateModeBadge();

    const learnArea = document.getElementById('learn-area');

    if (this.isSpellingQuestion()) {
      learnArea.innerHTML = this.renderSpelling();
      this.setupSpellingEvents();
    } else if (this.quizMode === 'flashcard') {
      learnArea.innerHTML = this.renderFlashcard();
      this.setupFlashcardEvents();
    } else {
      learnArea.innerHTML = this.renderMultipleChoice();
      this.setupMultipleChoiceEvents();
    }
  }

  updateProgress() {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    progressText.textContent = `${this.currentIndex + 1}/${this.words.length}`;
    const progressPercent = ((this.currentIndex) / this.words.length) * 100;
    progressFill.style.width = `${progressPercent}%`;
  }

  // 作答后把进度条推进到当前题
  updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = `${((this.currentIndex + 1) / this.words.length) * 100}%`;
    }
  }

  /* ---------- 高频词默写（见中写英） ---------- */

  renderSpelling() {
    const word = this.currentWord;
    const phonetic = this.phoneticHtml(word);
    // 中文释义常有一词多义，音标用来确认考的是哪个词
    const phoneticLine = phonetic ? `<div class="spelling-phonetic">${phonetic}</div>` : '';

    return `
      <div class="spelling-container">
        <div class="quiz-question">
          <div class="spelling-badge">🔥 高频词 · 真题出现 ${word.highFreq} 次</div>
          <div class="spelling-translation">${word.translation}</div>
          ${phoneticLine}
          <div class="question-hint">请根据释义和音标写出英文单词</div>
        </div>

        <div class="spelling-slots" id="spelling-slots"></div>

        <input class="spelling-input" id="spelling-input" type="text"
               autocomplete="off" autocorrect="off" autocapitalize="off"
               spellcheck="false" placeholder="输入英文单词后按回车">

        <div class="spelling-feedback hidden" id="spelling-feedback"></div>

        <div class="spelling-actions">
          <button class="forgot-btn" id="btn-spelling-hint">
            <span>💡</span>
            <span>提示字母</span>
          </button>
          <button class="btn btn-primary" id="btn-spelling-submit">提交</button>
          <button class="forgot-btn" id="btn-spelling-give-up">
            <span>🤔</span>
            <span>我忘记了</span>
          </button>
        </div>

        <div class="definition-panel hidden" id="definition-panel"></div>
      </div>
    `;
  }

  // 首字母默认给出，其余留空占位；提示按钮每点一次再多露一个字母
  renderSpellingSlots() {
    const slots = document.getElementById('spelling-slots');
    if (!slots) {
      return;
    }

    const revealedCount = this.spellingHints + 1;

    slots.innerHTML = this.currentWord.word.split('').map((char, index) => {
      const isLetter = /[a-z]/i.test(char);
      const revealed = !isLetter || index < revealedCount;
      return `<span class="spelling-slot${revealed && isLetter ? ' revealed' : ''}">${revealed ? char : ''}</span>`;
    }).join('');
  }

  setupSpellingEvents() {
    const input = document.getElementById('spelling-input');
    this.renderSpellingSlots();

    input.addEventListener('keydown', (event) => {
      // 中文输入法组词期间的回车不算提交
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        this.handleSpellingSubmit();
      }
    });

    document.getElementById('btn-spelling-submit')
      .addEventListener('click', () => this.handleSpellingSubmit());
    document.getElementById('btn-spelling-hint')
      .addEventListener('click', () => this.revealSpellingHint());
    document.getElementById('btn-spelling-give-up')
      .addEventListener('click', () => this.handleSpellingGiveUp());

    input.focus();
  }

  // 每点一次提示多露出一个字母（首字母已默认给出，至少留一个字母自己写）
  revealSpellingHint() {
    if (this.isAnswered) {
      return;
    }

    const maxHints = Math.max(0, this.currentWord.word.length - 2);
    if (this.spellingHints >= maxHints) {
      this.showSpellingFeedback('没有更多字母可以提示了，凭记忆写出剩下的部分吧', 'info');
      return;
    }

    this.spellingHints++;
    this.renderSpellingSlots();

    const hintBtn = document.getElementById('btn-spelling-hint');
    if (hintBtn) {
      hintBtn.innerHTML = `<span>💡</span><span>提示字母（已提示 ${this.spellingHints} 个）</span>`;
    }

    const input = document.getElementById('spelling-input');
    if (input) {
      input.focus();
    }
  }

  showSpellingFeedback(message, type) {
    const box = document.getElementById('spelling-feedback');
    if (!box) {
      return;
    }

    box.className = `spelling-feedback feedback-${type}`;
    box.textContent = message;
  }

  async handleSpellingSubmit() {
    if (this.isAnswered) {
      return;
    }

    const input = document.getElementById('spelling-input');
    const answer = (input.value || '').trim().toLowerCase();

    if (!answer) {
      this.showSpellingFeedback('请先输入单词再提交', 'info');
      input.focus();
      return;
    }

    if (answer === this.currentWord.word.trim().toLowerCase()) {
      await this.handleSpellingCorrect();
    } else {
      await this.handleSpellingWrong(`拼写有误，正确拼写是 ${this.currentWord.word}`);
    }
  }

  async handleSpellingCorrect() {
    this.isAnswered = true;

    const usedHint = this.spellingHints > 0;
    this.correctAnswers++;
    await this.applyAnswerResult(true, usedHint);

    this.showSpellingFeedback(
      usedHint
        ? `✓ 拼写正确，不过借助了 ${this.spellingHints} 个字母提示，这次不算真正掌握，很快会再考你一次`
        : '✓ 拼写正确',
      usedHint ? 'info' : 'correct'
    );
    this.lockAnswerControls();
    this.updateProgressBar();

    setTimeout(() => this.advanceToNext(), usedHint ? 1700 : 900);
  }

  async handleSpellingWrong(message) {
    this.isAnswered = true;

    this.wrongAnswers++;
    await this.applyAnswerResult(false);

    this.showSpellingFeedback(message, 'wrong');
    this.lockAnswerControls();
    this.updateProgressBar();
    this.showDefinition();
  }

  async handleSpellingGiveUp() {
    if (this.isAnswered) {
      return;
    }

    await this.handleSpellingWrong(`没关系，正确拼写是 ${this.currentWord.word}`);
  }

  renderFlashcard() {
    const word = this.currentWord;
    const phrasesHtml = word.phrases && word.phrases.length > 0
      ? `<div class="phrases-section">
          <div class="phrases-title">词组例句：</div>
          <div class="phrases-list">
            ${word.phrases.slice(0, 4).map(phrase =>
              `<div class="phrase-item">${phrase.phrase} — ${phrase.translation}</div>`
            ).join('')}
          </div>
        </div>`
      : '';

    return `
      <div class="flashcard-container">
        <div class="flashcard" id="flashcard">
          <div class="flashcard-inner" id="flashcard-inner">
            <div class="flashcard-front">
              <div class="word-level">(${word.level})</div>
              <div class="word-main">${word.word}${this.phoneticHtml(word)}</div>
              <div class="flashcard-hint">
                <span class="flashcard-hint-icon">👆</span>
                <span>点击卡片查看释义</span>
              </div>
            </div>
            <div class="flashcard-back">
              <div class="word-main" style="color: var(--primary);">${word.word}${this.phoneticHtml(word)}</div>
              <div class="translation-main">${word.translation}</div>
              ${phrasesHtml}
            </div>
          </div>
        </div>
        <div class="flashcard-actions" id="flashcard-actions" style="display: none;">
          <button class="action-btn known" id="btn-known">
            <span>✅</span>
            <span>认识</span>
          </button>
          <button class="action-btn unknown" id="btn-unknown">
            <span>❌</span>
            <span>不认识</span>
          </button>
        </div>
      </div>
    `;
  }

  setupFlashcardEvents() {
    const flashcard = document.getElementById('flashcard');
    const flashcardInner = document.getElementById('flashcard-inner');
    const flashcardActions = document.getElementById('flashcard-actions');

    flashcard.addEventListener('click', () => {
      if (!this.isFlipped) {
        this.flipCard();
      }
    });

    flashcard.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!this.isFlipped) {
          this.flipCard();
        }
      }
    });

    document.getElementById('btn-known').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleFlashcardAnswer(true);
    });

    document.getElementById('btn-unknown').addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleFlashcardAnswer(false);
    });

    flashcard.tabIndex = 0;
    flashcard.focus();
  }

  flipCard() {
    const flashcard = document.getElementById('flashcard');
    const flashcardActions = document.getElementById('flashcard-actions');

    flashcard.classList.add('flipped');
    flashcardActions.style.display = 'flex';
    this.isFlipped = true;

    const btnUnknown = document.getElementById('btn-unknown');
    btnUnknown.focus();
  }

  async handleFlashcardAnswer(known) {
    if (known) {
      this.correctAnswers++;
    } else {
      this.wrongAnswers++;
    }

    await this.applyAnswerResult(known);

    setTimeout(() => {
      this.advanceToNext();
    }, 300);
  }

  /**
   * 记录一次作答的结果。
   * 普通测验：答对加入已掌握、答错加入错题本；
   * 错词测试：只更新该词的艾宾浩斯复习阶段。
   * hinted 表示借助了字母提示 —— 默写靠提示拼出来的词不算真正掌握，
   * 既不标记为已掌握、也不推进复习阶段，之后还会再考一次。
   */
  async applyAnswerResult(isCorrect, hinted) {
    if (this.reviewMode) {
      try {
        await api.reviewWrongWord(this.currentWord.word, isCorrect, hinted);
      } catch (error) {
        console.error('更新复习计划失败:', error);
      }
      return;
    }

    if (!isCorrect) {
      await this.addToWrongWords();
    } else if (!hinted) {
      await this.markAsMastered();
    }
  }

  // 进入下一题，并同步保存进度
  advanceToNext() {
    this.currentIndex++;
    this.saveSession();
    this.renderQuiz();
  }

  renderMultipleChoice() {
    const word = this.currentWord;
    const options = this.generateOptions();

    let questionHtml = '';
    let optionsHtml = '';

    if (this.quizMode === 'word_to_translation') {
      questionHtml = `
        <div class="quiz-question">
          <div class="question-text">${word.word}${this.phoneticHtml(word)}</div>
          <div class="question-hint">请选择正确的中文释义</div>
        </div>
      `;

      optionsHtml = options.map((option, index) => `
        <button class="quiz-option" data-index="${index}" data-correct="${option.isCorrect}">
          <span class="option-label">${option.label}</span>
          <span class="option-text">${option.text}</span>
        </button>
      `).join('');
    } else {
      questionHtml = `
        <div class="quiz-question">
          <div class="question-text">${word.translation}</div>
          <div class="question-hint">请选择对应的英文单词</div>
        </div>
      `;

      optionsHtml = options.map((option, index) => `
        <button class="quiz-option" data-index="${index}" data-correct="${option.isCorrect}">
          <span class="option-label">${option.label}</span>
          <span class="option-text">${option.word}${this.phoneticHtml(option)}</span>
        </button>
      `).join('');
    }

    return `
      <div class="quiz-container">
        ${questionHtml}
        <div class="quiz-options">
          ${optionsHtml}
        </div>
        <div class="quiz-footer">
          <button class="forgot-btn" id="btn-forgot">
            <span>🤔</span>
            <span>我忘记了</span>
          </button>
        </div>
        <div class="definition-panel hidden" id="definition-panel"></div>
      </div>
    `;
  }

  generateOptions() {
    const word = this.currentWord;
    const distractors = this.getDistractors(word, 3);

    let options = [];
    if (this.quizMode === 'word_to_translation') {
      options = [
        { text: word.translation, isCorrect: true },
        ...distractors.map(d => ({ text: d.translation, isCorrect: false }))
      ];
    } else {
      // 带上音标，选项里也要显示读音
      options = [
        { word: word.word, phonetic: word.phonetic, isCorrect: true },
        ...distractors.map(d => ({ word: d.word, phonetic: d.phonetic, isCorrect: false }))
      ];
    }

    return this.shuffleArray(options).map((option, index) => ({
      ...option,
      label: String.fromCharCode(65 + index)
    }));
  }

  getDistractors(currentWord, count) {
    const sameLevel = [];
    const others = [];

    this.words.forEach(item => {
      if (item.word === currentWord.word) {
        return;
      }
      if (item.level === currentWord.level) {
        sameLevel.push(item);
      } else {
        others.push(item);
      }
    });

    // 优先用同级别的词当干扰项；同级词不够时用其他级别补齐。
    // 这里不能靠「随机重试直到凑够」——同级词不足时会永远循环下去。
    return this.shuffleArray(sameLevel).concat(this.shuffleArray(others)).slice(0, count);
  }

  setupMultipleChoiceEvents() {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        if (option.classList.contains('disabled')) return;

        const isCorrect = option.dataset.correct === 'true';
        this.handleMultipleChoiceAnswer(isCorrect, option);
      });
    });

    const forgotBtn = document.getElementById('btn-forgot');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => this.handleForgot());
    }
  }

  // 我忘记了：公布答案、展示释义并加入错题本
  async handleForgot() {
    if (this.isAnswered) {
      return;
    }
    this.isAnswered = true;

    const options = document.querySelectorAll('.quiz-option');
    options.forEach(option => {
      option.classList.add('disabled');
      if (option.dataset.correct === 'true') {
        option.classList.add('correct');
      }
    });

    this.wrongAnswers++;
    await this.applyAnswerResult(false);

    this.updateProgressBar();

    this.showDefinition();
  }

  // 展示当前词条的完整释义
  showDefinition() {
    const word = this.currentWord;
    const panel = document.getElementById('definition-panel');
    if (!panel) {
      return;
    }

    const phrasesHtml = word.phrases && word.phrases.length > 0
      ? `<div class="definition-phrases">
          <div class="phrases-title">词组例句：</div>
          ${word.phrases.slice(0, 4).map(phrase => `
            <div class="definition-phrase">
              <span class="definition-phrase-en">${phrase.phrase}</span>
              <span class="definition-phrase-zh">${phrase.translation}</span>
            </div>
          `).join('')}
        </div>`
      : '';

    panel.innerHTML = `
      <div class="definition-head">
        <span class="definition-word">${word.word}</span>
        ${this.phoneticHtml(word)}
        <span class="definition-level">${word.level}</span>
      </div>
      <div class="definition-translation">${word.translation}</div>
      ${phrasesHtml}
      <div class="definition-tip">${this.reviewMode ? '已重新安排复习时间' : '已加入错题本'}</div>
      <button class="btn btn-primary" id="btn-next-question">下一题 →</button>
    `;
    panel.classList.remove('hidden');

    this.lockAnswerControls();

    document.getElementById('btn-next-question').addEventListener('click', () => {
      this.advanceToNext();
    });
  }

  // 公布答案后锁住所有作答入口，避免重复计分
  lockAnswerControls() {
    ['btn-forgot', 'btn-spelling-hint', 'btn-spelling-submit', 'btn-spelling-give-up']
      .forEach(id => {
        const button = document.getElementById(id);
        if (button) {
          button.disabled = true;
        }
      });

    const input = document.getElementById('spelling-input');
    if (input) {
      input.disabled = true;
    }
  }

  async handleMultipleChoiceAnswer(isCorrect, selectedOption) {
    if (this.isAnswered) {
      return;
    }
    this.isAnswered = true;

    const options = document.querySelectorAll('.quiz-option');
    options.forEach(option => {
      option.classList.add('disabled');
      if (option.dataset.correct === 'true') {
        option.classList.add('correct');
      } else if (option === selectedOption && !isCorrect) {
        option.classList.add('wrong');
      }
    });

    if (isCorrect) {
      this.correctAnswers++;
    } else {
      this.wrongAnswers++;
    }

    await this.applyAnswerResult(isCorrect);

    this.updateProgressBar();

    setTimeout(() => {
      this.advanceToNext();
    }, 1500);
  }

  async markAsMastered() {
    try {
      await api.markMastered(this.currentWord.word);
    } catch (error) {
      console.error('标记已掌握失败:', error);
    }
  }

  async addToWrongWords() {
    try {
      await api.addWrongWord({
        word: this.currentWord.word,
        translation: this.currentWord.translation,
        level: this.currentWord.level,
        phrases: this.currentWord.phrases || []
      });
    } catch (error) {
      console.error('添加错题失败:', error);
    }
  }

  async renderResult() {
    try {
      await api.recordResult(this.correctAnswers, this.wrongAnswers);
      // 本局已结束，清除今日进度，下次进入重新开始（错词测试不动日常进度）
      if (!this.reviewMode) {
        await api.clearSession();
      }
    } catch (error) {
      console.error('更新统计数据失败:', error);
    }

    const accuracy = this.correctAnswers + this.wrongAnswers > 0
      ? Math.round((this.correctAnswers / (this.correctAnswers + this.wrongAnswers)) * 100)
      : 0;

    const learnArea = document.getElementById('learn-area');
    const icon = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪';
    const title = this.reviewMode ? '错词复习完成！' : '测验完成！';

    // 错词测试结束后回到错题本，方便查看新的复习计划
    const backButton = this.reviewMode
      ? `<button class="btn btn-primary btn-lg" onclick="ui.navigateTo('mistakes')">
           <span>📝</span>
           <span>返回错题本</span>
         </button>`
      : `<button class="btn btn-primary btn-lg" onclick="ui.navigateTo('home')">
           <span>🏠</span>
           <span>返回首页</span>
         </button>`;

    const retryButton = this.reviewMode
      ? `<button class="btn btn-secondary btn-lg" onclick="quiz.startWrongQuiz('${this.quizMode}', quiz.settings)">
           <span>🔄</span>
           <span>再测一轮</span>
         </button>`
      : `<button class="btn btn-secondary btn-lg" onclick="quiz.startQuiz('${this.quizMode}', quiz.settings)">
           <span>🔄</span>
           <span>再来一局</span>
         </button>`;

    learnArea.innerHTML = `
      <div class="quiz-result">
        <div class="result-icon">${icon}</div>
        <div class="result-title">${title}</div>
        <div class="result-stats">
          <div class="result-stat">
            <div class="result-stat-value">${this.correctAnswers + this.wrongAnswers}</div>
            <div class="result-stat-label">总题数</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-value text-success">${this.correctAnswers}</div>
            <div class="result-stat-label">正确</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-value text-danger">${this.wrongAnswers}</div>
            <div class="result-stat-label">错误</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-value text-primary">${accuracy}%</div>
            <div class="result-stat-label">正确率</div>
          </div>
        </div>
        ${this.reviewMode ? '<p class="result-tip">答对的词已按艾宾浩斯曲线安排下次复习时间</p>' : ''}
        <div style="margin-top: 32px;">
          ${backButton}
          ${retryButton}
        </div>
      </div>
    `;
  }
}

window.quiz = new Quiz();