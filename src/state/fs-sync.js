function cloneLines(lines) {
  return Array.isArray(lines) ? lines.slice() : [];
}

function computeFallbackStamp(rootStamp, fallbackMeta) {
  return {
    date: String((fallbackMeta && fallbackMeta.date) || rootStamp.date || ""),
    time: String((fallbackMeta && fallbackMeta.time) || rootStamp.time || ""),
  };
}

export function applyVisibleFilesToFs(options) {
  var opts = options || {};
  var fs = opts.fs;
  var meta = opts.meta;
  var rootPath = String(opts.rootPath || "");
  var visibleFiles = Array.isArray(opts.visibleFiles) ? opts.visibleFiles.slice() : [];
  var fileSpecs = opts.fileSpecs || {};
  var recoveryMetaByFile = opts.recoveryMetaByFile || {};
  var rootStamp = opts.rootStamp || { date: "", time: "" };

  if (!fs || !meta || !rootPath) {
    throw new Error("applyVisibleFilesToFs requires fs/meta/rootPath.");
  }

  fs[rootPath] = { type: "dir", children: visibleFiles.slice() };
  meta[rootPath] = {
    date: String(rootStamp.date || ""),
    time: String(rootStamp.time || ""),
    attr: "DIR,RO",
  };

  visibleFiles.forEach(function syncVisible(name) {
    var fileName = String(name || "");
    var spec = fileSpecs[fileName];
    var recoveredStamp = recoveryMetaByFile[fileName] || null;
    var fallbackMeta = spec && spec.path ? (meta[spec.path] || {}) : {};
    var stamp = recoveredStamp || computeFallbackStamp(rootStamp, fallbackMeta);

    if (!spec || !spec.path) {
      return;
    }

    fs[spec.path] = { type: "file", content: cloneLines(spec.lines) };
    meta[spec.path] = {
      size: Math.max(320, cloneLines(spec.lines).join("\n").length * 2),
      date: stamp.date,
      time: stamp.time,
      attr: "RO,LOG",
    };
  });

  return {
    rootPath: rootPath,
    visibleCount: visibleFiles.length,
  };
}

export function assertVisibleFsConsistency(options) {
  var opts = options || {};
  var fs = opts.fs || {};
  var meta = opts.meta || {};
  var rootPath = String(opts.rootPath || "");
  var visibleFiles = Array.isArray(opts.visibleFiles) ? opts.visibleFiles : [];
  var fileSpecs = opts.fileSpecs || {};

  if (!fs[rootPath] || fs[rootPath].type !== "dir") {
    throw new Error("FS invariant violated: root path missing or not directory.");
  }

  if (!Array.isArray(fs[rootPath].children)) {
    throw new Error("FS invariant violated: root directory children must be array.");
  }

  visibleFiles.forEach(function checkVisible(name) {
    var fileName = String(name || "");
    var spec = fileSpecs[fileName];
    if (!spec || !spec.path) {
      return;
    }

    if (!fs[spec.path] || fs[spec.path].type !== "file") {
      throw new Error("FS invariant violated: visible file missing from fs: " + fileName);
    }
    if (!meta[spec.path]) {
      throw new Error("FS invariant violated: visible file missing from meta: " + fileName);
    }
  });

  return true;
}
