// An illustrative permission selector only; never sends invites or grants access.
const roleButtons=[...document.querySelectorAll('[data-circle-role]')];
for(const button of roleButtons)button.addEventListener('click',()=>{
 const editing=button.dataset.circleRole==='editor';
 for(const peer of roleButtons)peer.setAttribute('aria-pressed',String(peer===button));
 document.getElementById('circle-member-role').textContent=editing?'Can edit':'View only';
 document.getElementById('circle-member-note').textContent=editing?'Help update permitted shared records':'Follow along without changing records';
 document.getElementById('circle-role-description').textContent=editing?'Editors can update permitted shared records. Choose people you trust.':'Viewers can see permitted shared records without editing them.';
});
