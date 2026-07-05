// Application State
let allWords = [];
let filteredWords = [];
let currentIndex = 0;
let isFlipped = false;
let isShuffle = false;
let shuffleOrder = [];
let weakWords = new Set();
let currentAudio = null;

// Settings & Synchronization State
let gasUrl = localStorage.getItem('ielts_gas_url') || '';
let localWeakWordsKey = 'ielts_weak_words';
let selectedVoiceName = localStorage.getItem('ielts_selected_voice') || 'default';

// Swipe/Touch gesture detection
let touchStartX = 0;
let touchEndX = 0;

// DOM Elements
const flashcard = document.getElementById('flashcard');
const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
const levelFilter = document.getElementById('level-filter');
const wordSelect = document.getElementById('word-select');
const weakFilterBtn = document.getElementById('weak-filter-btn');
const progressIndex = document.getElementById('current-index');
const progressTotal = document.getElementById('total-count');
const progressBar = document.getElementById('progress-bar');

const cardWord = document.getElementById('card-word');
const cardPos = document.getElementById('card-pos');
const cardExampleEn = document.getElementById('card-example-en');
const cardMeaning = document.getElementById('card-meaning');
const cardSynonymContainer = document.getElementById('card-synonym-container');
const cardSynonym = document.getElementById('card-synonym');
const cardExampleJa = document.getElementById('card-example-ja');

const cardNoFront = document.getElementById('card-no-front');
const cardNoBack = document.getElementById('card-no-back');
const cardLevelFront = document.getElementById('card-level-front');
const cardLevelBack = document.getElementById('card-level-back');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const ttsBtn = document.getElementById('tts-btn');
const ttsWave = document.getElementById('tts-wave');
const weakToggleBtn = document.getElementById('weak-toggle-btn');
const shuffleBtn = document.getElementById('shuffle-btn');

// Settings Elements
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const gasUrlInput = document.getElementById('gas-url-input');
const syncStatusDot = document.getElementById('sync-status-dot');
const syncStatusText = document.getElementById('sync-status-text');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Load words master data from Google Sheet, LocalStorage Cache, or local JSON file
async function loadWordsFromSources() {
  let wordsLoaded = false;
  
  if (gasUrl) {
    try {
      console.log('Fetching vocabulary list from Google Sheet...');
      updateSyncStatus('syncing', '単語データを読み込み中...');
      
      const response = await fetch(`${gasUrl}?action=get_words&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          allWords = data;
          localStorage.setItem('ielts_cached_words', JSON.stringify(allWords));
          console.log(`Loaded ${allWords.length} words from Google Sheet.`);
          wordsLoaded = true;
          updateSyncStatus('online', 'スプレッドシートと同期完了');
        }
      }
    } catch (e) {
      console.warn('Failed to load words from Google Sheet, falling back to local cache/file.', e);
    }
  }

  if (!wordsLoaded) {
    // Try local storage cache
    const cachedWords = localStorage.getItem('ielts_cached_words');
    if (cachedWords) {
      try {
        allWords = JSON.parse(cachedWords);
        console.log(`Loaded ${allWords.length} words from Local Cache.`);
        wordsLoaded = true;
      } catch (e) {
        console.error('Failed to parse cached words', e);
      }
    }
  }

  if (!wordsLoaded) {
    try {
      const response = await fetch('./words.json');
      allWords = await response.json();
      console.log(`Loaded ${allWords.length} words from local words.json.`);
      wordsLoaded = true;
    } catch (error) {
      console.error('Failed to load words.json', error);
      cardWord.textContent = "Error loading words";
    }
  }
  populateWordSelect();
}

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
  // Load local weak words cache first
  loadLocalWeakWords();
  
  // Register Service Worker for offline use
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch((err) => console.log('Service Worker failed to register', err));
  }

  // Load words master data from best source
  await loadWordsFromSources();

  // Init Settings inputs
  gasUrlInput.value = gasUrl;
  
  // Initialize voices list
  populateVoicesList();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoicesList;
  }

  // Sync weak words with Google Sheet if URL exists
  if (gasUrl) {
    syncWithSpreadsheet();
  }

  // Initial Filter & Render
  applyFilters();
  
  // Restore last studied word position
  const lastWordNo = localStorage.getItem('ielts_last_word_no');
  if (lastWordNo) {
    const lastIdx = filteredWords.findIndex(w => w.No.toString() === lastWordNo.toString());
    if (lastIdx !== -1) {
      currentIndex = lastIdx;
      displayCurrentWord();
    }
  }
  
  setupEventListeners();
});

// Event Listeners Configuration
function setupEventListeners() {
  // Card Flip on Click
  flashcard.addEventListener('click', toggleCardFlip);
  
  // Navigation
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(-1);
  });
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(1);
  });
  
  // TTS & Play
  ttsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    speakWord();
  });
  
  // Weak Word toggle
  weakToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWeakWord();
  });
  
  // Shuffle
  shuffleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleShuffle();
  });

  // Filters inputs
  searchInput.addEventListener('input', () => {
    applyFilters();
    updateSuggestions();
  });
  searchInput.addEventListener('focus', () => {
    updateSuggestions();
  });
  levelFilter.addEventListener('change', () => {
    applyFilters();
  });
  wordSelect.addEventListener('change', () => {
    const val = wordSelect.value;
    if (val) {
      const targetWord = allWords.find(w => w.No.toString() === val.toString());
      if (targetWord) {
        jumpToWord(targetWord);
      }
    }
  });
  weakFilterBtn.addEventListener('click', () => {
    const isPressed = weakFilterBtn.getAttribute('aria-pressed') === 'true';
    weakFilterBtn.setAttribute('aria-pressed', !isPressed ? 'true' : 'false');
    applyFilters();
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
      searchSuggestions.classList.add('hidden');
    }
  });

  // Settings Panel Actions
  settingsToggleBtn.addEventListener('click', openSettings);
  settingsCloseBtn.addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });
  saveSettingsBtn.addEventListener('click', saveSettings);

  // Keyboard navigation support
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
      return; // Skip when typing in search or input fields
    }
    
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      navigate(1);
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      navigate(-1);
    } else if (e.code === 'Space') {
      e.preventDefault();
      toggleCardFlip();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      speakWord();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      toggleWeakWord();
    }
  });

  // Mobile Swipe gestures
  flashcard.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  flashcard.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
  }, { passive: true });
}

// Swipe handling
function handleSwipeGesture() {
  const swipeThreshold = 50;
  if (touchEndX < touchStartX - swipeThreshold) {
    // Swiped left -> Next word
    navigate(1);
  } else if (touchEndX > touchStartX + swipeThreshold) {
    // Swiped right -> Previous word
    navigate(-1);
  }
}

// Local caching of Weak Words
function loadLocalWeakWords() {
  const localData = localStorage.getItem(localWeakWordsKey);
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      weakWords = new Set(parsed);
    } catch (e) {
      console.error('Error parsing cached weak words', e);
      weakWords = new Set();
    }
  }
}

function saveLocalWeakWords() {
  localStorage.setItem(localWeakWordsKey, JSON.stringify(Array.from(weakWords)));
}

// Apps Script Integration: Fetch & Synchronize
async function syncWithSpreadsheet() {
  if (!gasUrl) return;
  
  updateSyncStatus('syncing', '同期中...');
  
  try {
    // Add time parameter to bypass browser caching
    const url = `${gasUrl}?action=get&t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    
    const result = await response.json();
    if (result.success && Array.isArray(result.weakWords)) {
      // Merge remote into local set
      result.weakWords.forEach(no => weakWords.add(no));
      saveLocalWeakWords();
      
      updateSyncStatus('online', 'スプレッドシートと同期完了');
      // If currently showing weak words filter, update list
      if (weakFilterBtn.getAttribute('aria-pressed') === 'true') {
        applyFilters();
      } else {
        updateActiveStates();
      }
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (err) {
    console.warn('Sync failed, running in local-only mode:', err);
    updateSyncStatus('offline', 'オフライン（ローカル保存中）');
  }
}

async function sendWeakWordUpdateToGas(action, wordNo) {
  if (!gasUrl) return;
  
  updateSyncStatus('syncing', '更新を送信中...');
  
  try {
    const url = `${gasUrl}?action=${action}&wordNo=${wordNo}&t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response not ok');
    
    const result = await response.json();
    if (result.success) {
      updateSyncStatus('online', '同期完了');
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('Sync update failed', err);
    updateSyncStatus('offline', '未同期の変更があります');
  }
}

function updateSyncStatus(status, text) {
  syncStatusDot.className = `status-dot ${status}`;
  syncStatusText.textContent = text;
}

// Navigation & Presentation
function toggleCardFlip() {
  isFlipped = !isFlipped;
  if (isFlipped) {
    flashcard.classList.add('flipped');
  } else {
    flashcard.classList.remove('flipped');
  }
}

function navigate(direction) {
  if (filteredWords.length === 0) return;
  
  // Make sure we unflip the card first
  if (isFlipped) {
    toggleCardFlip();
    // Wait for unflip transition to complete before updating content
    setTimeout(() => {
      changeIndex(direction);
    }, 200);
  } else {
    changeIndex(direction);
  }
}

function changeIndex(direction) {
  currentIndex += direction;
  
  // Infinite wrap-around
  if (currentIndex >= filteredWords.length) {
    currentIndex = 0;
  } else if (currentIndex < 0) {
    currentIndex = filteredWords.length - 1;
  }
  
  displayCurrentWord();
}

function displayCurrentWord() {
  if (filteredWords.length === 0) {
    renderEmptyState();
    return;
  }

  const wordData = filteredWords[currentIndex];
  
  // Load Card text
  cardWord.textContent = wordData.Word;
  cardPos.textContent = wordData.POS;
  cardMeaning.textContent = wordData.Meaning;
  
  // Synonym mapping
  if (wordData.Synonym) {
    cardSynonym.textContent = wordData.Synonym;
    cardSynonymContainer.style.display = 'flex';
  } else {
    cardSynonymContainer.style.display = 'none';
  }
  
  cardExampleEn.textContent = wordData.Example_EN || 'No English example sentence available.';
  cardExampleJa.textContent = wordData.Example_JA || '日本語訳はありません。';
  
  // Word Info & Badge
  const noStr = wordData.No;
  cardNoFront.textContent = noStr;
  cardNoBack.textContent = noStr;
  
  cardLevelFront.textContent = wordData.Level;
  cardLevelBack.textContent = wordData.Level;
  
  // Update Indicators & buttons
  progressIndex.textContent = currentIndex + 1;
  progressTotal.textContent = filteredWords.length;
  
  const percentage = ((currentIndex + 1) / filteredWords.length) * 100;
  progressBar.style.width = `${percentage}%`;
  
  // Update word select dropdown to match current word
  wordSelect.value = wordData.No;

  // Save current word No to localStorage for resuming later
  localStorage.setItem('ielts_last_word_no', wordData.No);

  updateActiveStates();
}

function renderEmptyState() {
  cardWord.textContent = "該当なし";
  cardPos.textContent = "";
  cardMeaning.textContent = "フィルターに該当する単語がありません。";
  cardSynonymContainer.style.display = 'none';
  cardExampleEn.textContent = "";
  cardExampleJa.textContent = "";
  cardNoFront.textContent = "0000";
  cardNoBack.textContent = "0000";
  cardLevelFront.textContent = "NONE";
  cardLevelBack.textContent = "NONE";
  
  progressIndex.textContent = "0";
  progressTotal.textContent = "0";
  progressBar.style.width = "0%";
  
  weakToggleBtn.classList.remove('active');
}

function updateActiveStates() {
  if (filteredWords.length === 0) return;
  
  const currentWord = filteredWords[currentIndex];
  const isWeak = weakWords.has(currentWord.No);
  
  if (isWeak) {
    weakToggleBtn.classList.add('active');
    weakToggleBtn.setAttribute('aria-label', '苦手登録を解除');
  } else {
    weakToggleBtn.classList.remove('active');
    weakToggleBtn.setAttribute('aria-label', '苦手登録をする');
  }
}

// Toggle functions
function toggleWeakWord() {
  if (filteredWords.length === 0) return;
  const currentWord = filteredWords[currentIndex];
  const wordNo = currentWord.No;
  
  if (weakWords.has(wordNo)) {
    weakWords.delete(wordNo);
    sendWeakWordUpdateToGas('remove', wordNo);
  } else {
    weakWords.add(wordNo);
    sendWeakWordUpdateToGas('add', wordNo);
  }
  
  saveLocalWeakWords();
  updateActiveStates();
  
  // If we are filtering by weak words and just removed a star, we should refresh the lists
  if (weakFilterBtn.getAttribute('aria-pressed') === 'true' && !weakWords.has(wordNo)) {
    // If it's the last word in the filtered list, we need to adapt the index
    setTimeout(() => {
      applyFilters();
    }, 300);
  }
}

// Filters logic
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedLevel = levelFilter.value;
  const isWeakOnly = weakFilterBtn.getAttribute('aria-pressed') === 'true';
  
  // Keep track of current word before filter to restore position if possible
  const previousWordNo = filteredWords[currentIndex] ? filteredWords[currentIndex].No : null;
  
  filteredWords = allWords.filter(word => {
    // Level match
    if (selectedLevel !== 'all' && word.Level !== selectedLevel) return false;
    
    // Weak words match
    if (isWeakOnly && !weakWords.has(word.No)) return false;
    
    // Search match
    if (searchTerm) {
      const matchWord = word.Word.toLowerCase().includes(searchTerm);
      const matchMeaning = word.Meaning.toLowerCase().includes(searchTerm);
      const matchSynonym = word.Synonym && word.Synonym.toLowerCase().includes(searchTerm);
      if (!matchWord && !matchMeaning && !matchSynonym) return false;
    }
    
    return true;
  });
  
  if (isShuffle) {
    // Apply shuffle layout mapping
    shuffleArray(filteredWords);
  }
  
  // Try to find previous word's new index to preserve navigation state
  if (previousWordNo && filteredWords.length > 0) {
    const newIdx = filteredWords.findIndex(w => w.No === previousWordNo);
    currentIndex = newIdx !== -1 ? newIdx : 0;
  } else {
    currentIndex = 0;
  }
  
  displayCurrentWord();
  populateWordSelect(filteredWords);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  if (isShuffle) {
    shuffleBtn.classList.add('active');
  } else {
    shuffleBtn.classList.remove('active');
  }
  applyFilters();
}

// Helper to randomise arrays
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Web Speech Synthesis (TTS Audio)
function speakWord() {
  if (filteredWords.length === 0) return;
  const wordData = filteredWords[currentIndex];
  const word = wordData.Word;
  const example = wordData.Example_EN;
  
  if (!window.speechSynthesis) {
    alert("Speech Synthesis is not supported in this browser.");
    return;
  }

  // Cancel current speaking
  window.speechSynthesis.cancel();
  
  const wordUtterance = new SpeechSynthesisUtterance(word);
  wordUtterance.lang = 'en-US';
  
  // Load selected custom voice if configured
  let selectedVoice = null;
  if (selectedVoiceName !== 'default') {
    const voices = window.speechSynthesis.getVoices();
    selectedVoice = voices.find(v => v.name === selectedVoiceName);
    if (selectedVoice) wordUtterance.voice = selectedVoice;
  }

  // Visual wave animation toggle
  wordUtterance.onstart = () => {
    ttsWave.classList.add('active');
    ttsBtn.classList.add('speaking');
  };
  
  if (example && example !== 'No English example sentence available.' && example !== 'Please wait while the vocabulary loads.') {
    wordUtterance.onend = () => {
      // Small pause before speaking the example
      setTimeout(() => {
        const exampleUtterance = new SpeechSynthesisUtterance(example);
        exampleUtterance.lang = 'en-US';
        if (selectedVoice) exampleUtterance.voice = selectedVoice;
        
        exampleUtterance.onend = () => {
          ttsWave.classList.remove('active');
          ttsBtn.classList.remove('speaking');
        };
        
        exampleUtterance.onerror = () => {
          ttsWave.classList.remove('active');
          ttsBtn.classList.remove('speaking');
        };
        
        window.speechSynthesis.speak(exampleUtterance);
      }, 700);
    };
  } else {
    wordUtterance.onend = () => {
      ttsWave.classList.remove('active');
      ttsBtn.classList.remove('speaking');
    };
  }

  wordUtterance.onerror = () => {
    ttsWave.classList.remove('active');
    ttsBtn.classList.remove('speaking');
  };

  window.speechSynthesis.speak(wordUtterance);
}

// Audio Voices Loading
function populateVoicesList() {
  if (!window.speechSynthesis) return;
  
  const voices = window.speechSynthesis.getVoices();
  // Filter for English voices only for clarity
  const englishVoices = voices.filter(v => v.lang.startsWith('en-'));
  
  // Clear other than default option
  ttsVoiceSelect.innerHTML = '<option value="default">ブラウザ標準音声</option>';
  
  englishVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === selectedVoiceName) {
      option.selected = true;
    }
    ttsVoiceSelect.appendChild(option);
  });
}

// Settings Modal Controls
function openSettings() {
  gasUrlInput.value = gasUrl;
  settingsModal.classList.remove('hidden');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function saveSettings() {
  const newUrl = gasUrlInput.value.trim();
  const selectedVoice = ttsVoiceSelect.value;
  
  // Save URL
  if (newUrl !== gasUrl) {
    gasUrl = newUrl;
    localStorage.setItem('ielts_gas_url', gasUrl);
    if (gasUrl) {
      syncWithSpreadsheet();
      loadWordsFromSources().then(() => applyFilters());
    } else {
      updateSyncStatus('offline', '未接続（ローカル動作中）');
      localStorage.removeItem('ielts_cached_words');
      loadWordsFromSources().then(() => applyFilters());
    }
  }
  
  // Save Voice preference
  selectedVoiceName = selectedVoice;
  localStorage.setItem('ielts_selected_voice', selectedVoice);
  
  closeSettings();
}

// Search Suggestions & Direct Jump logic
function updateSuggestions() {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    searchSuggestions.innerHTML = '';
    searchSuggestions.classList.add('hidden');
    return;
  }

  // Filter suggestions from allWords (so we can find any word regardless of current filter)
  const matches = allWords.filter(word => {
    const matchWord = word.Word.toLowerCase().includes(query);
    const matchMeaning = word.Meaning.toLowerCase().includes(query);
    const matchNo = word.No && word.No.toString().includes(query);
    return matchWord || matchMeaning || matchNo;
  }).slice(0, 15);

  if (matches.length === 0) {
    searchSuggestions.innerHTML = '<div class="search-suggestion-item" style="cursor: default; color: var(--text-muted);">一致する単語がありません</div>';
    searchSuggestions.classList.remove('hidden');
    return;
  }

  searchSuggestions.innerHTML = '';
  matches.forEach(word => {
    const item = document.createElement('div');
    item.className = 'search-suggestion-item';
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'search-suggestion-word';
    wordSpan.textContent = word.Word;

    const meaningSpan = document.createElement('span');
    meaningSpan.className = 'search-suggestion-meaning';
    meaningSpan.textContent = word.Meaning;

    const noSpan = document.createElement('span');
    noSpan.className = 'search-suggestion-no';
    noSpan.textContent = `No.${word.No}`;

    item.appendChild(wordSpan);
    item.appendChild(meaningSpan);
    item.appendChild(noSpan);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToWord(word);
    });

    searchSuggestions.appendChild(item);
  });
  searchSuggestions.classList.remove('hidden');
}

function jumpToWord(word) {
  // Clear search input value
  searchInput.value = '';
  searchSuggestions.classList.add('hidden');
  searchSuggestions.innerHTML = '';

  // Check if this word is in the current filters (e.g. level, weak-only).
  // If not, reset the filters to ensure the word will be visible.
  let selectedLevel = levelFilter.value;
  if (selectedLevel !== 'all' && word.Level !== selectedLevel) {
    levelFilter.value = 'all';
  }

  const isWeakOnly = weakFilterBtn.getAttribute('aria-pressed') === 'true';
  if (isWeakOnly && !weakWords.has(word.No)) {
    weakFilterBtn.setAttribute('aria-pressed', 'false');
  }

  // Re-run applyFilters to rebuild filteredWords (since search input is now empty)
  applyFilters();

  // Find index in the newly filtered list
  const targetIdx = filteredWords.findIndex(w => w.No === word.No);
  if (targetIdx !== -1) {
    if (isFlipped) {
      toggleCardFlip();
      setTimeout(() => {
        currentIndex = targetIdx;
        displayCurrentWord();
      }, 200);
    } else {
      currentIndex = targetIdx;
      displayCurrentWord();
    }
  }
}

function populateWordSelect(wordsToShow = allWords) {
  if (!wordSelect) return;
  
  const currentVal = wordSelect.value;
  wordSelect.innerHTML = '<option value="">単語を選択してジャンプ...</option>';
  
  // Sort by No to ensure they appear in order
  const sortedWords = [...wordsToShow].sort((a, b) => parseInt(a.No) - parseInt(b.No));
  
  sortedWords.forEach(word => {
    const option = document.createElement('option');
    option.value = word.No;
    option.textContent = `No.${word.No} - ${word.Word}`;
    wordSelect.appendChild(option);
  });
  
  if (currentVal && wordsToShow.some(w => w.No.toString() === currentVal.toString())) {
    wordSelect.value = currentVal;
  }
}
