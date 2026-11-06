/* ================= CONFIG ================= */
const CONFIG = {
  uploadUrl: '/upload',   // your server's upload endpoint
  simulate: true,         // true = fake the upload (works without a server). Set false to use real XHR upload.
  currency: '$',
  baseFee: 0.50,          // minimum cost per file
  perMB: 0.10             // extra cost per MB
};

/* ================= ELEMENTS ================= */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');
const nextBtn = document.getElementById('nextBtn');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const message = document.getElementById('message');
const summary = document.getElementById('summary');
const totalCostEl = document.getElementById('totalCost');

/*
  Each item: { file, stage, percent, cost }
  stage: 'queued' -> 'uploading' -> 'detected' -> 'preparing' -> 'done' (or 'error')
*/
let items = [];
let busy = false;

const STAGE_LABELS = {
  queued: 'Queued',
  uploading: 'Uploading',
  detected: 'Detected',
  preparing: 'Preparing',
  done: 'Ready',
  error: 'Failed'
};

/* ================= DROP / BROWSE ================= */
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  }));

['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  }));

dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));

function addFiles(newFiles) {
  Array.from(newFiles).forEach(file =>
    items.push({ file, stage: 'queued', percent: 0, cost: null }));
  message.textContent = '';
  render();
}

/* ================= HELPERS ================= */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatMoney(n) {
  return CONFIG.currency + n.toFixed(2);
}

function calcCost(file) {
  return CONFIG.baseFee + (file.size / 1048576) * CONFIG.perMB;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================= RENDER ================= */
function render() {
  fileList.innerHTML = '';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="file-info">
        <div class="file-name"></div>
        <div class="file-size">${formatSize(item.file.size)}</div>
        <div class="file-bar"><div style="width:${item.percent}%"></div></div>
      </div>
      <div class="file-right">
        <span class="status ${item.stage}">${STAGE_LABELS[item.stage]}</span>
        ${item.cost !== null ? `<span class="file-cost">${formatMoney(item.cost)}</span>` : ''}
        ${item.stage === 'queued' && !busy ? '<button class="remove" title="Remove">&times;</button>' : ''}
      </div>`;
    li.querySelector('.file-name').textContent = item.file.name;

    const removeBtn = li.querySelector('.remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        items.splice(i, 1);
        render();
      });
    }
    fileList.appendChild(li);
  });

  updateControls();
}

function updateControls() {
  const hasQueued = items.some(it => it.stage === 'queued');
  const allDone = items.length > 0 && items.every(it => it.stage === 'done');

  uploadBtn.disabled = busy || !hasQueued;

  // Show total cost once at least one file has been priced
  const priced = items.filter(it => it.cost !== null);
  if (priced.length) {
    const total = priced.reduce((sum, it) => sum + it.cost, 0);
    totalCostEl.textContent = formatMoney(total);
    summary.style.display = 'flex';
  } else {
    summary.style.display = 'none';
  }

  // "Next" appears once something has been uploaded; enabled only when ALL files are done
  nextBtn.style.display = items.some(it => it.stage !== 'queued') ? 'block' : 'none';
  nextBtn.disabled = busy || !allDone;
}

/* ================= STAGES ================= */
function setStage(item, stage, percent) {
  item.stage = stage;
  if (percent !== undefined) item.percent = percent;
  render();
}

// Stage 1: uploading
function uploadFile(item) {
  setStage(item, 'uploading', 0);

  if (CONFIG.simulate) {
    return (async () => {
      for (let p = 0; p <= 100; p += 10) {
        item.percent = p;
        render();
        await sleep(120);
      }
    })();
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('files', item.file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', CONFIG.uploadUrl);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        item.percent = (e.loaded / e.total) * 100;
        render();
      }
    });
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject();
    xhr.onerror = () => reject();
    xhr.send(formData);
  });
}

// Stage 2: detected (file recognised by the system)
async function detectFile(item) {
  setStage(item, 'detected', 100);
  await sleep(900);
}

// Stage 3: preparing (analysing the file to work out the cost)
async function prepareFile(item) {
  setStage(item, 'preparing', 100);
  await sleep(1400);
  item.cost = calcCost(item.file);
}

async function processItem(item) {
  try {
    await uploadFile(item);
    await detectFile(item);
    await prepareFile(item);
    setStage(item, 'done');
  } catch (err) {
    item.cost = null;
    setStage(item, 'error', 0);
  }
}

/* ================= UPLOAD BUTTON ================= */
uploadBtn.addEventListener('click', async () => {
  const queue = items.filter(it => it.stage === 'queued');
  if (!queue.length) return;

  busy = true;
  message.style.color = 'var(--blue-dark)';
  message.textContent = 'Processing your files…';
  progress.style.display = 'block';
  progressBar.style.width = '0';
  render();

  let finished = 0;
  await Promise.all(queue.map(async item => {
    await processItem(item);
    finished++;
    progressBar.style.width = (finished / queue.length * 100) + '%';
  }));

  busy = false;

  const failed = items.some(it => it.stage === 'error');
  if (failed) {
    message.style.color = '#c62828';
    message.textContent = 'Some files failed. Remove them and try again.';
  } else {
    message.style.color = 'var(--green)';
    message.textContent = '✔ Files are ready. Review the cost and click Next.';
  }
  render();
});

/* ================= NEXT BUTTON ================= */
nextBtn.addEventListener('click', () => {
  const total = items
    .filter(it => it.stage === 'done')
    .reduce((sum, it) => sum + it.cost, 0);

  // Clicking Next = customer agrees to the price and starts processing
  nextBtn.disabled = true;
  uploadBtn.disabled = true;
  message.style.color = 'var(--green)';
  message.textContent = `✔ You agreed to ${formatMoney(total)}. Processing has started!`;

  // TODO: send the agreement to your server / redirect to payment, e.g.
  // fetch('/confirm', { method: 'POST', body: JSON.stringify({ total }) });
  // window.location.href = '/processing';
});

render();
