/** PREVIEW BUFFER 렌더러: 후보 태그를 링크 버튼으로 치환해 출력한다. */

/** 단일 로그 라인을 분해해 후보 태그 링크 버튼으로 삽입한다. */
function renderPreviewLineWithLinks(container, line, candidates, sourcePath, collectedTags) {
  var text = String(line || "");
  var sortedCandidates = (candidates || []).slice().sort(function sortByLenDesc(a, b) {
    return String(b).length - String(a).length;
  });
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
    cursor += matchedTag.length;
  }
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

  if (!container) {
    return;
  }

  container.innerHTML = "";
  while (lineIndex < safeLines.length) {
    var row = document.createElement("div");
    renderPreviewLineWithLinks(row, safeLines[lineIndex], candidates, path, collectedTags);
    container.appendChild(row);
    lineIndex += 1;
  }
}
