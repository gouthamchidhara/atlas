import { useEffect, useRef } from 'react'

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float wave(vec2 p, float speed, float scale) {
    return sin((p.x + p.y) * scale + uTime * speed) * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float horizon = smoothstep(-0.18, 0.52, uv.y);
    float pulse = wave(uv, 0.45, 5.0);
    float ribbon = smoothstep(0.028, 0.0, abs(uv.y + 0.12 * sin(uv.x * 6.0 + uTime * 0.65)));
    float glow = 0.18 / length(uv - vec2(0.32 * sin(uTime * 0.18), 0.18));

    vec3 deep = vec3(0.04, 0.12, 0.12);
    vec3 glass = vec3(0.22, 0.48, 0.44);
    vec3 sun = vec3(0.94, 0.46, 0.20);
    vec3 pearl = vec3(0.98, 0.91, 0.78);

    vec3 color = mix(pearl, glass, horizon);
    color = mix(color, deep, smoothstep(0.12, -0.44, uv.y));
    color += sun * glow * 0.24;
    color += mix(glass, sun, pulse) * ribbon * 0.42;

    float vignette = smoothstep(1.15, 0.28, length(uv));
    gl_FragColor = vec4(color * vignette, 1.0);
  }
`

export function CinematicScene() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return undefined
    }

    let cleanup = () => undefined
    let isMounted = true

    import('three').then((THREE) => {
      if (!isMounted) {
        return
      }

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      const scene = new THREE.Scene()
      const camera = new THREE.Camera()
      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
      }
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
      let animationFrame = 0

      scene.add(mesh)
      host.appendChild(renderer.domElement)

      const resize = () => {
        const width = host.clientWidth || window.innerWidth
        const height = host.clientHeight || window.innerHeight
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height, false)
        uniforms.uResolution.value.set(width, height)
      }

      const render = (time: number) => {
        uniforms.uTime.value = time * 0.001
        renderer.render(scene, camera)
        animationFrame = window.requestAnimationFrame(render)
      }

      resize()
      window.addEventListener('resize', resize)
      animationFrame = window.requestAnimationFrame(render)

      cleanup = () => {
        window.cancelAnimationFrame(animationFrame)
        window.removeEventListener('resize', resize)
        renderer.dispose()
        material.dispose()
        mesh.geometry.dispose()
        host.removeChild(renderer.domElement)
      }
    })

    return () => {
      isMounted = false
      cleanup()
    }
  }, [])

  return <div className="cinematic-scene" ref={hostRef} aria-hidden="true" />
}