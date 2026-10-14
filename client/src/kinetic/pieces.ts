import * as THREE from 'three'
import { PAL } from './palette'
import type { IndustryType } from './state'

// Procedural miniature industry pieces — recognizable tabletop components,
// built from primitives with restrained materials. No glow slabs.

const MAT = {
  brick: new THREE.MeshStandardMaterial({ color: PAL.brick, roughness: 0.92, metalness: 0.04 }),
  brickDark: new THREE.MeshStandardMaterial({ color: 0x4a2f1e, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: PAL.darkWood, roughness: 0.9 }),
  walnut: new THREE.MeshStandardMaterial({ color: PAL.walnut, roughness: 0.85 }),
  iron: new THREE.MeshStandardMaterial({ color: PAL.iron, roughness: 0.6, metalness: 0.55 }),
  steel: new THREE.MeshStandardMaterial({ color: PAL.steel, roughness: 0.35, metalness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: PAL.brass, roughness: 0.32, metalness: 0.95 }),
  copper: new THREE.MeshStandardMaterial({ color: PAL.copper, roughness: 0.42, metalness: 0.85 }),
  coal: new THREE.MeshStandardMaterial({ color: PAL.coal, roughness: 1 }),
  parch: new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 1 }),
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}

export interface PieceVisual {
  group: THREE.Group
  hitbox: THREE.Mesh
  flagMat: THREE.MeshStandardMaterial
  trimMats: THREE.MeshStandardMaterial[]
  windowMats: THREE.MeshStandardMaterial[]
}

let sharedFlagGeo: THREE.PlaneGeometry | null = null
let sharedPoleGeo: THREE.CylinderGeometry | null = null

export function createIndustryPiece(kind: IndustryType, level: 1 | 2, playerCss: string, playerHex: number): PieceVisual {
  const g = new THREE.Group()
  const scale = level === 2 ? 1.18 : 1

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x2a2018,
    emissive: PAL.window,
    emissiveIntensity: 0.16,
    roughness: 0.4,
  })
  const furnaceMat = new THREE.MeshStandardMaterial({
    color: 0x30150a,
    emissive: PAL.furnace,
    emissiveIntensity: 0.55,
    roughness: 0.7,
  })

  switch (kind) {
    case 'coal': {
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.26), MAT.wood, -0.12, 0.24, 0))
      const roof = mesh(new THREE.ConeGeometry(0.25, 0.14, 4), MAT.iron, -0.12, 0.41, 0)
      roof.rotation.y = Math.PI / 4
      g.add(roof)
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8), MAT.brickDark, 0.06, 0.29, -0.08))
      const pile = mesh(new THREE.ConeGeometry(0.17, 0.2, 7), MAT.coal, 0.18, 0.24, 0.12)
      g.add(pile)
      break
    }
    case 'iron': {
      g.add(mesh(new THREE.BoxGeometry(0.44, 0.26, 0.34), MAT.iron, 0, 0.27, 0))
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.22, 10), MAT.brickDark, 0.02, 0.5, 0))
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.iron)
      cap.position.set(0.02, 0.61, 0)
      g.add(cap)
      const vent = mesh(new THREE.BoxGeometry(0.12, 0.09, 0.02), furnaceMat, 0, 0.28, 0.175)
      g.add(vent)
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 6), MAT.copper, -0.16, 0.31, -0.1))
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 6), MAT.copper, 0.2, 0.27, -0.12))
      break
    }
    case 'cotton': {
      g.add(mesh(new THREE.BoxGeometry(0.36, 0.5, 0.26), MAT.brick, 0, 0.39, 0))
      for (let r = 0; r < 3; r++) {
        for (let cIdx = 0; cIdx < 3; cIdx++) {
          g.add(
            mesh(
              new THREE.BoxGeometry(0.055, 0.07, 0.008),
              windowMat,
              -0.11 + cIdx * 0.11,
              0.26 + r * 0.13,
              0.133,
            ),
          )
        }
      }
      g.add(mesh(new THREE.CylinderGeometry(0.038, 0.052, 0.52, 8), MAT.brickDark, 0.14, 0.4, -0.07))
      break
    }
    case 'manufacturer': {
      g.add(mesh(new THREE.BoxGeometry(0.46, 0.22, 0.3), MAT.brick, 0, 0.25, 0))
      g.add(mesh(new THREE.BoxGeometry(0.46, 0.08, 0.3), MAT.wood, 0, 0.4, 0))
      const ridge = mesh(new THREE.BoxGeometry(0.48, 0.05, 0.1), MAT.iron, 0, 0.47, 0)
      g.add(ridge)
      for (let i = 0; i < 3; i++) {
        g.add(mesh(new THREE.BoxGeometry(0.05, 0.09, 0.006), windowMat, -0.15 + i * 0.15, 0.27, 0.153))
      }
      const gear = mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 14), MAT.brass, -0.235, 0.3, 0)
      gear.rotation.y = Math.PI / 2
      g.add(gear)
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.042, 0.3, 8), MAT.brickDark, 0.17, 0.51, -0.08))
      break
    }
    case 'pottery': {
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.26, 12), MAT.brick, -0.08, 0.27, 0))
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        MAT.brickDark,
      )
      dome.position.set(-0.08, 0.4, 0)
      g.add(dome)
      g.add(mesh(new THREE.BoxGeometry(0.09, 0.11, 0.03), MAT.coal, -0.08, 0.2, 0.185))
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), MAT.wood, 0.16, 0.2, 0.1))
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), MAT.parch, 0.19, 0.19, -0.08))
      break
    }
    case 'brewery': {
      g.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.28, 12), MAT.copper, -0.1, 0.28, 0))
      g.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.28, 12), MAT.copper, 0.12, 0.28, 0.04))
      g.add(mesh(new THREE.SphereGeometry(0.115, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.copper, -0.1, 0.42, 0))
      const barrel = (x: number, y: number, z: number): void => {
        const b = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 9), MAT.wood, x, y, z)
        b.rotation.z = Math.PI / 2
        b.rotation.y = Math.random() * 0.4
        g.add(b)
      }
      barrel(0.16, 0.075, -0.14)
      barrel(0.05, 0.075, -0.16)
      barrel(0.1, 0.075, 0.16)
      break
    }
  }

  // Level plinth with brass studs.
  const plinth = mesh(new THREE.BoxGeometry(0.62, 0.09, 0.5), MAT.walnut, 0, 0.045, 0)
  g.add(plinth)
  const studs = new THREE.Group()
  for (let i = 0; i < level; i++) {
    studs.add(mesh(new THREE.SphereGeometry(0.022, 8, 8), MAT.brass, -0.05 + i * 0.1, 0.098, 0.255))
  }
  g.add(studs)

  // Ownership: small flag + colored trim.
  const flagMat = new THREE.MeshStandardMaterial({ color: playerHex, roughness: 0.8, side: THREE.DoubleSide })
  if (!sharedPoleGeo) sharedPoleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6)
  if (!sharedFlagGeo) sharedFlagGeo = new THREE.PlaneGeometry(0.15, 0.09)
  g.add(mesh(sharedPoleGeo, MAT.iron, 0.26, 0.39, -0.2))
  const flag = new THREE.Mesh(sharedFlagGeo, flagMat)
  flag.position.set(0.335, 0.49, -0.2)
  g.add(flag)

  const trim = new THREE.MeshStandardMaterial({ color: playerHex, roughness: 0.5, metalness: 0.35 })
  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.012, 6, 20), trim)
  trimRing.rotation.x = Math.PI / 2
  trimRing.position.y = 0.092
  g.add(trimRing)

  g.scale.setScalar(scale)

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.1, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  hitbox.position.y = 0.55
  hitbox.userData.kind = kind
  g.add(hitbox)

  return { group: g, hitbox, flagMat, trimMats: [trim], windowMats: [windowMat] }
}

// Contact shadow blob.
let shadowMat: THREE.MeshBasicMaterial | null = null
export function contactShadow(radius = 0.5): THREE.Mesh {
  if (!shadowMat) {
    shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  }
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), shadowMat)
  m.rotation.x = -Math.PI / 2
  return m
}

// Far background industrial skyline — very low contrast silhouettes.
export function buildSkyline(): THREE.Group {
  const group = new THREE.Group()
  const silMat = new THREE.MeshStandardMaterial({ color: 0x0d0a07, roughness: 1 })
  let rng = 987654321
  const rand = (): number => {
    rng = (rng * 1664525 + 1013904223) % 4294967296
    return rng / 4294967296
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rand() * 0.14
    const dist = 24 + rand() * 9
    const w = 1.6 + rand() * 3.4
    const h = 1.4 + rand() * 4.2
    const d = 1.4 + rand() * 2.8
    const b = mesh(new THREE.BoxGeometry(w, h, d), silMat, Math.cos(a) * dist, h / 2 - 0.4, Math.sin(a) * dist)
    b.rotation.y = rand() * Math.PI
    group.add(b)
    const chimneys = 1 + Math.floor(rand() * 3)
    for (let cIdx = 0; cIdx < chimneys; cIdx++) {
      const ch = h * (0.5 + rand() * 0.7)
      group.add(
        mesh(
          new THREE.CylinderGeometry(0.09, 0.14, ch, 7),
          silMat,
          b.position.x + (rand() - 0.5) * w,
          h - 0.4 + ch / 2,
          b.position.z + (rand() - 0.5) * d,
        ),
      )
    }
  }
  return group
}
