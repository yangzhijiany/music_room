class MusicPlayer {
    constructor() {
        // Auto detect current domain and port
        this.apiBase = window.location.origin;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isLoading = false;
        
        // DOM elements
        this.audioPlayer = document.getElementById('audioPlayer');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.playerSection = document.getElementById('playerSection');
        this.loading = document.getElementById('loading');
        this.playlistContainer = document.getElementById('playlist');
        this.clearPlaylistBtn = document.getElementById('clearPlaylist');
        
        // Playback control elements
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progressSlider = document.getElementById('progressSlider');
        this.progress = document.getElementById('progress');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValueEl = document.getElementById('volumeValue');
        
        this.initEventListeners();
        this.loadPlaylistFromStorage();
    }

    initEventListeners() {
        // Search related
        this.searchBtn.addEventListener('click', () => this.searchMusic());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchMusic();
            }
        });

        // Playlist related
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());

        // Playback control
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());

        // Progress control
        this.progressSlider.addEventListener('input', (e) => {
            if (this.audioPlayer.duration) {
                const time = (e.target.value / 100) * this.audioPlayer.duration;
                this.audioPlayer.currentTime = time;
            }
        });

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioPlayer.volume = volume;
            this.volumeValueEl.textContent = e.target.value + '%';
        });

        // Audio event listeners
        this.audioPlayer.addEventListener('loadstart', () => {
            this.updatePlayStatus('Loading...');
        });

        this.audioPlayer.addEventListener('canplay', () => {
            this.updatePlayStatus('Ready to play');
        });

        this.audioPlayer.addEventListener('play', () => {
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸';
            this.updatePlayStatus('Playing');
        });

        this.audioPlayer.addEventListener('pause', () => {
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶';
            this.updatePlayStatus('Paused');
        });

        this.audioPlayer.addEventListener('ended', () => {
            this.playNext();
        });

        this.audioPlayer.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audioPlayer.addEventListener('loadedmetadata', () => {
            this.durationEl.textContent = this.formatTime(this.audioPlayer.duration);
        });

        this.audioPlayer.addEventListener('error', (e) => {
            this.updatePlayStatus('Playback failed');
            this.showError('Audio loading failed, please try other songs');
        });

        // Initialize volume
        this.audioPlayer.volume = 0.5;
    }

    async searchMusic() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) {
            this.showError('Please enter search keywords');
            return;
        }

        this.showLoading(true);
        this.clearResults();

        try {
            const response = await fetch(`${this.apiBase}/getSearchByKey?key=${encodeURIComponent(keyword)}&limit=20`);
            const data = await response.json();
            
            if (data.response && data.response.code === 0) {
                this.displaySearchResults(data.response.data.song.list);
            } else {
                this.showError('Search failed, please try again');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('Network error, please check if API service is running normally');
        } finally {
            this.showLoading(false);
        }
    }

    displaySearchResults(songs) {
        if (!songs || songs.length === 0) {
            this.showNoResults();
            return;
        }

        const resultsHTML = songs.map(song => `
            <div class="song-item" data-songmid="${song.songmid}" data-songid="${song.songid}">
                <img src="${this.getImageUrl(song.albummid)}" alt="专辑封面" class="song-cover" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MEgyMFYyMFoiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+'">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.songname)}</div>
                    <div class="song-artist">${this.escapeHtml(song.singer[0].name)}</div>
                </div>
                <button class="play-btn" onclick="musicPlayer.addToPlaylist('${song.songmid}', '${song.songid}', '${this.escapeJsString(song.songname)}', '${this.escapeJsString(song.singer[0].name)}', '${this.escapeJsString(song.albumname)}', '${song.albummid}')">
                    ➕
                </button>
            </div>
        `).join('');

        this.searchResults.innerHTML = resultsHTML;
    }

    addToPlaylist(songmid, songid, title, artist, album, albummid) {
        const song = {
            songmid,
            songid,
            title,
            artist,
            album,
            albummid,
            imageUrl: this.getImageUrl(albummid)
        };

        // Check if already exists
        const exists = this.playlist.some(s => s.songmid === songmid);
        if (exists) {
            this.showError('Song is already in playlist');
            return;
        }

        this.playlist.push(song);
        this.updatePlaylistDisplay();
        this.savePlaylistToStorage();
        
        // If playlist is empty, auto play first song
        if (this.playlist.length === 1 && this.currentIndex === -1) {
            this.currentIndex = 0;
            this.playCurrentSong();
        }
    }

    updatePlaylistDisplay() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <p>Playlist is empty</p>
                    <p>Search for songs and click to add to playlist</p>
                </div>
            `;
            return;
        }

        const playlistHTML = this.playlist.map((song, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'playing' : ''}" 
                 data-index="${index}" onclick="musicPlayer.playFromPlaylist(${index})">
                <img src="${song.imageUrl}" alt="专辑封面" class="song-cover" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xNSAxNUgzMFYzMEgxNVYxNVoiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+'">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title)}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist)}</div>
                </div>
                <button class="remove-btn" onclick="event.stopPropagation(); musicPlayer.removeFromPlaylist(${index})" title="Remove">
                    ✕
                </button>
            </div>
        `).join('');

        this.playlistContainer.innerHTML = playlistHTML;
    }

    playFromPlaylist(index) {
        this.currentIndex = index;
        this.playCurrentSong();
    }

    removeFromPlaylist(index) {
        this.playlist.splice(index, 1);
        
        // Adjust current playback index
        if (index < this.currentIndex) {
            this.currentIndex--;
        } else if (index === this.currentIndex) {
            if (this.playlist.length === 0) {
                this.currentIndex = -1;
                this.stop();
            } else if (this.currentIndex >= this.playlist.length) {
                this.currentIndex = this.playlist.length - 1;
            }
            this.playCurrentSong();
        }
        
        this.updatePlaylistDisplay();
        this.savePlaylistToStorage();
    }

    clearPlaylist() {
        if (this.playlist.length === 0) return;
        
        if (confirm('Are you sure you want to clear the playlist?')) {
            this.playlist = [];
            this.currentIndex = -1;
            this.stop();
            this.updatePlaylistDisplay();
            this.savePlaylistToStorage();
        }
    }

    async playCurrentSong() {
        if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) {
            this.updatePlayStatus('Playlist is empty');
            return;
        }

        const song = this.playlist[this.currentIndex];
        this.isLoading = true;
        this.updatePlayStatus('Getting playback link...');

        try {
            // Get playback link
            const playResponse = await fetch(`${this.apiBase}/getMusicPlay?songmid=${song.songmid}`);
            const playData = await playResponse.json();

            if (playData.data && playData.data.playUrl && playData.data.playUrl[song.songmid]) {
                const playInfo = playData.data.playUrl[song.songmid];
                
                // Check for error messages
                if (playInfo.error && playInfo.error !== false) {
                    throw new Error(playInfo.error);
                }
                
                const playUrl = playInfo.url;
                
                if (playUrl) {
                    // Set audio source
                    this.audioPlayer.src = playUrl;
                    
                    // Update player info
                    this.updatePlayerInfo(song);
                    
                    // Show player
                    this.playerSection.style.display = 'block';
                    
                    // Update playlist display
                    this.updatePlaylistDisplay();
                    
                    // Auto play
                    try {
                        await this.audioPlayer.play();
                    } catch (playError) {
                        console.warn('自动播放失败:', playError);
                        this.updatePlayStatus('Click play button to start');
                    }
                } else {
                    this.showError('No playback link available for this song');
                }
            } else {
                this.showError('Failed to get playback link');
            }
        } catch (error) {
            console.error('播放错误:', error);
            this.showError('Playback failed, please try again');
        } finally {
            this.isLoading = false;
        }
    }

    togglePlayPause() {
        if (this.currentIndex < 0) {
            if (this.playlist.length > 0) {
                this.currentIndex = 0;
                this.playCurrentSong();
            }
            return;
        }

        if (this.isPlaying) {
            this.audioPlayer.pause();
        } else {
            this.audioPlayer.play();
        }
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        this.playCurrentSong();
    }

    playNext() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = this.currentIndex < this.playlist.length - 1 ? this.currentIndex + 1 : 0;
        this.playCurrentSong();
    }

    stop() {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.updatePlayStatus('Stopped');
        this.progress.style.width = '0%';
        this.progressSlider.value = 0;
        this.currentTimeEl.textContent = '0:00';
    }

    updatePlayerInfo(song) {
        document.getElementById('songTitle').textContent = song.title;
        document.getElementById('songArtist').textContent = song.artist;
        document.getElementById('songAlbum').textContent = song.album;
        document.getElementById('songImage').src = song.imageUrl;
    }

    updateProgress() {
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.progress.style.width = progress + '%';
            this.progressSlider.value = progress;
            this.currentTimeEl.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updatePlayStatus(status) {
        document.getElementById('playStatus').textContent = status;
    }

    getImageUrl(albummid) {
        if (!albummid) return '';
        return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Escape special characters in JavaScript strings
    escapeJsString(text) {
        if (!text) return '';
        return text.toString()
            .replace(/\\/g, '\\\\')  // Backslash
            .replace(/'/g, "\\'")    // Single quote
            .replace(/"/g, '\\"')    // Double quote
            .replace(/\n/g, '\\n')   // Line feed
            .replace(/\r/g, '\\r')   // Carriage return
            .replace(/\t/g, '\\t');  // Tab
    }

    showLoading(show) {
        this.loading.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        this.searchResults.innerHTML = `
            <div class="error-message">
                ${message}
            </div>
        `;
    }

    showNoResults() {
        this.searchResults.innerHTML = `
            <div class="no-results">
No related songs found, please try other keywords
            </div>
        `;
    }

    clearResults() {
        this.searchResults.innerHTML = '';
    }

    // Local storage functionality
    savePlaylistToStorage() {
        localStorage.setItem('musicPlayer_playlist', JSON.stringify(this.playlist));
        localStorage.setItem('musicPlayer_currentIndex', this.currentIndex.toString());
    }

    loadPlaylistFromStorage() {
        try {
            const savedPlaylist = localStorage.getItem('musicPlayer_playlist');
            const savedIndex = localStorage.getItem('musicPlayer_currentIndex');
            
            if (savedPlaylist) {
                this.playlist = JSON.parse(savedPlaylist);
                this.currentIndex = savedIndex ? parseInt(savedIndex) : -1;
                this.updatePlaylistDisplay();
            }
        } catch (error) {
            console.error('Failed to load playlist:', error);
        }
    }
}

// Initialize music player
const musicPlayer = new MusicPlayer();

// Initialize after page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('QQ Music Player loaded');
    
    // Check API connection
    fetch('http://localhost:3200/getTopLists')
        .then(response => response.json())
        .then(data => {
            if (data.response && data.response.code === 0) {
                console.log('API connection normal');
            } else {
                console.warn('API response abnormal');
            }
        })
        .catch(error => {
            console.error('API connection failed:', error);
            musicPlayer.showError('Unable to connect to music API service, please ensure service is running');
        });
});