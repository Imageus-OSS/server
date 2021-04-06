import http from 'http';
import socket from 'socket.io';

let io;
let httpServer;

const Socket = {
  createServer: (app) => {
    httpServer = app ? http.createServer(app) : http.createServer();

    if (!io) {
      io = new socket.Server(httpServer);
    }

    return io;
  },

  getSocketServer: () => io,
  getHttpServer: () => httpServer,
};

export default Socket;
