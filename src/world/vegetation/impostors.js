// Far-distance trees: each tree and bush variant is rendered once at load from the
// front, the side and above into an atlas (albedo with alpha, and object-space
// normals so the impostors are lit like the real trees). Far away, a tree is three
// crossed cards showing those pictures (see impostorGeometry / makeImpostorMaterial).
import * as THREE from 'three';

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vN;
void main() {
  vUv = uv;
  vCol = color;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const BAKE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uMode;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vN;
void main() {
  vec4 t = texture2D( map, vUv );
  vec2 ts = vec2( textureSize( map, 0 ) );
  vec2 dx = dFdx( vUv * ts ), dy = dFdy( vUv * ts );
  float mip = max( 0.0, 0.5 * log2( max( dot( dx, dx ), dot( dy, dy ) ) ) );
  if ( t.a * ( 1.0 + mip * 0.5 ) < 0.5 ) discard;
  if ( uMode < 0.5 ) gl_FragColor = vec4( t.rgb * vCol, 1.0 );
  else gl_FragColor = vec4( normalize( vN ) * 0.5 + 0.5, 1.0 );
}`;

// variants: [{ geometry, info }] from buildVariant. Returns { map, normalMap, rects
// (Vector4 per variant and view: u, v, du, dv), info (Vector4 per variant: top card
// height as a fraction, fade end, fade start, 0), dims [{ width, height, bottom }],
// targets }.
export function bakeImpostors(renderer, variants, treeMap, { size = 2048 } = {}) {
  const W = size,
    H = size;
  const cell = size / 8;
  const topCell = cell / 2;
  const sideRows = Math.ceil((variants.length * 2) / 8);
  const scene = new THREE.Scene();
  const rects = [];
  const info = [];
  const dims = [];
  const slot = (i) => [(i % 8) * cell, H - (Math.floor(i / 8) + 1) * cell, cell, cell];
  const topSlot = (i) => [(i % 16) * topCell, H - sideRows * cell - (Math.floor(i / 16) + 1) * topCell, topCell, topCell];
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: treeMap }, uMode: { value: 0 } },
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  variants.forEach(({ geometry, info: vi }, v) => {
    const bottom = Math.min(0, geometry.boundingBox.min.y);
    const top = vi.top;
    const hw = vi.halfW;
    dims.push({ width: hw * 2, height: top - bottom, bottom });
    info.push(new THREE.Vector4(THREE.MathUtils.clamp((vi.C[1] - bottom) / (top - bottom), 0.2, 0.95), 1e9, 1e9, 0));
    // Front (seen from +z), side (seen from +x, image right = -z), top (seen from +y,
    // image up = -z): rotate each view to face the camera, which looks down -z.
    const views = [
      { r: new THREE.Matrix4(), w: hw * 2, h: top - bottom, y0: bottom, s: slot(v * 2) },
      { r: new THREE.Matrix4().makeRotationY(-Math.PI / 2), w: hw * 2, h: top - bottom, y0: bottom, s: slot(v * 2 + 1) },
      { r: new THREE.Matrix4().makeRotationX(Math.PI / 2), w: hw * 2, h: hw * 2, y0: -hw, s: topSlot(v) },
    ];
    for (const view of views) {
      const [px, py, pw, ph] = view.s;
      const k = Math.min((pw - 2) / view.w, (ph - 2) / view.h);
      const bw = view.w * k,
        bh = view.h * k;
      const ox = px + (pw - bw) / 2,
        oy = py + (ph - bh) / 2;
      const m = new THREE.Matrix4().makeTranslation(ox + bw / 2, oy - view.y0 * k, 0).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(view.r);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m);
      mesh.frustumCulled = false;
      scene.add(mesh);
      rects.push(new THREE.Vector4(ox / W, oy / H, bw / W, bh / H));
    }
  });
  scene.updateMatrixWorld(true);
  const cam = new THREE.OrthographicCamera(0, W, H, 0, 1, 40000);
  cam.position.set(0, 0, 20000);
  cam.updateMatrixWorld();
  const mk = (srgb, depth) =>
    new THREE.WebGLRenderTarget(W, H, {
      depthBuffer: depth,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    });
  const bakeAlbedo = mk(true, true);
  const bakeNormal = mk(false, true);
  const prev = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  const prevShadow = renderer.shadowMap.enabled;
  renderer.autoClear = true;
  renderer.shadowMap.enabled = false;
  // Clear transparent parts to foliage colors, so mipmaps fade to green, not black.
  renderer.setClearColor(new THREE.Color().setRGB(0.05, 0.08, 0.03), 0);
  mat.uniforms.uMode.value = 0;
  renderer.setRenderTarget(bakeAlbedo);
  renderer.render(scene, cam);
  renderer.setClearColor(new THREE.Color(0.5, 0.85, 0.5), 0);
  mat.uniforms.uMode.value = 1;
  renderer.setRenderTarget(bakeNormal);
  renderer.render(scene, cam);
  // Copy into depth-less targets (with mipmaps) and free the baking targets.
  const albedo = mk(true, false);
  const normal = mk(false, false);
  const copy = new THREE.ShaderMaterial({
    uniforms: { src: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D src; varying vec2 vUv; void main() { gl_FragColor = texture2D(src, vUv); }',
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
  quad.frustumCulled = false;
  const qs = new THREE.Scene();
  qs.add(quad);
  for (const [src, dst] of [
    [bakeAlbedo, albedo],
    [bakeNormal, normal],
  ]) {
    copy.uniforms.src.value = src.texture;
    renderer.setRenderTarget(dst);
    renderer.render(qs, cam);
  }
  copy.dispose();
  quad.geometry.dispose();
  bakeAlbedo.dispose();
  bakeNormal.dispose();
  renderer.setRenderTarget(prev);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.autoClear = prevAuto;
  renderer.shadowMap.enabled = prevShadow;
  mat.dispose();
  return { map: albedo.texture, normalMap: normal.texture, rects, info, dims, targets: [albedo, normal] };
}
