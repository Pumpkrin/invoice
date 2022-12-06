import './modules/sign.js';
import './modules/discussion.js';

const dialog = document.querySelector('dialog');
dialog.addEventListener('cancel', event => event.preventDefault() ); 
dialog.showModal();



