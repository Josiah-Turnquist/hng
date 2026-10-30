// Materials for the vegetation: three.js standard materials with shader patches for
// wind, distance fades (dithered, so levels of detail cross-fade without sorting),
// mipmap-aware alpha testing (foliage doesn't thin out with distance) and leaf
// translucency. Matching depth materials keep the shadows in step with the wind and
// the level-of-detail switches. All patches go through addPatch so they chain with
// the cascaded shadow maps.
import * as THREE from 'three';
import { addPatch, after, before, replace } from '../../render/materialPatch.js';

// Uniforms shared by every vegetation material (updated once per frame).
export function makeSharedUniforms(def) {
  const w = def.wind || { speed: 2, from: 270 };
  const a = (w.from * Math.PI) / 180;
  // Direction the wind blows toward (x east, z south), as in Atmosphere.setWind.
  const dir = new THREE.Vector2(-Math.sin(a), Math.cos(a));
  return {
    uVegTime: { value: 0 },
    uVegWind: { value: new THREE.Vector4(dir.x, dir.y, Math.min(1.2, w.speed / 10), 0) },
    uVegCam: { value: new THREE.Vector3() },
    uVegLod: { value: 1 },
    // Added to the fade dither each frame when TAA is on, so cross-fades between
    // levels of detail blend smoothly over a few frames (0 otherwise).
    uVegDither: { value: 0 },
  };
}

const COMMON_VERT = /* glsl */ `
uniform float uVegTime;
uniform vec4 uVegWind;
uniform vec3 uVegCam;
uniform float uVegLod;
float vegHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Random per-plant color: brightness and a slight shift toward yellow or blue-green.
vec3 vegTintOf(vec2 xz) {
  float h = vegHash(floor(xz * 4.0) * 0.25 + 11.3);
  float h2 = vegHash(floor(xz * 4.0) * 0.25 - 7.9);
  return (0.86 + 0.26 * h) * mix(vec3(1.05, 1.02, 0.86), vec3(0.95, 1.0, 1.06), h2);
}
// Large slow gusts drifting downwind.
float vegGust(vec2 xz) {
  vec2 d = uVegWind.xy;
  float t = uVegTime;
  return 0.6 + 0.4 * sin(dot(xz, d) * 0.045 - t * 1.1) * sin(dot(xz, vec2(-d.y, d.x)) * 0.031 + t * 0.43);
}
// w: bend weight (0 at the base, ~1 at the top of a 20 m tree), flutter weight, phase.
vec3 vegWindOffset(vec3 wp, vec3 w, float phase) {
  vec2 d = uVegWind.xy;
  float str = uVegWind.z;
  float t = uVegTime;
  float g = vegGust(wp.xz);
  float sway = (0.65 + 0.35 * sin(t * 0.9 + phase * 6.2832)) * g;
  vec3 off = vec3(d.x, 0.0, d.y) * (sway * str * 0.45 * w.x);
  float br = sin(t * 1.9 + w.z * 6.2832 + phase * 4.0) * 0.6 + sin(t * 3.3 + w.z * 11.0) * 0.4;
  off += vec3(-d.y, 0.3, d.x) * (br * str * 0.2 * w.x * g);
  float fl = sin(t * 8.0 + w.z * 31.0 + dot(wp, vec3(1.7, 1.1, 1.3)));
  off += vec3(0.35, 1.0, 0.3) * (fl * str * 0.11 * w.y * (0.5 + g));
  return off;
}
`;

const COMMON_FRAG = /* glsl */ `
uniform float uVegDither;
float vegDither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uVegDither); }
`;

// Alpha-tested foliage loses coverage in smaller mipmaps (the alpha averages below
// the threshold); scale alpha up with the mip level to keep crowns full at distance.
const ALPHA_BOOST = /* glsl */ `
#ifdef USE_MAP
{
  vec2 vegTs = vec2(textureSize(map, 0));
  vec2 vegDx = dFdx(vMapUv * vegTs), vegDy = dFdy(vMapUv * vegTs);
  float vegMip = max(0.0, 0.5 * log2(max(dot(vegDx, vegDx), dot(vegDy, vegDy))));
  diffuseColor.a *= 1.0 + vegMip * 0.3;
}
#endif
`;

// Keep the outward (crown) normals on both sides of double-sided cards.
const NORMAL_BEGIN = THREE.ShaderChunk.normal_fragment_begin.replace(/normal \*= faceDirection;/, '/* vegetation: outward normals on both sides */');

// Light shining through thin leaves and grass blades when the sun is behind them
// (looking toward it). It is added in the direct lighting, after shadows, so only
// sunlit leaves glow. amount: a GLSL expression; power: how tightly it follows the sun.
const TRANSLUCENT = (amount, power) => /* glsl */ `
void RE_Direct_Veg( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float vegBack = pow( saturate( dot( -geometryViewDir, directLight.direction ) ), ${power} );
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vegBack * ( ${amount} );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Veg`;

// Leaves and blades shade one another at grazing angles, so a crown or a meadow
// never mirrors a low sun (or the bright sky around it) the way a smooth surface
// would: much weaker reflection at grazing angles. (Without it crowns looked pale
// and frosted when looking toward the sun.)
const DULL = /* glsl */ `
material.specularF90 = 0.2;`;

// Late summer: a few trees (and hedge stretches) have patches of leaves turning
// yellow and brown. Per plant (from its position) and per branch (from the vertex).
const WARM_VERT = /* glsl */ `
vVegWarm = smoothstep( 0.8, 0.97, vegHash( vegBase.xz * 0.61 + 3.7 ) ) * ( 0.3 + 0.7 * vegHash( floor( transformed.xz * 1.3 + transformed.y ) + vegBase.xz ) );`;
const WARM_TINT = 'mix( vec3( 1.0 ), vec3( 1.5, 1.02, 0.45 ), vVegWarm * 0.55 )';

// A world-space offset added after instancing, in both the projected and the world
// position (shadow lookups); `vegHide` collapses the vertex (the triangle is dropped).
const PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += vegOff;
if ( vegHide ) mvPosition.xyz = vec3( 0.0, -1.0e5, 0.0 );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
const WORLDPOS = /* glsl */ `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
vec4 worldPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
worldPosition = instanceMatrix * worldPosition;
#endif
worldPosition.xyz += vegOff;
worldPosition = modelMatrix * worldPosition;
#endif
`;

// Instanced trees, bushes and hedges (InstancedMesh, geometry from treeGeometry.js).
// fadeIn / fadeOut: distance bands over which this level of detail fades in and out
// (dithered; a fade-in is the exact complement of the fade-out of the level before).
// shadow: the distance range in which instances cast shadows.
export function makeTreeMaterial(atlas, shared, { fadeIn = [-2, -1], fadeOut, shadow = [-1, 1e9], translucency = 0.12, name = 'vegetation' }) {
  const own = {
    uVegFade: { value: new THREE.Vector4(fadeIn[0], fadeIn[1], fadeOut[0], fadeOut[1]) },
    uVegShadow: { value: new THREE.Vector2(shadow[0], shadow[1]) },
    uVegTransl: { value: translucency },
  };
  const m = new THREE.MeshStandardMaterial({
    map: atlas.map,
    normalMap: atlas.normalMap,
    roughnessMap: atlas.ormMap,
    roughness: atlas.ormMap ? 1 : 0.8,
    metalness: 0,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  m.name = name;
  m.normalScale.set(0.8, 0.8);
  addPatch(m, 'veg-tree', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', `${COMMON_VERT}
attribute vec3 vegWind;
uniform vec4 uVegFade;
varying float vVegIn;
varying float vVegOut;
varying vec3 vVegTint;
varying float vVegWarm;`);
    vs = after(vs, '#include <begin_vertex>', `
vec3 vegBase = vec3( instanceMatrix[3] );
float vegPhase = vegHash(vegBase.xz);
vec3 vegOff = vegWindOffset(vegBase + transformed, vegWind, vegPhase);
float vegD = distance(vegBase + vec3(0.0, 6.0, 0.0), uVegCam) * uVegLod;
vVegIn = smoothstep(uVegFade.x, uVegFade.y, vegD);
vVegOut = 1.0 - smoothstep(uVegFade.z, uVegFade.w, vegD);
vVegTint = vegTintOf(vegBase.xz);
${WARM_VERT}
bool vegHide = vVegIn <= 0.0 || vVegOut <= 0.0;`);
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    vs = replace(vs, '#include <worldpos_vertex>', WORLDPOS);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = after(fs, '#include <common>', `${COMMON_FRAG}
uniform float uVegTransl;
varying float vVegIn;
varying float vVegOut;
varying vec3 vVegTint;
varying float vVegWarm;`);
    fs = after(fs, '#include <map_fragment>', ALPHA_BOOST);
    fs = after(fs, '#include <color_fragment>', `
diffuseColor.rgb *= vVegTint;
#ifdef USE_MAP
// Leaves only (the top row of the atlas is bark).
if ( vMapUv.y < 0.8 ) diffuseColor.rgb *= ${WARM_TINT};
#endif
float vegDi = vegDither();
if ( 1.0 - vegDi > vVegIn || vegDi > vVegOut ) discard;`);
    fs = replace(fs, '#include <normal_fragment_begin>', NORMAL_BEGIN);
    // Sunlight shining through leaves when looking toward the sun (bark much less:
    // its vertex color is darker in green).
    fs = after(fs, '#include <lights_physical_pars_fragment>', TRANSLUCENT('uVegTransl * vColor.g * vColor.g * vColor.g', '4.0'));
    fs = after(fs, '#include <lights_physical_fragment>', DULL);
    shader.fragmentShader = fs;
  });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.5, side: THREE.DoubleSide });
  depth.name = `${name}:depth`;
  addPatch(depth, 'veg-tree-depth', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', `${COMMON_VERT}
attribute vec3 vegWind;
uniform vec2 uVegShadow;`);
    vs = after(vs, '#include <begin_vertex>', `
vec3 vegBase = vec3( instanceMatrix[3] );
vec3 vegOff = vegWindOffset(vegBase + transformed, vegWind, vegHash(vegBase.xz));
float vegDd = distance(vegBase + vec3(0.0, 6.0, 0.0), uVegCam) * uVegLod;
bool vegHide = vegDd < uVegShadow.x || vegDd > uVegShadow.y;`);
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    shader.vertexShader = vs;
    shader.fragmentShader = after(shader.fragmentShader, '#include <map_fragment>', ALPHA_BOOST);
  });
  return { material: m, depth, uniforms: own };
}

// A standing impostor card fades out between these values of |cos| of the angle
// between its face and the eye (seen from above). The two cards stand at right
// angles, so one of them always faces the eye at least at cos 45 degrees: the end
// of the fade must stay below that, or a tree could thin out.
export const IMPOSTOR_EDGE_FADE = [0.12, 0.3];

// Far trees: three crossed cards with baked views (InstancedBufferGeometry from
// impostorGeometry). Per instance: iPos (x, y, z, yaw), iSize (width, height,
// variant, 0). imp.rects: atlas rect (u, v, du, dv) per variant and card; imp.info
// per variant: (top card height / height, fade-in start, fade-in end, far end).
// Shadows are cast from the middle of the fade-in out to shadowMax.
export function makeImpostorMaterial(imp, shared, { shadowMax, variants }) {
  const n = variants;
  const own = {
    uVegShadow: { value: new THREE.Vector2(0, shadowMax) },
    uImpRect: { value: imp.rects },
    uImpInfo: { value: imp.info },
  };
  const m = new THREE.MeshStandardMaterial({
    map: imp.map,
    normalMap: imp.normalMap,
    roughness: 0.9,
    metalness: 0,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  m.name = 'vegetation:impostors';
  const decl = `${COMMON_VERT}
attribute vec4 iPos;
attribute vec4 iSize;
attribute float vegCard;
uniform vec4 uImpRect[${n * 3}];
uniform vec4 uImpInfo[${n}];
uniform vec2 uVegShadow;`;
  const uvCode = `
int vegV = int( iSize.z + 0.5 );
vec4 vegRect = uImpRect[ vegV * 3 + int( vegCard + 0.5 ) ];
#ifdef USE_MAP
vMapUv = vegRect.xy + uv * vegRect.zw;
#endif
#ifdef USE_NORMALMAP
vNormalMapUv = vegRect.xy + uv * vegRect.zw;
#endif`;
  const xform = `
vec4 vegInfo = uImpInfo[ vegV ];
float vegC = cos( iPos.w ), vegS = sin( iPos.w );
vec3 vegAx = vec3( vegC, 0.0, -vegS );
vec3 vegAz = vec3( vegS, 0.0, vegC );
vec3 vegLp = position;
if ( vegCard > 1.5 ) vegLp.y = vegInfo.x;
vec3 transformed = iPos.xyz + vegAx * ( vegLp.x * iSize.x ) + vec3( 0.0, vegLp.y * iSize.y, 0.0 ) + vegAz * ( vegLp.z * iSize.x );
float vegD = distance( iPos.xyz + vec3( 0.0, iSize.y * 0.5, 0.0 ), uVegCam ) * uVegLod;
vec3 vegOff = vec3( 0.0 );`;
  addPatch(m, 'veg-impostor', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', `${decl}
varying float vVegIn;
varying float vVegOut;
varying vec3 vVegTint;
varying float vVegWarm;
varying vec3 vImpX;
varying vec3 vImpZ;`);
    vs = after(vs, '#include <uv_vertex>', uvCode);
    vs = replace(
      vs,
      '#include <beginnormal_vertex>',
      `float vegC0 = cos( iPos.w ), vegS0 = sin( iPos.w );
vImpX = vec3( vegC0, 0.0, -vegS0 );
vImpZ = vec3( vegS0, 0.0, vegC0 );
vec3 objectNormal = vegCard < 0.5 ? vImpZ : ( vegCard < 1.5 ? vImpX : vec3( 0.0, 1.0, 0.0 ) );`,
    );
    vs = replace(
      vs,
      '#include <begin_vertex>',
      `${xform}
vVegIn = smoothstep( vegInfo.y, vegInfo.z, vegD );
vVegOut = 1.0 - smoothstep( vegInfo.w * 0.88, vegInfo.w, vegD );
{
  vec3 vegTo = uVegCam - ( iPos.xyz + vec3( 0.0, iSize.y * vegInfo.x, 0.0 ) );
  float vegUp = abs( normalize( vegTo ).y );
  vVegOut *= vegCard > 1.5 ? smoothstep( 0.3, 0.55, vegUp ) : 1.0 - smoothstep( 0.8, 0.95, vegUp );
  // A standing card seen almost edge on squeezes the whole picture into a line a
  // pixel or two wide (and the mipmap alpha boost makes it solid): a dark vertical
  // stroke through the tree. Fade it out there; the other card then faces the eye.
  if ( vegCard < 1.5 ) {
    vec2 vegH = normalize( vegTo.xz + vec2( 1e-6, 0.0 ) );
    vec2 vegCn = vegCard < 0.5 ? vec2( vegS, vegC ) : vec2( vegC, -vegS );
    vVegOut *= smoothstep( ${IMPOSTOR_EDGE_FADE[0].toFixed(3)}, ${IMPOSTOR_EDGE_FADE[1].toFixed(3)}, abs( dot( vegH, vegCn ) ) );
  }
}
vVegTint = vegTintOf( iPos.xz );
vVegWarm = smoothstep( 0.8, 0.97, vegHash( iPos.xz * 0.61 + 3.7 ) ) * 0.6;
bool vegHide = vVegIn <= 0.0 || vVegOut <= 0.0;`,
    );
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    vs = replace(vs, '#include <worldpos_vertex>', WORLDPOS);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = after(fs, '#include <common>', `${COMMON_FRAG}
varying float vVegIn;
varying float vVegOut;
varying vec3 vVegTint;
varying float vVegWarm;
varying vec3 vImpX;
varying vec3 vImpZ;`);
    fs = after(fs, '#include <map_fragment>', ALPHA_BOOST);
    fs = after(fs, '#include <lights_physical_pars_fragment>', TRANSLUCENT('0.035', '4.0'));
    fs = after(fs, '#include <lights_physical_fragment>', DULL);
    fs = after(fs, '#include <color_fragment>', `
diffuseColor.rgb *= vVegTint * ${WARM_TINT};
float vegDi = vegDither();
if ( 1.0 - vegDi > vVegIn || vegDi > vVegOut ) discard;`);
    fs = replace(
      fs,
      '#include <normal_fragment_maps>',
      `{
  vec3 vegN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  vec3 vegW = normalize( vImpX * vegN.x + vec3( 0.0, vegN.y, 0.0 ) + vImpZ * vegN.z );
  normal = normalize( ( viewMatrix * vec4( vegW, 0.0 ) ).xyz );
}`,
    );
    shader.fragmentShader = fs;
  });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: imp.map, alphaTest: 0.5, side: THREE.DoubleSide });
  depth.name = 'vegetation:impostors:depth';
  addPatch(depth, 'veg-impostor-depth', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', decl);
    vs = after(vs, '#include <uv_vertex>', uvCode);
    vs = replace(
      vs,
      '#include <begin_vertex>',
      `${xform}
bool vegHide = vegD < ( vegInfo.y + vegInfo.z ) * 0.5 || vegD > min( uVegShadow.y, vegInfo.w );`,
    );
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    shader.vertexShader = vs;
    shader.fragmentShader = after(shader.fragmentShader, '#include <map_fragment>', ALPHA_BOOST);
  });
  return { material: m, depth, uniforms: own };
}

// Ground cover: grass, wheat, ferns and flowers as crossed cards (clumpGeometry).
// Per instance: iA (x, y, z, yaw), iB (width, height, atlas cell + tint in the
// fraction, rank). The farther away, the fewer clumps are kept (by rank) and the
// bigger they get; all of them shrink into the ground at the far end.
// lod: (full-density distance, thinning exponent, fade start, fade end).
export function makeGroundMaterial(atlas, shared, { lod, cols, rows }) {
  const own = {
    uGrassLod: { value: new THREE.Vector4(...lod) },
    uGrassCells: { value: new THREE.Vector2(cols, rows) },
  };
  const m = new THREE.MeshStandardMaterial({
    map: atlas.map,
    roughness: 0.88,
    metalness: 0,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  m.name = 'vegetation:ground';
  const decl = `${COMMON_VERT}
attribute vec4 iA;
attribute vec4 iB;
uniform vec4 uGrassLod;
uniform vec2 uGrassCells;
varying float vGrassV;
varying float vGrassTint;
varying float vGrassGust;`;
  const uvCode = `
{
  float cell = floor( iB.z );
  vec2 cs = 1.0 / uGrassCells;
  vec2 org = vec2( mod( cell, uGrassCells.x ), uGrassCells.y - 1.0 - floor( cell / uGrassCells.x ) ) * cs;
  vMapUv = org + cs * ( vec2( 0.012, 0.004 ) + uv * vec2( 0.976, 0.984 ) );
  vGrassV = uv.y;
  vGrassTint = fract( iB.z );
}`;
  // How much of this clump shows at its distance (farther: fewer, bigger clumps).
  const lodCode = `
float gD = distance( iA.xyz, uVegCam ) * max( uVegLod, 0.6 );
float gK = gD < uGrassLod.x ? 1.0 : pow( uGrassLod.x / gD, uGrassLod.y );
float gShow = clamp( ( gK - iB.w ) / ( 0.25 * gK ), 0.0, 1.0 ) * ( 1.0 - smoothstep( uGrassLod.z, uGrassLod.w, gD ) );
float gGrow = gShow * pow( gK, -0.3 );
float gC = cos( iA.w ), gS = sin( iA.w );`;
  const placeCode = `
vec3 gP = position;
gP.xz *= iB.x;
gP.y *= iB.y;
gP *= gGrow;
gP.xz = vec2( gC * gP.x + gS * gP.z, -gS * gP.x + gC * gP.z );
// Wind: tips bend downwind with gusts rolling across the field, plus a flicker.
float gGust = vegGust( iA.xz );
float gH = position.y * position.y;
vec2 gDir = uVegWind.xy;
float gFl = sin( uVegTime * 3.1 + iA.x * 1.7 + iA.z * 1.3 ) * 0.35;
vec2 gBend = ( gDir * ( 0.25 + 0.9 * gGust * gGust ) + vec2( -gDir.y, gDir.x ) * gFl ) * uVegWind.z * gH * gP.y * 1.1;
gP.xz += gBend;
gP.y -= dot( gBend, gBend ) * 0.5 / max( gP.y, 0.05 );
vGrassGust = gGust * position.y;
vec3 transformed = iA.xyz + gP;
bool vegHide = gShow <= 0.0;
vec3 vegOff = vec3( 0.0 );`;
  addPatch(m, 'veg-ground', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', decl);
    vs = after(vs, '#include <uv_vertex>', uvCode);
    vs = replace(
      vs,
      '#include <beginnormal_vertex>',
      `${lodCode}
vec3 cardN = normalize( vec3( gC * normal.x + gS * normal.z, 0.0, -gS * normal.x + gC * normal.z ) );
vec3 objectNormal = normalize( vec3( 0.0, 1.0, 0.0 ) + cardN * 0.45 );`,
    );
    vs = replace(vs, '#include <begin_vertex>', placeCode);
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = after(fs, '#include <common>', `
varying float vGrassV;
varying float vGrassTint;
varying float vGrassGust;`);
    fs = after(fs, '#include <map_fragment>', ALPHA_BOOST);
    // Each clump a little greener or more straw-colored; deep shade low in the
    // tufts; the blade tips glow when the low sun is behind them.
    fs = after(
      fs,
      '#include <color_fragment>',
      `
diffuseColor.rgb *= mix( vec3( 0.82, 0.94, 0.76 ), vec3( 1.14, 1.04, 0.86 ), vGrassTint );
diffuseColor.rgb *= mix( 0.32, 1.0, smoothstep( 0.0, 0.8, vGrassV ) );
diffuseColor.rgb *= 1.0 + 0.16 * vGrassGust;`,
    );
    fs = after(fs, '#include <lights_physical_pars_fragment>', TRANSLUCENT('0.22 * ( 0.25 + 0.75 * vGrassV )', '3.0'));
    fs = after(fs, '#include <lights_physical_fragment>', DULL);
    fs = replace(fs, '#include <normal_fragment_begin>', NORMAL_BEGIN);
    shader.fragmentShader = fs;
  });
  // Shadows of the grass close by (long ones when the sun is low): the same clumps
  // drawn into the shadow maps by a second mesh, which draws nothing on screen.
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.5, side: THREE.DoubleSide });
  depth.name = 'vegetation:ground:depth';
  addPatch(depth, 'veg-ground-depth', (shader) => {
    Object.assign(shader.uniforms, shared, own);
    let vs = shader.vertexShader;
    vs = after(vs, '#include <common>', decl);
    vs = after(vs, '#include <uv_vertex>', uvCode);
    vs = replace(vs, '#include <begin_vertex>', lodCode + placeCode);
    vs = replace(vs, '#include <project_vertex>', PROJECT);
    shader.vertexShader = vs;
    shader.fragmentShader = after(shader.fragmentShader, '#include <map_fragment>', ALPHA_BOOST);
  });
  const hidden = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); }',
    fragmentShader: 'void main() { gl_FragColor = vec4( 0.0 ); }',
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  // The shadow pass copies map, alpha test and side from this material onto the
  // depth material, so they must match it (this shader itself ignores them).
  hidden.map = atlas.map;
  hidden.alphaTest = 0.5;
  hidden.name = 'vegetation:ground:shadowOnly';
  return { material: m, depth, hidden, uniforms: own };
}

export { before };
