import * as THREE from 'three'

const TITLE_FONT = '"Reem Kufi", "Tajawal", "Segoe UI", Tahoma, sans-serif'
const BODY_FONT = '"Tajawal", "Segoe UI", Tahoma, sans-serif'

export async function loadFonts() {
  if (!('fonts' in document)) return
  await Promise.race([
    Promise.all([
      document.fonts.load(`700 80px ${TITLE_FONT}`, 'قلعة'),
      document.fonts.load(`500 40px ${BODY_FONT}`, 'نزوى'),
      document.fonts.load(`800 40px ${BODY_FONT}`, 'نزوى'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ])
}

function ornament(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string) {
  g.save()
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx - w / 2, cy)
  g.lineTo(cx - 26, cy)
  g.moveTo(cx + 26, cy)
  g.lineTo(cx + w / 2, cy)
  g.stroke()
  g.translate(cx, cy)
  g.rotate(Math.PI / 4)
  g.fillRect(-11, -11, 22, 22)
  g.rotate(-Math.PI / 4)
  g.beginPath()
  g.arc(-w / 2, 0, 5, 0, Math.PI * 2)
  g.arc(w / 2, 0, 5, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** Paint an information board (RTL Arabic) into a CanvasTexture. w/h in metres. */
export function drawBoard(title: string, lines: string[], w: number, h: number) {
  const ppm = 512
  const W = Math.round(w * ppm)
  const H = Math.round(h * ppm)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  // parchment-like plaster background
  const grad = g.createRadialGradient(W / 2, H * 0.4, H * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75)
  grad.addColorStop(0, '#f6ead1')
  grad.addColorStop(1, '#dcc49b')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  const img = g.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)

  // double frame (maroon + gold) with corner diamonds
  const m = 34
  g.strokeStyle = '#7a1f1f'
  g.lineWidth = 10
  g.strokeRect(m, m, W - 2 * m, H - 2 * m)
  g.strokeStyle = '#b8862f'
  g.lineWidth = 3
  g.strokeRect(m + 16, m + 16, W - 2 * m - 32, H - 2 * m - 32)
  for (const [x, y] of [
    [m, m],
    [W - m, m],
    [m, H - m],
    [W - m, H - m],
  ]) {
    g.save()
    g.translate(x, y)
    g.rotate(Math.PI / 4)
    g.fillStyle = '#7a1f1f'
    g.fillRect(-16, -16, 32, 32)
    g.fillStyle = '#d6aa4f'
    g.fillRect(-8, -8, 16, 16)
    g.restore()
  }

  g.direction = 'rtl'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#7a1f1f'
  g.font = `700 ${Math.round(H * 0.12)}px ${TITLE_FONT}`
  g.fillText(title, W / 2, H * 0.2)
  ornament(g, W / 2, H * 0.31, Math.min(W * 0.5, 520), '#b8862f')

  // bullet lines, right aligned
  const fs = Math.round(H * 0.068)
  g.font = `500 ${fs}px ${BODY_FONT}`
  g.textAlign = 'right'
  const right = W - m - 90
  const maxW = W - 2 * m - 150
  let y = H * 0.42
  const step = fs * 1.62
  for (const line of lines) {
    // simple word wrap
    const words = line.split(' ')
    let cur = ''
    const wrapped: string[] = []
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd
      if (g.measureText(test).width > maxW && cur) {
        wrapped.push(cur)
        cur = wd
      } else cur = test
    }
    if (cur) wrapped.push(cur)
    g.save()
    g.translate(right + 34, y)
    g.rotate(Math.PI / 4)
    g.fillStyle = '#b8862f'
    g.fillRect(-7, -7, 14, 14)
    g.restore()
    for (const wl of wrapped) {
      g.fillStyle = '#2a1a10'
      g.fillText(wl, right, y)
      y += step
    }
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
