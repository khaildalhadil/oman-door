// Shared, mutable input state (read every frame by the player controller).
// Keyboard uses KeyboardEvent.code so it works with an Arabic keyboard layout too.

export const input = {
  x: 0, // right (+) / left (-)
  y: 0, // forward (+) / back (-)
  run: false,
  jump: false, // consumed by the controller
  interact: false, // consumed by whoever handles it
  joyX: 0,
  joyY: 0,
}

const keys = new Set<string>()

function update() {
  const f = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0
  const b = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0
  const r = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0
  const l = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0
  input.x = r - l
  input.y = f - b
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight')
}

let installed = false

export function installKeyboard() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    if (e.code === 'Space' && !e.repeat) input.jump = true
    if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) input.interact = true
    keys.add(e.code)
    update()
  })
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code)
    update()
  })
  window.addEventListener('blur', () => {
    keys.clear()
    update()
  })
}

/** Combined move vector (keyboard + joystick), magnitude <= 1. */
export function moveVector() {
  let x = input.x + input.joyX
  let y = input.y + input.joyY
  const m = Math.hypot(x, y)
  if (m > 1) {
    x /= m
    y /= m
  }
  const joyMag = Math.hypot(input.joyX, input.joyY)
  return { x, y, mag: Math.min(1, m), run: input.run || joyMag > 0.92 }
}

export function consumeJump() {
  const j = input.jump
  input.jump = false
  return j
}

export function consumeInteract() {
  const j = input.interact
  input.interact = false
  return j
}
