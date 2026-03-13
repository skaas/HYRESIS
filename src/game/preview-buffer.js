/** PREVIEW BUFFER 렌더러: 후보 태그를 링크 버튼으로 치환해 출력한다. */

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
  dividerNode.textContent = "|";

  bodyNode = document.createElement("span");
  bodyNode.className = "preview-dialogue-body";

  container.appendChild(speakerNode);
  container.appendChild(dividerNode);
  container.appendChild(bodyNode);

  return renderPreviewLineWithLinks(bodyNode, dialogue, candidates, sourcePath, collectedTags);
}

/** 단일 로그 라인을 분해해 후보 태그 링크 버튼으로 삽입한다. */
function renderPreviewLineWithLinks(container, line, candidates, sourcePath, collectedTags) {
  var text = String(line || "");
  var sortedCandidates = (candidates || []).slice().sort(function sortByLenDesc(a, b) {
    return String(b).length - String(a).length;
  });
  var matchedTags = {};
  var cursor = 0;

  while (cursor < text.length) {
    var matchedTag = "";
    var tagIndex = 0;
    while (tagIndex < sortedCandidates.length) {
      var currentTag = String(sortedCandidates[tagIndex] || "");
      if (currentTag && text.slice(cursor, cursor + currentTag.length) === currentTag) {
        matchedTag = currentTag;
        break;
      }
      tagIndex += 1;
    }

    if (!matchedTag) {
      container.appendChild(document.createTextNode(text[cursor]));
      cursor += 1;
      continue;
    }

    var tagButton = document.createElement("button");
    tagButton.type = "button";
    tagButton.className = "preview-tag-link";
    tagButton.dataset.tag = matchedTag;
    tagButton.dataset.path = sourcePath || "";
    tagButton.textContent = matchedTag;
    if ((collectedTags || []).indexOf(matchedTag) !== -1) {
      tagButton.classList.add("is-collected");
    }
    container.appendChild(tagButton);
    matchedTags[matchedTag] = true;
    cursor += matchedTag.length;
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
  var safeLines = Array.isArray(lines) ? lines : [];
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

  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.classList.add("is-structured-preview");
  while (lineIndex < safeLines.length) {
    var row = document.createElement("div");
    lineKind = getPreviewLineKind(safeLines[lineIndex], inProjectionNote);
    row.className = "preview-line preview-line-" + lineKind;
    if (lineKind === "note-head") {
      inProjectionNote = true;
    } else if (lineKind === "hashline") {
      inProjectionNote = false;
    }
    if (lineKind === "dialogue") {
      matchedInLine = renderPreviewDialogueLine(
        row,
        safeLines[lineIndex],
        candidates,
        path,
        collectedTags,
        speakerProfiles,
        selectedProfileId,
      );
    } else {
      matchedInLine = renderPreviewLineWithLinks(row, safeLines[lineIndex], candidates, path, collectedTags);
    }
    Object.keys(matchedInLine).forEach(function markMatched(tag) {
      matchedTags[tag] = true;
    });
    container.appendChild(row);
    lineIndex += 1;
  }

  while (candidateIndex < candidates.length) {
    var candidate = String(candidates[candidateIndex] || "");
    if (candidate && !matchedTags[candidate]) {
      missingTags.push(candidate);
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
    container.appendChild(fallbackRow);
  }
}
