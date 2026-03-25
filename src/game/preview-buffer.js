/** PREVIEW BUFFER 렌더러: 후보 태그를 링크 버튼으로 치환해 출력한다. */

function getFileNameFromPath(path) {
  var text = String(path || "");
  var lastSlash = text.lastIndexOf("/");
  return lastSlash >= 0 ? text.slice(lastSlash + 1) : text;
}

function formatPreviewLineNumber(index) {
  var safeIndex = Math.max(1, Number(index) || 1);
  return String(safeIndex).padStart(2, "0");
}

function extractLeadingPreviewMeta(lines) {
  var safeLines = Array.isArray(lines) ? lines : [];
  var cursor = 0;
  var meta = {
    fragment: "",
    sourceTrace: "",
    projectionClass: "",
  };

  while (cursor < safeLines.length) {
    var text = String(safeLines[cursor] || "").trim();
    if (text.indexOf("fragment ") === 0 && !meta.fragment) {
      meta.fragment = text;
      cursor += 1;
      continue;
    }
    if (text.indexOf("source trace:") === 0 && !meta.sourceTrace) {
      meta.sourceTrace = text.slice("source trace:".length).trim();
      cursor += 1;
      continue;
    }
    if (text.indexOf("projection class:") === 0 && !meta.projectionClass) {
      meta.projectionClass = text.slice("projection class:".length).trim();
      cursor += 1;
      continue;
    }
    break;
  }

  return {
    meta: meta,
    bodyLines: safeLines.slice(cursor),
  };
}

function getPreviewLineKind(line, inProjectionNote) {
  var text = String(line || "").trim();

  if (!text) {
    return inProjectionNote ? "note-gap" : "blank";
  }
  if (text === "state projection note") {
    return "note-head";
  }
  if (text.indexOf("hashline=") === 0) {
    return "hashline";
  }
  if (/^\[[0-9.]+초 정적\]$/.test(text)) {
    return "cue";
  }
  if (text.indexOf("fragment ") === 0 || text.indexOf("source trace:") === 0 || text.indexOf("projection class:") === 0) {
    return "meta";
  }
  if (/^[^:]{1,24}:\s*"/.test(text)) {
    return "dialogue";
  }
  if (/[=⇒∧]/.test(text)) {
    return "formula";
  }
  if (inProjectionNote) {
    return "note";
  }
  return "body";
}

function renderPreviewDialogueLine(container, line, candidates, sourcePath, collectedTags, profileMap, selectedProfileId) {
  var text = String(line || "");
  var colonIndex = text.indexOf(":");
  var speaker = "";
  var dialogue = "";
  var speakerNode = null;
  var dividerNode = null;
  var bodyNode = null;
  var safeProfiles = profileMap || {};
  var activeProfileId = String(selectedProfileId || "");
  var speakerProfile = null;

  if (colonIndex === -1) {
    return renderPreviewLineWithLinks(container, line, candidates, sourcePath, collectedTags);
  }

  speaker = text.slice(0, colonIndex).trim();
  dialogue = text.slice(colonIndex + 1).trim();
  speakerProfile = safeProfiles && safeProfiles[speaker] ? safeProfiles[speaker] : null;
  if (dialogue[0] === "\"" && dialogue[dialogue.length - 1] === "\"") {
    dialogue = dialogue.slice(1, -1);
  }

  if (speakerProfile) {
    speakerNode = document.createElement("button");
    speakerNode.type = "button";
    speakerNode.className = "preview-dialogue-speaker preview-profile-link";
    speakerNode.dataset.profile = speaker;
    speakerNode.textContent = speaker;
    if (activeProfileId && activeProfileId === speaker) {
      speakerNode.classList.add("is-active");
    }
  } else {
    speakerNode = document.createElement("span");
    speakerNode.className = "preview-dialogue-speaker";
    speakerNode.textContent = speaker;
  }

  dividerNode = document.createElement("span");
  dividerNode.className = "preview-dialogue-divider";
  dividerNode.textContent = "";

  bodyNode = document.createElement("span");
  bodyNode.className = "preview-dialogue-body";

  container.appendChild(speakerNode);
  container.appendChild(dividerNode);
  container.appendChild(bodyNode);

  return renderPreviewLineWithLinks(bodyNode, dialogue, candidates, sourcePath, collectedTags);
}

function normalizePreviewCandidate(candidate) {
  if (typeof candidate === "string") {
    return {
      text: candidate,
      tag: candidate,
    };
  }
  if (candidate && typeof candidate === "object") {
    return {
      text: String(candidate.text || candidate.tag || ""),
      tag: String(candidate.tag || candidate.text || ""),
    };
  }
  return {
    text: "",
    tag: "",
  };
}

/** 단일 로그 라인을 분해해 후보 태그 링크 버튼으로 삽입한다. */
function renderPreviewLineWithLinks(container, line, candidates, sourcePath, collectedTags) {
  var text = String(line || "");
  var sortedCandidates = (candidates || []).map(normalizePreviewCandidate).filter(function keepCandidate(candidate) {
    return Boolean(candidate.text) && Boolean(candidate.tag);
  }).sort(function sortByLenDesc(a, b) {
    return String(b.text).length - String(a.text).length;
  });
  var matchedTags = {};
  var cursor = 0;

  while (cursor < text.length) {
    var matchedCandidate = null;
    var tagIndex = 0;
    while (tagIndex < sortedCandidates.length) {
      var currentCandidate = sortedCandidates[tagIndex];
      var currentText = String(currentCandidate.text || "");
      if (currentText && text.slice(cursor, cursor + currentText.length) === currentText) {
        matchedCandidate = currentCandidate;
        break;
      }
      tagIndex += 1;
    }

    if (!matchedCandidate) {
      container.appendChild(document.createTextNode(text[cursor]));
      cursor += 1;
      continue;
    }

    var tagButton = document.createElement("button");
    tagButton.type = "button";
    tagButton.className = "preview-tag-link";
    tagButton.dataset.tag = matchedCandidate.tag;
    tagButton.dataset.path = sourcePath || "";
    tagButton.textContent = matchedCandidate.text;
    if ((collectedTags || []).indexOf(matchedCandidate.tag) !== -1) {
      tagButton.classList.add("is-collected");
    }
    container.appendChild(tagButton);
    matchedTags[matchedCandidate.tag] = true;
    cursor += matchedCandidate.text.length;
  }

  return matchedTags;
}

/** PREVIEW BUFFER 전체 라인을 태그 링크 포함 형태로 렌더링한다. */
export function renderPreviewBufferWithTagLinks(options) {
  var container = options && options.container;
  var path = options && options.path;
  var lines = options && options.lines;
  var fileSpecByPath = (options && options.fileSpecByPath) || {};
  var collectedTags = (options && options.collectedTags) || [];
  var extractedPreview = extractLeadingPreviewMeta(lines);
  var safeLines = extractedPreview.bodyLines;
  var fileSpec = fileSpecByPath[path] || null;
  var candidates = fileSpec && Array.isArray(fileSpec.candidates) ? fileSpec.candidates.slice() : [];
  var lineIndex = 0;
  var matchedTags = {};
  var matchedInLine = null;
  var candidateIndex = 0;
  var missingTags = [];
  var fallbackRow = null;
  var title = null;
  var inProjectionNote = false;
  var lineKind = "";
  var speakerProfiles = (options && options.speakerProfiles) || {};
  var selectedProfileId = (options && options.selectedProfileId) || "";
  var shell = null;
  var toolbar = null;
  var titleNode = null;
  var metaNode = null;
  var body = null;
  var metaSummaryNode = null;
  var lineNumberNode = null;
  var contentNode = null;
  var safePath = String(path || "");
  var fileName = getFileNameFromPath(safePath);
  var previewMeta = extractedPreview.meta;
  var headerParts = [];

  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.classList.add("is-structured-preview");
  shell = document.createElement("section");
  shell.className = "preview-file-shell";

  toolbar = document.createElement("header");
  toolbar.className = "preview-file-toolbar";

  titleNode = document.createElement("div");
  titleNode.className = "preview-file-title";
  titleNode.textContent = fileName || "preview.log";

  if (previewMeta.fragment) {
    headerParts.push(previewMeta.fragment);
  }
  if (previewMeta.sourceTrace) {
    headerParts.push("source " + previewMeta.sourceTrace);
  }
  if (previewMeta.projectionClass) {
    headerParts.push("class " + previewMeta.projectionClass);
  }

  metaSummaryNode = document.createElement("div");
  metaSummaryNode.className = "preview-file-summary";
  metaSummaryNode.textContent = headerParts.join("  |  ");

  metaNode = document.createElement("div");
  metaNode.className = "preview-file-meta";
  metaNode.textContent = "restored read-only  |  lines " + String(safeLines.length);

  toolbar.appendChild(titleNode);
  if (headerParts.length > 0) {
    toolbar.appendChild(metaSummaryNode);
  }
  toolbar.appendChild(metaNode);
  shell.appendChild(toolbar);

  body = document.createElement("div");
  body.className = "preview-file-body";
  shell.appendChild(body);

  while (lineIndex < safeLines.length) {
    var row = document.createElement("div");
    lineKind = getPreviewLineKind(safeLines[lineIndex], inProjectionNote);
    row.className = "preview-line preview-line-" + lineKind;
    row.dataset.lineNumber = String(lineIndex + 1);
    lineNumberNode = document.createElement("span");
    lineNumberNode.className = "preview-line-number";
    lineNumberNode.textContent = formatPreviewLineNumber(lineIndex + 1);
    contentNode = document.createElement("div");
    contentNode.className = "preview-line-content";
    row.appendChild(lineNumberNode);
    row.appendChild(contentNode);
    if (lineKind === "note-head") {
      inProjectionNote = true;
    } else if (lineKind === "hashline") {
      inProjectionNote = false;
    }
    if (lineKind === "dialogue") {
      matchedInLine = renderPreviewDialogueLine(
        contentNode,
        safeLines[lineIndex],
        candidates,
        path,
        collectedTags,
        speakerProfiles,
        selectedProfileId,
      );
    } else {
      matchedInLine = renderPreviewLineWithLinks(contentNode, safeLines[lineIndex], candidates, path, collectedTags);
    }
    Object.keys(matchedInLine).forEach(function markMatched(tag) {
      matchedTags[tag] = true;
    });
    body.appendChild(row);
    lineIndex += 1;
  }

  while (candidateIndex < candidates.length) {
    var candidate = normalizePreviewCandidate(candidates[candidateIndex]);
    if (candidate.tag && !matchedTags[candidate.tag]) {
      missingTags.push(candidate.tag);
    }
    candidateIndex += 1;
  }

  if (missingTags.length > 0) {
    fallbackRow = document.createElement("div");
    fallbackRow.className = "preview-recovery-note";
    title = document.createElement("span");
    title.textContent = "추출 가능 조각: ";
    fallbackRow.appendChild(title);
    missingTags.forEach(function appendFallbackTag(tag, idx) {
      var tagButton = document.createElement("button");
      tagButton.type = "button";
      tagButton.className = "preview-tag-link";
      tagButton.dataset.tag = tag;
      tagButton.dataset.path = path || "";
      tagButton.textContent = tag;
      if ((collectedTags || []).indexOf(tag) !== -1) {
        tagButton.classList.add("is-collected");
      }
      fallbackRow.appendChild(tagButton);
      if (idx < missingTags.length - 1) {
        fallbackRow.appendChild(document.createTextNode(" "));
      }
    });
    shell.appendChild(fallbackRow);
  }

  container.appendChild(shell);
}
