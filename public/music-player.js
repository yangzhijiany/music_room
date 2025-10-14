class MusicPlayer {
    constructor() {
        // 自动检测当前域名和端口
        this.apiBase = window.location.origin;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isLoading = false;
        
        // DOM元素
        this.audioPlayer = document.getElementById('audioPlayer');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.playerSection = document.getElementById('playerSection');
        this.loading = document.getElementById('loading');
        this.playlistContainer = document.getElementById('playlist');
        this.clearPlaylistBtn = document.getElementById('clearPlaylist');
        
        // 播放控制元素
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
        // 搜索相关
        this.searchBtn.addEventListener('click', () => this.searchMusic());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchMusic();
            }
        });

        // 播放列表相关
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());

        // 播放控制
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());

        // 进度控制
        this.progressSlider.addEventListener('input', (e) => {
            if (this.audioPlayer.duration) {
                const time = (e.target.value / 100) * this.audioPlayer.duration;
                this.audioPlayer.currentTime = time;
            }
        });

        // 音量控制
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioPlayer.volume = volume;
            this.volumeValueEl.textContent = e.target.value + '%';
        });

        // 音频事件监听
        this.audioPlayer.addEventListener('loadstart', () => {
            this.updatePlayStatus('正在加载...');
        });

        this.audioPlayer.addEventListener('canplay', () => {
            this.updatePlayStatus('准备播放');
        });

        this.audioPlayer.addEventListener('play', () => {
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸';
            this.updatePlayStatus('正在播放');
        });

        this.audioPlayer.addEventListener('pause', () => {
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶';
            this.updatePlayStatus('已暂停');
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
            this.updatePlayStatus('播放失败');
            this.showError('音频加载失败，请尝试其他歌曲');
        });

        // 初始化音量
        this.audioPlayer.volume = 0.5;
    }

    async searchMusic() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) {
            this.showError('请输入搜索关键词');
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
                this.showError('搜索失败，请重试');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('网络错误，请检查API服务是否正常运行');
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
                <button class="play-btn" onclick="musicPlayer.addToPlaylist('${song.songmid}', '${song.songid}', '${this.escapeHtml(song.songname)}', '${this.escapeHtml(song.singer[0].name)}', '${this.escapeHtml(song.albumname)}', '${song.albummid}')">
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

        // 检查是否已存在
        const exists = this.playlist.some(s => s.songmid === songmid);
        if (exists) {
            this.showError('歌曲已在播放列表中');
            return;
        }

        this.playlist.push(song);
        this.updatePlaylistDisplay();
        this.savePlaylistToStorage();
        
        // 如果播放列表为空，自动播放第一首
        if (this.playlist.length === 1 && this.currentIndex === -1) {
            this.currentIndex = 0;
            this.playCurrentSong();
        }
    }

    updatePlaylistDisplay() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <p>播放列表为空</p>
                    <p>搜索歌曲并点击添加到播放列表</p>
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
                <button class="remove-btn" onclick="event.stopPropagation(); musicPlayer.removeFromPlaylist(${index})" title="删除">
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
        
        // 调整当前播放索引
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
        
        if (confirm('确定要清空播放列表吗？')) {
            this.playlist = [];
            this.currentIndex = -1;
            this.stop();
            this.updatePlaylistDisplay();
            this.savePlaylistToStorage();
        }
    }

    async playCurrentSong() {
        if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) {
            this.updatePlayStatus('播放列表为空');
            return;
        }

        const song = this.playlist[this.currentIndex];
        this.isLoading = true;
        this.updatePlayStatus('正在获取播放链接...');

        try {
            // 获取播放链接
            const playResponse = await fetch(`${this.apiBase}/getMusicPlay?songmid=${song.songmid}`);
            const playData = await playResponse.json();

            if (playData.data && playData.data.playUrl && playData.data.playUrl[song.songmid]) {
                const playUrl = playData.data.playUrl[song.songmid].url;
                
                if (playUrl) {
                    // 设置音频源
                    this.audioPlayer.src = playUrl;
                    
                    // 更新播放器信息
                    this.updatePlayerInfo(song);
                    
                    // 显示播放器
                    this.playerSection.style.display = 'block';
                    
                    // 更新播放列表显示
                    this.updatePlaylistDisplay();
                    
                    // 自动播放
                    try {
                        await this.audioPlayer.play();
                    } catch (playError) {
                        console.warn('自动播放失败:', playError);
                        this.updatePlayStatus('点击播放按钮开始播放');
                    }
                } else {
                    this.showError('该歌曲暂无播放链接');
                }
            } else {
                this.showError('获取播放链接失败');
            }
        } catch (error) {
            console.error('播放错误:', error);
            this.showError('播放失败，请重试');
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
        this.updatePlayStatus('已停止');
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
                没有找到相关歌曲，请尝试其他关键词
            </div>
        `;
    }

    clearResults() {
        this.searchResults.innerHTML = '';
    }

    // 本地存储功能
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
            console.error('加载播放列表失败:', error);
        }
    }
}

// 初始化音乐播放器
const musicPlayer = new MusicPlayer();

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('QQ音乐播放器已加载');
    
    // 检查API连接
    fetch('http://localhost:3200/getTopLists')
        .then(response => response.json())
        .then(data => {
            if (data.response && data.response.code === 0) {
                console.log('API连接正常');
            } else {
                console.warn('API响应异常');
            }
        })
        .catch(error => {
            console.error('API连接失败:', error);
            musicPlayer.showError('无法连接到音乐API服务，请确保服务正在运行');
        });
});