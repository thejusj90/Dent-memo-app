import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3?bundle';

const SUPABASE_URL = 'https://qcwsmepvucxtqgqohuqe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O9bkwJ1Qq3Kvpf2w7oS1zQ_bDAMe-sk';
const REDIRECT_TO = 'https://consent.dentmemo.in/';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const style = document.createElement('style');
style.textContent = `
  .oauth-wrap{display:grid;gap:10px;margin:14px 0}
  .oauth-sep{display:flex;align-items:center;gap:10px;color:#8b96a7;font-size:11px;font-weight:700}
  .oauth-sep:before,.oauth-sep:after{content:"";height:1px;background:#e2e7ef;flex:1}
  .google-auth-btn{width:100%;min-height:44px;border:1px solid #d9e0ea;border-radius:11px;background:#fff;color:#1f2937;font-weight:750;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer}
  .google-auth-btn:hover{background:#f8fafc}
  .google-auth-btn:disabled{opacity:.55;cursor:not-allowed}
  .google-g{font-weight:900;font-size:18px;color:#4285f4}
`;
document.head.appendChild(style);

async function googleSignIn(button) {
  if (!navigator.onLine) {
    alert('Connect to the internet to sign in with Google.');
    return;
  }
  button.disabled = true;
  button.textContent = 'Opening Google…';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_TO }
  });
  if (error) {
    button.disabled = false;
    button.innerHTML = '<span class="google-g">G</span> Continue with Google';
    alert(`Google sign-in failed: ${error.message}`);
  }
}

function injectGoogleButton() {
  const card = document.querySelector('.auth-card');
  if (!card || card.querySelector('[data-google-auth]')) return;

  const anchor = card.querySelector('#login, #su');
  if (!anchor) return;

  const wrap = document.createElement('div');
  wrap.className = 'oauth-wrap';
  wrap.dataset.googleAuth = 'true';
  wrap.innerHTML = `
    <button type="button" class="google-auth-btn">
      <span class="google-g">G</span> Continue with Google
    </button>
    <div class="oauth-sep"><span>or continue with email</span></div>
  `;
  anchor.parentNode.insertBefore(wrap, anchor);
  wrap.querySelector('.google-auth-btn').addEventListener('click', e => googleSignIn(e.currentTarget));
}

const observer = new MutationObserver(injectGoogleButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
injectGoogleButton();
