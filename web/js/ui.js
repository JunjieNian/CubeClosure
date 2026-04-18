/**
 * ui.js — Control panel, info panel, room selection, event binding
 */
import { CODEBOOK_CSV } from './codebook.js';
import { t, translateTitle } from './i18n.js';

export class UIController {
  constructor(animController, cubeScene, modelData) {
    this.anim = animController;
    this.scene = cubeScene;
    this.model = modelData;
    this.selectedRoomIndex = -1;

    this._bindControls();
    this._buildCodebookTable();
    this._updatePhaseDisplay();
    this._updateStats();

    this.scene.onRoomSelect = (idx) => this._onRoomSelected(idx);
  }

  _bindControls() {
    const gridSelect = document.getElementById('grid-size');
    gridSelect.addEventListener('change', (e) => {
      document.dispatchEvent(new CustomEvent('gridchange', { detail: { n: parseInt(e.target.value) } }));
    });

    document.getElementById('btn-prev').addEventListener('click', () => this.anim.stepBackward());
    document.getElementById('btn-play').addEventListener('click', () => {
      this._updatePlayButton(this.anim.togglePlay());
    });
    document.getElementById('btn-next').addEventListener('click', () => this.anim.stepForward());
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.anim.goToState(0);
      this.anim.pause();
      this._updatePlayButton(false);
    });

    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      this.anim.setSpeed(speed);
      speedVal.textContent = speed.toFixed(1) + 'x';
    });

    this._bindToggle('toggle-service', (active) => this.scene.setServiceLayerVisible(active));
    this._bindToggle('toggle-trails', (active) => {
      this.scene.showTrails = active;
      if (!active) this.scene.clearTrails();
      else this._redrawTrail();
    });
    this._bindToggle('toggle-loop', (active) => { this.anim.autoLoop = active; });

    this.anim.onStateChange = () => this._updatePhaseDisplay();
  }

  _bindToggle(id, callback) {
    const el = document.getElementById(id);
    el.addEventListener('click', () => {
      el.classList.toggle('active');
      callback(el.classList.contains('active'));
    });
  }

  _updatePlayButton(playing) {
    const btn = document.getElementById('btn-play');
    btn.textContent = playing ? '\u23F8' : '\u25B6';
    btn.classList.toggle('active', playing);
  }

  _updatePhaseDisplay() {
    document.getElementById('phase-title').textContent = translateTitle(this.anim.currentTitle);
    document.getElementById('phase-step').textContent = `State ${this.anim.currentState + 1} / ${this.anim.totalStates}`;
    document.getElementById('phase-state-num').textContent = `Phase: ${this.anim.currentPhase}`;
    const pct = ((this.anim.currentState) / Math.max(1, this.anim.totalStates - 1)) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  _updateStats() {
    const n = this.model.n;
    document.getElementById('stat-grid').textContent = `${n}\u00d7${n}\u00d7${n}`;
    document.getElementById('stat-rooms').textContent = n * n * n;
    document.getElementById('stat-tracked').textContent = this.model.trackedInitial
      ? this.model.trackedInitial.length
      : (this.model.allInitial ? this.model.allInitial.length : '\u2014');
    document.getElementById('stat-phases').textContent = '3';
  }

  _buildCodebookTable() {
    const tbody = document.getElementById('codebook-body');
    tbody.innerHTML = '';
    for (const row of CODEBOOK_CSV) {
      const tr = document.createElement('tr');
      tr.dataset.s = row.S;
      tr.innerHTML = `
        <td>${row.S}</td>
        <td>${row.abc}</td>
        <td>${row.p0}</td>
        <td>${row.p1}</td>
        <td>${row.p2}</td>
        <td>${row.d1 >= 0 ? '+' : ''}${row.d1}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  highlightCodebookRow(s) {
    document.querySelectorAll('#codebook-body tr').forEach(tr => {
      tr.classList.toggle('active', parseInt(tr.dataset.s) === s);
    });
  }

  _onRoomSelected(index) {
    this.selectedRoomIndex = index;
    const info = document.getElementById('room-info');
    if (index < 0 || index >= this.scene.rooms.length) {
      info.innerHTML = `<div class="no-selection">${t('clickToInspect')}</div>`;
      return;
    }

    const room = this.scene.rooms[index];
    const identity = room.identity;
    const current = room.currentPos.map(v => Math.round(v));
    const codebookEntry = CODEBOOK_CSV.find(r => r.S === identity[0]);

    info.innerHTML = `
      <div class="room-detail">
        <div class="detail-label">${t('roomIdentity')}</div>
        <div class="detail-value highlight">(${identity.join(', ')})</div>
      </div>
      <div class="room-detail">
        <div class="detail-label">${t('currentPosition')}</div>
        <div class="detail-value" id="room-cur-pos">(${current.join(', ')})</div>
      </div>
      <div class="room-detail">
        <div class="detail-label">${t('roomIndex')}</div>
        <div class="detail-value">#${index}</div>
      </div>
      ${codebookEntry ? `
      <div class="room-detail">
        <div class="detail-label">${t('xAxisEncoding')} (S=${identity[0]})</div>
        <div class="detail-value">abc = ${codebookEntry.abc}, ${t('positions')}: ${codebookEntry.p0}\u2192${codebookEntry.p1}\u2192${codebookEntry.p2}</div>
      </div>
      ` : ''}
    `;

    if (identity[0] >= 1 && identity[0] <= 26) {
      this.highlightCodebookRow(identity[0]);
    }

    this.scene.featuredRoom = index;
    this.scene._updateFeaturedRoom();
    this._redrawTrail();
  }

  _redrawTrail() {
    if (!this.scene.showTrails) return;
    const idx = this.scene.featuredRoom;
    if (idx < 0 || idx >= this.model.states[0].length) return;
    const trail = this.model.states.map(state => state[idx]);
    this.scene.drawTrail(trail);
  }

  /** Called on language change */
  onLangChange() {
    this._updatePhaseDisplay();
    if (this.selectedRoomIndex >= 0) {
      this._onRoomSelected(this.selectedRoomIndex);
    }
  }

  update() {
    if (this._lastDisplayedState !== this.anim.currentState) {
      this._lastDisplayedState = this.anim.currentState;
      this._updatePhaseDisplay();
    }

    if (this.selectedRoomIndex >= 0 && this.selectedRoomIndex < this.scene.rooms.length) {
      const posEl = document.getElementById('room-cur-pos');
      if (posEl) {
        const cur = this.scene.rooms[this.selectedRoomIndex].currentPos.map(v => Math.round(v * 10) / 10);
        posEl.textContent = `(${cur.join(', ')})`;
      }
    }
  }

  refresh(modelData) {
    this.model = modelData;
    this._updateStats();
    this._updatePhaseDisplay();
    this.selectedRoomIndex = -1;
    document.getElementById('room-info').innerHTML =
      `<div class="no-selection">${t('clickToInspect')}</div>`;
  }
}
