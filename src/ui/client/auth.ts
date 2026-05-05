export const AUTH_SCRIPT = `
;(function(){
  var ANON_KEY = 'museumAnonVisits';

  function readAnon() {
    try {
      var raw = window.localStorage.getItem(ANON_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(_) { return []; }
  }
  function writeAnon(arr){
    try { window.localStorage.setItem(ANON_KEY, JSON.stringify(arr)); } catch(_) {}
  }
  function clearAnon(){
    try { window.localStorage.removeItem(ANON_KEY); } catch(_) {}
  }
  function pushAnon(museumId, visitedAt){
    var arr = readAnon();
    var i = -1;
    for (var k = 0; k < arr.length; k++) { if (arr[k].museumId === museumId) { i = k; break; } }
    if (i >= 0) arr.splice(i,1);
    arr.unshift({ museumId: museumId, visitedAt: visitedAt || Date.now() });
    writeAnon(arr);
  }
  function removeAnon(museumId){
    var arr = readAnon().filter(function(v){ return v.museumId !== museumId; });
    writeAnon(arr);
  }

  async function syncMe(){
    try {
      var res = await fetch('/auth/me', { credentials: 'same-origin' });
      var j = await res.json();
      window.MuseumAuth.user = j.user || null;
      return window.MuseumAuth.user;
    } catch(_) { window.MuseumAuth.user = null; return null; }
  }
  async function register(email, password){
    var res = await fetch('/auth/register', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.error || 'register_failed');
    window.MuseumAuth.user = j.user;
    await mergeLocal();
    return j.user;
  }
  async function login(email, password){
    var res = await fetch('/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.error || 'login_failed');
    window.MuseumAuth.user = j.user;
    await mergeLocal();
    return j.user;
  }
  async function logout(){
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.MuseumAuth.user = null;
  }
  async function setDisplayName(name){
    var res = await fetch('/auth/me', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.error || 'update_failed');
    window.MuseumAuth.user = j.user;
    return j.user;
  }
  function googleStart(){
    window.location.href = '/auth/google/start';
  }
  async function mergeLocal(){
    var anon = readAnon();
    if (!anon.length) return 0;
    try {
      var res = await fetch('/auth/merge-anonymous', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visits: anon }),
      });
      if (res.ok) { clearAnon(); var j = await res.json(); return j.merged || 0; }
    } catch(_) {}
    return 0;
  }

  window.MuseumAuth = {
    user: null,
    syncMe: syncMe,
    register: register,
    login: login,
    logout: logout,
    setDisplayName: setDisplayName,
    googleStart: googleStart,
    mergeLocal: mergeLocal,
    isAuthenticated: function(){ return !!window.MuseumAuth.user; },
    anon: { read: readAnon, push: pushAnon, remove: removeAnon, clear: clearAnon },
  };
})();
`
