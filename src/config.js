const coarse =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

export const IS_TOUCH = typeof window !== "undefined" && (coarse || "ontouchstart" in window);

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 30;
export const RENDER_DISTANCE = IS_TOUCH ? 4 : 6;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
export const GRAVITY = 26;
export const JUMP_SPEED = 8.4;
export const WALK_SPEED = 4.6;
export const SPRINT_SPEED = 7.4;
export const FLY_SPEED = 13;
export const SWIM_SPEED = 3.2;
export const REACH = 6;
export const DAY_LENGTH = 600;
export const SAVE_KEY = "vexio-craft-save-v1";
export const AUTOSAVE_INTERVAL = 20;
export const MAX_HEALTH = 20;
export const FALL_SAFE = 3;
export const REGEN_DELAY = 6;
