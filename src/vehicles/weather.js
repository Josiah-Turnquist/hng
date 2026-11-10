// Field wear on vehicles' paint, added to their materials' shaders: a tank
// that has been driven, not one out of the box. Painted per pixel from where
// the point is on the vehicle as built (models/index.js bakes that into each
// mesh as `aModel`, so the wear rides with turrets and wheels as they turn),
// and from which way the surface faces:
//  - the paint itself: uneven, sun-bleached in patches, never one flat color;
//  - streaks down the upright faces, where rain has run through the dust;
//  - dust lying on everything that faces up;
//  - dust and dried mud thrown up by the tracks and wheels: the running gear
//    and lower hull caked, thinning out by the height of the hull top;
//  - paint chipped to dark steel and rust along edges and in scattered specks;
//  - and a matte finish: service paint is flat, dust flatter. (The clean
//    paint took the sky's reflection like plastic.)
// A material without `aModel` on its mesh (the track links, a stand-in) is
// left as it is.
import { addPatch, after } from '../render/materialPatch.js';

const VERT_DECL = /* glsl */ `
attribute vec4 aModel;
varying vec4 vVehModel;
varying float vVehUp;`;
const VERT_MAIN = /* glsl */ `
vVehModel = aModel;
vVehUp = normalize( mat3( modelMatrix ) * objectNormal ).y;`;

const FRAG_DECL = /* glsl */ `
varying vec4 vVehModel;
varying float vVehUp;
uniform vec3 uVehDust;
float vehHash3( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}
float vehNoise3( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  vec2 e = vec2( 1.0, 0.0 );
  return mix(
    mix( mix( vehHash3( i ), vehHash3( i + e.xyy ), f.x ), mix( vehHash3( i + e.yxy ), vehHash3( i + e.xxy ), f.x ), f.y ),
    mix( mix( vehHash3( i + e.yyx ), vehHash3( i + e.xyx ), f.x ), mix( vehHash3( i + e.yxx ), vehHash3( i + e.xxx ), f.x ), f.y ),
    f.z );
}
// Two layers, the second turned and finer, so the blotches don't line up in
// squares along the hull (plain value noise, cut off at a level, does).
const mat3 vehTurn = mat3( 0.36, 0.48, -0.8, -0.8, 0.6, 0.0, 0.48, 0.64, 0.6 );
float vehBlotch( vec3 p ) {
  vec3 q = vehTurn * p;
  return 0.6 * vehNoise3( q ) + 0.4 * vehNoise3( vehTurn * q * 2.13 + 17.0 );
}
float vehDustAmt = 0.0;
float vehChip = 0.0;`;

// paint: 1 for painted steel (everything), 0 for rubber, bare steel and
// canvas (the dust and mud only).
const fragColor = (paint) => /* glsl */ `
if ( vVehModel.w > 1.5 ) {
  vec3 P = vVehModel.xyz;
  float h = P.y;
  float n1 = vehNoise3( P * 1.3 + 11.0 );
  float n2 = vehBlotch( P * 5.0 + 7.0 );
  float n3 = vehBlotch( P * 17.0 + 3.0 );
  float near = 1.0 - smoothstep( 25.0, 60.0, length( vViewPosition ) );
  float n4 = near > 0.0 ? vehNoise3( P * 75.0 ) : 0.5;
  vec3 c = diffuseColor.rgb;
  float paint = ${paint.toFixed(1)};
  // The paint: uneven, bleached in patches.
  c *= mix( 1.0, 0.74 + 0.44 * n1, paint );
  float L = dot( c, vec3( 0.3, 0.59, 0.11 ) );
  c = mix( c, vec3( L ) * vec3( 1.1, 1.07, 0.98 ) * 1.2, 0.3 * smoothstep( 0.45, 0.85, n2 * 0.6 + n1 * 0.4 ) * paint );
  // Streaks down the upright faces.
  float upright = 1.0 - smoothstep( 0.3, 0.75, abs( vVehUp ) );
  float run = vehNoise3( vec3( P.x * 11.0, P.y * 0.8, P.z * 11.0 ) );
  float runFine = vehNoise3( vec3( P.x * 34.0, P.y * 1.6, P.z * 34.0 ) + 5.0 );
  c *= 1.0 - 0.27 * upright * smoothstep( 0.5, 0.85, run * 0.75 + n2 * 0.25 ) * paint;
  c = mix( c, uVehDust * 1.15, 0.16 * upright * smoothstep( 0.6, 0.9, runFine ) * ( 0.4 + 0.6 * n2 ) * paint );
  // Dust lying on what faces up; dust and dried mud thrown up from below.
  float top = smoothstep( 0.5, 0.95, vVehUp );
  float under = smoothstep( 0.3, 0.9, -vVehUp );
  float low = 1.0 - smoothstep( 0.2, 1.35 + 0.5 * ( n1 - 0.5 ), h );
  float splash = smoothstep( 0.56, 0.72, n3 ) * ( 1.0 - smoothstep( 0.4, 1.7, h ) );
  float dust = clamp( max( top * ( 0.3 + 0.5 * n2 ), low * ( 0.3 + 0.6 * n2 ) ) + splash * 0.3 + under * 0.35, 0.0, 0.92 );
  float mud = ( 1.0 - smoothstep( 0.05, 0.7, h + ( n2 - 0.5 ) * 0.4 ) ) * ( 0.5 + 0.5 * n3 );
  // Chipped paint: along edges, and scattered specks and scratches close up.
  #ifndef FLAT_SHADED
    float curv = length( fwidth( vNormal ) ) / max( length( fwidth( vViewPosition ) ), 1e-5 );
  #else
    float curv = 0.0;
  #endif
  float edge = smoothstep( 18.0, 90.0, curv ) * near;
  float chip = clamp( edge * smoothstep( 0.3, 0.65, n3 ) * 0.9 + smoothstep( 0.87, 0.94, n4 ) * smoothstep( 0.4, 0.75, n2 ) * near * 0.7, 0.0, 1.0 ) * paint;
  vec3 steel = mix( vec3( 0.045, 0.04, 0.036 ), vec3( 0.085, 0.05, 0.03 ), smoothstep( 0.4, 0.85, n2 ) );
  c = mix( c, steel, chip * 0.85 );
  c = mix( c, uVehDust * ( 0.82 + 0.36 * n3 ), dust );
  c = mix( c, uVehDust * 0.55 * ( 0.85 + 0.3 * n3 ), mud * 0.7 );
  vehDustAmt = max( dust, mud );
  vehChip = chip * ( 1.0 - vehDustAmt );
  diffuseColor.rgb = c;
}`;
const FRAG_ROUGH = /* glsl */ `
if ( vVehModel.w > 1.5 ) {
  // Flat service paint, flatter under dust; bare steel a little brighter.
  roughnessFactor = mix( max( roughnessFactor, 0.78 ), 1.0, vehDustAmt );
  roughnessFactor = mix( roughnessFactor, 0.55, vehChip * 0.6 );
}`;
const FRAG_METAL = /* glsl */ `
if ( vVehModel.w > 1.5 ) metalnessFactor = mix( metalnessFactor * ( 1.0 - vehDustAmt ), 0.8, vehChip * 0.5 );`;

// The color of the dust and dried mud (linear): the pale earth of the map.
const DUST = { value: null };

// Add the wear to a vehicle material (once; shared by every vehicle using it).
export function weatherVehicleMaterial(THREE, material, { paint = true } = {}) {
  if (!material?.isMeshStandardMaterial || material.userData.vehWeather) return material;
  material.userData.vehWeather = paint ? 'paint' : 'dust';
  DUST.value ||= new THREE.Color(0x8a7a5c).convertSRGBToLinear();
  addPatch(material, `vehWeather${paint ? 1 : 0}`, (shader) => {
    shader.uniforms.uVehDust = DUST;
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', VERT_DECL);
    vs = after(vs, '#include <beginnormal_vertex>', VERT_MAIN);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = after(fs, '#include <common>', FRAG_DECL);
    fs = after(fs, '#include <map_fragment>', fragColor(paint ? 1 : 0));
    fs = after(fs, '#include <roughnessmap_fragment>', FRAG_ROUGH);
    fs = after(fs, '#include <metalnessmap_fragment>', FRAG_METAL);
    shader.fragmentShader = fs;
  });
  return material;
}

// Bake where each point is on the vehicle as built into its meshes (aModel:
// x, y, z in the vehicle's frame, y up from the ground; w = 2 marks it as
// baked). Call with the vehicle's root at rest and its matrices up to date. A
// geometry used by several meshes (the same road wheel at each station)
// takes the place of the first.
export function bakeModelPlaces(THREE, root) {
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || o.geometry.attributes.aModel) return;
    const pos = o.geometry.attributes.position;
    if (pos.isInterleavedBufferAttribute) return;
    const a = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      a[i * 4] = v.x;
      a[i * 4 + 1] = v.y;
      a[i * 4 + 2] = v.z;
      a[i * 4 + 3] = 2;
    }
    o.geometry.setAttribute('aModel', new THREE.BufferAttribute(a, 4));
  });
}
