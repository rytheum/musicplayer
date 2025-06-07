const content = document.querySelector(".content"),
  Playimage = content.querySelector(".music-image img"),
  musicName = content.querySelector(".music-titles .name"),
  musicArtist = content.querySelector(".music-titles .artist"),
  Audio = document.querySelector(".main-song"),
  playBtn = content.querySelector(".play-pause"),
  playBtnIcon = content.querySelector(".play-pause span"),
  prevBtn = content.querySelector("#prev"),
  nextBtn = content.querySelector("#next"),
  progressBar = content.querySelector(".progress-bar"),
  progressDetails = content.querySelector(".progress-details"),
  repeatBtn = content.querySelector("#repeat"),
  Shuffle = content.querySelector("#shuffle");

let index = 1;

window.addEventListener("load", () => {
  loadData(index);
});

// Fungsi memuat data lagu ke tampilan
function loadData(indexValue) {
  musicName.innerHTML = songs[indexValue - 1].name;
  musicArtist.innerHTML = songs[indexValue - 1].artist;
  Playimage.src = "images/" + songs[indexValue - 1].img + ".png";
  Audio.src = "music/" + songs[indexValue - 1].audio + ".mp3";
  updateTrackCount(); // Update "Playing * of *"
}

// Fungsi memutar lagu
function playSong() {
  content.classList.add("paused");
  playBtnIcon.innerHTML = "pause";
  Audio.play();
}

// Fungsi menjeda lagu
function pauseSong() {
  content.classList.remove("paused");
  playBtnIcon.innerHTML = "play_arrow";
  Audio.pause();
}

// Tombol play/pause
playBtn.addEventListener("click", () => {
  const isMusicPaused = content.classList.contains("paused");
  if (isMusicPaused) {
    pauseSong();
  } else {
    playSong();
  }
});

// Tombol next
nextBtn.addEventListener("click", () => {
  nextSong();
});

// Tombol previous
prevBtn.addEventListener("click", () => {
  prevSong();
});

function nextSong() {
  index++;
  if (index > songs.length) {
    index = 1;
  }
  loadData(index);
  playSong();
}

function prevSong() {
  index--;
  if (index <= 0) {
    index = songs.length;
  }
  loadData(index);
  playSong();
}

// Update progress bar & waktu
Audio.addEventListener("timeupdate", (e) => {
  const initialTime = e.target.currentTime;
  const finalTime = e.target.duration;
  let BarWidth = (initialTime / finalTime) * 100;
  progressBar.style.width = BarWidth + "%";

  // Update current time
  let currentTimeData = content.querySelector(".current");
  let CurrentTime = Audio.currentTime;
  let currentMinutes = Math.floor(CurrentTime / 60);
  let currentSeconds = Math.floor(CurrentTime % 60);
  if (currentSeconds < 10) {
    currentSeconds = "0" + currentSeconds;
  }
  currentTimeData.innerText = currentMinutes + ":" + currentSeconds;
});

// Set waktu saat bar diklik
progressDetails.addEventListener("click", (e) => {
  let progressValue = progressDetails.clientWidth;
  let clickedOffsetX = e.offsetX;
  let MusicDuration = Audio.duration;
  Audio.currentTime = (clickedOffsetX / progressValue) * MusicDuration;
});

// Update final duration saat lagu dimuat
Audio.addEventListener("loadeddata", () => {
  let finalTimeData = content.querySelector(".final");
  let AudioDuration = Audio.duration;
  let finalMinutes = Math.floor(AudioDuration / 60);
  let finalSeconds = Math.floor(AudioDuration % 60);
  if (finalSeconds < 10) {
    finalSeconds = "0" + finalSeconds;
  }
  finalTimeData.innerText = finalMinutes + ":" + finalSeconds;
});

// Tombol repeat
repeatBtn.addEventListener("click", () => {
  Audio.currentTime = 0;
});

// Tombol shuffle
Shuffle.addEventListener("click", () => {
  var randIndex = Math.floor(Math.random() * songs.length) + 1;
  index = randIndex;
  loadData(index);
  playSong();
});

// Saat lagu selesai, lanjut ke lagu berikutnya
Audio.addEventListener("ended", () => {
  index++;
  if (index > songs.length) {
    index = 1;
  }
  loadData(index);
  playSong();
  // Update indikator track
  updateTrackCount();
});

// Update track info (Playing * of *)
const currentTrackElement = document.getElementById("current-track");
const totalTracksElement = document.getElementById("total-tracks");

// Set total track di awal
totalTracksElement.textContent = songs.length;

// Fungsi untuk update nomor lagu sekarang
function updateTrackCount() {
  currentTrackElement.textContent = index;
}

// Inisialisasi
updateTrackCount();

// Volume slider
const volumeSlider = document.getElementById("volume-slider");
volumeSlider.addEventListener("input", () => {
  Audio.volume = volumeSlider.value;
});
