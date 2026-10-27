import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { taskTitle, taskOrder } from './tasks.js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const api = url && key ? createClient(url, key) : null;

function authError(error) {
  if (error.code === 'email_address_not_authorized') return 'Use the email you registered with Stripe Projects. This app’s free email service can only send to its owner or team.';
  if (error.code === 'over_email_send_rate_limit') return 'The email limit has been reached. Please wait an hour before trying again.';
  if (error.code === 'email_not_confirmed') return 'Confirm your email using the link in your inbox, then sign in.';
  if (error.code === 'invalid_credentials') return 'The email or password is incorrect.';
  return error.message;
}

function Auth({ recovery, onRecovered }) {
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const formRef = useRef(null);
  const screen = recovery ? 'password' : mode;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    setBusy(true); setError(''); setMessage('');
    try {
      let result;
      if (screen === 'password') result = await api.auth.updateUser({ password });
      else if (screen === 'signup') result = await api.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      else result = await api.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (screen === 'signup' && !result.data.session) {
        setMessage('Check your inbox for the confirmation link. After confirming, sign in here.');
        formRef.current?.reset();
      }
      if (screen === 'password') onRecovered();
    } catch (err) { setError(authError(err)); }
    finally { setBusy(false); }
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(''); setMessage(''); formRef.current?.reset();
  }

  return <section className="auth panel" aria-labelledby="auth-title">
    <h1 id="auth-title">{screen === 'password' ? 'Choose a new password' : screen === 'signup' ? 'Create your account' : 'Sign in'}</h1>
    <p>{screen === 'signup' ? 'Use the email you registered with Stripe Projects. Confirm the email before signing in.' : screen === 'password' ? 'Enter a new password for your account.' : 'Your tasks are saved to your account.'}</p>
    <form ref={formRef} onSubmit={submit}>
      {screen !== 'password' ? <label>Email<input type="email" name="email" autoComplete="email" required disabled={busy} /></label> : null}
      <label>Password<input type="password" name="password" autoComplete={screen === 'signin' ? 'current-password' : 'new-password'} minLength={screen === 'signin' ? 1 : 8} required disabled={busy} aria-describedby={screen !== 'signin' ? 'password-help' : undefined} /></label>
      {screen !== 'signin' ? <small id="password-help">At least 8 characters.</small> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : screen === 'signup' ? 'Create account' : screen === 'password' ? 'Save password' : 'Sign in'}</button>
    </form>
    {!recovery ? <button className="text-button" disabled={busy} onClick={switchMode}>{mode === 'signin' ? 'Create an account' : 'Back to sign in'}</button> : null}
  </section>;
}

function TaskList({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const request = useRef(0);
  const inFlight = useRef(false);
  const inputRef = useRef(null);

  async function load() {
    if (inFlight.current) return;
    const version = ++request.current;
    setLoading(true);
    try {
      const result = await api.from('tasks').select('id,title,completed,created_at').eq('user_id', user.id).order('created_at');
      if (result.error) throw result.error;
      if (active.current && version === request.current) { setTasks(result.data); setLoaded(true); setLoadError(''); }
    } catch (err) { if (active.current && version === request.current) setLoadError(err.message); }
    finally { if (active.current && version === request.current) setLoading(false); }
  }

  useEffect(() => {
    active.current = true; load();
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active.current = false; request.current++; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user.id]);

  async function mutate(action, success) {
    if (inFlight.current) return;
    inFlight.current = true; request.current++; setLoading(false); setBusy(true); setError(''); setNotice('');
    try {
      const result = await action();
      if (result.error) throw result.error;
      if (active.current) { success(result.data); setNotice('Saved.'); }
    } catch (err) { if (active.current) setError(err.message); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }

  async function add(event) {
    event.preventDefault();
    let value;
    try { value = taskTitle(title); } catch (err) { setError(err.message); return; }
    await mutate(() => api.from('tasks').insert({ user_id: user.id, title: value }).select('id,title,completed,created_at').single(), task => {
      setTasks(current => [...current, task]); setTitle(''); inputRef.current?.focus();
    });
  }

  async function rename(event, task) {
    event.preventDefault();
    let value;
    try { value = taskTitle(draft); } catch (err) { setError(err.message); return; }
    await mutate(() => api.from('tasks').update({ title: value }).eq('id', task.id).eq('user_id', user.id).select('id,title,completed,created_at').single(), updated => {
      setTasks(current => current.map(t => t.id === task.id ? updated : t)); setEditing(null);
    });
  }

  async function complete(task) {
    await mutate(() => api.from('tasks').update({ completed: !task.completed }).eq('id', task.id).eq('user_id', user.id).select('id,title,completed,created_at').single(), updated => {
      setTasks(current => current.map(t => t.id === task.id ? updated : t));
    });
  }

  async function remove(task) {
    await mutate(() => api.from('tasks').delete().eq('id', task.id).eq('user_id', user.id).select('id').single(), () => {
      setTasks(current => current.filter(t => t.id !== task.id)); setDeleting(null); setNotice('Task deleted.');
    });
  }

  async function signOut() {
    if (inFlight.current) return;
    setBusy(true); setError('');
    const result = await api.auth.signOut({ scope: 'local' });
    if (result.error) { setError(result.error.message); setBusy(false); }
  }

  return <section className="panel task-panel" aria-labelledby="tasks-title">
    <div className="account"><span title={user.email}>{user.email}</span><button className="text-button" onClick={signOut} disabled={busy}>Sign out</button></div>
    <h1 id="tasks-title">Your tasks</h1>
    <form className="add-form" onSubmit={add}>
      <label className="sr-only" htmlFor="new-task">New task</label>
      <input ref={inputRef} id="new-task" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={300} required disabled={busy || !loaded} />
      <button className="primary" disabled={busy || !loaded || !title.trim()}>Add</button>
    </form>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {loadError ? <div className="error" role="alert"><span>Couldn’t load your tasks: {loadError}</span><button className="text-button" disabled={loading || busy} onClick={load}>Try again</button></div> : null}
    {!loaded && !loadError ? <p className="empty" role="status">Loading tasks…</p> : null}
    {loaded && tasks.length === 0 ? <p className="empty">No tasks yet.</p> : null}
    <ul className="tasks">{taskOrder(tasks).map(task => <li className={task.completed ? 'task completed' : 'task'} key={task.id}>
      {editing === task.id ? <form className="edit-form" onSubmit={event => rename(event, task)}>
        <label className="sr-only" htmlFor={`edit-${task.id}`}>Task name</label>
        <input id={`edit-${task.id}`} value={draft} onChange={e => setDraft(e.target.value)} maxLength={300} required disabled={busy} autoFocus />
        <button className="primary" disabled={busy || !draft.trim()}>Save</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
      </form> : <>
        <input type="checkbox" checked={task.completed} onChange={() => complete(task)} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} disabled={busy} />
        <span className="task-title">{task.title}</span>
        <div className="task-actions"><button className="text-button" aria-label={`Rename ${task.title}`} disabled={busy} onClick={() => { setEditing(task.id); setDraft(task.title); setDeleting(null); setError(''); }}>Rename</button><button className="text-button muted" aria-label={`Delete ${task.title}`} disabled={busy} onClick={() => { setDeleting(task.id); setError(''); }}>Delete</button></div>
      </>}
      {deleting === task.id ? <div className="delete-confirm"><span>Delete this task?</span><button className="danger" disabled={busy} onClick={() => remove(task)}>Delete task</button><button className="text-button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button></div> : null}
    </li>)}</ul>
    <div className="list-footer"><span role="status">{busy ? 'Saving…' : notice}</span><span>Stored in your account</span></div>
  </section>;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(api));
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!api) return;
    let active = true, receivedEvent = false;
    const { data: { subscription } } = api.auth.onAuthStateChange((event, next) => {
      receivedEvent = true;
      if (!active) return;
      setSession(next); setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    api.auth.getSession().then(({ data, error }) => {
      if (!active || receivedEvent) return;
      if (error) setError(error.message);
      setSession(data.session); setLoading(false);
    }).catch(err => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <main className="app-shell">
    <header className="brand"><img src="/llama.svg" alt="" /><div><span>Llama List</span><p>A small place for things to do.</p></div></header>
    {!api ? <p className="error" role="alert">This app’s connection is unavailable. Please try again later.</p> : loading ? <p className="empty" role="status">Loading your account…</p> : session && !recovery ? <TaskList key={session.user.id} user={session.user} /> : <Auth recovery={recovery} onRecovered={() => { setRecovery(false); window.history.replaceState(null, '', window.location.pathname); }} />}
    {error ? <p className="error" role="alert">{error}</p> : null}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
