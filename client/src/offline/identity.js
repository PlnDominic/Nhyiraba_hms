// Who is signed in, read synchronously from the app's own session record so it also works offline.
export const getCurrentUserId = () => {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('currentUser');
    return (raw && JSON.parse(raw)?.id) || 'anon';
  } catch (e) {
    return 'anon';
  }
};
