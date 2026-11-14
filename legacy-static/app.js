(()=>{const STORE='myday-v1';
const today=new Date();
today.setHours(0,0,0,0);
let selected=new Date(today),monthView=new Date(today.getFullYear(),today.getMonth(),1),filter='all',showAll=false;
let data;
try{data=JSON.parse(localStorage.getItem(STORE))||{tasks:[],notes:{}}}catch{data={tasks:[],notes:{}}}if(!data.tasks.length){const d=key(today);
data.tasks=[{id:id(),title:'Poranna kawa i chwila dla siebie',time:'08:00',priority:'low',category:'Osobiste',date:d,done:false},{id:id(),title:'Przejrzeć plan tygodnia',time:'09:00',priority:'high',category:'Praca',date:d,done:false},{id:id(),title:'Przygotować prezentację dla zespołu',time:'11:30',priority:'high',category:'Praca',date:d,done:false},{id:id(),title:'Spacer na świeżym powietrzu',time:'14:00',priority:'medium',category:'Zdrowie',date:d,done:false},{id:id(),title:'Odpisać na ważne wiadomości',time:'16:00',priority:'medium',category:'Praca',date:d,done:false}];
save()}
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s), months=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
function id(){return Math.random().toString(36).slice(2,10)}
function key(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function save(){localStorage.setItem(STORE,JSON.stringify(data))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function same(a,b){return key(a)===key(b)}
function relative(){if(same(selected,today))return 'Plan na dziś';
if(key(selected)===key(new Date(today.getTime()+86400000)))return 'Plan na jutro';
return `Plan na ${selected.getDate()} ${months[selected.getMonth()]}`}
function renderCalendar(){const y=monthView.getFullYear(),m=monthView.getMonth();
$('#monthLabel').textContent=new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(monthView);
let first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),html='';
for(let i=0;
i<42;
i++){let n,dt,dim=false;
if(i<first){n=prev-first+i+1;
dt=new Date(y,m-1,n);
dim=true}else if(i>=first+days){n=i-first-days+1;
dt=new Date(y,m+1,n);
dim=true}else{n=i-first+1;
dt=new Date(y,m,n)}html+=`<span class="day ${dim?'dim':''} ${same(dt,selected)?'selected':''} ${same(dt,today)?'today':''}" data-date="${key(dt)}">${n}</span>`}$('#calendarDays').innerHTML=html;
$$('.day').forEach(el=>el.onclick=()=>{selected=new Date(el.dataset.date+'T00:00:00');
showAll=false;
render()})}
function render(){renderCalendar();
$('#fullDate').textContent=`${selected.getDate()} ${months[selected.getMonth()]} ${selected.getFullYear()}`;
$('#taskHeading').textContent=showAll?'Wszystkie zadania':relative();
$('#navToday').classList.toggle('active',!showAll);
$('#navAll').classList.toggle('active',showAll);
let tasks=showAll?[...data.tasks]:data.tasks.filter(t=>t.date===key(selected));
tasks.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
const total=tasks.length,done=tasks.filter(t=>t.done).length,open=total-done;
$('#doneCount').textContent=done;
$('#totalCount').textContent=total;
$('#remainingCount').textContent=open;
$('#completionPct').innerHTML=`${total?Math.round(done/total*100):0}<small>%</small>`;
$('#progressBar').style.width=`${total?done/total*100:0}%`;
$('#navCount').textContent=data.tasks.filter(t=>t.date===key(today)&&!t.done).length;
let visible=tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
$('#taskList').innerHTML=visible.length?visible.map(t=>`<article class="task ${t.done?'done':''}"><input class="check" type="checkbox" aria-label="Oznacz jako wykonane" data-check="${t.id}" ${t.done?'checked':''}><div class="task-copy"><div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta"><span>◷ ${t.time||'Bez godziny'}</span><span>${escapeHtml(t.category||'Inne')}</span></div></div><span class="priority ${t.priority}">${t.priority==='high'?'Wysoki':t.priority==='low'?'Niski':'Średni'}</span><button class="delete-task" title="Usuń zadanie" data-delete="${t.id}">×</button></article>`).join(''):`<div class="empty"><div class="empty-icon">${total?'✓':'☀️'}</div>${total?'Brak zadań w tym widoku.':'Ten dzień jest jeszcze otwarty.<br>Dodaj zadanie i zacznij planować.'}</div>`;
$$('[data-check]').forEach(el=>el.onchange=()=>{const t=data.tasks.find(t=>t.id===el.dataset.check);
if(t)t.done=el.checked;
save();
render()});
$$('[data-delete]').forEach(el=>el.onclick=()=>{data.tasks=data.tasks.filter(t=>t.id!==el.dataset.delete);
save();
render();
toast('Zadanie usunięte')});
let upcoming=tasks.filter(t=>t.time&&!t.done).slice(0,4);
$('#upNext').innerHTML=upcoming.length?upcoming.map(t=>`<div class="up-item"><div class="up-time">${t.time}</div><div class="timeline"><i class="dot"></i></div><div class="up-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.category||'Inne')}</small></div></div>`).join(''):`<div class="up-empty">${open?'Wszystko zaplanowane. Spokojnie, dasz radę!':'Brak kolejnych zadań. Czas na chwilę dla siebie ☕'}</div>`;
$('#dayNote').value=data.notes[key(selected)]||'';
let h=new Date().getHours();
$('#greeting').textContent=h<12?'Dzień dobry ☀️':h<18?'Miłego popołudnia ☀️':'Dobry wieczór 🌙'}
function toast(msg){const el=$('#toast');
el.textContent=msg;
el.classList.add('show');
setTimeout(()=>el.classList.remove('show'),2100)}
function openModal(){$('#modalBack').classList.add('open');
setTimeout(()=>$('#title').focus(),50)}
function closeModal(){$('#modalBack').classList.remove('open');
$('#taskForm').reset()}$('#addTask').onclick=openModal;
$('#closeModal').onclick=closeModal;
$('#modalBack').onclick=e=>{if(e.target===$('#modalBack'))closeModal()};
document.onkeydown=e=>{if(e.key==='Escape')closeModal()};
$('#taskForm').onsubmit=e=>{e.preventDefault();
const title=$('#title').value.trim();
if(!title)return;
data.tasks.push({id:id(),title,time:$('#time').value,priority:$('#priority').value,category:$('#category').value,date:key(selected),done:false});
save();
showAll=false;
filter='all';
$$('.filters button').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
closeModal();
render();
toast('Dodano zadanie do planu')};
$('#prevDay').onclick=()=>{selected.setDate(selected.getDate()-1);
showAll=false;
render()};
$('#nextDay').onclick=()=>{selected.setDate(selected.getDate()+1);
showAll=false;
render()};
$('#prevMonth').onclick=()=>{monthView.setMonth(monthView.getMonth()-1);
renderCalendar()};
$('#nextMonth').onclick=()=>{monthView.setMonth(monthView.getMonth()+1);
renderCalendar()};
$('#navToday').onclick=()=>{selected=new Date(today);
showAll=false;
render()};
$('#navAll').onclick=()=>{showAll=true;
render()};
$('#mobileToday').onclick=()=>{selected=new Date(today);
showAll=false;
render()};
$$('.filters button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;
$$('.filters button').forEach(x=>x.classList.toggle('active',x===b));
render()});
let noteTimer;
$('#dayNote').oninput=e=>{clearTimeout(noteTimer);
let k=key(selected),v=e.target.value;
noteTimer=setTimeout(()=>{if(v)data.notes[k]=v;
else delete data.notes[k];
save()},300)};
render()})();

