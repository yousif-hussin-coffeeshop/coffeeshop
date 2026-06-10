/* ============================================================
 *  بُن البلد — Frontend logic
 *  - Loads content.json (mini-CMS) and injects it into the page
 *  - Handles the floating chatbot widget + proxy calls
 * ============================================================ */

// ⚠️ Replace with your deployed Cloudflare Worker URL (see README.md)
const PROXY_URL = 'https://coffeeshop-proxy.yousifhussincoffeeshop.workers.dev';

// Used only when content.json can't be fetched — e.g. opening index.html
// directly from disk (file://) where browsers block fetch, or a JSON syntax
// error after an edit. Keep it in sync with content.json.
const FALLBACK_CONTENT = {
  shopName: 'بُن البلد',
  heroTitle: 'قهوتك على مزاجك.. زي زمان',
  heroSubtitle: 'بن طازة بنحمّصه يومياً، وقعدة بتجمعك بأحلى الناس. من قلب الحي وليك.',
  contactPhone: '+20 100 234 5678',
  contactAddress: '15 شارع النيل، الدقي، الجيزة',
  menu: [
    {
      category: 'مشروبات ساخنة',
      name: 'قهوة تركي على الرملة',
      description: 'بن محمص غامق، بتتعمل قدامك على الرملة وبتتقدم بوشّها',
      price: '30 ج.م',
    },
    {
      category: 'مشروبات ساخنة',
      name: 'إسبريسو دبل',
      description: 'شوت مزدوج من بن أرابيكا مختار بعناية، للي بيحبوا القهوة جد',
      price: '45 ج.م',
    },
    {
      category: 'مشروبات ساخنة',
      name: 'لاتيه بالبندق',
      description: 'إسبريسو ناعم مع حليب مبخّر ولمسة بندق دافية',
      price: '55 ج.م',
    },
    {
      category: 'مشروبات باردة',
      name: 'آيس كوفي كراميل',
      description: 'قهوة مثلجة منعشة بصوص الكراميل وكريمة خفيفة',
      price: '60 ج.م',
    },
    {
      category: 'حلويات',
      name: 'كوكيز الشوكولاتة البيتي',
      description: 'مخبوز طازة كل يوم الصبح، بياخدك لجو البيت مع قهوتك',
      price: '25 ج.م',
    },
  ],
};

// Filled after content.json loads; sent to the proxy as chatbot context
let siteData = null;

// Conversation history: [{ role: 'user' | 'assistant', content: '...' }]
const chatHistory = [];

/* ----------------------- Content loading ----------------------- */

async function loadContent() {
  try {
    const res = await fetch('content.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    siteData = await res.json();
    renderContent(siteData);
  } catch (err) {
    // file:// preview or broken JSON — render the embedded copy instead of
    // a broken page full of placeholders
    console.error(
      'فشل تحميل content.json — هيتم عرض النسخة الاحتياطية المدمجة في app.js:',
      err
    );
    siteData = FALLBACK_CONTENT;
    renderContent(siteData);
  }
}

function renderContent(data) {
  // Texts
  setText('nav-shop-name', data.shopName);
  setText('hero-title', data.heroTitle);
  setText('hero-subtitle', data.heroSubtitle);
  setText('contact-address', data.contactAddress);
  setText('footer-shop-name', data.shopName);
  setText('chat-shop-name', `مساعد ${data.shopName}`);
  document.title = `${data.shopName} | ${data.heroTitle}`;

  // Phone links (strip spaces for the tel: scheme)
  const tel = `tel:${String(data.contactPhone).replace(/\s+/g, '')}`;
  const phoneLink = document.getElementById('contact-phone');
  if (phoneLink) {
    phoneLink.textContent = data.contactPhone;
    phoneLink.href = tel;
  }
  const orderBtn = document.getElementById('order-btn');
  if (orderBtn) orderBtn.href = tel;

  renderMenu(data.menu || []);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

/* --------------------------- Menu ------------------------------ */

function renderMenu(menu) {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Group items by category, preserving JSON order
  const categories = [...new Set(menu.map((item) => item.category))];

  for (const category of categories) {
    const section = document.createElement('div');
    section.className = 'mb-10 last:mb-0';

    const heading = document.createElement('h3');
    heading.className =
      'text-xl font-black text-caramel mb-4 flex items-center gap-2';
    heading.textContent = category;
    section.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4';

    for (const item of menu.filter((i) => i.category === category)) {
      const card = document.createElement('article');
      card.className =
        'bg-white border border-latte rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition';

      const top = document.createElement('div');
      top.className = 'flex items-start justify-between gap-3 mb-2';

      const name = document.createElement('h4');
      name.className = 'font-black text-espresso';
      name.textContent = item.name;

      const price = document.createElement('span');
      price.className =
        'bg-latte text-mocha text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap';
      price.textContent = item.price;

      top.append(name, price);

      const desc = document.createElement('p');
      desc.className = 'text-sm text-mocha leading-relaxed';
      desc.textContent = item.description;

      card.append(top, desc);
      cards.appendChild(card);
    }

    section.appendChild(cards);
    grid.appendChild(section);
  }
}

/* -------------------------- Chatbot ---------------------------- */

const chatToggle = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

function setChatOpen(open) {
  chatWindow.classList.toggle('hidden', !open);
  chatWindow.classList.toggle('flex', open);
  chatToggle.setAttribute('aria-expanded', String(open));
  chatToggle.textContent = open ? '✕' : '💬';
  if (open) chatInput.focus();
}

chatToggle.addEventListener('click', () =>
  setChatOpen(chatWindow.classList.contains('hidden'))
);
chatClose.addEventListener('click', () => setChatOpen(false));

// Render a message bubble; uses textContent only (no HTML injection)
function appendMessage(role, text) {
  const row = document.createElement('div');
  row.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';

  const bubble = document.createElement('div');
  bubble.className =
    role === 'user'
      ? 'bg-espresso text-cream rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm leading-relaxed shadow-sm'
      : 'bg-white border border-latte text-roast rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm leading-relaxed shadow-sm';
  bubble.textContent = text;

  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function showTyping() {
  const bubble = appendMessage('assistant', '');
  bubble.classList.add('animate-pulse');
  bubble.textContent = 'بيكتب...';
  return bubble.parentElement; // the row, so we can remove it later
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || chatSend.disabled) return;

  // Friendly guard if the proxy hasn't been configured yet
  if (PROXY_URL === 'YOUR_CLOUDFLARE_WORKER_URL_HERE') {
    appendMessage('user', text);
    appendMessage(
      'assistant',
      'المساعد لسه مش متوصّل. لازم صاحب الموقع يضيف لينك الـ Worker في ملف app.js الأول. 🙏'
    );
    chatInput.value = '';
    return;
  }

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  chatInput.value = '';
  chatSend.disabled = true;
  chatInput.disabled = true;
  const typingRow = showTyping();

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        // Last few turns (excluding the message we just pushed) for continuity
        history: chatHistory.slice(0, -1).slice(-6),
        // The whole mini-CMS so the bot answers from real menu data only
        context: siteData,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = (data && data.reply) || '';
    if (!reply) throw new Error('Empty reply');

    typingRow.remove();
    appendMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error('Chat error:', err);
    typingRow.remove();
    appendMessage(
      'assistant',
      'معلش، حصلت مشكلة صغيرة عندي. جرّب تاني كمان شوية، أو كلمنا على التليفون. ☎️'
    );
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});

/* ---------------------------- Init ----------------------------- */

// The year doesn't depend on content.json — set it even if the fetch fails
setText('footer-year', String(new Date().getFullYear()));
loadContent();
