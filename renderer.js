'use strict';

const btnOpen    = document.getElementById('btnOpen');
const btnConvert = document.getElementById('btnConvert');
const btnSave    = document.getElementById('btnSave');
const fileInfo   = document.getElementById('fileInfo');
const srcArea    = document.getElementById('srcArea');
const outArea    = document.getElementById('outArea');
const statusBar  = document.getElementById('statusBar');

let currentFilePath = null;
let repxContent = null;

function setStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className = 'status-bar' + (type ? ` ${type}` : '');
}

// ─── Open file ────────────────────────────────────────────────────────────────
btnOpen.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openFile();
  if (!filePath) return;

  currentFilePath = filePath;
  repxContent = null;
  outArea.value = '';
  btnSave.disabled = true;

  const result = await window.electronAPI.convert(filePath);
  if (result.success) {
    // Fetch source content for display (via convert we already read it — display repx diff below)
    setStatus(`已打开：${filePath}`, '');
    fileInfo.textContent = filePath;
    // Show source XML placeholder note — actual source shown on convert
    srcArea.value = '正在加载…';
    btnConvert.disabled = false;
    // Auto-display source via a dedicated read (we piggyback on the result)
    // We store the repx but let user click Convert to see it
    // Actually let's just load the file content for display
    loadSourceContent(filePath);
  } else {
    setStatus(`打开失败：${result.error}`, 'error');
  }
});

async function loadSourceContent(filePath) {
  // We display via a secondary convert call just to read the file.
  // In production, a dedicated "readFile" IPC would be cleaner;
  // here we display the result from the first convert attempt already stored.
  const r = await window.electronAPI.convert(filePath);
  if (r.success) {
    // We don't have a direct readFile IPC, so we store the repx quietly
    // and leave the source textarea empty until the user clicks Convert.
    // Instead, show a helpful hint.
    srcArea.value = '(文件已加载，点击"转换"按钮查看源 XML 及输出结果)';
    repxContent = r.repx;
  }
}

// ─── Convert ──────────────────────────────────────────────────────────────────
btnConvert.addEventListener('click', async () => {
  if (!currentFilePath) return;

  setStatus('正在转换…', '');
  btnConvert.disabled = true;

  const result = await window.electronAPI.convert(currentFilePath);
  btnConvert.disabled = false;

  if (result.success) {
    repxContent = result.repx;
    outArea.value = repxContent;
    srcArea.value = '转换成功！\n\n提示：源文件路径：' + currentFilePath;
    btnSave.disabled = false;
    const lineCount = repxContent.split('\n').length;
    setStatus(`转换成功！输出 ${lineCount} 行 XML`, 'success');
  } else {
    outArea.value = '';
    setStatus(`转换失败：${result.error}`, 'error');
  }
});

// ─── Save ─────────────────────────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  if (!repxContent) return;

  const baseName = currentFilePath
    ? currentFilePath.replace(/\\/g, '/').split('/').pop().replace(/\.(fr3|frf)$/i, '.repx')
    : 'report.repx';

  const savePath = await window.electronAPI.saveFile(baseName);
  if (!savePath) return;

  const result = await window.electronAPI.save(savePath, repxContent);
  if (result.success) {
    setStatus(`已保存：${savePath}`, 'success');
  } else {
    setStatus(`保存失败：${result.error}`, 'error');
  }
});
