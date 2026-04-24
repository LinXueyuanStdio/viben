export const roundedRectVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const roundedRectFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec4 uBgColor;
  uniform vec4 uBorderColor;
  uniform float uBorderWidth;

  float sdRoundedRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 halfSize = uSize * 0.5;
    float d = sdRoundedRect(p, halfSize, uRadius);
    float aa = 1.0;
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    float innerAlpha = 1.0 - smoothstep(-aa, aa, d + uBorderWidth);
    vec4 col = mix(uBorderColor, uBgColor, innerAlpha);
    col.a *= alpha;
    if (col.a < 0.001) discard;
    gl_FragColor = col;
  }
`;
