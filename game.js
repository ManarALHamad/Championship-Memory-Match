/* Championship Memory Match
   1) Put your logo and card images in the assets folder.
   2) Edit LOGO_SRC and CARDS below so the paths match your file names.
   If an image is missing, the card shows an emoji so the game still works. */

(() => {
  'use strict';

  // ---------- CONFIG: edit these paths ----------
  const LOGO_SRC = 'assets/logo.png';
  const GAME_MUSIC_SRC = 'sounds/balad-ayni.mp4';

  const CARDS = [
    { name: 'Saheel',                  img: 'assets/saheel.png',    emoji: '🐴' },
    { name: 'Water bottle',            img: 'assets/water.png',     emoji: '💧' },
    { name: 'Bahrain pin',             img: 'assets/pin.png',       emoji: '📍' },
    { name: 'BPC emblem',              img: 'assets/bpclogo.png',   emoji: '🔥' },
    { name: 'World Para Powerlifting', img: 'assets/WORLD.png',     emoji: '🏋️' },
    { name: 'Bahrain branding',        img: 'assets/branding.png', emoji: '🇧🇭' }
  ];
  // ----------------------------------------------

  const PAIRS = CARDS.length;
  const MISMATCH_DELAY = 700;
  const BEST_KEY = 'championshipMemoryMatch.best';
  const gameMusic = new Audio(GAME_MUSIC_SRC);
  gameMusic.loop = true;
  gameMusic.volume = 0.2;

  const board = document.getElementById('board');
  const timeEl = document.getElementById('time');
  const attemptsEl = document.getElementById('attempts');
  const pairsEl = document.getElementById('pairs');
  const bestEl = document.getElementById('best');
  const modal = document.getElementById('winModal');
  const finalScoreEl = document.getElementById('finalScore');
  const finalTimeEl = document.getElementById('finalTime');
  const finalAttemptsEl = document.getElementById('finalAttempts');
  const newBestEl = document.getElementById('newBest');

  let firstCard = null;
  let secondCard = null;
  let locked = false;
  let attempts = 0;
  let matched = 0;
  let startTime = null;
  let timerId = null;
  let elapsed = 0;
  let musicGeneration = 0;
  let musicRequested = false;

  function playMusicFromMiddle() {
    musicRequested = true;
    const generation = musicGeneration;
    const start = () => {
      if (!musicRequested || generation !== musicGeneration) return;
      gameMusic.currentTime = gameMusic.duration / 2;
      gameMusic.play().catch(() => {});
    };

    if (gameMusic.readyState >= 1) {
      start();
    } else {
      gameMusic.addEventListener('loadedmetadata', start, { once: true });
    }
  }

  function stopMusic() {
    musicRequested = false;
    musicGeneration++;
    gameMusic.pause();
  }

  // Logo setup, with fallbacks if the file is missing
  const logo = document.getElementById('logo');
  const winLogo = document.getElementById('winLogo');
  logo.src = LOGO_SRC;
  winLogo.src = LOGO_SRC;
  logo.addEventListener('error', () => { logo.style.display = 'none'; });
  winLogo.addEventListener('error', () => { winLogo.style.display = 'none'; });

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTime(seconds) {
    return seconds.toFixed(1) + 's';
  }

  // Score rewards speed and few attempts. A perfect game uses one attempt per pair.
  function calcScore(seconds, tries) {
    const extraTries = Math.max(0, tries - PAIRS);
    return Math.max(0, Math.round(1000 - seconds * 8 - extraTries * 25));
  }

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveBest(result) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(result));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function showBest() {
    const best = loadBest();
    bestEl.textContent = best ? String(best.score) : '–';
  }

  function buildFront(card) {
    const front = document.createElement('span');
    front.className = 'face front';

    const img = new Image();
    img.alt = card.name;
    img.src = card.img;
    img.addEventListener('error', () => {
      img.remove();
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = card.emoji;
      front.prepend(emoji);
    });

    const caption = document.createElement('span');
    caption.className = 'caption';
    caption.textContent = card.name;

    front.append(img, caption);
    return front;
  }

  function buildBack() {
    const back = document.createElement('span');
    back.className = 'face back';
    const img = new Image();
    img.alt = '';
    img.src = LOGO_SRC;
    img.addEventListener('error', () => {
      img.remove();
      const text = document.createElement('span');
      text.className = 'back-fallback';
      text.textContent = 'CHAMP';
      back.append(text);
    });
    back.append(img);
    return back;
  }

  function buildCard(card, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card';
    btn.dataset.name = card.name;
    btn.setAttribute('aria-label', 'Card ' + (index + 1) + ', face down');

    const inner = document.createElement('span');
    inner.className = 'card-inner';
    inner.append(buildBack(), buildFront(card));
    btn.append(inner);

    btn.addEventListener('click', () => flip(btn));
    return btn;
  }

  function startTimer() {
    startTime = performance.now();
    timerId = setInterval(() => {
      elapsed = (performance.now() - startTime) / 1000;
      timeEl.textContent = formatTime(elapsed);
    }, 100);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    if (startTime !== null) {
      elapsed = (performance.now() - startTime) / 1000;
      timeEl.textContent = formatTime(elapsed);
    }
  }

  function flip(cardEl) {
    if (locked) return;
    if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

    if (startTime === null) {
      startTimer();
      playMusicFromMiddle();
    }

    cardEl.classList.add('flipped');
    cardEl.setAttribute('aria-label', cardEl.dataset.name + ', face up');

    if (!firstCard) {
      firstCard = cardEl;
      return;
    }

    secondCard = cardEl;
    attempts++;
    attemptsEl.textContent = attempts;

    if (firstCard.dataset.name === secondCard.dataset.name) {
      handleMatch();
    } else {
      handleMiss();
    }
  }

  function handleMatch() {
    [firstCard, secondCard].forEach((c) => {
      c.classList.remove('flipped');
      c.classList.add('matched');
      c.disabled = true;
      c.setAttribute('aria-label', c.dataset.name + ', matched');
    });
    matched++;
    pairsEl.textContent = matched + '/' + PAIRS;
    firstCard = null;
    secondCard = null;

    if (matched === PAIRS) finishGame();
  }

  function handleMiss() {
    locked = true;
    const a = firstCard;
    const b = secondCard;
    a.classList.add('miss');
    b.classList.add('miss');
    setTimeout(() => {
      [a, b].forEach((c) => {
        c.classList.remove('flipped', 'miss');
        c.setAttribute('aria-label', 'Card face down');
      });
      firstCard = null;
      secondCard = null;
      locked = false;
    }, MISMATCH_DELAY);
  }

  function finishGame() {
    stopTimer();
    stopMusic();
    const score = calcScore(elapsed, attempts);
    const best = loadBest();
    const isNewBest = !best || score > best.score;

    if (isNewBest) {
      saveBest({ score, time: elapsed, attempts });
    }

    finalScoreEl.textContent = score;
    finalTimeEl.textContent = formatTime(elapsed);
    finalAttemptsEl.textContent = attempts;
    newBestEl.hidden = !isNewBest;
    showBest();

    setTimeout(() => {
      modal.hidden = false;
      document.getElementById('playAgain').focus();
    }, 600);
  }

  function newGame() {
    stopTimer();
    stopMusic();
    startTime = null;
    elapsed = 0;
    firstCard = null;
    secondCard = null;
    locked = false;
    attempts = 0;
    matched = 0;

    timeEl.textContent = '0.0s';
    attemptsEl.textContent = '0';
    pairsEl.textContent = '0/' + PAIRS;
    modal.hidden = true;
    showBest();

    const deck = shuffle(CARDS.concat(CARDS));
    board.replaceChildren(...deck.map(buildCard));
  }

  document.getElementById('restart').addEventListener('click', newGame);
  document.getElementById('playAgain').addEventListener('click', newGame);

  newGame();
})();
