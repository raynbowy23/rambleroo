import type { PostcardLook, Region, SceneFamily } from '../../lib/types'
import type { Inks } from './motifs/types'

// Far terrain, middle terrain, keyline, accent, water. Each row is a distinct ink set.
const palettes: Record<SceneFamily, [string, string, string, string, string][]> = {
  river: [
    ['#afc2a0', '#718d69', '#284d43', '#c77a43', '#6daca9'],
    ['#dabd87', '#b89359', '#684b38', '#bc643e', '#8caaa8'],
    ['#c6b6ce', '#9c819e', '#493e61', '#c8918c', '#839eb9'],
    ['#d2b4a2', '#b77864', '#633e44', '#dcaa61', '#668f99'],
  ],
  coast: [
    ['#b9d5ba', '#77a798', '#275b56', '#d7ac69', '#4eaaa9'],
    ['#e4c7a2', '#c99272', '#794c46', '#e1ac72', '#9faac2'],
    ['#c0c5d1', '#8299ad', '#394763', '#c69188', '#6081a5'],
    ['#d9ca9a', '#aaa16c', '#5b6242', '#bc7643', '#89b6a0'],
  ],
  mountain: [
    ['#a9c5be', '#688f90', '#2c5057', '#c29b5c', '#78aead'],
    ['#d7bba0', '#b18b70', '#654d42', '#cc854c', '#9caaa0'],
    ['#c9b7ce', '#97849e', '#493e61', '#cd9ba4', '#869bb8'],
    ['#cccd9c', '#90975c', '#4d5b3d', '#b88946', '#75a191'],
  ],
  forest: [
    ['#b6c4a3', '#73906b', '#294f40', '#c6a660', '#73a19a'],
    ['#d6bf94', '#b1915f', '#6b5035', '#c57b3d', '#a3b6a2'],
    ['#c3bfd1', '#8e88a6', '#48415f', '#bf8b98', '#819cab'],
    ['#cbb5a2', '#ac796b', '#633f48', '#d4a565', '#719798'],
  ],
  desert: [
    ['#dfb894', '#c6754d', '#7b4032', '#e5ad54', '#8aa8a4'],
    ['#ded1a8', '#b9a370', '#71603e', '#bf8944', '#93b7a8'],
    ['#d7b7c2', '#ae8198', '#664562', '#db9b84', '#8b9cbb'],
    ['#bfc7c0', '#849e98', '#395d60', '#cf9d76', '#759faa'],
  ],
  town: [
    ['#bac5a5', '#81916e', '#354e42', '#b96748', '#78a29e'],
    ['#ddc79c', '#b59a68', '#68503d', '#c08746', '#91aaa4'],
    ['#c4bfd2', '#9089a7', '#484363', '#bd8896', '#7f9fb4'],
    ['#d7b3a0', '#b88072', '#713f46', '#d6a86b', '#74949e'],
  ],
  prairie: [
    ['#d6ce99', '#b2ad67', '#5a613d', '#b87441', '#89a79c'],
    ['#e3c296', '#c49a60', '#77543a', '#c16a3e', '#9fafb4'],
    ['#c5bacc', '#a28ca6', '#534563', '#c79894', '#819db3'],
    ['#b8cebb', '#81a78e', '#345f51', '#d5ac65', '#74a7a7'],
  ],
}

export function warmWinter(region?: Region) {
  return region === 'florida' || region === 'hawaii' || region === 'southwest' || region === 'deep-south'
}

export function lookInks(family: SceneFamily, look: PostcardLook): Inks {
  const [far, mid, dark, accent, water] = palettes[family][look.palette % 4] ?? palettes[family][0]
  return { paper: '#f6ead3', far, mid, dark, accent, water }
}

export function lookSky(look: PostcardLook, region?: Region) {
  const skies = {
    dawn: ['#d8949c', '#f7d0a8'],
    day: ['#79b9c4', '#e6e8c9'],
    golden: ['#d69b50', '#f5d08a'],
    dusk: ['#454368', '#b4829e'],
  }
  const [top, bottom] = skies[look.time]
  return {
    top: look.season === 'winter' && look.time === 'day' ? (warmWinter(region) ? '#aab5ad' : '#c6d5d4') : top,
    bottom,
  }
}

/** Blend seasonal pigment into terrain while retaining the selected palette. */
export function mixInk(base: string, tint: string, amount: number) {
  const channels = [1, 3, 5].map((start) => {
    const a = parseInt(base.slice(start, start + 2), 16)
    const b = parseInt(tint.slice(start, start + 2), 16)
    return Math.round(a * (1 - amount) + b * amount)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${channels.join('')}`
}
