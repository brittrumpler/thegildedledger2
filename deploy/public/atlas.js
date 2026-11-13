const $ = id => document.getElementById(id);
const map = $('map');
const viewport = $('atlas-viewport');
const chart = $('atlas-chart');
const pins = $('atlas-pins');
const list = $('atlas-list');
const filters = ['atlas-search', 'atlas-region', 'atlas-type', 'atlas-tale'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const safeSource = value => {
  try {
    const url = new URL(value);
    return ['https://seaofthieves.wiki.gg','https://rarethief.com','https://www.seaofthieves.com'].includes(url.origin) ? escape(url.href) : '';
  } catch {
    return '';
  }
};
const normalized = value => String(value).normalize('NFKD').replace(/[^a-z0-9]/gi, '').toLowerCase();
const columns = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rows = 26;
let locations;
let load;
let selected;
let zoom = 1;

function coordinates(location) {
  if (location.chart) return location.chart;
  const match = /^([A-Z])\s*-\s*(\d{1,2})$/.exec(location.grid);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > rows) return null;
  return [.114 + (columns.indexOf(match[1]) + .5) * .0299, .111 + (Number(match[2]) - .5) * .0299];
}

function setZoom(level, center = false) {
  const x = center ? .5 : (viewport.scrollLeft + viewport.clientWidth / 2) / (chart.offsetWidth || 1);
  const y = center ? .5 : (viewport.scrollTop + viewport.clientHeight / 2) / (chart.offsetHeight || 1);
  zoom = level;
  chart.style.width = `${Math.round(Math.min(viewport.clientWidth, viewport.clientHeight) * zoom)}px`;
  viewport.scrollLeft = chart.offsetWidth * x - viewport.clientWidth / 2;
  viewport.scrollTop = chart.offsetHeight * y - viewport.clientHeight / 2;
  $('atlas-out').disabled = zoom <= 1;
  $('atlas-in').disabled = zoom >= 3.8;
}

function setupOptions(id, values) {
  const control = $(id);
  for (const value of [...new Set(values)].sort((a,b)=>a.localeCompare(b))) {
    const option = document.createElement('option');
    option.value = option.textContent = value;
    control.append(option);
  }
}

function selectedTales(location) {
  const filter = $('atlas-tale').value;
  return filter ? location.tales.filter(tale => tale.title === filter) : location.tales;
}

function updateDetails() {
  const location = locations.find(place => place.id === selected);
  const detail = $('atlas-detail');
  if (!location) {
    detail.innerHTML = '<h3>Choose a location</h3><p>Pick a marker or a place in the list.</p>';
    return;
  }
  const tales = selectedTales(location);
  const photo = safeSource(location.image);
  const source = safeSource(location.source);
  const facts = Object.entries(location.facts || {}).map(([label, entries]) =>
    `<dt>${escape(label)}</dt><dd>${entries.map(escape).join(', ')}</dd>`).join('');
  detail.innerHTML = `<div class="atlas-location-header">
      <div><p class="atlas-kicker">${escape(location.type)}</p><h3 tabindex="-1">${escape(location.name)}</h3></div>
      <span class="atlas-coordinate">${escape(location.grid || 'Off map')}</span>
    </div>
    <p class="atlas-location-region">${escape(location.region)}</p>
    ${photo ? `<img class="atlas-island-photo" src="${photo}" alt="" loading="lazy">` : ''}
    ${facts ? `<dl class="atlas-facts">${facts}</dl>` : ''}
    <h4>Tall Tales</h4>
    ${tales.length ? `<ul class="atlas-tales">${tales.map(tale => {
      const link = safeSource(tale.source);
      return `<li><span>${escape(tale.kind)}</span><strong>${escape(tale.title)}</strong><p>${escape(tale.note)}</p>
        ${link ? `<a href="${link}" target="_blank" rel="noopener">Step guide ↗</a>` : ''}</li>`;
    }).join('')}</ul>` : '<p class="fine-print">No Tall Tale stops are listed for this location in the guide.</p>'}
    ${source ? `<a href="${source}" target="_blank" rel="noopener" class="atlas-source-link">Island guide ↗</a>` : ''}`;
  detail.scrollTop = 0;
  detail.querySelector('img')?.addEventListener('error', event => event.target.hidden = true, { once: true });
}

function updateSelected() {
  for (const button of map.querySelectorAll('[data-place]')) {
    button.setAttribute('aria-pressed', String(button.dataset.place === selected));
  }
  updateDetails();
}

function render() {
  const query = normalized($('atlas-search').value);
  const region = $('atlas-region').value;
  const group = $('atlas-type').value;
  const tale = $('atlas-tale').value;
  const visible = locations.filter(place =>
    (!query || normalized(place.name).includes(query) || normalized(place.grid).includes(query)) &&
    (!region || place.region === region) && (!group || place.group === group) &&
    (!tale || place.tales.some(entry => entry.title === tale))
  );
  if (!visible.some(place => place.id === selected)) selected = visible.length === 1 ? visible[0].id : '';
  pins.innerHTML = visible.map(place => {
    const point = coordinates(place);
    if (!point) return '';
    const kind = place.group === 'Outpost' ? 'outpost' : place.group === 'Island' ? 'island' : 'other';
    return `<button class="atlas-pin ${kind}${place.tales.length ? ' has-tale' : ''}" type="button" data-place="${escape(place.id)}"
      style="left:${point[0] * 100}%;top:${point[1] * 100}%"
      aria-label="${escape(place.name)}, ${escape(place.grid)}" title="${escape(place.name)} · ${escape(place.grid)}">
      <i aria-hidden="true"></i><span class="atlas-pin-label" aria-hidden="true">${escape(place.name)}</span></button>`;
  }).join('');
  list.innerHTML = visible.map(place =>
    `<button class="atlas-list-row" type="button" data-place="${escape(place.id)}">
      <span><strong>${escape(place.name)}</strong><small>${escape(place.type)}${place.tales.length ? ' · Tall Tale' : ''}</small></span>
      <span>${escape(place.grid || 'Off map')}</span>
    </button>`
  ).join('') || '<p class="fine-print atlas-no-results">No locations match these filters.</p>';
  $('atlas-results').textContent = `${visible.length} shown`;
  updateSelected();
}

function select(placeId, center) {
  selected = placeId;
  updateSelected();
  const point = coordinates(locations.find(place => place.id === placeId));
  if (center && point) {
    viewport.scrollLeft = chart.offsetWidth * point[0] - viewport.clientWidth / 2;
    viewport.scrollTop = chart.offsetHeight * point[1] - viewport.clientHeight / 2;
  }
}

map.addEventListener('click', event => {
  const button = event.target.closest('[data-place]');
  if (!button) return;
  select(button.dataset.place, list.contains(button));
  const heading = $('atlas-detail').querySelector('h3');
  if (heading && window.matchMedia('(max-width: 880px)').matches) {
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'nearest' });
  }
});
for (const id of filters) $(id).addEventListener(id === 'atlas-search' ? 'input' : 'change', () => locations && render());
$('atlas-out').addEventListener('click', () => setZoom(Math.max(1, zoom / 1.4)));
$('atlas-in').addEventListener('click', () => setZoom(Math.min(3.8, zoom * 1.4)));
$('atlas-reset').addEventListener('click', () => setZoom(1, true));

let drag;
viewport.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('is-panning');
});
viewport.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  viewport.scrollLeft = drag.left + drag.x - event.clientX;
  viewport.scrollTop = drag.top + drag.y - event.clientY;
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) viewport.addEventListener(type, () => {
  drag = undefined;
  viewport.classList.remove('is-panning');
});

async function openMap() {
  if (location.hash !== '#map') return;
  if (locations) {
    if (viewport.clientWidth) setZoom(zoom);
    return;
  }
  if (load) return;
  load = fetch('data/atlas.json?v=map-table').then(response => {
    if (!response.ok) throw new Error('Chart data request failed');
    return response.json();
  }).then(data => {
    locations = data.locations.sort((a,b)=>a.name.localeCompare(b.name));
    $('atlas-count').textContent = `${locations.length} charted locations`;
    setupOptions('atlas-region', locations.map(place => place.region));
    setupOptions('atlas-type', locations.map(place => place.group));
    setupOptions('atlas-tale', locations.flatMap(place => place.tales.map(tale => tale.title)));
    render();
    requestAnimationFrame(() => setZoom(1, true));
  }).catch(() => {
    load = undefined;
    $('atlas-count').textContent = 'The location guide could not load. Switch tabs and try again.';
  });
}
window.addEventListener('hashchange', openMap);
window.addEventListener('resize', () => { if (locations && viewport.clientWidth) setZoom(zoom); });
openMap();
