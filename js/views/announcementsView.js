/**
 * Admin Announcements view.
 * Owner-only — post, list, and delete announcements that all employees see in their portal.
 */

import {
  addAnnouncement, deleteAnnouncement,
  getAnnouncements, onAnnouncementsChange
} from '../data/store.js';
import { showToast } from './components/toast.js';

let _container = null;

export function render(selector) {
  _container = document.querySelector(selector);
  if (!_container) return;

  _container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>📢 Announcements</h1>
        <span class="content-header-subtitle">Post news, reminders, or alerts to all staff.</span>
      </div>
    </div>
    <div class="page-body">

      <!-- Compose new announcement -->
      <div class="section-card" style="margin-bottom:18px;">
        <div class="section-card-header">
          <span class="section-card-title">✏️ Post a new announcement</span>
        </div>
        <div class="section-card-body">
          <div class="form-grid">
            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label" for="ann-title">Title</label>
              <input type="text" class="form-control" id="ann-title" maxlength="120"
                     placeholder="e.g., Holiday on May 15">
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label" for="ann-body">Message</label>
              <textarea class="form-control" id="ann-body" rows="4"
                        placeholder="Share the details with your team…"></textarea>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:4px;">
            <button type="button" class="btn btn-primary" id="ann-post-btn">📢 Post announcement</button>
            <span id="ann-post-error" style="font-size:0.8rem;color:var(--color-danger);align-self:center;"></span>
          </div>
        </div>
      </div>

      <!-- Past announcements -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">🗂 Past announcements</span>
          <span style="font-size:0.78rem;color:var(--color-text-muted);" id="ann-count-label"></span>
        </div>
        <div class="section-card-body" id="ann-list">
          <div style="padding:12px;color:var(--color-text-muted);text-align:center;font-size:0.85rem;">
            Loading…
          </div>
        </div>
      </div>

    </div>
  `;

  // Wire up post handler
  document.getElementById('ann-post-btn').addEventListener('click', handlePost);

  // Live updates — re-render the list whenever announcements change
  onAnnouncementsChange(list => renderList(list));

  // Initial fetch
  getAnnouncements()
    .then(renderList)
    .catch(e => {
      console.error(e);
      document.getElementById('ann-list').innerHTML =
        `<div style="padding:12px;color:var(--color-danger);text-align:center;">Failed to load announcements.</div>`;
    });
}

async function handlePost() {
  const titleEl = document.getElementById('ann-title');
  const bodyEl  = document.getElementById('ann-body');
  const errEl   = document.getElementById('ann-post-error');
  const btn     = document.getElementById('ann-post-btn');
  errEl.textContent = '';

  const title = titleEl.value.trim();
  const body  = bodyEl.value.trim();
  if (!title) { errEl.textContent = 'Title is required.'; return; }
  if (!body)  { errEl.textContent = 'Message is required.'; return; }

  btn.disabled = true;
  btn.textContent = 'Posting…';
  try {
    const { auth } = await import('../firebase.js');
    const createdBy = auth?.currentUser?.email || '';
    await addAnnouncement({ title, body, createdBy });
    titleEl.value = '';
    bodyEl.value  = '';
    showToast('Announcement posted — staff will see it instantly.', 'success');
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Failed to post. Try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = '📢 Post announcement';
  }
}

function renderList(list) {
  const listEl  = document.getElementById('ann-list');
  const countEl = document.getElementById('ann-count-label');
  if (!listEl) return;

  if (countEl) countEl.textContent = list.length ? `${list.length} total` : '';

  if (!list.length) {
    listEl.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--color-text-muted);">
        <div style="font-size:2.4rem;margin-bottom:8px;">📭</div>
        <div style="font-weight:600;">No announcements yet</div>
        <div style="font-size:0.82rem;margin-top:4px;">
          Post your first announcement above. It'll appear in every employee's portal.
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${list.map(a => `
        <div style="padding:14px 16px;border:1px solid var(--color-border);border-radius:10px;
                    background:var(--color-surface);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:1rem;color:var(--color-text);">
                ${esc(a.title)}
              </div>
              <div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:3px;">
                ${a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}${a.createdBy ? ' · by ' + esc(a.createdBy) : ''}
              </div>
            </div>
            <button type="button" class="btn btn-danger btn-sm" data-ann-del="${esc(a.id)}" title="Delete">🗑</button>
          </div>
          <div style="margin-top:10px;font-size:0.9rem;color:var(--color-text);
                      white-space:pre-wrap;line-height:1.45;">${esc(a.body)}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Wire delete buttons
  listEl.querySelectorAll('[data-ann-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.annDel;
      if (!confirm('Delete this announcement? Employees will no longer see it.')) return;
      btn.disabled = true;
      try {
        await deleteAnnouncement(id);
        showToast('Announcement deleted.', 'info');
      } catch (e) {
        console.error(e);
        showToast('Failed to delete.', 'error');
        btn.disabled = false;
      }
    });
  });
}

function esc(v) {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
