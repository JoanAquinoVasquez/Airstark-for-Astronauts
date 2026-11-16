import { Color, MeshPhysicalMaterial } from 'three'

export function createHeartTissueMaterial() {
  const material = new MeshPhysicalMaterial({
    roughness: 0.49,
    ior: 1.4,
    specularIntensity: 0.62,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34,
    sheen: 0.4,
    sheenColor: '#a24549',
    sheenRoughness: 0.78,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tissueDark = { value: new Color('#541824') }
    shader.uniforms.tissueLight = { value: new Color('#b96560') }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      varying vec3 vTissuePosition;
    `).replace('#include <project_vertex>', `
      vTissuePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #include <project_vertex>
    `)

    // Procedural pigmentation stays fixed in LPS space as the phase and camera change.
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vTissuePosition;
      uniform vec3 tissueDark;
      uniform vec3 tissueLight;

      float tissueHash(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float tissueNoise(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(tissueHash(cell), tissueHash(cell + vec3(1, 0, 0)), f.x),
              mix(tissueHash(cell + vec3(0, 1, 0)), tissueHash(cell + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(tissueHash(cell + vec3(0, 0, 1)), tissueHash(cell + vec3(1, 0, 1)), f.x),
              mix(tissueHash(cell + vec3(0, 1, 1)), tissueHash(cell + vec3(1, 1, 1)), f.x), f.y),
          f.z
        );
      }
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      float mottling = tissueNoise(vTissuePosition * 0.07);
      float fibres = tissueNoise(vTissuePosition * vec3(0.76, 0.76, 0.24) + mottling);
      float tone = clamp(0.1 + mottling * 0.64 + fibres * 0.26, 0.0, 1.0);
      diffuseColor.rgb *= mix(tissueDark, tissueLight, tone);
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (fibres - 0.5) * 0.15, 0.0, 1.0);
    `)
  }

  return material
}
