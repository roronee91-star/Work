// 공통 GLSL 조각
export const HASH = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
`;

export const FOG = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uDay;
const vec3 SUN_DIR = vec3(0.4472, 0.5367, 0.7155);
vec3 applyFog(vec3 col, vec3 worldPos){
  float d = length(worldPos - cameraPosition);
  float f = 1.0 - exp(-pow(d * uFogDensity, 2.0));
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

// 강 중심선 (JS와 GLSL이 같은 값을 써야 합니다)
export const RIVER_HALF = 230;
export function riverCenter(x) {
  return 300 + 90 * Math.sin(x / 900) + 30 * Math.sin(x / 310 + 1.3);
}
export const RIVER_GLSL = /* glsl */`
float riverC(float x){ return 300.0 + 90.0 * sin(x / 900.0) + 30.0 * sin(x / 310.0 + 1.3); }
`;
