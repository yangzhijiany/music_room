class RoomMusicPlayer {
    constructor() {
        // Auto detect current domain and port
        this.apiBase = window.location.origin;
        this.socket = null;
        this.currentRoom = null;
        this.currentUser = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isLoading = false;
        this.syncInterval = null;
        this.currentLoadingSong = null;
        this.currentSongMid = null;
        this.pendingSeekTime = null;
        this.lastSyncAt = 0;
        
        // DOM elements
        this.entryPage = document.getElementById('entryPage');
        this.roomPage = document.getElementById('roomPage');
        this.loading = document.getElementById('loading');
        this.errorToast = document.getElementById('errorToast');
        
        // Entry page elements
        this.enterRoomBtn = document.getElementById('enterRoomBtn');
        this.userName = document.getElementById('userName');
        
        // Room page elements
        this.roomTitle = document.getElementById('roomTitle');
        this.userCount = document.getElementById('userCount');
        this.shareRoomBtn = document.getElementById('shareRoomBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        
        // Search and playlist
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.playlistContainer = document.getElementById('playlist');
        this.clearPlaylistBtn = document.getElementById('clearPlaylist');
        
        // 聊天
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        
        // User list
        this.usersList = document.getElementById('usersList');
        
        // Player
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playerSection = document.getElementById('playerSection');
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
        this.initAudioEventHandlers();
    }

    // Initialize audio event handlers
    initAudioEventHandlers() {
        this.onAudioLoadStart = () => {
            console.log('Audio started loading...');
        };

        this.onAudioCanPlay = () => {
            console.log('Audio can play');
            this.isLoading = false;
            this.showLoading(false);
            this.currentLoadingSong = null;
            this.applyPendingSeek();
            
            // If should be playing, auto play
            if (this.isPlaying) {
                this.audioPlayer.play().catch(e => {
                    console.warn('自动播放失败:', e);
                    this.showError('Auto play failed, please click play manually');
                });
            }
        };

        this.onAudioLoaded = () => {
            console.log('Audio data loaded');
        };

        this.onAudioError = (e) => {
            console.error('Audio loading error:', e);
            this.isLoading = false;
            this.showLoading(false);
            this.currentLoadingSong = null;
            this.showError('Audio loading failed, please try again');
        };
    }

    initEventListeners() {
        // Entry page events
        this.enterRoomBtn.addEventListener('click', () => this.enterRoom());
        
        // Room page events
        this.shareRoomBtn.addEventListener('click', () => this.shareRoom());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // Search events
        this.searchBtn.addEventListener('click', () => this.searchMusic());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchMusic();
        });
        
        // Playlist events
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        
        // Chat events
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Playback control events
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
        
        // Audio events
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => {
            this.durationEl.textContent = this.formatTime(this.audioPlayer.duration);
        });
        this.audioPlayer.addEventListener('ended', () => {
            // 歌曲播放完成，通知服务器
            this.socket.emit('song_finished');
        });
        this.audioPlayer.addEventListener('error', (e) => {
            this.showError('Audio loading failed');
        });
        
        // Initialize volume
        this.audioPlayer.volume = 0.5;
    }

    // Connect WebSocket
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
        });
        
        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.showError('Connection lost, reconnecting...');
        });
        
        this.socket.on('room_created', (data) => {
            this.currentRoom = data.room;
            this.currentUser = data.user;
            this.showRoomPage();
        });
        
        this.socket.on('room_joined', (data) => {
            this.currentRoom = data.room;
            this.currentUser = data.user;
            this.playlist = data.room.playlist || [];
            this.showRoomPage();
        });
        
        this.socket.on('user_joined', (data) => {
            this.updateUserList(data.roomUsers);
            this.addSystemMessage(`${data.user.name} 加入了房间`);
        });
        
        this.socket.on('user_left', (data) => {
            this.updateUserList(data.roomUsers);
            this.addSystemMessage(`${data.user.name} 离开了房间`);
        });
        
        this.socket.on('playlist_updated', (data) => {
            this.playlist = data.playlist;
            this.currentRoom.playlist = this.playlist;
            
            // Update current playback state
            if (typeof data.currentIndex !== 'undefined') {
                this.currentIndex = data.currentIndex;
            }
            if (typeof data.isPlaying !== 'undefined') {
                this.isPlaying = data.isPlaying;
                this.playPauseBtn.textContent = data.isPlaying ? '⏸' : '▶';
            }
            if (data.currentSong) {
                this.updatePlayerInfo(data.currentSong);
                this.playerSection.style.display = 'block';
                // If current playing song is deleted, auto play next
                if (data.isPlaying && data.currentSong) {
                    this.loadAndPlaySong(data.currentSong, 0);
                }
            } else if (this.playlist.length === 0) {
                // Playlist is empty, hide player
                this.playerSection.style.display = 'none';
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;
            }
            
            this.updatePlaylistDisplay();
            
            if (data.addedBy) {
                this.addSystemMessage(`${data.addedBy} 添加了歌曲到播放列表`);
            } else if (data.removedBy) {
                this.addSystemMessage(`${data.removedBy} 从播放列表删除了歌曲`);
            } else if (data.clearedBy) {
                this.addSystemMessage(`${data.clearedBy} 清空了播放列表`);
            }
        });
        
        this.socket.on('playback_started', (data) => {
            this.currentIndex = data.currentIndex;
            // 使用服务器返回的播放列表，而不是本地缓存的
            this.playlist = data.playlist || this.currentRoom.playlist;
            this.currentRoom.playlist = this.playlist; // 同步更新房间的播放列表
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸';
            this.updatePlaylistDisplay();
            this.updatePlayerInfo(data.currentSong);
            this.playerSection.style.display = 'block';
            
            // 获取并播放音频
            this.loadAndPlaySong(data.currentSong, data.currentTime ?? 0);
            
            if (data.playedBy) {
                this.addSystemMessage(`${data.playedBy} 开始播放: ${data.currentSong.title}`);
            }
        });
        
        this.socket.on('playback_toggled', (data) => {
            this.isPlaying = data.isPlaying;
            this.playPauseBtn.textContent = data.isPlaying ? '⏸' : '▶';
            
            if (typeof data.currentTime === 'number') {
                this.pendingSeekTime = data.currentTime;
                this.applyPendingSeek();
            }
            
            if (this.audioPlayer.src) {
                if (data.isPlaying) {
                    const playPromise = this.audioPlayer.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(e => console.warn('播放失败:', e));
                    }
                } else {
                    this.audioPlayer.pause();
                }
            }
            
            if (data.toggledBy) {
                this.addSystemMessage(`${data.toggledBy} ${data.isPlaying ? '恢复' : '暂停'}了播放`);
            }
        });
        
        this.socket.on('song_finished', (data) => {
            // 歌曲播放完成，更新播放列表和当前播放状态
            this.playlist = data.playlist;
            this.currentRoom.playlist = this.playlist;
            this.currentIndex = data.currentIndex;
            this.isPlaying = data.isPlaying;
            this.playPauseBtn.textContent = data.isPlaying ? '⏸' : '▶';
            this.updatePlaylistDisplay();
            
            if (data.currentSong) {
                // 有下一首歌曲，更新播放器信息并播放
                this.updatePlayerInfo(data.currentSong);
                this.playerSection.style.display = 'block';
                this.loadAndPlaySong(data.currentSong, data.currentTime ?? 0);
            } else {
                // 没有下一首歌曲，隐藏播放器
                this.playerSection.style.display = 'none';
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;
            }
            
            if (data.message) {
                this.addSystemMessage(data.message);
            }
        });
        
        this.socket.on('sync_playback', (data) => {
            this.syncPlayback(data);
        });
        
        this.socket.on('message_received', (data) => {
            this.addChatMessage(data);
        });
        
        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    // Enter room
    enterRoom() {
        const userName = this.userName.value.trim();
        
        if (!userName) {
            this.showError('Please enter nickname');
            return;
        }
        
        this.showLoading(true, 'Entering room...');
        this.connectSocket();
        
        // Join fixed room "MAIN" directly
        this.socket.emit('join_room', {
            roomId: 'MAIN',
            userName: userName
        });
    }

    // Show room page
    showRoomPage() {
        this.entryPage.style.display = 'none';
        this.roomPage.style.display = 'flex';
        this.loading.style.display = 'none';
        
        this.roomTitle.textContent = 'Sync Music Room';
        this.userCount.textContent = this.currentRoom.users.size;
        
        this.updatePlaylistDisplay();
        this.updateUserList();
        
        // 请求同步播放状态
        this.socket.emit('request_sync');
        
        // 开始同步检查
        this.startSyncCheck();
    }

    // Leave room
    leaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.socket.emit('leave_room');
            this.socket.disconnect();
            this.roomPage.style.display = 'none';
            this.entryPage.style.display = 'flex';
            this.stopSyncCheck();
            this.resetPlayer();
        }
    }

    // Share room
    shareRoom() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            this.showError('Room link copied to clipboard');
        }).catch(() => {
            this.showError('Copy failed, please copy link manually');
        });
    }

    // Search music
    async searchMusic() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) {
            this.showError('Please enter search keywords');
            return;
        }

        this.showLoading(true, 'Searching...');
        this.clearSearchResults();

        try {
            const response = await fetch(`${this.apiBase}/getSearchByKey?key=${encodeURIComponent(keyword)}`);
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

    // Display search results
    displaySearchResults(songs) {
        if (!songs || songs.length === 0) {
            this.showNoResults();
            return;
        }

        const resultsHTML = songs.map(song => `
            <div class="song-item" data-songmid="${song.songmid}">
                <img src="${this.getImageUrl(song.albummid)}" alt="专辑封面" class="song-cover" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMCAxMEgzMFYzMEgxMFYxMFoiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+'">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.songname)}</div>
                    <div class="song-artist">${this.escapeHtml(song.singer[0].name)}</div>
                </div>
                <button class="add-btn" onclick="roomPlayer.addToPlaylist('${song.songmid}', '${song.songid}', '${this.escapeJsString(song.songname)}', '${this.escapeJsString(song.singer[0].name)}', '${this.escapeJsString(song.albumname)}', '${song.albummid}')">
                    ➕
                </button>
            </div>
        `).join('');

        this.searchResults.innerHTML = resultsHTML;
    }

    // Add song to playlist
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

        this.socket.emit('add_to_playlist', { song });
    }

    // Remove song from playlist
    removeFromPlaylist(index) {
        this.socket.emit('remove_from_playlist', { index });
    }

    // Clear playlist
    clearPlaylist() {
        if (this.playlist.length === 0) return;
        
        if (confirm('Are you sure you want to clear the playlist?')) {
            this.socket.emit('clear_playlist');
        }
    }

    // Update playlist display
    updatePlaylistDisplay() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <p>Playlist is empty</p>
                    <p>Search for songs and add to playlist</p>
                </div>
            `;
            return;
        }

        const playlistHTML = this.playlist.map((song, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'playing' : ''}" 
                 data-index="${index}" onclick="roomPlayer.playFromPlaylist(${index})">
                <img src="${song.imageUrl}" alt="专辑封面" class="song-cover" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzUiIGhlaWdodD0iMzUiIHZpZXdCb3g9IjAgMCAzNSAzNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjM1IiBoZWlnaHQ9IjM1IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik04IDhIMjdWMjdIOFY4WiIgZmlsbD0iI0Q5RDlEOSIvPgo8L3N2Zz4='">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title)}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist)}</div>
                </div>
                <button class="remove-btn" onclick="event.stopPropagation(); roomPlayer.removeFromPlaylist(${index})" title="Remove">
                    ✕
                </button>
            </div>
        `).join('');

        this.playlistContainer.innerHTML = playlistHTML;
    }

    // Play song from playlist
    playFromPlaylist(index) {
        this.socket.emit('play_song', { index });
    }

    // Playback control
    togglePlayPause() {
        this.socket.emit('toggle_play_pause');
    }

    playPrevious() {
        this.socket.emit('play_previous');
    }

    playNext() {
        this.socket.emit('play_next');
    }

    calculateExpectedTime(progress) {
        if (!progress) {
            return null;
        }

        const baseTime = typeof progress.currentTime === 'number' ? progress.currentTime : 0;
        if (progress.isPlaying) {
            const reportedAt = progress.reportedAt || Date.now();
            const delta = (Date.now() - reportedAt) / 1000;
            return Math.max(0, baseTime + delta);
        }

        if (typeof progress.playbackOffset === 'number') {
            return Math.max(0, progress.playbackOffset);
        }

        return Math.max(0, baseTime);
    }

    setAudioPosition(seconds) {
        if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
            return;
        }

        let target = Math.max(0, seconds);
        const duration = this.audioPlayer.duration;
        if (Number.isFinite(duration) && duration > 0) {
            target = Math.min(target, Math.max(duration - 0.15, 0));
        }

        try {
            this.audioPlayer.currentTime = target;
        } catch (error) {
            console.warn('调整播放进度失败:', error);
            this.pendingSeekTime = target;
        }
    }

    applyPendingSeek() {
        if (this.pendingSeekTime === null) {
            return;
        }

        const target = this.pendingSeekTime;
        this.pendingSeekTime = null;
        this.setAudioPosition(target);
        this.lastSyncAt = Date.now();
    }

    shouldResync(expected, actual, isPlaying) {
        if (expected === null || Number.isNaN(actual)) {
            return false;
        }
        const tolerance = isPlaying ? 0.75 : 0.2;
        return Math.abs(expected - actual) > tolerance;
    }

    // Sync playback
    syncPlayback(data) {
        if (!data.currentSong) {
            // No current song, hide player
            this.playerSection.style.display = 'none';
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            return;
        }
        
        const previousSongMid = this.currentSongMid;
        const incomingSongMid = data.currentSong.songmid;
        const songChanged = !this.audioPlayer.src || previousSongMid !== incomingSongMid;
        
        this.currentIndex = data.currentIndex;
        this.isPlaying = data.isPlaying;
        this.playPauseBtn.textContent = data.isPlaying ? '⏸' : '▶';
        
        this.updatePlayerInfo(data.currentSong);
        this.currentSongMid = incomingSongMid;
        this.playerSection.style.display = 'block';
        
        const expectedTime = this.calculateExpectedTime(data.progress);
        
        if (songChanged) {
            this.loadAndPlaySong(data.currentSong, expectedTime ?? 0);
        } else if (expectedTime !== null) {
            if (this.audioPlayer.readyState >= 1) {
                const actual = this.audioPlayer.currentTime;
                if (this.shouldResync(expectedTime, actual, data.isPlaying)) {
                    this.setAudioPosition(expectedTime);
                    this.lastSyncAt = Date.now();
                }
            } else {
                this.pendingSeekTime = expectedTime;
            }
        }
        
        if (this.audioPlayer.src) {
            if (data.isPlaying) {
                if (this.audioPlayer.paused) {
                    const playPromise = this.audioPlayer.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(e => console.warn('播放失败:', e));
                    }
                }
            } else {
                if (!this.audioPlayer.paused) {
                    this.audioPlayer.pause();
                }
                if (expectedTime !== null) {
                    this.pendingSeekTime = expectedTime;
                    this.applyPendingSeek();
                }
            }
        }
    }

    // Update player info
    updatePlayerInfo(song) {
        document.getElementById('songTitle').textContent = song.title;
        document.getElementById('songArtist').textContent = song.artist;
        document.getElementById('songAlbum').textContent = song.album;
        document.getElementById('songImage').src = song.imageUrl;
    }

    // Load and play song
    async loadAndPlaySong(song, startAt = 0) {
        if (!song.songmid) {
            this.showError('Invalid song ID');
            return;
        }

        if (this.currentLoadingSong === song.songmid || this.isLoading) {
            console.log('Loading in progress, skipping duplicate request');
            return;
        }

        this.isLoading = true;
        this.pendingSeekTime = typeof startAt === 'number' ? Math.max(0, startAt) : 0;

        try {
            this.currentLoadingSong = song.songmid;
            this.showLoading(true, 'Getting playback link...');
            
            const response = await fetch(`${this.apiBase}/getMusicPlay?songmid=${song.songmid}`);
            const data = await response.json();
            
            if (data.data && data.data.playUrl && data.data.playUrl[song.songmid]) {
                const playInfo = data.data.playUrl[song.songmid];
                
                // Check for error messages
                if (playInfo.error && playInfo.error !== false) {
                    throw new Error(playInfo.error);
                }
                
                const playUrl = playInfo.url;
                
                if (playUrl) {
                    console.log('Setting audio source:', playUrl);
                    
                    this.audioPlayer.pause();
                    this.audioPlayer.removeEventListener('loadstart', this.onAudioLoadStart);
                    this.audioPlayer.removeEventListener('canplay', this.onAudioCanPlay);
                    this.audioPlayer.removeEventListener('loadeddata', this.onAudioLoaded);
                    this.audioPlayer.removeEventListener('error', this.onAudioError);
                    
                    this.audioPlayer.src = playUrl;
                    this.currentSongMid = song.songmid;
                    
                    let loadTimeout;

                    const handleCanPlay = () => {
                        clearTimeout(loadTimeout);
                        this.audioPlayer.removeEventListener('error', handleError);
                        this.onAudioCanPlay();
                    };
                    
                    const handleError = (e) => {
                        clearTimeout(loadTimeout);
                        this.audioPlayer.removeEventListener('canplay', handleCanPlay);
                        this.onAudioError(e);
                    };
                    
                    loadTimeout = setTimeout(() => {
                        this.isLoading = false;
                        this.showLoading(false);
                        this.currentLoadingSong = null;
                        this.audioPlayer.removeEventListener('canplay', handleCanPlay);
                        this.audioPlayer.removeEventListener('error', handleError);
                        this.showError('Audio loading timeout, please try again');
                        console.error('Audio loading timeout');
                    }, 15000);
                    
                    this.audioPlayer.addEventListener('canplay', handleCanPlay, { once: true });
                    this.audioPlayer.addEventListener('error', handleError, { once: true });
                    this.audioPlayer.addEventListener('loadstart', this.onAudioLoadStart, { once: true });
                    this.audioPlayer.addEventListener('loadeddata', this.onAudioLoaded, { once: true });
                } else {
                    throw new Error('No playback link available for this song');
                }
            } else {
                    throw new Error('Failed to get playback link');
            }
        } catch (error) {
            this.showLoading(false);
            this.currentLoadingSong = null;
            console.error('获取播放链接错误:', error);
            this.showError(error && error.message ? error.message : 'Failed to get playback link, please try again');
        } finally {
            this.isLoading = false;
        }
    }
    // Update progress
    updateProgress() {
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.progress.style.width = progress + '%';
            this.progressSlider.value = progress;
            this.currentTimeEl.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    // 开始同步检查
    startSyncCheck() {
        this.syncInterval = setInterval(() => {
            if (this.socket && this.currentRoom) {
                this.socket.emit('request_sync');
            }
        }, 5000); // 每5秒同步一次
    }

    // Stop sync check
    stopSyncCheck() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Reset player
    resetPlayer() {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.isPlaying = false;
        this.pendingSeekTime = null;
        this.currentSongMid = null;
        this.playPauseBtn.textContent = '▶';
        this.progress.style.width = '0%';
        this.progressSlider.value = 0;
        this.currentTimeEl.textContent = '0:00';
        this.playerSection.style.display = 'none';
    }
    sendMessage() {
        const content = this.chatInput.value.trim();
        if (!content) return;
        
        this.socket.emit('send_message', { content });
        this.chatInput.value = '';
    }

    // Add chat message
    addChatMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.user === this.currentUser.name ? 'user' : 'other'}`;
        
        messageEl.innerHTML = `
            <div class="message-header">${message.user}</div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;
        
        this.chatMessages.appendChild(messageEl);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // Add system message
    addSystemMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        messageEl.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        
        this.chatMessages.appendChild(messageEl);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // Update user list
    updateUserList(users) {
        if (!users) {
            users = this.currentRoom ? Array.from(this.currentRoom.users) : [];
        }
        
        const usersHTML = users.map(user => `
            <div class="user-item">
                <span class="user-avatar">👤</span>
                <span class="user-name">${this.escapeHtml(user.name)}</span>
            </div>
        `).join('');
        
        this.usersList.innerHTML = usersHTML;
        this.userCount.textContent = users.length;
    }


    // Utility methods
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    showLoading(show, text = 'Loading...') {
        this.loading.style.display = show ? 'flex' : 'none';
        document.getElementById('loadingText').textContent = text;
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.errorToast.style.display = 'block';
        setTimeout(() => {
            this.errorToast.style.display = 'none';
        }, 3000);
    }

    clearSearchResults() {
        this.searchResults.innerHTML = '';
    }

    showNoResults() {
        this.searchResults.innerHTML = `
            <div class="no-results">
No related songs found, please try other keywords
            </div>
        `;
    }
}

// Initialize room player
const roomPlayer = new RoomMusicPlayer();

// Initialize after page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sync music room loaded');
});
