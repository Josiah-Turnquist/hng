// Lets several systems modify the shaders of three.js's built-in materials
// (terrain blending, wind on plants, cascaded shadows) without overwriting
// each other. Each patch is a named function run inside onBeforeCompile.

export function addPatch(material, key, fn) {
  const list = (material.userData.patches ??= []);
  if (list.some((p) => p.key === key)) return material;
  list.push({ key, fn });
  material.onBeforeCompile = (shader, renderer) => {
    for (const p of material.userData.patches) p.fn(shader, renderer, material);
  };
  // three.js caches compiled programs by this key; it must differ whenever the
  // shader text differs, or materials would share the wrong program.
  material.customProgramCacheKey = () => material.userData.patches.map((p) => p.key).join('|');
  material.needsUpdate = true;
  return material;
}

// Insert code after a chunk include, e.g. after('#include <common>', 'uniform float x;')
export function after(src, marker, code) {
  if (!src.includes(marker)) throw new Error(`shader marker not found: ${marker}`);
  return src.replace(marker, `${marker}\n${code}`);
}

export function before(src, marker, code) {
  if (!src.includes(marker)) throw new Error(`shader marker not found: ${marker}`);
  return src.replace(marker, `${code}\n${marker}`);
}

export function replace(src, marker, code) {
  if (!src.includes(marker)) throw new Error(`shader marker not found: ${marker}`);
  return src.replace(marker, code);
}
