// const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.users = new Map(); // socketId -> user info
        
        // 创建固定的主房间
        this.createMainRoom();
    }
    
    // 创建固定的主房间
    createMainRoom() {
        const mainRoom = {
            id: 'MAIN',
            name: '同步听歌房间',
            users: new Set(),
            playlist: [],
			currentSong: null,
			currentIndex: -1,
			isPlaying: false,
			startTime: null,
			playbackOffset: 0,
			createdAt: Date.now()
		};
        
        this.rooms.set('MAIN', mainRoom);
        console.log('固定主房间已创建: MAIN');
    }

    // 创建房间
    createRoom(roomName = '') {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            name: roomName || `房间${roomId}`,
            users: new Set(),
            playlist: [],
			currentSong: null,
			currentIndex: -1,
			isPlaying: false,
			startTime: null,
			playbackOffset: 0,
			createdAt: Date.now()
		};
        
        this.rooms.set(roomId, room);
        console.log(`房间创建: ${roomId}`);
        return room;
    }

    // 加入房间
    joinRoom(roomId, socketId, userInfo) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        // 检查房间是否已满（可选限制）
        if (room.users.size >= 100) {
            return { success: false, error: '房间已满' };
        }

        // 添加用户到房间
        const user = {
            id: socketId,
            name: userInfo.name || `用户${socketId.slice(-4)}`,
            joinTime: Date.now(),
            isOnline: true
        };

        room.users.add(socketId);
        this.users.set(socketId, { ...user, roomId });

        console.log(`用户 ${user.name} 加入房间 ${roomId}`);
        return { success: true, room, user };
    }

    // 离开房间
    leaveRoom(socketId) {
        const user = this.users.get(socketId);
        if (!user) {
            return null;
        }

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.users.delete(socketId);
            
        // 如果房间为空且不是主房间，删除房间
        if (room.users.size === 0 && user.roomId !== 'MAIN') {
            this.rooms.delete(user.roomId);
            console.log(`房间 ${user.roomId} 已删除`);
        }
        }

        this.users.delete(socketId);
        console.log(`用户 ${user.name} 离开房间`);
        return { room, user };
    }

    // 获取房间信息
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // 获取用户信息
    getUser(socketId) {
        return this.users.get(socketId);
    }

    // 添加歌曲到播放列表
    addToPlaylist(roomId, song) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        // 检查是否已存在
        const exists = room.playlist.some(s => s.songmid === song.songmid);
        if (exists) {
            return { success: false, error: '歌曲已在播放列表中' };
        }

        room.playlist.push(song);
        console.log(`歌曲 ${song.title} 添加到房间 ${roomId} 的播放列表`);
        return { success: true, playlist: room.playlist };
    }

    // 从播放列表删除歌曲
    removeFromPlaylist(roomId, index) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        if (index < 0 || index >= room.playlist.length) {
            return { success: false, error: '索引无效' };
        }

        const removedSong = room.playlist.splice(index, 1)[0];
        
        // 调整当前播放索引（在新的队列管理模式下，当前播放歌曲总是在索引0）
        if (index === 0 && room.currentIndex === 0) {
            // 删除的是当前正在播放的歌曲
            if (room.playlist.length === 0) {
                room.currentIndex = -1;
                room.currentSong = null;
                room.isPlaying = false;
                room.startTime = null;
                room.playbackOffset = 0;
            } else {
                // 播放下一首歌曲（新的头部）
                room.currentIndex = 0;
                room.currentSong = room.playlist[0];
                room.isPlaying = true;
                room.playbackOffset = 0;
                room.startTime = Date.now();
            }
        } else if (index < room.currentIndex) {
            // 删除的歌曲在当前播放歌曲之前，调整索引
            room.currentIndex--;
        }

        console.log(`歌曲 ${removedSong.title} 从房间 ${roomId} 的播放列表删除`);
        return { 
            success: true, 
            playlist: room.playlist, 
            currentIndex: room.currentIndex,
            currentSong: room.currentSong,
            isPlaying: room.isPlaying
        };
    }

    // 清空播放列表
    clearPlaylist(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

		room.playlist = [];
		room.currentIndex = -1;
		room.currentSong = null;
		room.isPlaying = false;
		room.playbackOffset = 0;
		room.startTime = null;

        console.log(`房间 ${roomId} 的播放列表已清空`);
        return { success: true, playlist: room.playlist };
    }

    // 播放歌曲
    playSong(roomId, index) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        if (index < 0 || index >= room.playlist.length) {
            return { success: false, error: '索引无效' };
        }

        // 如果点击播放列表中的歌曲，移除该歌曲之前的所有歌曲
        if (index > 0) {
            room.playlist.splice(0, index);
            room.currentIndex = 0; // 现在要播放的歌曲在列表头部
        } else {
            room.currentIndex = index;
        }

		room.currentSong = room.playlist[room.currentIndex];
		room.isPlaying = true;
		room.playbackOffset = 0;
		room.startTime = Date.now();

        console.log(`房间 ${roomId} 开始播放: ${room.currentSong.title}`);
        return { 
            success: true, 
            currentSong: room.currentSong, 
            currentIndex: room.currentIndex,
            playlist: room.playlist, // 返回更新后的播放列表
            startTime: room.startTime,
            currentTime: this._getElapsedSeconds(room)
        };
    }

    // 暂停/恢复播放
    togglePlayPause(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        if (!room.currentSong) {
            return { success: false, error: '没有正在播放的歌曲' };
        }

		const now = Date.now();
		const elapsed = this._getElapsedSeconds(room, now);

		if (room.isPlaying) {
			room.playbackOffset = elapsed;
			room.isPlaying = false;
			room.startTime = null;
		} else {
			const offsetMs = Math.max(0, room.playbackOffset || 0) * 1000;
			room.startTime = now - Math.round(offsetMs);
			room.isPlaying = true;
			room.playbackOffset = 0;
		}

		console.log(`房间 ${roomId} ${room.isPlaying ? '恢复' : '暂停'}播放`);
		return { 
			success: true, 
			isPlaying: room.isPlaying,
			startTime: room.startTime,
			currentTime: room.isPlaying ? this._getElapsedSeconds(room) : room.playbackOffset
		};
    }

    // 歌曲播放完成，自动播放下一首并移除当前歌曲
    onSongFinished(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        if (room.playlist.length === 0) {
            return { success: false, error: '播放列表为空' };
        }

        // 移除当前播放的歌曲（列表头部的歌曲）
        const finishedSong = room.playlist.shift();
        console.log(`房间 ${roomId} 歌曲播放完成，已移除: ${finishedSong.title}`);

        // 检查是否还有歌曲
        if (room.playlist.length === 0) {
            // 播放列表为空，停止播放
            room.currentIndex = -1;
            room.currentSong = null;
            room.isPlaying = false;
            room.startTime = null;
            room.playbackOffset = 0;
            
            return {
                success: true,
                currentSong: null,
                currentIndex: -1,
                playlist: room.playlist,
                isPlaying: false,
                message: '播放列表已清空'
            };
        } else {
            // 播放下一首歌曲（现在是列表头部）
            room.currentIndex = 0;
            room.currentSong = room.playlist[0];
            room.isPlaying = true;
            room.playbackOffset = 0;
            room.startTime = Date.now();

            console.log(`房间 ${roomId} 自动播放下一首: ${room.currentSong.title}`);
            return {
                success: true,
                currentSong: room.currentSong,
                currentIndex: room.currentIndex,
                playlist: room.playlist,
                startTime: room.startTime,
                currentTime: this._getElapsedSeconds(room),
                message: `自动播放下一首: ${room.currentSong.title}`
            };
        }
    }

    // 上一首（在新的队列管理模式下，上一首功能被禁用，因为已播放的歌曲已被移除）
    playPrevious(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        return { 
            success: false, 
            error: '上一首功能已禁用，因为已播放的歌曲会自动从列表中移除' 
        };
    }

    // 下一首
    playNext(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: '房间不存在' };
        }

        if (room.playlist.length === 0) {
            return { success: false, error: '播放列表为空' };
        }

        // 移除当前歌曲，播放下一首（新的头部歌曲）
        const currentSong = room.playlist.shift();
        console.log(`房间 ${roomId} 手动切换到下一首，已移除: ${currentSong.title}`);

        if (room.playlist.length === 0) {
            // 没有下一首了
            room.currentIndex = -1;
            room.currentSong = null;
            room.isPlaying = false;
            room.startTime = null;
            room.playbackOffset = 0;
            
            return {
                success: true,
                currentSong: null,
                currentIndex: -1,
                playlist: room.playlist,
                isPlaying: false,
                message: '没有下一首歌曲'
            };
        }

        // 播放下一首歌曲（现在是列表头部）
        room.currentIndex = 0;
        room.currentSong = room.playlist[0];
        room.isPlaying = true;
        room.playbackOffset = 0;
        room.startTime = Date.now();

        console.log(`房间 ${roomId} 播放下一首: ${room.currentSong.title}`);
        return { 
            success: true, 
            currentSong: room.currentSong, 
            currentIndex: room.currentIndex,
            playlist: room.playlist,
            startTime: room.startTime,
            currentTime: this._getElapsedSeconds(room)
        };
    }

    // 获取当前播放进度
    getCurrentProgress(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.currentSong) {
            return { success: false, error: '没有正在播放的歌曲' };
        }

        const reportedAt = Date.now();
        const elapsed = this._getElapsedSeconds(room, reportedAt);
        
        return {
            success: true,
            currentTime: elapsed,
            isPlaying: room.isPlaying,
            startTime: room.isPlaying ? room.startTime : null,
            playbackOffset: room.isPlaying ? 0 : room.playbackOffset,
            reportedAt
        };
    }

    _getElapsedSeconds(room, referenceTime = Date.now()) {
        if (room.isPlaying && room.startTime) {
            return Number(((referenceTime - room.startTime) / 1000).toFixed(3));
        }
        return Number((room.playbackOffset || 0).toFixed(3));
    }

    // 生成房间ID
    generateRoomId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // 获取房间列表（可选功能）
    getRoomList() {
        const roomList = [];
        for (const [id, room] of this.rooms) {
            roomList.push({
                id,
                name: room.name,
                userCount: room.users.size,
                currentSong: room.currentSong,
                isPlaying: room.isPlaying,
                createdAt: room.createdAt
            });
        }
        return roomList;
    }

    // 获取房间用户列表
    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return [];
        }

        const users = [];
        for (const socketId of room.users) {
            const user = this.users.get(socketId);
            if (user) {
                users.push({
                    id: user.id,
                    name: user.name,
                    joinTime: user.joinTime
                });
            }
        }
        return users;
    }
}

module.exports = RoomManager;
