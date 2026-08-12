/* File synced with root app.js (debug banner removed) */

/* ============ UTIL ============ */

function uid() { return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============ VIEW SWITCHING ============ */

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  if (name === 'all') renderBrowse();
  if (name === 'favorites') renderFavorites();
  if (name === 'considering') renderConsidering();
  if (name === 'gameSetup') renderGameSetup();
  if (name === 'randomSetup') renderRandomSetup();
  if (name === 'missingInfo') renderMissingInfo();
  if (name === 'add' && editingId === null) resetMealForm();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

/* ============ MEAL CARD RENDERING ============ */

function mealMatchesFilters(meal, f, searchText) {
  if (searchText) {
    const hay = (meal.name + ' ' + meal.ingredients.join(' ')).toLowerCase();
    if (!hay.includes(searchText.toLowerCase())) return false;
  }
  if (f.types.size > 0) {
    const has = meal.mealTypes.some(t => f.types.has(t));
    if (!has) return false;
  }
  if (f.keywords.size > 0) {
    const hasAll = [...f.keywords].every(k => meal.keywords.includes(k));
    if (!hasAll) return false;
  }
  if (f.sizes && f.sizes.size > 0) {
    if (!meal.size || !f.sizes.has(meal.size)) return false;
  }
  return true;
}

function createMealCard(meal) {
  const card = document.createElement('div');
  card.className = 'meal-card';

  const favBtn = document.createElement('button');
  favBtn.className = 'meal-card-fav' + (meal.favorite ? ' is-fav' : '');
  favBtn.innerHTML = meal.favorite ? '\u2665' : '\u2661';
  favBtn.title = meal.favorite ? 'remove from obsessions' : 'add to obsessions';
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    meal.favorite = !meal.favorite;
    persist();
    refreshEverything();
  });
  card.appendChild(favBtn);

  const considerBtn = document.createElement('button');
  considerBtn.className = 'meal-card-consider' + (meal.considering ? ' is-considering' : '');
  considerBtn.innerHTML = meal.considering ? '\u2713' : '+';
  considerBtn.title = meal.considering ? 'remove from considering' : 'add to considering';
  considerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    meal.considering = !meal.considering;
    persist();
    refreshEverything();
  });
  card.appendChild(considerBtn);

  if (meal.image && meal.image.src) {
    const img = document.createElement('img');
    img.className = 'meal-card-image';
    img.src = meal.image.src;
    img.alt = meal.name;
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'meal-card-image-placeholder';
    ph.textContent = '\uD83C\uDF7D';
    card.appendChild(ph);
  }

  const body = document.createElement('div');
  body.className = 'meal-card-body';

  const name = document.createElement('div');
  name.className = 'meal-card-name';
  name.textContent = meal.name;
  body.appendChild(name);

  if (meal.ingredients.length) {
    const ing = document.createElement('div');
    ing.className = 'meal-card-ingredients';
    ing.textContent = meal.ingredients.join(', ');
    body.appendChild(ing);
  }

  if (meal.keywords.length) {
    const kw = document.createElement('div');
    kw.className = 'meal-card-keywords';
    kw.innerHTML = meal.keywords.map(k => `<span>${escapeHtml(k)}</span>`).join('');
    body.appendChild(kw);
  }

  const meta = document.createElement('div');
  meta.className = 'meal-card-meta';
  meta.innerHTML = `
    <div class="meal-card-extra">
      <span class="meal-card-cal">${meal.calories ? escapeHtml(meal.calories) + ' cal' : ''}</span>
      ${meal.duration ? `<span class="meal-card-duration">\u23f1 ${escapeHtml(meal.duration)}</span>` : ''}
    </div>
    <div class="meal-card-extra">
      ${meal.size ? `<span class="meal-card-size">${escapeHtml(meal.size)}</span>` : ''}
      <span class="meal-card-types">${meal.mealTypes.length ? escapeHtml(meal.mealTypes.join(' / ')) : 'unassigned'}</span>
    </div>
  `;
  body.appendChild(meta);

  card.appendChild(body);
  card.addEventListener('click', () => openMealModal(meal.id));
  return card;
}

function renderBrowse() {
  const grid = document.getElementById('mealGrid');
  grid.innerHTML = '';
  const matches = APP_DATA.meals.filter(m => mealMatchesFilters(m, filters, filters.search));
  const favs = matches.filter(m => m.favorite);
  const rest = matches.filter(m => !m.favorite);
  const ordered = [...favs, ...rest];
  ordered.forEach(m => grid.appendChild(createMealCard(m)));

  document.getElementById('browseCount').textContent =
    `${APP_DATA.meals.length} meal${APP_DATA.meals.length === 1 ? '' : 's'} saved` +
    (matches.length !== APP_DATA.meals.length ? ` \u2014 ${matches.length} shown` : '');

  const empty = document.getElementById('emptyState');
  if (ordered.length === 0) {
    empty.hidden = false;
    empty.textContent = APP_DATA.meals.length === 0
      ? 'no meals yet \u2014 tap "Add meal" to start your menu.'
      : 'nothing matches those filters.';
  } else {
    empty.hidden = true;
  }

  const anyFilter = filters.search || filters.types.size || filters.keywords.size || filters.sizes.size;
  document.getElementById('clearFiltersBtn').hidden = !anyFilter;

  updateMissingInfoBanner();
}

/* ============ MISSING INFO ============ */

function getMissingFields(meal) {
  const missing = [];
  if (!meal.calories) missing.push('calories');
  if (!meal.duration) missing.push('time to make');
  if (!meal.mealTypes.length) missing.push('meal type');
  if (!meal.size) missing.push('meal size');
  return missing;
}

function updateMissingInfoBanner() {
  const count = APP_DATA.meals.filter(m => getMissingFields(m).length).length;
  const banner = document.getElementById('missingInfoBanner');
  if (count > 0) {
    banner.hidden = false;
    banner.innerHTML = `<strong>${count} meal${count === 1 ? '' : 's'}</strong> missing some info \u2014 tap to fill it in.`;
  } else {
    banner.hidden = true;
  }
}

document.getElementById('missingInfoBanner').addEventListener('click', () => showView('missingInfo'));

function renderMissingInfo() {
  const listEl = document.getElementById('missingInfoList');
  listEl.innerHTML = '';
  const incomplete = APP_DATA.meals
    .map(m => ({ meal: m, missing: getMissingFields(m) }))
    .filter(x => x.missing.length);

  incomplete.forEach(({ meal, missing }) => {
    const row = document.createElement('div');
    row.className = 'missing-info-row';

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="missing-info-row-name">${escapeHtml(meal.name)}</div>
      <div class="missing-info-row-fields">missing: ${escapeHtml(missing.join(', '))}</div>
    `;
    row.appendChild(info);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost-btn';
    btn.textContent = 'add details';
    btn.addEventListener('click', () => {
      editingId = meal.id;
      populateMealForm(meal);
      showView('add');
    });
    row.appendChild(btn);

    listEl.appendChild(row);
  });

  document.getElementById('missingInfoEmpty').hidden = incomplete.length > 0;
}

function renderFavorites() {
  const grid = document.getElementById('favoritesGrid');
  grid.innerHTML = '';
  const favs = APP_DATA.meals.filter(m => m.favorite);
  favs.forEach(m => grid.appendChild(createMealCard(m)));
  document.getElementById('favoritesEmpty').hidden = favs.length > 0;
}

/* ============ CONSIDERING ============ */

function getConsideringMeals() {
  return APP_DATA.meals.filter(m => m.considering);
}

function renderConsidering() {
  const grid = document.getElementById('consideringGrid');
  grid.innerHTML = '';
  const pool = getConsideringMeals();
  pool.forEach(m => grid.appendChild(createMealCard(m)));
  document.getElementById('consideringEmpty').hidden = pool.length > 0;

  document.getElementById('consideringPoolCount').textContent = pool.length
    ? `${pool.length} meal${pool.length === 1 ? '' : 's'} on your list.`
    : '';

  document.getElementById('considerThisOrThatBtn').disabled = pool.length < 2;
  document.getElementById('considerRandomBtn').disabled = pool.length < 1;
}

document.getElementById('resetConsideringBtn').addEventListener('click', () => {
  const pool = getConsideringMeals();
  if (!pool.length) return;
  if (!confirm('Clear your considering list? This only removes them from this list \u2014 nothing gets deleted from the menu.')) return;
  pool.forEach(m => { m.considering = false; });
  persist();
  refreshEverything();
});

document.getElementById('considerThisOrThatBtn').addEventListener('click', () => {
  startThisOrThat(getConsideringMeals());
});

document.getElementById('considerRandomBtn').addEventListener('click', () => {
  startRandomFood(getConsideringMeals());
});

/* ============ FILTER BAR (browse) ============ */

function renderChipToggle(container, options, activeSet, className, onChange) {
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'chip ' + className + (activeSet.has(opt) ? ' chip-active' : '');
    if (className === 'chip-type') btn.dataset.type = opt;
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (activeSet.has(opt)) activeSet.delete(opt); else activeSet.add(opt);
      onChange();
    });
    container.appendChild(btn);
  });
}

function refreshBrowseFilterChips() {
  renderChipToggle(document.getElementById('mealTypeFilters'), ['breakfast', 'lunch', 'dinner', 'snack'], filters.types, 'chip-type', renderBrowse);
  renderSizeChipToggle(document.getElementById('mealSizeFilters'), filters.sizes, renderBrowse);
  renderChipToggle(document.getElementById('keywordFilters'), APP_DATA.keywords, filters.keywords, 'chip-keyword', renderBrowse);
}

function refreshGameFilterChips() {
  renderChipToggle(document.getElementById('gameMealTypeFilters'), ['breakfast', 'lunch', 'dinner', 'snack'], gameFilters.types, 'chip-type', renderGameSetup);
  renderSizeChipToggle(document.getElementById('gameMealSizeFilters'), gameFilters.sizes, renderGameSetup);
  renderChipToggle(document.getElementById('gameKeywordFilters'), APP_DATA.keywords, gameFilters.keywords, 'chip-keyword', renderGameSetup);
}

function refreshRandomFilterChips() {
  renderChipToggle(document.getElementById('randomMealTypeFilters'), ['breakfast', 'lunch', 'dinner', 'snack'], randomFilters.types, 'chip-type', renderRandomSetup);
  renderSizeChipToggle(document.getElementById('randomMealSizeFilters'), randomFilters.sizes, renderRandomSetup);
  renderChipToggle(document.getElementById('randomKeywordFilters'), APP_DATA.keywords, randomFilters.keywords, 'chip-keyword', renderRandomSetup);
}

// the size chip buttons already exist as static markup (fixed set of 4),
// so just (re)wire click handlers + active state rather than rebuilding them
function renderSizeChipToggle(container, activeSet, onChange) {
  container.querySelectorAll('.chip-size').forEach(btn => {
    const size = btn.dataset.size;
    btn.classList.toggle('chip-active', activeSet.has(size));
    btn.onclick = () => {
      if (activeSet.has(size)) activeSet.delete(size); else activeSet.add(size);
      onChange();
    };
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  filters.search = e.target.value;
  renderBrowse();
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  filters.search = '';
  filters.types.clear();
  filters.keywords.clear();
  filters.sizes.clear();
  document.getElementById('searchInput').value = '';
  refreshBrowseFilterChips();
  renderBrowse();
});

/* ============ MEAL DETAIL MODAL ============ */

// similarity for the modal's "similar meals" strip: shared keywords +
// shared ingredient words count equally, with a small bonus for matching size
function mealSimilarityScore(a, b) {
  const aTokens = new Set(extractThemeTokens(a).map(t => t.toLowerCase()));
  let shared = 0;
  extractThemeTokens(b).forEach(t => { if (aTokens.has(t.toLowerCase())) shared++; });
  let score = shared;
  if (a.size && a.size === b.size) score += 1;
  return score;
}

function getSimilarMealsFor(meal, count) {
  return APP_DATA.meals
    .filter(m => m.id !== meal.id)
    .map(m => ({ meal: m, score: mealSimilarityScore(meal, m) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(x => x.meal);
}

function openMealModal(id) {
  const meal = APP_DATA.meals.find(m => m.id === id);
  if (!meal) return;
  const similarMeals = getSimilarMealsFor(meal, 8);
  const content = document.getElementById('modalContent');
  content.innerHTML = `
    ${meal.image && meal.image.src ? `<img class="modal-detail-image" src="${meal.image.src}" alt="${escapeHtml(meal.name)}">` : ''}
    <div class="modal-detail-name">${escapeHtml(meal.name)}</div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">ingredients</span>
      <div class="modal-detail-list">${meal.ingredients.length ? escapeHtml(meal.ingredients.join(', ')) : '\u2014'}</div>
    </div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">nutrients</span>
      <div class="modal-detail-list">${meal.nutrients.length ? meal.nutrients.map(n => `${escapeHtml(n.label)}: ${escapeHtml(n.value)}`).join(' \u00b7 ') : '\u2014'}${meal.calories ? (meal.nutrients.length ? ' \u00b7 ' : '') + 'Calories: ' + escapeHtml(meal.calories) : ''}</div>
    </div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">when</span>
      <div class="modal-detail-list">${meal.mealTypes.length ? escapeHtml(meal.mealTypes.join(', ')) : 'not assigned'}</div>
    </div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">time to make</span>
      <div class="modal-detail-list">${meal.duration ? escapeHtml(meal.duration) : '\u2014'}</div>
    </div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">meal size</span>
      <div class="modal-detail-list">${meal.size ? escapeHtml(meal.size) : '\u2014'}</div>
    </div>
    <div class="modal-detail-section">
      <span class="modal-detail-label">keywords</span>
      <div class="modal-detail-list">${meal.keywords.length ? escapeHtml(meal.keywords.join(', ')) : '\u2014'}</div>
    </div>
    ${similarMeals.length ? `
    <div class="modal-detail-section">
      <span class="modal-detail-label">similar meals</span>
      <div class="modal-similar-scroll" id="modalSimilarScroll"></div>
    </div>` : ''}
    <div class="modal-actions">
      <button class="primary-btn" id="modalEditBtn">edit</button>
      <button class="ghost-btn" id="modalConsiderBtn">${meal.considering ? 'remove from considering' : 'add to considering'}</button>
      <button class="ghost-btn" id="modalFavBtn">${meal.favorite ? 'remove from obsessions' : 'add to obsessions'}</button>
    </div>
  `;
  if (similarMeals.length) {
    const scrollEl = document.getElementById('modalSimilarScroll');
    similarMeals.forEach(m => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'modal-similar-card';
      card.innerHTML = `
        ${m.image && m.image.src
          ? `<img src="${m.image.src}" alt="${escapeHtml(m.name)}">`
          : `<div class="modal-similar-placeholder">\uD83C\uDF7D</div>`}
        <div class="modal-similar-name">${escapeHtml(m.name)}</div>
      `;
      card.addEventListener('click', () => openMealModal(m.id));
      scrollEl.appendChild(card);
    });
  }
  document.getElementById('modalEditBtn').addEventListener('click', () => {
    closeModal();
    editingId = id;
    populateMealForm(meal);
    showView('add');
  });
  document.getElementById('modalConsiderBtn').addEventListener('click', () => {
    meal.considering = !meal.considering;
    persist();
    closeModal();
    refreshEverything();
  });
  document.getElementById('modalFavBtn').addEventListener('click', () => {
    meal.favorite = !meal.favorite;
    persist();
    closeModal();
    refreshEverything();
  });
  document.getElementById('mealModalBackdrop').classList.remove('hidden');
}

function closeModal() { document.getElementById('mealModalBackdrop').classList.add('hidden'); }
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('mealModalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'mealModalBackdrop') closeModal();
});

/* ============ ADD / EDIT MEAL FORM ============ */

function makeDynamicRow(listEl, placeholder, value, isNutrient) {
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  if (isNutrient) {
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'e.g. Protein';
    labelInput.className = 'nutrient-label';
    labelInput.value = value ? value.label : '';
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'e.g. 12g';
    valueInput.className = 'nutrient-value';
    valueInput.value = value ? value.value : '';
    row.appendChild(labelInput);
    row.appendChild(valueInput);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value || '';
    row.appendChild(input);
  }
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-row-btn';
  removeBtn.textContent = '\u2715';
  removeBtn.addEventListener('click', () => row.remove());
  row.appendChild(removeBtn);
  listEl.appendChild(row);
}

document.getElementById('addIngredientBtn').addEventListener('click', () => {
  makeDynamicRow(document.getElementById('ingredientList'), 'e.g. flour', '', false);
});
document.getElementById('addNutrientBtn').addEventListener('click', () => {
  makeDynamicRow(document.getElementById('nutrientList'), '', null, true);
});

function renderKeywordPicker() {
  const wrap = document.getElementById('keywordPicker');
  wrap.innerHTML = '';
  APP_DATA.keywords.forEach(k => {
    const label = document.createElement('label');
    label.className = 'check-pill';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = k;
    cb.checked = formSelectedKeywords.has(k);
    cb.addEventListener('change', () => {
      if (cb.checked) formSelectedKeywords.add(k); else formSelectedKeywords.delete(k);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + k));
    wrap.appendChild(label);
  });
}

document.getElementById('addKeywordBtn').addEventListener('click', () => {
  const input = document.getElementById('newKeywordInput');
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  if (!APP_DATA.keywords.includes(val)) {
    APP_DATA.keywords.push(val);
    if (!sessionNewKeywords.includes(val)) sessionNewKeywords.push(val);
    persist();
  }
  formSelectedKeywords.add(val);
  input.value = '';
  renderKeywordPicker();
  refreshBrowseFilterChips();
  refreshGameFilterChips();
  refreshRandomFilterChips();
});
document.getElementById('newKeywordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addKeywordBtn').click(); }
});

/* image tabs */
document.querySelectorAll('.image-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.image-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isUpload = tab.dataset.tab === 'upload';
    document.getElementById('imageUpload').hidden = !isUpload;
    document.getElementById('imageUrl').hidden = isUpload;
  });
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    formImage = { type: 'upload', src: reader.result };
    showImagePreview();
  };
  reader.readAsDataURL(file);
});

document.getElementById('imageUrl').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val) {
    formImage = { type: 'url', src: val };
    showImagePreview();
  }
});

function showImagePreview() {
  const wrap = document.getElementById('imagePreviewWrap');
  const img = document.getElementById('imagePreview');
  if (formImage && formImage.src) {
    img.src = formImage.src;
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }
}

document.getElementById('removeImageBtn').addEventListener('click', () => {
  formImage = null;
  document.getElementById('imageUpload').value = '';
  document.getElementById('imageUrl').value = '';
  showImagePreview();
});

function resetMealForm() {
  editingId = null;
  document.getElementById('mealId').value = '';
  document.getElementById('mealName').value = '';
  document.getElementById('mealCalories').value = '';
  document.getElementById('mealDuration').value = '';
  document.getElementById('ingredientList').innerHTML = '';
  makeDynamicRow(document.getElementById('ingredientList'), 'e.g. flour', '', false);
  document.getElementById('nutrientList').innerHTML = '';
  makeDynamicRow(document.getElementById('nutrientList'), '', null, true);
  document.querySelectorAll('input[name="mealType"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="mealSize"]').forEach(rb => rb.checked = false);
  formSelectedKeywords = new Set();
  sessionNewKeywords = [];
  renderKeywordPicker();
  formImage = null;
  document.getElementById('imageUpload').value = '';
  document.getElementById('imageUrl').value = '';
  showImagePreview();
  document.getElementById('addTitle').textContent = 'add a meal';
  document.getElementById('saveMealBtn').textContent = 'save meal';
  document.getElementById('cancelEditBtn').hidden = true;
  document.getElementById('deleteMealBtn').hidden = true;
}

function populateMealForm(meal) {
  document.getElementById('mealId').value = meal.id;
  document.getElementById('mealName').value = meal.name;
  document.getElementById('mealCalories').value = meal.calories || '';
  document.getElementById('mealDuration').value = meal.duration || '';
  document.getElementById('ingredientList').innerHTML = '';
  (meal.ingredients.length ? meal.ingredients : ['']).forEach(i => makeDynamicRow(document.getElementById('ingredientList'), 'e.g. flour', i, false));
  document.getElementById('nutrientList').innerHTML = '';
  (meal.nutrients.length ? meal.nutrients : [null]).forEach(n => makeDynamicRow(document.getElementById('nutrientList'), '', n, true));
  document.querySelectorAll('input[name="mealType"]').forEach(cb => cb.checked = meal.mealTypes.includes(cb.value));
  document.querySelectorAll('input[name="mealSize"]').forEach(rb => rb.checked = rb.value === meal.size);
  formSelectedKeywords = new Set(meal.keywords);
  sessionNewKeywords = [];
  renderKeywordPicker();
  formImage = meal.image ? { ...meal.image } : null;
  showImagePreview();
  document.getElementById('addTitle').textContent = 'edit meal';
  document.getElementById('saveMealBtn').textContent = 'save changes';
  document.getElementById('cancelEditBtn').hidden = false;
  document.getElementById('deleteMealBtn').hidden = false;
}

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  showView('all');
});

document.getElementById('deleteMealBtn').addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('Delete this meal for good?')) return;
  APP_DATA.meals = APP_DATA.meals.filter(m => m.id !== editingId);
  persist();
  editingId = null;
  showView('all');
});

document.getElementById('mealForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('mealName').value.trim();
  if (!name) return;

  const ingredients = [...document.querySelectorAll('#ingredientList .dynamic-row input')]
    .map(i => i.value.trim()).filter(Boolean);

  const nutrients = [...document.querySelectorAll('#nutrientList .dynamic-row')]
    .map(row => {
      const label = row.querySelector('.nutrient-label').value.trim();
      const value = row.querySelector('.nutrient-value').value.trim();
      return label && value ? { label, value } : null;
    }).filter(Boolean);

  const mealTypes = [...document.querySelectorAll('input[name="mealType"]:checked')].map(cb => cb.value);
  const calories = document.getElementById('mealCalories').value.trim();
  const duration = document.getElementById('mealDuration').value.trim();
  const sizeInput = document.querySelector('input[name="mealSize"]:checked');
  const size = sizeInput ? sizeInput.value : null;

  const meal = {
    id: editingId || uid(),
    name,
    ingredients,
    nutrients,
    calories,
    duration,
    mealTypes,
    size,
    keywords: [...formSelectedKeywords],
    image: formImage,
    favorite: editingId ? APP_DATA.meals.find(m => m.id === editingId).favorite : false,
    considering: editingId ? APP_DATA.meals.find(m => m.id === editingId).considering : false
  };

  if (editingId) {
    const idx = APP_DATA.meals.findIndex(m => m.id === editingId);
    APP_DATA.meals[idx] = meal;
  } else {
    APP_DATA.meals.push(meal);
  }
  persist();
  editingId = null;
  refreshEverything();

  if (sessionNewKeywords.length) {
    openKeywordTagModal(meal.id, [...sessionNewKeywords]);
    sessionNewKeywords = [];
  } else {
    showView('all');
  }
});

/* ============ KEYWORD "TAG OTHER MEALS" MODAL ============ */

let keywordTagState = { keywords: [], sourceMealId: null };

function openKeywordTagModal(sourceMealId, newKeywords) {
  keywordTagState = { keywords: newKeywords, sourceMealId };

  const label = newKeywords.map(k => `\u201c${k}\u201d`).join(', ');
  document.getElementById('keywordTagTitle').textContent = `add ${label} to other meals?`;

  const listEl = document.getElementById('keywordTagMealList');
  listEl.innerHTML = '';
  const candidates = APP_DATA.meals.filter(m =>
    m.id !== sourceMealId && !newKeywords.every(k => m.keywords.includes(k))
  );

  if (!candidates.length) {
    listEl.innerHTML = '<p class="empty-state">no other meals to tag right now.</p>';
  } else {
    candidates.forEach(m => {
      const label = document.createElement('label');
      label.className = 'check-pill';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = m.id;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + m.name));
      listEl.appendChild(label);
    });
  }

  document.getElementById('keywordTagModalBackdrop').classList.remove('hidden');
}

function closeKeywordTagModal() {
  document.getElementById('keywordTagModalBackdrop').classList.add('hidden');
  showView('all');
}

document.getElementById('keywordTagApplyBtn').addEventListener('click', () => {
  const checkedIds = [...document.querySelectorAll('#keywordTagMealList input[type="checkbox"]:checked')].map(cb => cb.value);
  if (checkedIds.length) {
    checkedIds.forEach(id => {
      const meal = APP_DATA.meals.find(m => m.id === id);
      if (!meal) return;
      keywordTagState.keywords.forEach(k => {
        if (!meal.keywords.includes(k)) meal.keywords.push(k);
      });
    });
    persist();
    refreshEverything();
  }
  closeKeywordTagModal();
});

document.getElementById('keywordTagSkipBtn').addEventListener('click', closeKeywordTagModal);
document.getElementById('keywordTagCloseBtn').addEventListener('click', closeKeywordTagModal);
document.getElementById('keywordTagModalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'keywordTagModalBackdrop') closeKeywordTagModal();
});

/* ============ EXPORT / IMPORT ============ */

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});

/* ============ THIS OR THAT GAME ============ */

function getGamePool() {
  return APP_DATA.meals.filter(m => mealMatchesFilters(m, gameFilters, ''));
}

function renderGameSetup() {
  refreshGameFilterChips();
  const pool = getGamePool();
  document.getElementById('gamePoolCount').textContent =
    pool.length >= 2
      ? `${pool.length} meals in the running.`
      : `need at least 2 matching meals to play (currently ${pool.length}).`;
  document.getElementById('startGameBtn').disabled = pool.length < 2;
}

document.getElementById('startGameBtn').addEventListener('click', () => {
  startThisOrThat(getGamePool());
});

function startThisOrThat(pool) {
  if (pool.length < 2) return;
  game.roundNum = 1;
  game.totalRounds = Math.max(1, Math.ceil(Math.log2(pool.length)));
  game.allPicks = [];
  beginRound(shuffle(pool));
  showView('gamePlay');
}

function beginRound(poolForRound) {
  const arr = [...poolForRound];
  game.pairs = [];
  game.nextPool = [];
  while (arr.length > 1) {
    game.pairs.push([arr.shift(), arr.shift()]);
  }
  if (arr.length === 1) game.nextPool.push(arr[0]); // bye advances automatically
  game.pairIndex = 0;
  renderGameProgress();
  showCurrentPair();
}

function renderGameProgress() {
  const wrap = document.getElementById('gameProgress');
  wrap.innerHTML = '';
  for (let i = 1; i <= game.totalRounds; i++) {
    const dot = document.createElement('span');
    if (i < game.roundNum) dot.classList.add('done');
    else if (i === game.roundNum) dot.classList.add('current');
    wrap.appendChild(dot);
  }
}

function renderDuelCard(el, meal) {
  el.innerHTML = `
    ${meal.image && meal.image.src
      ? `<img class="duel-card-image" src="${meal.image.src}" alt="${escapeHtml(meal.name)}">`
      : `<div class="duel-card-image-placeholder">\uD83C\uDF7D</div>`}
    <div class="duel-card-name">${escapeHtml(meal.name)}</div>
    <div class="duel-card-sub">${meal.ingredients.length ? escapeHtml(meal.ingredients.slice(0, 4).join(', ')) : ''}</div>
  `;
}

function showCurrentPair() {
  if (game.pairIndex >= game.pairs.length) {
    if (game.nextPool.length === 1) {
      finishGame(game.nextPool[0]);
      return;
    }
    game.roundNum++;
    beginRound(shuffle(game.nextPool));
    return;
  }
  const [a, b] = game.pairs[game.pairIndex];
  renderDuelCard(document.getElementById('duelCardA'), a);
  renderDuelCard(document.getElementById('duelCardB'), b);
}

function pickWinner(sideIndex) {
  const pair = game.pairs[game.pairIndex];
  const winner = pair[sideIndex];
  game.nextPool.push(winner);
  game.allPicks.push(winner);
  game.pairIndex++;
  showCurrentPair();
}

document.getElementById('duelCardA').addEventListener('click', () => pickWinner(0));
document.getElementById('duelCardB').addEventListener('click', () => pickWinner(1));
document.getElementById('quitGameBtn').addEventListener('click', () => showView('gameSetup'));

let lastWinnerId = null;

function finishGame(winnerMeal) {
  lastWinnerId = winnerMeal.id;
  const card = document.getElementById('resultCard');
  card.innerHTML = `
    ${winnerMeal.image && winnerMeal.image.src ? `<img src="${winnerMeal.image.src}" alt="${escapeHtml(winnerMeal.name)}">` : ''}
    <div class="result-card-name">${escapeHtml(winnerMeal.name)}</div>
    <div class="result-card-sub">${winnerMeal.ingredients.length ? escapeHtml(winnerMeal.ingredients.join(', ')) : ''}</div>
  `;
  const alreadyFav = APP_DATA.meals.find(m => m.id === winnerMeal.id)?.favorite;
  document.getElementById('obsessionQuestion').textContent = alreadyFav
    ? 'this is already one of your obsessions.'
    : 'add this to your current obsessions?';
  document.getElementById('addObsessionBtn').hidden = !!alreadyFav;

  renderThemesSummary(document.getElementById('resultThemes'), game.allPicks);
  renderMealMiniList(document.getElementById('resultRunnersUp'), 'other meals that did well', getTournamentRunnersUp(winnerMeal, game.allPicks, 5));
  showView('gameResult');
}

// a meal earns a "win" every time it beats another meal in a round; the
// champion is excluded here since they already have their own result card
function getTournamentRunnersUp(champion, allPicks, count) {
  const wins = {};
  const mealsById = {};
  allPicks.forEach(m => {
    if (m.id === champion.id) return;
    wins[m.id] = (wins[m.id] || 0) + 1;
    mealsById[m.id] = m;
  });
  return Object.keys(wins)
    .sort((a, b) => wins[b] - wins[a])
    .slice(0, count)
    .map(id => ({
      meal: mealsById[id],
      why: `won ${wins[id]} round${wins[id] === 1 ? '' : 's'}`
    }));
}

// generic renderer for a small clickable list of meals with a one-line
// reason each — used for This or That runners-up and Random Food's
// highly-rated-but-not-picked meals
function renderMealMiniList(container, label, entries) {
  if (!entries.length) { container.innerHTML = ''; return; }
  container.innerHTML = `<span class="similar-meals-label">${escapeHtml(label)}</span><div class="similar-meals-list"></div>`;
  const listEl = container.querySelector('.similar-meals-list');
  entries.forEach(({ meal, why }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'similar-meal-item';
    item.innerHTML = `
      ${meal.image && meal.image.src
        ? `<img src="${meal.image.src}" alt="${escapeHtml(meal.name)}">`
        : `<div class="similar-meal-placeholder">\uD83C\uDF7D</div>`}
      <div>
        <div class="similar-meal-name">${escapeHtml(meal.name)}</div>
        <div class="similar-meal-why">${escapeHtml(why)}</div>
      </div>
    `;
    item.addEventListener('click', () => openMealModal(meal.id));
    listEl.appendChild(item);
  });
}

function extractThemeTokens(meal) {
  // ingredients may be entered as one comma-separated string in a single
  // row, or as several separate rows — split every entry on commas so
  // both styles count correctly toward common themes.
  const ingredientTokens = meal.ingredients.flatMap(i => i.split(',').map(s => s.trim()).filter(Boolean));
  return [...meal.keywords, ...ingredientTokens];
}

function renderThemesSummary(container, pickedMeals) {
  const counts = {};
  pickedMeals.forEach(m => extractThemeTokens(m).forEach(token => {
    const key = token.toLowerCase();
    if (!counts[key]) counts[key] = { label: token, count: 0 };
    counts[key].count++;
  }));
  const ranked = Object.values(counts).sort((a, b) => b.count - a.count);
  const meaningful = ranked.filter(r => r.count > 1);
  const list = meaningful.length ? meaningful : ranked;
  if (!list.length) { container.innerHTML = ''; return; }

  const top = list[0];
  const rest = list.slice(1, 5);

  container.innerHTML = `
    <div class="theme-top">
      <span class="theme-top-label">came up the most</span>
      <span class="theme-top-value">${escapeHtml(top.label)}${top.count > 1 ? ` \u00d7${top.count}` : ''}</span>
    </div>
    ${rest.length ? `
      <div class="theme-others">
        <span class="theme-others-label">you might also like</span>
        <div class="theme-others-list">${rest.map(r => `<span>${escapeHtml(r.label)}</span>`).join('')}</div>
      </div>` : ''}
  `;
}

document.getElementById('addObsessionBtn').addEventListener('click', () => {
  const meal = APP_DATA.meals.find(m => m.id === lastWinnerId);
  if (meal) {
    meal.favorite = true;
    persist();
    refreshEverything();
  }
  document.getElementById('addObsessionBtn').hidden = true;
  document.getElementById('obsessionQuestion').textContent = 'added to your obsessions.';
});

document.getElementById('skipObsessionBtn').addEventListener('click', () => {
  showView('gameSetup');
});
document.getElementById('playAgainBtn').addEventListener('click', () => {
  showView('gameSetup');
});

/* ============ RANDOM FOOD GAME ============ */
/* Purely a "what am I in the mood for" tool — nothing here is saved
   anywhere; keywordScores exists only for the duration of one session
   and just nudges which meals come up next. */

function getRandomPool() {
  return APP_DATA.meals.filter(m => mealMatchesFilters(m, randomFilters, ''));
}

function renderRandomSetup() {
  refreshRandomFilterChips();
  const pool = getRandomPool();
  document.getElementById('randomPoolCount').textContent =
    pool.length >= 1
      ? `${pool.length} meal${pool.length === 1 ? '' : 's'} could come up.`
      : 'no meals match those filters yet.';
  document.getElementById('startRandomBtn').disabled = pool.length < 1;
}

document.getElementById('startRandomBtn').addEventListener('click', () => {
  startRandomFood(getRandomPool());
});

function startRandomFood(pool) {
  if (pool.length < 1) return;
  randomGame.pool = pool;
  randomGame.remaining = shuffle(pool);
  randomGame.keywordScores = {};
  randomGame.mealRatings = {};
  randomGame.currentMeal = null;
  showView('randomPlay');
  advanceRandomGame();
}

function weightForMeal(meal) {
  const bonus = meal.keywords.reduce((sum, k) => sum + (randomGame.keywordScores[k] || 0), 0);
  return Math.max(0.15, 1 + bonus);
}

function advanceRandomGame() {
  if (randomGame.remaining.length === 0) {
    finalizeRandomGameAuto();
    return;
  }
  const pool = randomGame.remaining;
  const weights = pool.map(weightForMeal);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosenIdx = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) { chosenIdx = i; break; }
  }
  const chosen = pool.splice(chosenIdx, 1)[0];
  randomGame.currentMeal = chosen;
  renderRandomProgress();
  renderRandomCard(chosen);
}

function renderRandomProgress() {
  const shownSoFar = randomGame.pool.length - randomGame.remaining.length; // includes the one about to be shown
  document.getElementById('randomProgress').textContent =
    `meal ${shownSoFar} of ${randomGame.pool.length} \u2014 each one only comes up once this round.`;
}

function renderRandomCard(meal) {
  const card = document.getElementById('randomCard');
  card.innerHTML = `
    ${meal.image && meal.image.src
      ? `<img class="random-card-image" src="${meal.image.src}" alt="${escapeHtml(meal.name)}">`
      : `<div class="random-card-image-placeholder">\uD83C\uDF7D</div>`}
    <div class="random-card-headline">YAY! you're eating</div>
    <div class="random-card-name">${escapeHtml(meal.name)}</div>
    <div class="random-card-sub">${meal.ingredients.length ? escapeHtml(meal.ingredients.join(', ')) : ''}</div>
  `;
}

document.querySelectorAll('.rating-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const delta = Number(btn.dataset.rating);
    const meal = randomGame.currentMeal;
    if (meal) {
      randomGame.mealRatings[meal.id] = delta;
      meal.keywords.forEach(k => {
        randomGame.keywordScores[k] = (randomGame.keywordScores[k] || 0) + delta;
      });
    }
    advanceRandomGame();
  });
});

document.getElementById('selectRandomMealBtn').addEventListener('click', () => {
  if (randomGame.currentMeal) finishRandomGame(randomGame.currentMeal, false);
});
document.getElementById('leaveRandomGameBtn').addEventListener('click', () => {
  showView('randomSetup');
});

function finalizeRandomGameAuto() {
  const ratedIds = Object.keys(randomGame.mealRatings);
  if (!ratedIds.length) { showView('randomSetup'); return; }
  let best = null;
  let bestScore = -Infinity;
  ratedIds.forEach(id => {
    const meal = randomGame.pool.find(m => m.id === id);
    if (!meal) return;
    // small tiebreaker so ties between equally-rated meals lean toward
    // whichever also picked up more keyword goodwill along the way
    const score = randomGame.mealRatings[id] + weightForMeal(meal) * 0.001;
    if (score > bestScore) { bestScore = score; best = meal; }
  });
  if (best) finishRandomGame(best, true);
  else showView('randomSetup');
}

function getLikedRandomMeals() {
  return Object.entries(randomGame.mealRatings)
    .filter(([, rating]) => rating > 0)
    .map(([id]) => randomGame.pool.find(m => m.id === id))
    .filter(Boolean);
}

const RATING_LABELS = { 3: 'rated YAY!', 1: 'rated maybe!', 0: 'rated not sure', '-1': 'rated not a fan', '-3': 'rated absolutely not' };

// meals from this round that got a positive reaction but weren't the one
// you ended up with — ranked by how highly you rated them
function getRandomRunnersUp(champion, count) {
  return Object.entries(randomGame.mealRatings)
    .filter(([id, rating]) => id !== champion.id && rating > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, rating]) => ({
      meal: randomGame.pool.find(m => m.id === id),
      why: RATING_LABELS[rating] || 'rated highly'
    }))
    .filter(x => x.meal)
    .slice(0, count);
}

function finishRandomGame(meal, wasAutoPicked) {
  randomGame.lastMealId = meal.id;
  document.getElementById('randomResultEyebrow').textContent = wasAutoPicked
    ? 'you never hit select, but based on your reactions, you\u2019d probably like'
    : 'you\u2019re having';
  const card = document.getElementById('randomResultCard');
  card.innerHTML = `
    ${meal.image && meal.image.src ? `<img src="${meal.image.src}" alt="${escapeHtml(meal.name)}">` : ''}
    <div class="result-card-name">${escapeHtml(meal.name)}</div>
    <div class="result-card-sub">${meal.ingredients.length ? escapeHtml(meal.ingredients.join(', ')) : ''}</div>
  `;
  renderThemesSummary(document.getElementById('randomResultThemes'), getLikedRandomMeals());
  renderMealMiniList(document.getElementById('randomSimilarMeals'), 'also rated highly', getRandomRunnersUp(meal, 5));
  const alreadyFav = APP_DATA.meals.find(m => m.id === meal.id)?.favorite;
  document.getElementById('randomObsessionQuestion').textContent = alreadyFav
    ? 'this is already one of your obsessions.'
    : 'add this to your current obsessions?';
  document.getElementById('addRandomObsessionBtn').hidden = !!alreadyFav;
  showView('randomResult');
}

document.getElementById('addRandomObsessionBtn').addEventListener('click', () => {
  const meal = APP_DATA.meals.find(m => m.id === randomGame.lastMealId);
  if (meal) {
    meal.favorite = true;
    persist();
    refreshEverything();
  }
  document.getElementById('addRandomObsessionBtn').hidden = true;
  document.getElementById('randomObsessionQuestion').textContent = 'added to your obsessions.';
});
document.getElementById('skipRandomObsessionBtn').addEventListener('click', () => showView('randomSetup'));
document.getElementById('randomPlayAgainBtn').addEventListener('click', () => showView('randomSetup'));

/* ============ GLOBAL REFRESH ============ */

function refreshEverything() {
  refreshBrowseFilterChips();
  refreshGameFilterChips();
  refreshRandomFilterChips();
  const activeView = document.querySelector('.view.active').id.replace('view-', '');
  if (activeView === 'all') renderBrowse();
  if (activeView === 'favorites') renderFavorites();
  if (activeView === 'considering') renderConsidering();
  if (activeView === 'gameSetup') renderGameSetup();
  if (activeView === 'randomSetup') renderRandomSetup();
  if (activeView === 'missingInfo') renderMissingInfo();
  updateMissingInfoBanner();
}

/* ============ INIT ============ */

loadData();
refreshBrowseFilterChips();
refreshGameFilterChips();
refreshRandomFilterChips();
resetMealForm();
renderBrowse();

// Immediate test message so the debug area visibly confirms the script ran
document.addEventListener('DOMContentLoaded', () => {
  try {
    const el = document.getElementById('debugLog');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'DEBUG TEST: script loaded and DOMContentLoaded fired.';
    }
  } catch (e) { /* ignore */ }
  try { console.log('DEBUG TEST: script loaded and DOMContentLoaded fired.'); } catch (e) {}
});