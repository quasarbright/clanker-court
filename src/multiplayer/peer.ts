import Peer from "peerjs";
import type { DataConnection } from "peerjs";

export interface RoomHandle {
  roomCode: string;
  destroy: () => void;
}

export interface ConnectionHandle {
  send: (msg: object) => void;
  destroy: () => void;
}

export function createRoom(
  onConnection: (send: (msg: object) => void) => void,
  onData: (msg: unknown) => void,
): Promise<RoomHandle> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    peer.on("error", reject);
    peer.on("open", (id) => {
      peer.on("connection", (conn: DataConnection) => {
        conn.on("open", () => {
          const send = (msg: object) => conn.send(msg);
          onConnection(send);
          conn.on("data", onData);
        });
      });
      resolve({ roomCode: id, destroy: () => peer.destroy() });
    });
  });
}

export function joinRoom(
  roomCode: string,
  onData: (msg: unknown) => void,
): Promise<ConnectionHandle> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    peer.on("error", reject);
    peer.on("open", () => {
      const conn = peer.connect(roomCode, { reliable: true });
      conn.on("error", reject);
      conn.on("open", () => {
        conn.on("data", onData);
        resolve({ send: (msg: object) => conn.send(msg), destroy: () => peer.destroy() });
      });
    });
  });
}
