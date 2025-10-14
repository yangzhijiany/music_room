const { Server } = require('socket.io');
const RoomManager = require('./room-manager');

class WebSocketServer {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.roomManager = new RoomManager();
        this.setupEventHandlers();
        
        console.log('WebSocket服务器已启动');
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`用户连接: ${socket.id}`);

            // 创建房间
            socket.on('create_room', (data) => {
                try {
                    const room = this.roomManager.createRoom(data.roomName);
                    socket.join(room.id);
                    
                    // 加入房间
                    const result = this.roomManager.joinRoom(room.id, socket.id, {
                        name: data.userName || `用户${socket.id.slice(-4)}`
                    });
                    
                    if (result.success) {
                        socket.emit('room_created', {
                            room: room,
                            user: result.user
                        });
                        
                        // 通知房间内其他用户
                        socket.to(room.id).emit('user_joined', {
                            user: result.user,
                            roomUsers: this.roomManager.getRoomUsers(room.id)
                        });
                    }
                } catch (error) {
                    socket.emit('error', { message: '创建房间失败' });
                }
            });

            // 加入房间
            socket.on('join_room', (data) => {
                try {
                    const result = this.roomManager.joinRoom(data.roomId, socket.id, {
                        name: data.userName || `用户${socket.id.slice(-4)}`
                    });
                    
                    if (result.success) {
                        socket.join(data.roomId);
                        
                        socket.emit('room_joined', {
                            room: result.room,
                            user: result.user
                        });
                        
                        // 通知房间内其他用户
                        socket.to(data.roomId).emit('user_joined', {
                            user: result.user,
                            roomUsers: this.roomManager.getRoomUsers(data.roomId)
                        });
                        
                        // 发送当前房间状态给新用户
                        const room = this.roomManager.getRoom(data.roomId);
                        if (room.currentSong) {
                            const progress = this.roomManager.getCurrentProgress(data.roomId);
                            socket.emit('sync_playback', {
                                currentSong: room.currentSong,
                                currentIndex: room.currentIndex,
                                isPlaying: room.isPlaying,
                                progress: progress.success ? progress : null
                            });
                        }
                    } else {
                        socket.emit('error', { message: result.error });
                    }
                } catch (error) {
                    socket.emit('error', { message: '加入房间失败' });
                }
            });

            // 离开房间
            socket.on('leave_room', () => {
                const result = this.roomManager.leaveRoom(socket.id);
                if (result) {
                    socket.leave(result.user.roomId);
                    
                    // 通知房间内其他用户
                    socket.to(result.user.roomId).emit('user_left', {
                        user: result.user,
                        roomUsers: this.roomManager.getRoomUsers(result.user.roomId)
                    });
                }
            });

            // 添加歌曲到播放列表
            socket.on('add_to_playlist', (data) => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.addToPlaylist(user.roomId, data.song);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playlist_updated', {
                        playlist: result.playlist,
                        addedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 从播放列表删除歌曲
            socket.on('remove_from_playlist', (data) => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.removeFromPlaylist(user.roomId, data.index);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playlist_updated', {
                        playlist: result.playlist,
                        currentIndex: result.currentIndex,
                        removedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 清空播放列表
            socket.on('clear_playlist', () => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.clearPlaylist(user.roomId);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playlist_updated', {
                        playlist: result.playlist,
                        currentIndex: -1,
                        clearedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 播放歌曲
            socket.on('play_song', (data) => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.playSong(user.roomId, data.index);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playback_started', {
                        currentSong: result.currentSong,
                        currentIndex: result.currentIndex,
                        startTime: result.startTime,
                        currentTime: result.currentTime,
                        playedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 暂停/恢复播放
            socket.on('toggle_play_pause', () => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.togglePlayPause(user.roomId);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playback_toggled', {
                        isPlaying: result.isPlaying,
                        startTime: result.startTime,
                        currentTime: result.currentTime,
                        toggledBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 上一首
            socket.on('play_previous', () => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.playPrevious(user.roomId);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playback_started', {
                        currentSong: result.currentSong,
                        currentIndex: result.currentIndex,
                        startTime: result.startTime,
                        currentTime: result.currentTime,
                        playedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 下一首
            socket.on('play_next', () => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const result = this.roomManager.playNext(user.roomId);
                if (result.success) {
                    // 广播给房间内所有用户
                    this.io.to(user.roomId).emit('playback_started', {
                        currentSong: result.currentSong,
                        currentIndex: result.currentIndex,
                        startTime: result.startTime,
                        currentTime: result.currentTime,
                        playedBy: user.name
                    });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // 发送聊天消息
            socket.on('send_message', (data) => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: '用户未加入房间' });
                    return;
                }

                const message = {
                    id: Date.now() + Math.random(),
                    user: user.name,
                    content: data.content,
                    timestamp: Date.now(),
                    type: data.type || 'text'
                };

                // 广播给房间内所有用户
                this.io.to(user.roomId).emit('message_received', message);
            });

            // 请求同步播放状态
            socket.on('request_sync', () => {
                const user = this.roomManager.getUser(socket.id);
                if (!user) {
                    return;
                }

                const room = this.roomManager.getRoom(user.roomId);
                if (room && room.currentSong) {
                    const progress = this.roomManager.getCurrentProgress(user.roomId);
                    socket.emit('sync_playback', {
                        currentSong: room.currentSong,
                        currentIndex: room.currentIndex,
                        isPlaying: room.isPlaying,
                        progress: progress.success ? progress : null
                    });
                }
            });

            // 用户断开连接
            socket.on('disconnect', () => {
                console.log(`用户断开连接: ${socket.id}`);
                const result = this.roomManager.leaveRoom(socket.id);
                if (result) {
                    // 通知房间内其他用户
                    socket.to(result.user.roomId).emit('user_left', {
                        user: result.user,
                        roomUsers: this.roomManager.getRoomUsers(result.user.roomId)
                    });
                }
            });
        });
    }

    // 获取房间列表
    getRoomList() {
        return this.roomManager.getRoomList();
    }

    // 获取房间信息
    getRoomInfo(roomId) {
        return this.roomManager.getRoom(roomId);
    }
}

module.exports = WebSocketServer;

