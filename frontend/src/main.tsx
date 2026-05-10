import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DaughterApp from './pages/Daughter';
import './styles.css';

const path = window.location.pathname;

// 路由：/daughter -> 女儿端；/mom 或其他 -> 妈妈端；/ 自动跳转到 /mom
if (path === '/' || path === '') {
  window.history.replaceState(null, '', '/mom');
}

const isDaughter = window.location.pathname.startsWith('/daughter');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDaughter ? <DaughterApp /> : <App />}
  </React.StrictMode>
);
