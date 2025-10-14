class RoomMusicPlayer {
    constructor() {
        // 自动检测当前域名和端口
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
        
        // DOM元素
        this.entryPage = document.getElementById('entryPage');
        this.roomPage = document.getElementById('roomPage');
        this.loading = document.getElementById('loading');
        this.errorToast = document.getElementById('errorToast');
        
        // 入口页面元素
        this.enterRoomBtn = document.getElementById('enterRoomBtn');
        this.userName = document.getElementById('userName');
        
        // 房间页面元素
        this.roomTitle = document.getElementById('roomTitle');
        this.userCount = document.getElementById('userCount');
        this.shareRoomBtn = document.getElementById('shareRoomBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        
        // 搜索和播放列表
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.playlistContainer = document.getElementById('playlist');
        this.clearPlaylistBtn = document.getElementById('clearPlaylist');
        
        // 聊天
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        
        // 用户列表
        this.usersList = document.getElementById('usersList');
        
        // 播放器
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

    // 初始化音频事件处理函数
    initAudioEventHandlers() {
        this.onAudioLoadStart = () => {
            console.log('音频开始加载...');
        };

        this.onAudioCanPlay = () => {
            console.log('音频可以播放');
            this.isLoading = false;
            this.showLoading(false);
            this.currentLoadingSong = null;
            this.applyPendingSeek();
            
            // 如果当前应该播放，则自动播放
            if (this.isPlaying) {
                this.audioPlayer.play().catch(e => {
                    console.warn('自动播放失败:', e);
                    this.showError('自动播放失败，请手动点击播放');
                });
            }
        };

        this.onAudioLoaded = () => {
            console.log('音频数据加载完成');
        };

        this.onAudioError = (e) => {
            console.error('音频加载错误:', e);
            this.isLoading = false;
            this.showLoading(false);
            this.currentLoadingSong = null;
            this.showError('音频加载失败，请重试');
        };
    }

    initEventListeners() {
        // 入口页面事件
        this.enterRoomBtn.addEventListener('click', () => this.enterRoom());
        
        // 房间页面事件
        this.shareRoomBtn.addEventListener('click', () => this.shareRoom());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // 搜索事件
        this.searchBtn.addEventListener('click', () => this.searchMusic());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchMusic();
        });
        
        // 播放列表事件
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        
        // 聊天事件
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // 播放控制事件
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
        
        // 音频事件
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => {
            this.durationEl.textContent = this.formatTime(this.audioPlayer.duration);
        });
        this.audioPlayer.addEventListener('ended', () => this.playNext());
        this.audioPlayer.addEventListener('error', (e) => {
            this.showError('音频加载失败');
        });
        
        // 初始化音量
        this.audioPlayer.volume = 0.5;
    }

    // 连接WebSocket
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
        });
        
        this.socket.on('disconnect', () => {
            console.log('WebSocket连接断开');
            this.showError('连接断开，正在重连...');
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
            this.playlist = this.currentRoom.playlist;
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

    // 进入房间
    enterRoom() {
        const userName = this.userName.value.trim();
        
        if (!userName) {
            this.showError('请输入昵称');
            return;
        }
        
        this.showLoading(true, '正在进入房间...');
        this.connectSocket();
        
        // 直接加入固定房间 "MAIN"
        this.socket.emit('join_room', {
            roomId: 'MAIN',
            userName: userName
        });
    }

    // 显示房间页面
    showRoomPage() {
        this.entryPage.style.display = 'none';
        this.roomPage.style.display = 'flex';
        this.loading.style.display = 'none';
        
        this.roomTitle.textContent = '同步听歌房间';
        this.userCount.textContent = this.currentRoom.users.size;
        
        this.updatePlaylistDisplay();
        this.updateUserList();
        
        // 请求同步播放状态
        this.socket.emit('request_sync');
        
        // 开始同步检查
        this.startSyncCheck();
    }

    // 离开房间
    leaveRoom() {
        if (confirm('确定要离开房间吗？')) {
            this.socket.emit('leave_room');
            this.socket.disconnect();
            this.roomPage.style.display = 'none';
            this.entryPage.style.display = 'flex';
            this.stopSyncCheck();
            this.resetPlayer();
        }
    }

    // 分享房间
    shareRoom() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            this.showError('房间链接已复制到剪贴板');
        }).catch(() => {
            this.showError('复制失败，请手动复制链接');
        });
    }

    // 搜索音乐
    async searchMusic() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) {
            this.showError('请输入搜索关键词');
            return;
        }

        this.showLoading(true, '正在搜索...');
        this.clearSearchResults();

        try {
            const response = await fetch(`${this.apiBase}/getSearchByKey?key=${encodeURIComponent(keyword)}`);
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

    // 显示搜索结果
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
                <button class="add-btn" onclick="roomPlayer.addToPlaylist('${song.songmid}', '${song.songid}', '${this.escapeHtml(song.songname)}', '${this.escapeHtml(song.singer[0].name)}', '${this.escapeHtml(song.albumname)}', '${song.albummid}')">
                    ➕
                </button>
            </div>
        `).join('');

        this.searchResults.innerHTML = resultsHTML;
    }

    // 添加歌曲到播放列表
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

    // 从播放列表删除歌曲
    removeFromPlaylist(index) {
        this.socket.emit('remove_from_playlist', { index });
    }

    // 清空播放列表
    clearPlaylist() {
        if (this.playlist.length === 0) return;
        
        if (confirm('确定要清空播放列表吗？')) {
            this.socket.emit('clear_playlist');
        }
    }

    // 更新播放列表显示
    updatePlaylistDisplay() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <p>播放列表为空</p>
                    <p>搜索歌曲并添加到播放列表</p>
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
                <button class="remove-btn" onclick="event.stopPropagation(); roomPlayer.removeFromPlaylist(${index})" title="删除">
                    ✕
                </button>
            </div>
        `).join('');

        this.playlistContainer.innerHTML = playlistHTML;
    }

    // 从播放列表播放歌曲
    playFromPlaylist(index) {
        this.socket.emit('play_song', { index });
    }

    // 播放控制
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

    // 同步播放
    syncPlayback(data) {
        if (!data.currentSong) return;
        
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

    // 更新播放器信息
    updatePlayerInfo(song) {
        document.getElementById('songTitle').textContent = song.title;
        document.getElementById('songArtist').textContent = song.artist;
        document.getElementById('songAlbum').textContent = song.album;
        document.getElementById('songImage').src = song.imageUrl;
    }

    // 加载并播放歌曲
    async loadAndPlaySong(song, startAt = 0) {
        if (!song.songmid) {
            this.showError('歌曲ID无效');
            return;
        }

        if (this.currentLoadingSong === song.songmid || this.isLoading) {
            console.log('正在加载中，跳过重复请求');
            return;
        }

        this.isLoading = true;
        this.pendingSeekTime = typeof startAt === 'number' ? Math.max(0, startAt) : 0;

        try {
            this.currentLoadingSong = song.songmid;
            this.showLoading(true, '正在获取播放链接...');
            
            const response = await fetch(`${this.apiBase}/getMusicPlay?songmid=${song.songmid}`);
            const data = await response.json();
            
            if (data.data && data.data.playUrl && data.data.playUrl[song.songmid]) {
                const playInfo = data.data.playUrl[song.songmid];
                
                // 检查是否有错误信息
                if (playInfo.error) {
                    throw new Error(playInfo.error);
                }
                
                const playUrl = playInfo.url;
                
                if (playUrl) {
                    console.log('设置音频源:', playUrl);
                    
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
                        this.showError('音频加载超时，请重试');
                        console.error('音频加载超时');
                    }, 15000);
                    
                    this.audioPlayer.addEventListener('canplay', handleCanPlay, { once: true });
                    this.audioPlayer.addEventListener('error', handleError, { once: true });
                    this.audioPlayer.addEventListener('loadstart', this.onAudioLoadStart, { once: true });
                    this.audioPlayer.addEventListener('loadeddata', this.onAudioLoaded, { once: true });
                } else {
                    throw new Error('该歌曲暂无播放链接');
                }
            } else {
                throw new Error('获取播放链接失败');
            }
        } catch (error) {
            this.showLoading(false);
            this.currentLoadingSong = null;
            console.error('获取播放链接错误:', error);
            this.showError(error && error.message ? error.message : '获取播放链接失败，请重试');
        } finally {
            this.isLoading = false;
        }
    }
    // 更新进度
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

    // 停止同步检查
    stopSyncCheck() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // 重置播放器
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

    // 添加聊天消息
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

    // 添加系统消息
    addSystemMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        messageEl.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        
        this.chatMessages.appendChild(messageEl);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // 更新用户列表
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


    // 工具方法
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

    showLoading(show, text = '正在加载...') {
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
                没有找到相关歌曲，请尝试其他关键词
            </div>
        `;
    }
}

// 初始化房间播放器
const roomPlayer = new RoomMusicPlayer();

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('同步听歌房间已加载');
});
