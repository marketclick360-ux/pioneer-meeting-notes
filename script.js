// Supabase Auto-Save for Circuit Assembly Program
const SUPABASE_URL = 'https://vqgratxiuwcxvelzgncl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZ3JhdHhpdXdjeHZlbHpnbmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTgwNTIsImV4cCI6MjA4NTQ5NDA1Mn0.kUYtA_0Jmx1SQZiYG090IPntfWe5sOXes_1LjzyDCKI';

let saveTimeout = null;
let sessionId = null;
let statusEl = null;
let fieldsCache = null;

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  let sid = params.get('session');
  if (!sid) {
    sid = localStorage.getItem('assembly_session_id');
  }
  if (!sid) {
    sid = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  localStorage.setItem('assembly_session_id', sid);
  if (!params.get('session')) {
    const url = new URL(window.location);
    url.searchParams.set('session', sid);
    window.history.replaceState({}, '', url);
  }
  return sid;
}

function getFields() {
  if (!fieldsCache) {
    fieldsCache = document.querySelectorAll('input, textarea');
  }
  return fieldsCache;
}

// FIX: Use placeholder text as unique key so each field saves/loads independently
function getFieldKey(el, i) {
  if (el.getAttribute('data-key')) return el.getAttribute('data-key');
  if (el.placeholder) return 'ph_' + el.placeholder.substring(0, 40).replace(/\s+/g, '_');
  return 'field_' + i;
}

function collectNotes() {
  const notes = {};
  getFields().forEach((el, i) => {
    const key = getFieldKey(el, i);
    if (el.value && el.value.trim()) {
      notes[key] = el.value;
    }
  });
  return notes;
}

function applyNotes(notes) {
  if (!notes || Object.keys(notes).length === 0) return;
  getFields().forEach((el, i) => {
    const key = getFieldKey(el, i);
    if (notes[key]) {
      el.value = notes[key];
    }
  });
}

async function saveNotes() {
  const notes = collectNotes();
  showStatus('Saving...');
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/assembly_notes?session_id=eq.${sessionId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const existing = await checkRes.json();
    if (existing.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/assembly_notes?session_id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ notes: notes })
        }
      );
    } else {
      await fetch(
        `${SUPABASE_URL}/rest/v1/assembly_notes`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ session_id: sessionId, notes: notes })
        }
      );
    }
    showStatus('Saved!');
    setTimeout(() => showStatus(''), 2000);
  } catch (err) {
    console.error('Save error:', err);
    showStatus('Save failed');
  }
}

async function loadNotes() {
  try {
    showStatus('Loading...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/assembly_notes?session_id=eq.${sessionId}&select=notes`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeout);
    const data = await res.json();
    if (data.length > 0 && data[0].notes) {
      applyNotes(data[0].notes);
      showStatus('Notes loaded!');
    } else {
      showStatus('Ready!');
    }
    setTimeout(() => showStatus(''), 2000);
  } catch (err) {
    if (err.name === 'AbortError') {
      showStatus('Timed out - offline mode');
    } else {
      showStatus('Offline mode');
    }
  }
}

function debounceSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveNotes, 1500);
  showStatus('Typing...');
}

function showStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function createStatusBar() {
  const bar = document.createElement('div');
  bar.id = 'save-status-bar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:linear-gradient(135deg,#4a5568,#2d3748);color:white;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;font-size:13px;z-index:9999;box-shadow:0 -2px 10px rgba(0,0,0,0.3);';

  const left = document.createElement('div');
  left.textContent = 'Session: ' + sessionId.substring(0, 12) + '...';
  left.style.cssText = 'opacity:0.8;font-size:11px;';

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:10px;';

  statusEl = document.createElement('span');
  statusEl.style.cssText = 'background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:10px;font-size:11px;';

  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Share';
  shareBtn.style.cssText = 'background:#667eea;color:white;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;';
  shareBtn.onclick = function() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = 'Share'; }, 2000);
    });
  };

  right.appendChild(statusEl);
  right.appendChild(shareBtn);
  bar.appendChild(left);
  bar.appendChild(right);
  document.body.appendChild(bar);
  document.body.style.paddingBottom = '45px';
}

// PERFORMANCE FIX: Use event delegation instead of attaching listeners to every field
function setupEventDelegation() {
  document.body.addEventListener('input', function(e) {
    if (e.target.matches('input, textarea')) {
      debounceSave();
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  sessionId = getSessionId();
  createStatusBar();
  setupEventDelegation();
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadNotes());
  } else {
    setTimeout(loadNotes, 50);
  }
});
