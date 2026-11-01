import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {reset} from './offline';
import BeautySalon from './components/BeautySalon';
import OwnerDashboard from './components/OwnerDashboard';

function App(){
  const [admin,setAdmin]=useState(location.hash==='#admin');
  useEffect(()=>{document.body.classList.toggle('hm-admin',admin);},[admin]);
  useEffect(()=>{const change=()=>{setAdmin(location.hash==='#admin');window.scrollTo(0,0);};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  return <><div className="portfolio-notice"><span><b>Демонстрация портфолио</b> · Записи сохраняются только в этом браузере.</span><nav><a href="#site">Сайт</a><a href="#admin">Панель</a><button onClick={()=>{if(confirm('Удалить демонстрационные записи и изменения?'))reset();}}>Сбросить</button></nav></div>{admin?<OwnerDashboard/>:<BeautySalon/>}</>;
}
document.addEventListener('click',event=>{
  const a=(event.target as HTMLElement).closest('a');if(!a)return;
  const href=a.getAttribute('href')||'';
  if(href==='/manage/'){event.preventDefault();location.hash='admin';}
  else if(href==='/'||href==='/proposal/'){event.preventDefault();location.hash='site';}
  else if(/^(https?:|tel:|mailto:)/.test(href)){event.preventDefault();alert('Это демонстрационный сайт. Контакты и внешние обращения отключены.');}
},true);
document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'light');
createRoot(document.getElementById('root')!).render(<App/>);
