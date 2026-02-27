// Replace this config with your actual Firebase Project config
const firebaseConfig = {
    apiKey: "AIzaSyMockKeyForLocalTestingPleaseReplace",
    authDomain: "forward-app.firebaseapp.com",
    projectId: "forward-app",
    storageBucket: "forward-app.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:123456:web:abcdef"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// Enable Offline Persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Multiple tabs open, offline persistence disabled.");
        } else if (err.code == 'unimplemented') {
            console.warn("The current browser does not support all of the features required to enable persistence.");
        }
    });

// Handle Auth State
auth.onAuthStateChanged((user) => {
    currentUser = user;
    const syncTitle = document.getElementById('sync-account-title');
    const syncSub = document.getElementById('sync-account-sub');
    const syncStatus = document.getElementById('sync-account-status');

    if (user) {
        if (user.isAnonymous) {
            if (syncTitle) syncTitle.textContent = "Link Email Account";
            if (syncSub) syncSub.textContent = "Sync across devices";
            if (syncStatus) syncStatus.textContent = "→";
        } else {
            if (syncTitle) syncTitle.textContent = "Account Linked";
            if (syncSub) syncSub.textContent = user.email;
            if (syncStatus) syncStatus.textContent = "✓";
        }
        // We have a user! Re-initialize data sync.
        if (typeof load === 'function') {
            load(); // We'll modify data.js to use Firestore
        }
    } else {
        // No user found, create an anonymous session immediately
        auth.signInAnonymously().catch((error) => {
            console.error("Anonymous Sign-in failed", error);
        });
    }
});

// UI Functions for Linking Account
function toggleAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('active');
        // Adjust UI based on state
        if (currentUser && !currentUser.isAnonymous) {
            document.getElementById('auth-submit-btn').style.display = 'none';
            document.getElementById('auth-signout-btn').style.display = 'block';
            document.getElementById('auth-email').style.display = 'none';
            document.getElementById('auth-password').style.display = 'none';
        } else {
            document.getElementById('auth-submit-btn').style.display = 'block';
            document.getElementById('auth-signout-btn').style.display = 'none';
            document.getElementById('auth-email').style.display = 'block';
            document.getElementById('auth-password').style.display = 'block';
        }
        document.getElementById('auth-error-msg').style.display = 'none';
    }
}

function linkEmailAccount() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const errMsg = document.getElementById('auth-error-msg');

    if (!email || !pass) {
        errMsg.style.display = 'block';
        errMsg.textContent = 'Please enter both email and password.';
        return;
    }

    if (currentUser && currentUser.isAnonymous) {
        const credential = firebase.auth.EmailAuthProvider.credential(email, pass);
        currentUser.linkWithCredential(credential).then((usercred) => {
            const user = usercred.user;
            console.log("Anonymous account successfully upgraded", user);
            document.getElementById('auth-modal').classList.remove('active');
        }).catch((error) => {
            if (error.code === 'auth/credential-already-in-use') {
                // If they already have an account, sign them in to it instead
                auth.signInWithCredential(credential).then(() => {
                    document.getElementById('auth-modal').classList.remove('active');
                });
            } else {
                errMsg.style.display = 'block';
                errMsg.textContent = error.message;
            }
        });
    }
}

function signOutAccount() {
    auth.signOut().then(() => {
        document.getElementById('auth-modal').classList.remove('active');
        // Wipe local array state when signing out of linked account to prevent mixing
        items = [];
        projects = [];
        if (typeof renderInbox === 'function') renderInbox();
    });
}
