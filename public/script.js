const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const message = document.getElementById('message');

let files = [];

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
  files = files.concat(Array.from(newFiles));
  message.textContent = '';
  render();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function render() {
  fileList.innerHTML = '';
  files.forEach((file, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="file-info">
        <div class="file-name"></div>
        <div class="file-size">${formatSize(file.size)}</div>
      </div>
      <button class="remove" title="Remove">&times;</button>`;
    li.querySelector('.file-name').textContent = file.name;
    li.querySelector('.remove').addEventListener('click', () => {
      files.splice(i, 1);
      render();
    });
    fileList.appendChild(li);
  });
  uploadBtn.disabled = files.length === 0;
}

uploadBtn.addEventListener('click', () => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

  progress.style.display = 'block';
  uploadBtn.disabled = true;
  message.textContent = '';

  const xhr = new XMLHttpRequest();
  // Change this URL to your server's upload endpoint
  xhr.open('POST', '/upload');

  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      progressBar.style.width = (e.loaded / e.total * 100) + '%';
    }
  });
  xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300);
  xhr.onerror = () => finish(false);
  xhr.send(formData);
});

function finish(ok) {
  progressBar.style.width = ok ? '100%' : '0';
  message.style.color = ok ? 'var(--green)' : '#c62828';
  message.textContent = ok ? '✔ Upload complete!' : 'Upload failed. Is the server endpoint set up?';
  if (ok) {
    files = [];
    render();
  } else {
    uploadBtn.disabled = files.length === 0;
  }
}