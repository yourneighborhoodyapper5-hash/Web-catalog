import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app-check.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD8Km7xNl6rp376KuT8A9o9sBRUlH_AGsc',
  authDomain: 'api-holder-catalog.firebaseapp.com',
  projectId: 'api-holder-catalog',
  storageBucket: 'api-holder-catalog.firebasestorage.app',
  messagingSenderId: '652836332608',
  appId: '1:652836332608:web:dc8de4b814e03998a22ba5',
  measurementId: 'G-X0D1TNQDZ1'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Replace this public site key with your reCAPTCHA v3 site key from Firebase App Check.
const appCheckSiteKey = 'REPLACE_WITH_FIREBASE_APP_CHECK_RECAPTCHA_V3_SITE_KEY';
if (appCheckSiteKey !== 'REPLACE_WITH_FIREBASE_APP_CHECK_RECAPTCHA_V3_SITE_KEY') {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}
const ollamaChat = httpsCallable(getFunctions(app, 'us-central1'), 'ollamaChat');
const $ = (selector) => document.querySelector(selector);
const searchForm = $('#search-form');
const searchInput = $('#search-input');
const resultsSection = $('#results-section');
const webResults = $('#web-results');
const answerContent = $('#answer-content');
const toast = $('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function updateSearchLinks(query = searchInput.value.trim()) {
  const encoded = encodeURIComponent(query);
  $('#google-link').href = `https://www.google.com/search?q=${encoded}`;
  $('#bing-link').href = `https://www.bing.com/search?q=${encoded}`;
  $('#ddg-link').href = `https://duckduckgo.com/?q=${encoded}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderResults(pages) {
  webResults.replaceChildren();
  pages.forEach((page) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    const title = escapeHtml(page.title);
    const excerpt = escapeHtml(page.extract || 'Open this page to explore more about the topic.');
    const href = escapeHtml(page.url);
    card.innerHTML = `<div class="result-source"><span class="source-favicon">W</span> Wikipedia</div><a class="result-title" href="${href}" target="_blank" rel="noopener noreferrer">${title}</a><p class="result-excerpt">${excerpt}</p>`;
    webResults.append(card);
  });
}

async function findSources(query) {
  const endpoint = new URL('https://en.wikipedia.org/w/api.php');
  endpoint.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '6', gsrnamespace: '0', prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '3', format: 'json', origin: '*' }).toString();
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Search results are temporarily unavailable.');
  const payload = await response.json();
  return Object.values(payload.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((page) => ({ title: page.title, extract: page.extract || '', url: `https://en.wikipedia.org/?curid=${page.pageid}` }));
}

async function loadOllamaSettings() {
  // Only the model name is public configuration. The Ollama API key stays in Firebase Secret Manager.
  const snapshot = await getDoc(doc(db, 'settings', 'ollama'));
  if (!snapshot.exists()) throw new Error('Add the model name to Firestore at settings/ollama.');
  const { model } = snapshot.data();
  if (!model) throw new Error('Add a model string field to Firestore at settings/ollama.');
  return { model: String(model) };
}

function formatAnswer(text, pages) {
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  const content = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\[(\d+)\]/g, (_, number) => {
    const page = pages[Number(number) - 1];
    return page ? `<a href="${escapeHtml(page.url)}" target="_blank" rel="noopener noreferrer">[${number}]</a>` : `[${number}]`;
  })}</p>`).join('');
  answerContent.innerHTML = content || '<p>I couldn’t form a useful summary from these sources. The links are ready for you to explore.</p>';
}

async function askOllama(query, pages) {
  const { model } = await loadOllamaSettings();
  const response = await ollamaChat({
    model,
    query,
    sources: pages.map(({ title, extract, url }) => ({ title, extract, url }))
  });
  if (!response.data?.content) throw new Error('Ollama returned an empty answer.');
  return response.data.content;
}

async function search(query) {
  const cleaned = query.trim();
  if (!cleaned) { searchInput.focus(); return; }
  searchInput.value = cleaned;
  updateSearchLinks(cleaned);
  $('#results-title').textContent = cleaned;
  $('#result-count').textContent = 'SEARCHING THE WEB';
  $('#no-results').classList.add('hidden');
  webResults.replaceChildren();
  answerContent.innerHTML = '<div class="answer-placeholder"><span class="loader"></span><span>Looking through useful sources…</span></div>';
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const pages = await findSources(cleaned);
    $('#result-count').textContent = `${pages.length} WEB SOURCE${pages.length === 1 ? '' : 'S'}`;
    if (!pages.length) {
      $('#no-results').classList.remove('hidden');
      answerContent.innerHTML = '<p>I couldn’t find matching sources. Try a broader search, or use one of the search engines above.</p>';
      return;
    }
    renderResults(pages);
    answerContent.innerHTML = '<div class="answer-placeholder"><span class="loader"></span><span>Putting the sources together…</span></div>';
    try {
      formatAnswer(await askOllama(cleaned, pages), pages);
    } catch (error) {
      answerContent.innerHTML = '<p>Your web sources are ready. The AI summary is unavailable right now, but you can still open and read every result.</p>';
      showToast(error.message || 'Could not reach the AI service.');
    }
  } catch (error) {
    $('#result-count').textContent = 'SEARCH UNAVAILABLE';
    $('#no-results').classList.remove('hidden');
    showToast(error.message || 'Could not load web sources.');
  }
}

searchForm.addEventListener('submit', (event) => { event.preventDefault(); search(searchInput.value); });
searchInput.addEventListener('input', () => updateSearchLinks());
document.querySelectorAll('.quick-searches button').forEach((button) => button.addEventListener('click', () => search(button.dataset.query)));
$('#new-search').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => searchInput.focus(), 300); });
$('#settings-button').addEventListener('click', () => showToast('Add your model name at Firestore → settings → ollama. The API key is stored securely in Firebase Functions secrets.'));
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); searchInput.focus(); }
  if (event.key === 'Enter' && document.activeElement === searchInput) { event.preventDefault(); search(searchInput.value); }
});
updateSearchLinks('');
