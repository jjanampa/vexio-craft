function serverUrl() {
  const override = import.meta.env?.VITE_WS_URL;
  if (override) return override;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

export class Net {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.id = null;
    this.connected = false;
    this.stopped = false;
    this.opened = false;
    this.retryTimer = null;
    this.retryDelay = 1000;
    this.name = "";
  }

  connect(name) {
    this.name = name;
    this.stopped = false;
    this.open();
  }

  open() {
    if (this.stopped) return;
    let ws;
    try {
      ws = new WebSocket(`${serverUrl()}?name=${encodeURIComponent(this.name)}`);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.opened = true;
      this.retryDelay = 1000;
    };
    ws.onmessage = (event) => this.handle(event);
    ws.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      this.ws = null;
      if (this.stopped) return;
      this.handlers.onStatus?.(false, wasConnected);
      this.scheduleRetry();
    };
    ws.onerror = () => {};
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.open(), this.retryDelay);
    this.retryDelay = Math.min(5000, Math.round(this.retryDelay * 1.6));
  }

  handle(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    switch (msg.t) {
      case "welcome":
        this.id = msg.id;
        this.connected = true;
        this.handlers.onWelcome?.(msg);
        break;
      case "join":
        this.handlers.onJoin?.(msg.player);
        break;
      case "leave":
        this.handlers.onLeave?.(msg.id, msg.name);
        break;
      case "rename":
        this.handlers.onRename?.(msg.id, msg.name);
        break;
      case "state":
        this.handlers.onState?.(msg.players);
        break;
      case "edit":
        this.handlers.onEdit?.(msg);
        break;
      case "anim":
        this.handlers.onSwing?.(msg.id, msg.a);
        break;
      case "prime":
        this.handlers.onPrime?.(msg.x, msg.y, msg.z);
        break;
      case "boom":
        this.handlers.onBoom?.(msg.x, msg.y, msg.z, msg.r);
        break;
    }
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  sendState(x, y, z, yaw, pitch, dim, item, armor, character) {
    this.send({ t: "state", x, y, z, yaw, pitch, dim, item, armor, character });
  }

  sendEdit(x, y, z, id, dim) {
    this.send({ t: "edit", x, y, z, id, dim });
  }

  sendSwing() {
    this.send({ t: "anim", a: "swing" });
  }

  sendPrime(x, y, z) {
    this.send({ t: "prime", x, y, z });
  }

  sendBoom(x, y, z, r) {
    this.send({ t: "boom", x, y, z, r });
  }

  sendDim(dim, x, y, z) {
    this.send({ t: "dim", dim, x, y, z });
  }

  rename(name) {
    this.name = name;
    this.send({ t: "rename", name });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
