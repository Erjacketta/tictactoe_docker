// file: server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"]
  }
});

let rooms = {};

function createRoom() {
  const roomId = 'room-' + Math.random().toString(36).substr(2, 9);
  rooms[roomId] = {
    players: [],
    board: Array(9).fill(null),
    currentTurn: 'X'
  };
  return roomId;
}

function checkWinner(board, symbol) {
  const winningCombinations = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return winningCombinations.some(comb => comb.every(i => board[i] === symbol));
}

function checkDraw(board) {
  return board.every(cell => cell !== null);
}

app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
  let assignedRoom = null;
  let playerSymbol = null;

  // Cerca una stanza libera
  for (let roomId in rooms) {
    if (rooms[roomId].players.length < 2) {
      assignedRoom = roomId;
      break;
    }
  }

  if (!assignedRoom) {
    assignedRoom = createRoom();
  }

  const room = rooms[assignedRoom];
  playerSymbol = room.players.length === 0 ? 'X' : 'O';
  room.players.push({ id: socket.id, symbol: playerSymbol });
  socket.join(assignedRoom);

  console.log(`Giocatore ${playerSymbol} connesso: ${socket.id} nella stanza ${assignedRoom}`);

  if (room.players.length === 2) {
    room.players.forEach(p => {
      io.to(p.id).emit('gameStart', { symbol: p.symbol });
    });
  } else {
    socket.emit('waiting');
  }

  socket.on('makeMove', index => {
    if (!room || room.board[index] || room.currentTurn !== playerSymbol) return;

    room.board[index] = playerSymbol;
    io.to(assignedRoom).emit('moveMade', { index, symbol: playerSymbol });

    if (checkWinner(room.board, playerSymbol)) {
      io.to(assignedRoom).emit('gameOver', { index, symbol: playerSymbol, message: `Giocatore ${playerSymbol} ha vinto!` });
    } else if (checkDraw(room.board)) {
      io.to(assignedRoom).emit('draw');
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
    }
  });

  socket.on('restartGame', () => {
    room.board = Array(9).fill(null);
    room.currentTurn = 'X';
    io.to(assignedRoom).emit('restartGame');
  });

  socket.on('disconnect', () => {
    console.log(`Giocatore ${playerSymbol} disconnesso: ${socket.id}`);
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[assignedRoom];
      } else {
        io.to(assignedRoom).emit('waiting');
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server avviato su http://localhost:3000');
});
