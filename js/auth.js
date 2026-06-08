var currentUser = null;
var appStarted  = false; // bindEvents() chỉ gọi 1 lần dù login/logout nhiều lần

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(() =>
    alert('Đăng nhập thất bại. Vui lòng thử lại!'));
}

function signOutUser() {
  if (!confirm('Đăng xuất khỏi Advanced Diary?')) return;
  auth.signOut();
}

function updateUserAvatar() {
  const el = document.getElementById('user-avatar');
  if (currentUser.photoURL) {
    el.innerHTML = `<img src="${currentUser.photoURL}" alt="">`;
  } else {
    el.textContent = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();
  }
}

// Lắng nghe thay đổi trạng thái đăng nhập
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('loading-screen').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');

    await loadFromFirestore();

    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    updateUserAvatar();
    loadShortcuts();
    initTheme();
    renderMain();

    // Bind events chỉ 1 lần để tránh duplicate listeners
    if (!appStarted) {
      initScrollbar();
      initTouchDrag();
      initCarouselSwipe();
      bindEvents();
      appStarted = true;
    }
  } else {
    currentUser = null;
    notebooks   = [];
    entries     = [];
    imageCache  = {};

    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
  }
});
