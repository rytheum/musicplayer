// ============================================
// RYTHEUM MUSIC PLAYER — Enhanced Edition
// ============================================

// --- DOM Elements ---
const audio = document.getElementById('audio');
const albumArt = document.getElementById('album-art');
const albumImg = document.getElementById('album-img');
const songName = document.getElementById('song-name');
const songArtist = document.getElementById('song-artist');
const trackBadge = document.getElementById('track-badge');

const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const repeatIcon = document.getElementById('repeat-icon');

const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

const volumeSlider = document.getElementById('volume-slider');
const volumeBtn = document.getElementById('volume-btn');
const volumeIcon = document.getElementById('volume-icon');
const speedSelect = document.getElementById('speed-select');

const favBtn = document.getElementById('fav-btn');
const favIcon = document.getElementById('fav-icon');
const playingIndicator = document.getElementById('playing-indicator');

const bgGradient = document.getElementById('bg-gradient');
const toastContainer = document.getElementById('toast-container');
const overlay = document.getElementById('overlay');

// Panel elements
const playlistPanel = document.getElementById('playlist-panel');
const eqPanel = document.getElementById('eq-panel');
const timerPanel = document.getElementById('timer-panel');
const shortcutsPanel = document.getElementById('shortcuts-panel');
const playlistList = document.getElementById('playlist-list');
const playlistSearch = document.getElementById('playlist-search');

// --- State ---
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0; // 0 = off, 1 = all, 2 = one
let favorites = JSON.parse(localStorage.getItem('rytheum_favorites') || '[]');
let showFavoritesOnly = false;
let previousVolume = 1;

// Custom Playlists State
let activePlaylistId = 'all'; // 'all', 'favorites', or custom playlist id
let editingPlaylistId = null;
let targetSongKeyForAddToPlaylist = null;
let customPlaylists = JSON.parse(localStorage.getItem('rytheum_custom_playlists') || 'null');

if (!customPlaylists || !Array.isArray(customPlaylists) || customPlaylists.length === 0) {
  customPlaylists = [
    {
      id: 'pl_my_mix',
      name: 'Playlist Pilihan Saya',
      songKeys: ['blue', 'favorite lesson', 'perfect', 'koiiro', 'yoru ni kakeru']
    }
  ];
  localStorage.setItem('rytheum_custom_playlists', JSON.stringify(customPlaylists));
}

function saveCustomPlaylists() {
  localStorage.setItem('rytheum_custom_playlists', JSON.stringify(customPlaylists));
}

function getActivePlaylist() {
  if (activePlaylistId === 'all' || activePlaylistId === 'favorites') return null;
  return customPlaylists.find(p => p.id === activePlaylistId) || null;
}

function getCurrentQueue() {
  if (activePlaylistId === 'favorites') {
    return songs
      .map((song, originalIndex) => ({ song, originalIndex }))
      .filter(({ originalIndex }) => isFavorite(originalIndex));
  }
  
  const currentPl = getActivePlaylist();
  if (currentPl) {
    return currentPl.songKeys
      .map(key => {
        const idx = songs.findIndex(s => s.audio === key);
        return idx !== -1 ? { song: songs[idx], originalIndex: idx } : null;
      })
      .filter(Boolean);
  }
  
  return songs.map((song, originalIndex) => ({ song, originalIndex }));
}

// Equalizer & visualizer state
let eqFilterGains = [0, 0, 0, 0, 0]; // 60, 250, 1K, 4K, 16K (dB)
let visualizerAnimId = null;

// Sleep timer
let sleepTimerId = null;
let sleepTimerEnd = null;
let sleepTimerDisplayId = null;

// Dragging state for progress bar
let isDraggingProgress = false;

// --- EQ Configuration ---
const EQ_FREQUENCIES = [
  { freq: 60, label: '60' },
  { freq: 250, label: '250' },
  { freq: 1000, label: '1K' },
  { freq: 4000, label: '4K' },
  { freq: 16000, label: '16K' },
];

const EQ_PRESETS = {
  flat:     [0, 0, 0, 0, 0],
  bass:     [6, 4, 1, 0, 0],
  pop:      [-1, 2, 4, 2, -1],
  rock:     [4, 2, -1, 3, 4],
  jazz:     [3, 1, -1, 1, 3],
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Ensure audio volume is synchronized
  audio.volume = parseFloat(volumeSlider.value) || 1;
  loadSong(currentIndex);
  renderPlaylistTabs();
  renderPlaylist();
  generateParticles();
  generateEQBands();
  startVisualizer();
  setupEventListeners();
  initCustomPlaylistEvents();
});

// ============================================
// SONG LOADING
// ============================================

function loadSong(index) {
  if (index < 0 || index >= songs.length) return;
  currentIndex = index;
  const song = songs[index];
  songName.textContent = song.name;
  songArtist.textContent = song.artist;

  const albumElem = document.getElementById('song-album-name');
  if (albumElem) {
    albumElem.textContent = song.album || 'Single';
  }

  albumImg.src = `images/${song.img}.png`;
  audio.src = `music/${song.audio}.mp3`;

  // Track badge with queue and playlist context
  const queue = getCurrentQueue();
  const qIdx = queue.findIndex(item => item.originalIndex === index);
  let badgeContext = '';
  if (activePlaylistId === 'favorites') {
    badgeContext = 'Favorit';
  } else if (activePlaylistId !== 'all') {
    const pl = getActivePlaylist();
    if (pl) badgeContext = pl.name;
  } else if (song.genre) {
    badgeContext = song.genre;
  }

  const trackNum = qIdx !== -1 ? qIdx + 1 : index + 1;
  const totalTracks = queue.length > 0 ? queue.length : songs.length;
  trackBadge.textContent = `${trackNum} / ${totalTracks}${badgeContext ? ` • ${badgeContext}` : ''}`;

  // Reset progress bar displays
  progressFill.style.width = '0%';
  timeCurrent.textContent = '0:00';

  // Update background hue
  const hue = (index * 37 + 200) % 360;
  bgGradient.style.setProperty('--hue', hue);

  // Update favorite button
  updateFavButton();

  // Update active item in playlist
  updatePlaylistActive();
}

// Error handling for audio loading
audio.addEventListener('error', () => {
  console.error('Audio playback error:', audio.error);
  const song = songs[currentIndex];
  showToast(`Gagal memuat: ${song ? song.name : 'audio'}`, 'error', 'error');
});

// ============================================
// PLAYBACK CONTROLS
// ============================================

function playSong() {
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      playIcon.textContent = 'pause';
      albumArt.classList.add('playing');
      playingIndicator.classList.add('active');
    }).catch((err) => {
      console.warn('Playback prevented or failed:', err);
      isPlaying = false;
      playIcon.textContent = 'play_arrow';
      albumArt.classList.remove('playing');
      playingIndicator.classList.remove('active');
    });
  }
}

function pauseSong() {
  audio.pause();
  isPlaying = false;
  playIcon.textContent = 'play_arrow';
  albumArt.classList.remove('playing');
  playingIndicator.classList.remove('active');
}

function togglePlay() {
  if (isPlaying) {
    pauseSong();
  } else {
    playSong();
  }
}

function nextSong() {
  const queue = getCurrentQueue();
  if (queue.length === 0) return;

  let currentQIdx = queue.findIndex(item => item.originalIndex === currentIndex);
  if (currentQIdx === -1) currentQIdx = 0;

  if (isShuffled) {
    let newQIdx;
    do {
      newQIdx = Math.floor(Math.random() * queue.length);
    } while (newQIdx === currentQIdx && queue.length > 1);
    currentQIdx = newQIdx;
  } else {
    currentQIdx = (currentQIdx + 1) % queue.length;
  }

  loadSong(queue[currentQIdx].originalIndex);
  playSong();
}

function prevSong() {
  // If more than 3 seconds in, restart current song
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const queue = getCurrentQueue();
  if (queue.length === 0) return;

  let currentQIdx = queue.findIndex(item => item.originalIndex === currentIndex);
  if (currentQIdx === -1) currentQIdx = 0;

  if (isShuffled) {
    let newQIdx;
    do {
      newQIdx = Math.floor(Math.random() * queue.length);
    } while (newQIdx === currentQIdx && queue.length > 1);
    currentQIdx = newQIdx;
  } else {
    currentQIdx = (currentQIdx - 1 + queue.length) % queue.length;
  }

  loadSong(queue[currentQIdx].originalIndex);
  playSong();
}

function toggleShuffle() {
  isShuffled = !isShuffled;
  shuffleBtn.classList.toggle('active', isShuffled);
  showToast(
    isShuffled ? 'Shuffle enabled' : 'Shuffle disabled',
    'shuffle',
    'info'
  );
}

function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  switch (repeatMode) {
    case 0:
      repeatBtn.classList.remove('active');
      repeatIcon.textContent = 'repeat';
      showToast('Repeat off', 'repeat', 'info');
      break;
    case 1:
      repeatBtn.classList.add('active');
      repeatIcon.textContent = 'repeat';
      showToast('Repeat all', 'repeat', 'info');
      break;
    case 2:
      repeatBtn.classList.add('active');
      repeatIcon.textContent = 'repeat_one';
      showToast('Repeat one', 'repeat_one', 'info');
      break;
  }
}

// Handle song end
audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    // Repeat one
    audio.currentTime = 0;
    playSong();
  } else if (repeatMode === 1) {
    // Repeat all
    nextSong();
  } else {
    // No repeat
    if (currentIndex < songs.length - 1 || isShuffled) {
      nextSong();
    } else {
      pauseSong();
      currentIndex = 0;
      loadSong(currentIndex);
    }
  }
});

// ============================================
// PROGRESS BAR
// ============================================

audio.addEventListener('timeupdate', () => {
  if (isDraggingProgress) return;
  if (!isNaN(audio.duration)) {
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    timeCurrent.textContent = formatTime(audio.currentTime);
  }
});

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration);
});

// Click to seek
progressTrack.addEventListener('mousedown', (e) => {
  isDraggingProgress = true;
  seekFromEvent(e);
});

document.addEventListener('mousemove', (e) => {
  if (isDraggingProgress) seekFromEvent(e);
});

document.addEventListener('mouseup', () => {
  isDraggingProgress = false;
});

// Touch support
progressTrack.addEventListener('touchstart', (e) => {
  isDraggingProgress = true;
  seekFromTouch(e);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (isDraggingProgress) seekFromTouch(e);
}, { passive: true });

document.addEventListener('touchend', () => {
  isDraggingProgress = false;
});

function seekFromEvent(e) {
  const rect = progressTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const pct = x / rect.width;
  if (!isNaN(audio.duration)) {
    audio.currentTime = pct * audio.duration;
    progressFill.style.width = (pct * 100) + '%';
    timeCurrent.textContent = formatTime(audio.currentTime);
  }
}

function seekFromTouch(e) {
  const touch = e.touches[0];
  const rect = progressTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
  const pct = x / rect.width;
  if (!isNaN(audio.duration)) {
    audio.currentTime = pct * audio.duration;
    progressFill.style.width = (pct * 100) + '%';
    timeCurrent.textContent = formatTime(audio.currentTime);
  }
}

// ============================================
// VOLUME CONTROL
// ============================================

volumeSlider.addEventListener('input', () => {
  audio.volume = parseFloat(volumeSlider.value);
  updateVolumeIcon();
  updateVolumeSliderFill();
});

volumeBtn.addEventListener('click', () => {
  if (audio.volume > 0) {
    previousVolume = audio.volume;
    audio.volume = 0;
    volumeSlider.value = 0;
  } else {
    audio.volume = previousVolume;
    volumeSlider.value = previousVolume;
  }
  updateVolumeIcon();
  updateVolumeSliderFill();
});

function updateVolumeIcon() {
  if (audio.volume === 0) {
    volumeIcon.textContent = 'volume_off';
  } else if (audio.volume < 0.5) {
    volumeIcon.textContent = 'volume_down';
  } else {
    volumeIcon.textContent = 'volume_up';
  }
}

function updateVolumeSliderFill() {
  const pct = volumeSlider.value * 100;
  volumeSlider.style.background = `linear-gradient(90deg, var(--accent-1) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

// Initial volume fill
updateVolumeSliderFill();

// ============================================
// SPEED CONTROL
// ============================================

speedSelect.addEventListener('change', () => {
  audio.playbackRate = parseFloat(speedSelect.value);
  showToast(`Speed: ${speedSelect.value}×`, 'speed', 'info');
});

// ============================================
// FAVORITES SYSTEM
// ============================================

function toggleFavorite(index = currentIndex) {
  const songKey = songs[index].audio;
  const idx = favorites.indexOf(songKey);
  if (idx > -1) {
    favorites.splice(idx, 1);
    if (index === currentIndex) {
      showToast('Removed from favorites', 'heart_broken', 'love');
    }
  } else {
    favorites.push(songKey);
    if (index === currentIndex) {
      showToast('Added to favorites', 'favorite', 'love');
    }
  }
  localStorage.setItem('rytheum_favorites', JSON.stringify(favorites));
  updateFavButton();
  updatePlaylistFavIcons();

  // Heart pop animation
  if (index === currentIndex) {
    favBtn.classList.add('pop');
    setTimeout(() => favBtn.classList.remove('pop'), 400);
  }
}

function isFavorite(index) {
  return favorites.includes(songs[index].audio);
}

function updateFavButton() {
  favBtn.classList.toggle('liked', isFavorite(currentIndex));
}

// ============================================
// PLAYLIST PANEL & CUSTOM PLAYLIST SYSTEM
// ============================================

let dragSrcIndex = null;

function renderPlaylistTabs() {
  const tabsContainer = document.getElementById('custom-pl-tabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';

  // Tab: Semua Lagu
  const allTab = document.createElement('button');
  allTab.className = `custom-pl-tab${activePlaylistId === 'all' ? ' active' : ''}`;
  allTab.innerHTML = `<span>Semua Lagu</span> <span class="count">${songs.length}</span>`;
  allTab.addEventListener('click', () => {
    activePlaylistId = 'all';
    showFavoritesOnly = false;
    document.getElementById('filter-fav')?.classList.remove('active');
    renderPlaylistTabs();
    renderPlaylist(playlistSearch.value);
    updateTrackBadge();
  });
  tabsContainer.appendChild(allTab);

  // Tab: Favorit
  const favCount = favorites.length;
  const favTab = document.createElement('button');
  favTab.className = `custom-pl-tab${activePlaylistId === 'favorites' ? ' active' : ''}`;
  favTab.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px;color:var(--liked)">favorite</span> <span>Favorit</span> <span class="count">${favCount}</span>`;
  favTab.addEventListener('click', () => {
    activePlaylistId = 'favorites';
    showFavoritesOnly = true;
    document.getElementById('filter-fav')?.classList.add('active');
    renderPlaylistTabs();
    renderPlaylist(playlistSearch.value);
    updateTrackBadge();
  });
  tabsContainer.appendChild(favTab);

  // Custom Playlists tabs
  customPlaylists.forEach(pl => {
    const plTab = document.createElement('button');
    plTab.className = `custom-pl-tab${activePlaylistId === pl.id ? ' active' : ''}`;
    plTab.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">queue_music</span> <span>${pl.name}</span> <span class="count">${pl.songKeys.length}</span>`;
    plTab.addEventListener('click', () => {
      activePlaylistId = pl.id;
      showFavoritesOnly = false;
      document.getElementById('filter-fav')?.classList.remove('active');
      renderPlaylistTabs();
      renderPlaylist(playlistSearch.value);
      updateTrackBadge();
    });
    tabsContainer.appendChild(plTab);
  });

  // + Buat Playlist tab button
  const newTab = document.createElement('button');
  newTab.className = 'custom-pl-tab new-pl-btn';
  newTab.innerHTML = `<span class="material-symbols-rounded" style="font-size:15px">add</span> <span>Playlist Baru</span>`;
  newTab.addEventListener('click', () => {
    openPlaylistNameModal();
  });
  tabsContainer.appendChild(newTab);
}

function updateTrackBadge() {
  const song = songs[currentIndex];
  if (!song) return;
  const queue = getCurrentQueue();
  const qIdx = queue.findIndex(item => item.originalIndex === currentIndex);
  let badgeContext = '';
  if (activePlaylistId === 'favorites') {
    badgeContext = 'Favorit';
  } else if (activePlaylistId !== 'all') {
    const pl = getActivePlaylist();
    if (pl) badgeContext = pl.name;
  } else if (song.genre) {
    badgeContext = song.genre;
  }

  const trackNum = qIdx !== -1 ? qIdx + 1 : currentIndex + 1;
  const totalTracks = queue.length > 0 ? queue.length : songs.length;
  trackBadge.textContent = `${trackNum} / ${totalTracks}${badgeContext ? ` • ${badgeContext}` : ''}`;
}

function renderPlaylist(filter = '') {
  playlistList.innerHTML = '';
  const lowerFilter = filter.toLowerCase();

  const customHeader = document.getElementById('custom-pl-header');
  const customTitle = document.getElementById('custom-pl-title');
  const customCount = document.getElementById('custom-pl-count');
  const currentPl = getActivePlaylist();

  if (currentPl) {
    if (customHeader) customHeader.style.display = 'flex';
    if (customTitle) customTitle.textContent = currentPl.name;
    if (customCount) customCount.textContent = `${currentPl.songKeys.length} lagu • Tarik ⠿ atau klik ▲▼ untuk ubah urutan`;
  } else {
    if (customHeader) customHeader.style.display = 'none';
  }

  // If in custom playlist
  if (currentPl) {
    if (currentPl.songKeys.length === 0) {
      playlistList.innerHTML = `
        <div class="empty-pl-state">
          <span class="material-symbols-rounded empty-pl-icon">playlist_add</span>
          <div class="empty-pl-title">Playlist Masih Kosong</div>
          <p class="empty-pl-desc">Belum ada lagu di playlist ini. Tambahkan lagu favoritmu sekarang!</p>
          <button class="btn-primary" id="empty-add-song-btn">
            <span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;margin-right:4px">add</span>
            Tambah Lagu
          </button>
        </div>
      `;
      document.getElementById('empty-add-song-btn')?.addEventListener('click', openSongPickerModal);
      return;
    }

    currentPl.songKeys.forEach((key, orderIdx) => {
      const originalIdx = songs.findIndex(s => s.audio === key);
      if (originalIdx === -1) return;
      const song = songs[originalIdx];

      // Filter by search
      if (lowerFilter) {
        const matchName = song.name.toLowerCase().includes(lowerFilter);
        const matchArtist = song.artist.toLowerCase().includes(lowerFilter);
        const matchGenre = song.genre ? song.genre.toLowerCase().includes(lowerFilter) : false;
        const matchAlbum = song.album ? song.album.toLowerCase().includes(lowerFilter) : false;
        if (!matchName && !matchArtist && !matchGenre && !matchAlbum) return;
      }

      const item = document.createElement('div');
      item.className = `playlist-item${originalIdx === currentIndex ? ' active' : ''}`;
      item.dataset.index = originalIdx;
      item.dataset.order = orderIdx;
      item.draggable = true;

      const isFirst = orderIdx === 0;
      const isLast = orderIdx === currentPl.songKeys.length - 1;

      const numberOrVisualizer = originalIdx === currentIndex && isPlaying
        ? `<div class="mini-visualizer"><span></span><span></span><span></span></div>`
        : `<span class="playlist-item-number">${orderIdx + 1}</span>`;

      item.innerHTML = `
        <span class="drag-handle" title="Tahan & geser untuk mengubah urutan">
          <span class="material-symbols-rounded">drag_indicator</span>
        </span>
        ${numberOrVisualizer}
        <div class="playlist-item-img">
          <img src="images/${song.img}.png" alt="${song.name}" loading="lazy">
        </div>
        <div class="playlist-item-info">
          <div class="playlist-item-name">${song.name}</div>
          <div class="playlist-item-artist">${song.artist}${song.album ? ` • ${song.album}` : ''}</div>
        </div>
        <div class="reorder-actions">
          <button class="reorder-btn move-up" title="Pindah ke Atas" ${isFirst ? 'disabled' : ''}>
            <span class="material-symbols-rounded">expand_less</span>
          </button>
          <button class="reorder-btn move-down" title="Pindah ke Bawah" ${isLast ? 'disabled' : ''}>
            <span class="material-symbols-rounded">expand_more</span>
          </button>
        </div>
        <div class="playlist-item-actions">
          <button class="playlist-fav-btn${isFavorite(originalIdx) ? ' liked' : ''}" data-fav-index="${originalIdx}" title="Favorit">
            <span class="material-symbols-rounded">favorite</span>
          </button>
          <button class="playlist-action-btn delete-btn remove-from-pl" title="Hapus dari playlist ini">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      `;

      // Drag and drop event listeners
      item.addEventListener('dragstart', (e) => {
        dragSrcIndex = orderIdx;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', orderIdx);
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragSrcIndex !== null && dragSrcIndex !== orderIdx) {
          moveSongInCustomPlaylist(currentPl.id, dragSrcIndex, orderIdx);
        }
      });

      // Move Up / Down button listeners
      item.querySelector('.move-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isFirst) {
          moveSongInCustomPlaylist(currentPl.id, orderIdx, orderIdx - 1);
        }
      });

      item.querySelector('.move-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isLast) {
          moveSongInCustomPlaylist(currentPl.id, orderIdx, orderIdx + 1);
        }
      });

      // Remove from playlist button
      item.querySelector('.remove-from-pl')?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSongFromCustomPlaylist(currentPl.id, song.audio);
      });

      // Fav button
      item.querySelector('.playlist-fav-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(originalIdx);
        renderPlaylistTabs();
        renderPlaylist(playlistSearch.value);
      });

      // Click to play
      item.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.drag-handle')) return;
        currentIndex = originalIdx;
        loadSong(currentIndex);
        playSong();
        renderPlaylist(playlistSearch.value);
      });

      playlistList.appendChild(item);
    });

    return;
  }

  // Standard / Favorites list rendering
  songs.forEach((song, i) => {
    // Filter by search
    if (lowerFilter) {
      const matchName = song.name.toLowerCase().includes(lowerFilter);
      const matchArtist = song.artist.toLowerCase().includes(lowerFilter);
      const matchGenre = song.genre ? song.genre.toLowerCase().includes(lowerFilter) : false;
      const matchAlbum = song.album ? song.album.toLowerCase().includes(lowerFilter) : false;
      if (!matchName && !matchArtist && !matchGenre && !matchAlbum) return;
    }

    // Filter by favorites
    if (activePlaylistId === 'favorites' && !isFavorite(i)) return;

    const item = document.createElement('div');
    item.className = `playlist-item${i === currentIndex ? ' active' : ''}`;
    item.dataset.index = i;

    const numberOrVisualizer = i === currentIndex && isPlaying
      ? `<div class="mini-visualizer"><span></span><span></span><span></span></div>`
      : `<span class="playlist-item-number">${i + 1}</span>`;

    item.innerHTML = `
      ${numberOrVisualizer}
      <div class="playlist-item-img">
        <img src="images/${song.img}.png" alt="${song.name}" loading="lazy">
      </div>
      <div class="playlist-item-info">
        <div class="playlist-item-name">${song.name}</div>
        <div class="playlist-item-artist">${song.artist}${song.genre ? ` • <span class="playlist-item-genre">${song.genre}</span>` : ''}</div>
      </div>
      <div class="playlist-item-actions">
        <button class="playlist-action-btn add-to-pl-btn" data-audio="${song.audio}" title="Tambahkan ke Playlist">
          <span class="material-symbols-rounded">playlist_add</span>
        </button>
        <button class="playlist-fav-btn${isFavorite(i) ? ' liked' : ''}" data-fav-index="${i}" title="Favorit">
          <span class="material-symbols-rounded">favorite</span>
        </button>
      </div>
    `;

    // Click to play
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      currentIndex = i;
      loadSong(currentIndex);
      playSong();
      renderPlaylist(playlistSearch.value);
    });

    // Add to playlist button
    item.querySelector('.add-to-pl-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToPlaylistModal(song.audio);
    });

    // Fav button
    item.querySelector('.playlist-fav-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(i);
      renderPlaylistTabs();
      renderPlaylist(playlistSearch.value);
    });

    playlistList.appendChild(item);
  });
}

function updatePlaylistActive() {
  playlistList.querySelectorAll('.playlist-item').forEach(item => {
    const idx = parseInt(item.dataset.index);
    item.classList.toggle('active', idx === currentIndex);
  });
}

function updatePlaylistFavIcons() {
  playlistList.querySelectorAll('.playlist-fav-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.favIndex);
    btn.classList.toggle('liked', isFavorite(idx));
  });
}

// Reordering logic
function moveSongInCustomPlaylist(playlistId, fromIndex, toIndex) {
  const pl = customPlaylists.find(p => p.id === playlistId);
  if (!pl) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= pl.songKeys.length || toIndex >= pl.songKeys.length) return;

  const movedKey = pl.songKeys.splice(fromIndex, 1)[0];
  pl.songKeys.splice(toIndex, 0, movedKey);
  saveCustomPlaylists();
  renderPlaylistTabs();
  renderPlaylist(playlistSearch.value);
  updateTrackBadge();

  const song = songs.find(s => s.audio === movedKey);
  showToast(`Urutan "${song ? song.name : 'lagu'}" diperbarui (#${toIndex + 1})`, 'swap_vert', 'info');
}

function addSongToCustomPlaylist(playlistId, songKey) {
  const pl = customPlaylists.find(p => p.id === playlistId);
  if (!pl) return;
  if (!pl.songKeys.includes(songKey)) {
    pl.songKeys.push(songKey);
    saveCustomPlaylists();
    renderPlaylistTabs();
    renderPlaylist(playlistSearch.value);
    updateTrackBadge();
    const song = songs.find(s => s.audio === songKey);
    showToast(`"${song ? song.name : 'Lagu'}" ditambahkan ke ${pl.name}`, 'playlist_add_check', 'love');
  }
}

function removeSongFromCustomPlaylist(playlistId, songKey) {
  const pl = customPlaylists.find(p => p.id === playlistId);
  if (!pl) return;
  const idx = pl.songKeys.indexOf(songKey);
  if (idx > -1) {
    pl.songKeys.splice(idx, 1);
    saveCustomPlaylists();
    renderPlaylistTabs();
    renderPlaylist(playlistSearch.value);
    updateTrackBadge();
    const song = songs.find(s => s.audio === songKey);
    showToast(`"${song ? song.name : 'Lagu'}" dihapus dari ${pl.name}`, 'delete', 'info');
  }
}

// Modals management
function openPlaylistNameModal(playlistId = null) {
  editingPlaylistId = playlistId;
  const modal = document.getElementById('playlist-name-modal');
  const title = document.getElementById('playlist-modal-title');
  const input = document.getElementById('playlist-name-input');
  if (!modal || !input) return;

  if (playlistId) {
    const pl = customPlaylists.find(p => p.id === playlistId);
    title.textContent = 'Ubah Nama Playlist';
    input.value = pl ? pl.name : '';
  } else {
    title.textContent = 'Buat Playlist Baru';
    input.value = '';
  }

  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 50);
}

function savePlaylistName() {
  const input = document.getElementById('playlist-name-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast('Masukkan nama playlist terlebih dahulu', 'error', 'error');
    return;
  }

  if (editingPlaylistId) {
    const pl = customPlaylists.find(p => p.id === editingPlaylistId);
    if (pl) {
      pl.name = name;
      saveCustomPlaylists();
      showToast(`Playlist diubah menjadi "${name}"`, 'edit', 'info');
    }
  } else {
    const newId = 'pl_' + Date.now();
    const newPl = {
      id: newId,
      name: name,
      songKeys: []
    };
    customPlaylists.push(newPl);
    activePlaylistId = newId;
    saveCustomPlaylists();
    showToast(`Playlist "${name}" berhasil dibuat!`, 'check_circle', 'love');
  }

  closeModal('playlist-name-modal');
  renderPlaylistTabs();
  renderPlaylist(playlistSearch.value);
}

function deleteCustomPlaylist(playlistId) {
  const pl = customPlaylists.find(p => p.id === playlistId);
  if (!pl) return;
  if (!confirm(`Hapus playlist "${pl.name}"?`)) return;

  const idx = customPlaylists.findIndex(p => p.id === playlistId);
  if (idx > -1) {
    customPlaylists.splice(idx, 1);
    saveCustomPlaylists();
    activePlaylistId = 'all';
    renderPlaylistTabs();
    renderPlaylist(playlistSearch.value);
    updateTrackBadge();
    showToast(`Playlist "${pl.name}" dihapus`, 'delete', 'info');
  }
}

function openSongPickerModal() {
  const pl = getActivePlaylist();
  if (!pl) return;

  const modal = document.getElementById('song-picker-modal');
  const nameElem = document.getElementById('song-picker-pl-name');
  const searchInput = document.getElementById('song-picker-search');
  if (nameElem) nameElem.textContent = pl.name;
  if (searchInput) searchInput.value = '';

  renderSongPickerList();
  modal.style.display = 'flex';
}

function renderSongPickerList(filter = '') {
  const listContainer = document.getElementById('song-picker-list');
  const pl = getActivePlaylist();
  if (!listContainer || !pl) return;
  listContainer.innerHTML = '';

  const lowerFilter = filter.toLowerCase();

  songs.forEach((song, i) => {
    if (lowerFilter) {
      const matchName = song.name.toLowerCase().includes(lowerFilter);
      const matchArtist = song.artist.toLowerCase().includes(lowerFilter);
      const matchGenre = song.genre ? song.genre.toLowerCase().includes(lowerFilter) : false;
      if (!matchName && !matchArtist && !matchGenre) return;
    }

    const isAdded = pl.songKeys.includes(song.audio);
    const item = document.createElement('div');
    item.className = 'song-picker-item';
    item.innerHTML = `
      <div class="song-picker-info">
        <div class="song-picker-img">
          <img src="images/${song.img}.png" alt="${song.name}">
        </div>
        <div class="song-picker-text">
          <div class="song-picker-name">${song.name}</div>
          <div class="song-picker-artist">${song.artist} • ${song.genre || ''}</div>
        </div>
      </div>
      <button class="song-picker-btn${isAdded ? ' added' : ''}">
        ${isAdded ? '✓ Ditambahkan' : '+ Tambah'}
      </button>
    `;

    item.querySelector('.song-picker-btn')?.addEventListener('click', () => {
      if (isAdded) {
        removeSongFromCustomPlaylist(pl.id, song.audio);
      } else {
        addSongToCustomPlaylist(pl.id, song.audio);
      }
      renderSongPickerList(document.getElementById('song-picker-search')?.value || '');
    });

    listContainer.appendChild(item);
  });
}

function openAddToPlaylistModal(songKey) {
  targetSongKeyForAddToPlaylist = songKey;
  const song = songs.find(s => s.audio === songKey);
  const modal = document.getElementById('add-to-playlist-modal');
  const title = document.getElementById('add-to-pl-song-title');
  if (title && song) {
    title.textContent = `${song.name} — ${song.artist}`;
  }
  renderModalPlaylistSelectList();
  modal.style.display = 'flex';
}

function renderModalPlaylistSelectList() {
  const container = document.getElementById('modal-pl-list');
  if (!container || !targetSongKeyForAddToPlaylist) return;
  container.innerHTML = '';

  if (customPlaylists.length === 0) {
    container.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0;">Belum ada custom playlist. Buat di bawah!</p>`;
    return;
  }

  customPlaylists.forEach(pl => {
    const isAdded = pl.songKeys.includes(targetSongKeyForAddToPlaylist);
    const item = document.createElement('div');
    item.className = `modal-pl-item${isAdded ? ' active' : ''}`;
    item.innerHTML = `
      <div class="modal-pl-meta">
        <span class="material-symbols-rounded" style="color:var(--accent-1);font-size:18px">queue_music</span>
        <div>
          <div class="modal-pl-name">${pl.name}</div>
          <div class="modal-pl-count">${pl.songKeys.length} lagu</div>
        </div>
      </div>
      <div class="modal-pl-toggle">
        <span class="material-symbols-rounded" style="font-size:16px">${isAdded ? 'check' : 'add'}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      if (isAdded) {
        removeSongFromCustomPlaylist(pl.id, targetSongKeyForAddToPlaylist);
      } else {
        addSongToCustomPlaylist(pl.id, targetSongKeyForAddToPlaylist);
      }
      renderModalPlaylistSelectList();
    });

    container.appendChild(item);
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function initCustomPlaylistEvents() {
  // Header create button
  document.getElementById('create-playlist-btn')?.addEventListener('click', () => openPlaylistNameModal());

  // Save playlist name button
  document.getElementById('save-playlist-name-btn')?.addEventListener('click', savePlaylistName);
  document.getElementById('playlist-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePlaylistName();
  });

  // Rename & Delete in header
  document.getElementById('rename-pl-btn')?.addEventListener('click', () => {
    if (activePlaylistId && activePlaylistId !== 'all' && activePlaylistId !== 'favorites') {
      openPlaylistNameModal(activePlaylistId);
    }
  });

  document.getElementById('delete-pl-btn')?.addEventListener('click', () => {
    if (activePlaylistId && activePlaylistId !== 'all' && activePlaylistId !== 'favorites') {
      deleteCustomPlaylist(activePlaylistId);
    }
  });

  // Add songs button in header
  document.getElementById('add-songs-to-pl-btn')?.addEventListener('click', openSongPickerModal);

  // Song picker search
  document.getElementById('song-picker-search')?.addEventListener('input', (e) => {
    renderSongPickerList(e.target.value);
  });

  // Quick create playlist inside modal
  document.getElementById('quick-create-pl-btn')?.addEventListener('click', () => {
    const input = document.getElementById('quick-create-pl-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    const newId = 'pl_' + Date.now();
    const newPl = {
      id: newId,
      name: name,
      songKeys: targetSongKeyForAddToPlaylist ? [targetSongKeyForAddToPlaylist] : []
    };
    customPlaylists.push(newPl);
    saveCustomPlaylists();
    input.value = '';
    renderModalPlaylistSelectList();
    renderPlaylistTabs();
    showToast(`Playlist "${name}" dibuat!`, 'check_circle', 'love');
  });

  document.getElementById('quick-create-pl-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('quick-create-pl-btn')?.click();
    }
  });

  // Modal close buttons
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) closeModal(modalId);
      else closeAllModals();
    });
  });

  // Close modals on clicking background backdrop
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

// Search
playlistSearch.addEventListener('input', () => {
  renderPlaylist(playlistSearch.value);
});

// Filter favorites
document.getElementById('filter-fav').addEventListener('click', () => {
  if (activePlaylistId === 'favorites') {
    activePlaylistId = 'all';
  } else {
    activePlaylistId = 'favorites';
  }
  showFavoritesOnly = activePlaylistId === 'favorites';
  document.getElementById('filter-fav').classList.toggle('active', showFavoritesOnly);
  renderPlaylistTabs();
  renderPlaylist(playlistSearch.value);
  updateTrackBadge();
  showToast(
    showFavoritesOnly ? 'Menampilkan Lagu Favorit' : 'Menampilkan Semua Lagu',
    'filter_list',
    'info'
  );
});

// ============================================
// VISUALIZER & EQUALIZER
// ============================================

// --- Visualizer ---
function startVisualizer() {
  const canvas = document.getElementById('visualizer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('visualizer-wrapper');
  if (!wrapper) return;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.offsetWidth || 340;
    const h = wrapper.offsetHeight || 340;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const bars = 96;
  const barHeights = new Float32Array(bars);
  barHeights.fill(3);

  function draw(timestamp) {
    visualizerAnimId = requestAnimationFrame(draw);

    const w = wrapper.offsetWidth || 340;
    const h = wrapper.offsetHeight || 340;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const innerRadius = 127; // Sits right outside the 125px album art
    const maxBarLen = Math.max(20, (Math.min(w, h) / 2) - innerRadius - 6);

    const t = timestamp * 0.003;
    const vol = typeof audio.volume === 'number' ? audio.volume : 1;

    // Simulated energetic beat pulse (~124 BPM)
    const beat = Math.sin(t * 3.8);
    const beatKick = Math.pow(Math.max(0, beat), 4);

    // Dynamic EQ band multipliers
    const bassMultiplier = Math.max(0.2, 1 + (eqFilterGains[0] + eqFilterGains[1]) / 20);
    const midMultiplier = Math.max(0.2, 1 + eqFilterGains[2] / 20);
    const trebleMultiplier = Math.max(0.2, 1 + (eqFilterGains[3] + eqFilterGains[4]) / 20);

    for (let i = 0; i < bars; i++) {
      let targetHeight = 3;

      if (isPlaying && vol > 0.01) {
        const pos = i / bars;
        const bassDist = Math.abs(pos - 0.5);

        // Sinusoidal multi-frequency waves
        const w1 = Math.sin(t * 4.5 + i * 0.18) * 0.35 + 0.35;
        const w2 = Math.cos(t * 7.2 - i * 0.35) * 0.25 + 0.25;
        const w3 = Math.sin(t * 11.0 + i * 0.5) * 0.15 + 0.15;
        let energy = w1 + w2 + w3;

        if (bassDist < 0.25) {
          energy = (energy + beatKick * 0.8) * bassMultiplier;
        } else if (bassDist > 0.35) {
          energy = energy * trebleMultiplier;
        } else {
          energy = energy * midMultiplier;
        }

        targetHeight = Math.max(3, energy * maxBarLen * vol);
      } else {
        // Smooth gentle breathing wave when paused
        targetHeight = 3 + Math.sin(t * 1.5 + i * 0.15) * 1.5;
      }

      // Smooth interpolation for fluid motion
      barHeights[i] += (targetHeight - barHeights[i]) * 0.22;

      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const curLen = barHeights[i];

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * (innerRadius + curLen);
      const y2 = centerY + Math.sin(angle) * (innerRadius + curLen);

      const songHue = (currentIndex * 37 + 240) % 360;
      const hue = (songHue + (i / bars) * 70) % 360;
      const alpha = isPlaying ? (0.45 + (curLen / maxBarLen) * 0.55) : 0.25;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);
  visualizerAnimId = requestAnimationFrame(draw);
}

// --- Equalizer ---
function generateEQBands() {
  const container = document.getElementById('eq-bands');
  container.innerHTML = '';

  EQ_FREQUENCIES.forEach(({ freq, label }, i) => {
    const band = document.createElement('div');
    band.className = 'eq-band';
    band.innerHTML = `
      <span class="eq-value" id="eq-val-${i}">0 dB</span>
      <div class="eq-slider-container">
        <input type="range" class="eq-slider" id="eq-slider-${i}"
               min="-12" max="12" value="0" step="1"
               data-eq-index="${i}">
      </div>
      <span class="eq-freq">${label}</span>
    `;
    container.appendChild(band);
  });

  // Slider events
  container.querySelectorAll('.eq-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const idx = parseInt(slider.dataset.eqIndex);
      const val = parseFloat(slider.value);
      eqFilterGains[idx] = val;
      document.getElementById(`eq-val-${idx}`).textContent = `${val > 0 ? '+' : ''}${val} dB`;

      // Deactivate presets when manually adjusting
      document.querySelectorAll('.eq-preset').forEach(p => p.classList.remove('active'));
    });
  });
}

function applyEQPreset(presetName) {
  const values = EQ_PRESETS[presetName];
  if (!values) return;

  values.forEach((val, i) => {
    eqFilterGains[i] = val;
    const slider = document.getElementById(`eq-slider-${i}`);
    const display = document.getElementById(`eq-val-${i}`);
    if (slider) slider.value = val;
    if (display) display.textContent = `${val > 0 ? '+' : ''}${val} dB`;
  });

  // Update active preset button
  document.querySelectorAll('.eq-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetName);
  });

  showToast(`EQ: ${presetName.charAt(0).toUpperCase() + presetName.slice(1)}`, 'equalizer', 'info');
}

// EQ Preset buttons
document.getElementById('eq-presets').addEventListener('click', (e) => {
  const btn = e.target.closest('.eq-preset');
  if (btn) {
    applyEQPreset(btn.dataset.preset);
  }
});

// ============================================
// SLEEP TIMER
// ============================================

document.getElementById('timer-options').addEventListener('click', (e) => {
  const btn = e.target.closest('.timer-opt');
  if (!btn) return;

  const minutes = parseInt(btn.dataset.minutes);
  startSleepTimer(minutes);
});

function startSleepTimer(minutes) {
  // Clear existing timer
  clearSleepTimer(false);

  sleepTimerEnd = Date.now() + minutes * 60 * 1000;

  // Highlight active option
  document.querySelectorAll('.timer-opt').forEach(b => b.classList.remove('active'));
  document.querySelector(`.timer-opt[data-minutes="${minutes}"]`)?.classList.add('active');

  // Update display
  const timerStatus = document.getElementById('timer-status');
  timerStatus.classList.add('active');
  timerStatus.querySelector('.timer-status-icon').textContent = 'timer';

  // Show cancel button
  document.getElementById('cancel-timer').style.display = 'flex';

  // Countdown display
  updateTimerDisplay();
  sleepTimerDisplayId = setInterval(updateTimerDisplay, 1000);

  // Actual timer
  const ms = minutes * 60 * 1000;
  sleepTimerId = setTimeout(() => {
    pauseSong();
    clearSleepTimer(true);
    showToast('Sleep timer ended — music paused', 'bedtime', 'warning');
  }, ms);

  showToast(`Sleep timer: ${minutes} minutes`, 'bedtime', 'success');
}

function updateTimerDisplay() {
  const timerStatus = document.getElementById('timer-status');
  if (!sleepTimerEnd) return;

  const remaining = Math.max(0, sleepTimerEnd - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  timerStatus.querySelector('p').innerHTML =
    `Music stops in <strong>${mins}:${secs.toString().padStart(2, '0')}</strong>`;

  if (remaining <= 0) {
    clearSleepTimer(true);
  }
}

function clearSleepTimer(resetUI = true) {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  if (sleepTimerDisplayId) {
    clearInterval(sleepTimerDisplayId);
    sleepTimerDisplayId = null;
  }
  sleepTimerEnd = null;

  if (resetUI) {
    const timerStatus = document.getElementById('timer-status');
    timerStatus.classList.remove('active');
    timerStatus.querySelector('.timer-status-icon').textContent = 'timer_off';
    timerStatus.querySelector('p').textContent = 'No timer set';
    document.getElementById('cancel-timer').style.display = 'none';
    document.querySelectorAll('.timer-opt').forEach(b => b.classList.remove('active'));
  }
}

document.getElementById('cancel-timer').addEventListener('click', () => {
  clearSleepTimer(true);
  showToast('Sleep timer cancelled', 'timer_off', 'info');
});

// ============================================
// PANEL MANAGEMENT
// ============================================

function openPanel(panelId) {
  closeAllPanels();
  document.getElementById(panelId).classList.add('open');
  overlay.classList.add('active');

  // Re-render playlist when opening
  if (panelId === 'playlist-panel') {
    renderPlaylist(playlistSearch.value);
  }
}

function closeAllPanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  overlay.classList.remove('active');
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel.classList.contains('open')) {
    closeAllPanels();
  } else {
    openPanel(panelId);
  }
}

// Panel toggle buttons
document.getElementById('playlist-toggle').addEventListener('click', () => togglePanel('playlist-panel'));
document.getElementById('eq-toggle').addEventListener('click', () => togglePanel('eq-panel'));
document.getElementById('timer-toggle').addEventListener('click', () => togglePanel('timer-panel'));
document.getElementById('shortcuts-toggle').addEventListener('click', () => togglePanel('shortcuts-panel'));

// Close buttons
document.getElementById('close-playlist').addEventListener('click', closeAllPanels);
document.getElementById('close-eq').addEventListener('click', closeAllPanels);
document.getElementById('close-timer').addEventListener('click', closeAllPanels);
document.getElementById('close-shortcuts').addEventListener('click', closeAllPanels);

// Click overlay to close
overlay.addEventListener('click', closeAllPanels);

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in search
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextSong();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      prevSong();
      break;
    case 'ArrowUp':
      e.preventDefault();
      adjustVolume(0.05);
      break;
    case 'ArrowDown':
      e.preventDefault();
      adjustVolume(-0.05);
      break;
    case 'KeyM':
      volumeBtn.click();
      break;
    case 'KeyS':
      toggleShuffle();
      break;
    case 'KeyR':
      cycleRepeat();
      break;
    case 'KeyL':
      toggleFavorite();
      break;
    case 'KeyP':
      togglePanel('playlist-panel');
      break;
    case 'KeyE':
      togglePanel('eq-panel');
      break;
    case 'Escape':
      closeAllPanels();
      break;
  }
});

function adjustVolume(delta) {
  let newVol = Math.max(0, Math.min(1, audio.volume + delta));
  audio.volume = newVol;
  volumeSlider.value = newVol;
  updateVolumeIcon();
  updateVolumeSliderFill();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, icon = 'info', type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-symbols-rounded">${icon}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============================================
// PARTICLES
// ============================================

function generateParticles() {
  const container = document.getElementById('particles');
  const count = 25;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 8 + 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 25 + 20) + 's';
    particle.style.animationDelay = (Math.random() * 20) + 's';

    container.appendChild(particle);
  }
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', nextSong);
  prevBtn.addEventListener('click', prevSong);
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', cycleRepeat);
  favBtn.addEventListener('click', () => toggleFavorite());
}

// ============================================
// UTILITIES
// ============================================

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
