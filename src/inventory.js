import { stackLimit } from "./items.js";

export function makeStack(id, count = 1) {
  if (!id || count <= 0) return null;
  return { id, count: Math.min(count, stackLimit(id)) };
}

export class Inventory {
  constructor(size = 36) {
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  get(index) {
    return this.slots[index] || null;
  }

  set(index, stack) {
    if (index < 0 || index >= this.size) return;
    this.slots[index] =
      stack && stack.id && stack.count > 0 ? { id: stack.id, count: Math.min(stack.count, stackLimit(stack.id)) } : null;
  }

  add(id, count = 1) {
    if (!id || count <= 0) return 0;
    const limit = stackLimit(id);
    let left = count;
    for (let i = 0; i < this.size && left > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id && slot.count < limit) {
        const take = Math.min(limit - slot.count, left);
        slot.count += take;
        left -= take;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(limit, left);
        this.slots[i] = { id, count: take };
        left -= take;
      }
    }
    return left;
  }

  countOf(id) {
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.id === id) total += slot.count;
    }
    return total;
  }

  canAdd(id, count = 1) {
    const limit = stackLimit(id);
    let space = 0;
    for (const slot of this.slots) {
      if (!slot) space += limit;
      else if (slot.id === id && slot.count < limit) space += limit - slot.count;
      if (space >= count) return true;
    }
    return space >= count;
  }

  remove(id, count = 1) {
    if (count <= 0) return true;
    if (this.countOf(id) < count) return false;
    let left = count;
    for (let i = 0; i < this.size && left > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id) {
        const take = Math.min(slot.count, left);
        slot.count -= take;
        left -= take;
        if (slot.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  takeFrom(index, count) {
    const slot = this.slots[index];
    if (!slot) return null;
    const take = Math.min(slot.count, count);
    slot.count -= take;
    const stack = { id: slot.id, count: take };
    if (slot.count <= 0) this.slots[index] = null;
    return stack;
  }

  findSlotWith(id, from = 0, to = this.size) {
    for (let i = from; i < to; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id) return i;
    }
    return -1;
  }

  firstEmpty(from = 0, to = this.size) {
    for (let i = from; i < to; i++) {
      if (!this.slots[i]) return i;
    }
    return -1;
  }

  serialize() {
    return this.slots.map((slot) => (slot ? [slot.id, slot.count] : null));
  }

  load(list) {
    for (let i = 0; i < this.size; i++) {
      const entry = list?.[i];
      if (Array.isArray(entry) && Number.isInteger(entry[0]) && Number.isInteger(entry[1]) && entry[1] > 0) {
        this.slots[i] = { id: entry[0], count: Math.min(entry[1], stackLimit(entry[0])) };
      } else {
        this.slots[i] = null;
      }
    }
  }

  clear() {
    this.slots.fill(null);
  }
}
