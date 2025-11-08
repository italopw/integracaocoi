// Arquivo: js/entrada.js
// Módulo que contém a lógica do formulário que estava inline em entrada.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

setLogLevel('debug');

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = (typeof __firebase_config !== 'undefined') ? JSON.parse(__firebase_config) : ((typeof _firebase_config !== 'undefined') ? JSON.parse(_firebase_config) : null);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId;
const SECTORS = [
    'MOEGAS/RECEPÇÃO', 'SILOS E PRÉ-SECAGENS', 'SILO PULMÃO',
    'SILOS DE REPASSE', 'BENEFICIAMENTO', 'ENSAQUE', 'MARCOLD',
    'GRANELEIRO ADRIANA'
];

// Inicialização Firebase
async function initializeFirebaseForm() {
    if (!firebaseConfig) {
        console.warn('Firebase config não encontrada. Modo mock/local ativado.');
        return;
    }
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
        userId = auth.currentUser?.uid || (crypto && crypto.randomUUID ? crypto.randomUUID() : ('user-' + Date.now()));
        console.log(`✅ Autenticação Firebase bem-sucedida. User ID: ${userId}`);
        loadLastStatusFromFirestore();
    } catch (error) {
        console.error('Falha na autenticação:', error);
    }
}

function getPlanningDocRefPrivate() {
    return doc(db, `artifacts/${appId}/users/${userId}/planning_data/current_status`);
}
function getPlanningDocRefPublic() {
    return doc(db, `artifacts/${appId}/public/data/planning_data/current_status`);
}

function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showFeedback(message, isError = false) {
    const msgEl = document.getElementById('feedback-message');
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.className = `p-3 rounded-md mt-4 font-semibold text-center fade-in ${isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`;
    msgEl.style.opacity = '1';
    setTimeout(() => {
        msgEl.className = 'fade-out';
        setTimeout(() => { msgEl.textContent = ''; msgEl.style.opacity = '0'; }, 500);
    }, 5000);
}

async function loadLastStatusFromFirestore() {
    try {
        const docRef = getPlanningDocRefPrivate();
        const docSnap = await getDoc(docRef);
        if (docSnap.exists && docSnap.exists()) {
            const data = docSnap.data();
            (data.setores || []).forEach(setor => {
                const statusEl = document.getElementById(`status-${setor.id}`);
                const priorityEl = document.getElementById(`priority-${setor.id}`);
                if (statusEl) statusEl.value = setor.status || '';
                if (priorityEl) priorityEl.value = setor.prioridade || 'NORMAL';
            });
            showFeedback('Último status de trabalho carregado com sucesso.', false);
        }
    } catch (error) {
        console.error('Erro ao carregar status do Firestore (private):', error);
    }
}

function loadStatusFromLocal() {
    console.log('Carregando status do localStorage (não implementado)');
}

async function saveStatusPrivate() {
    const formData = collectFormData(false);
    try {
        if (db) await setDoc(getPlanningDocRefPrivate(), formData || {});
        console.log('Rascunho salvo no Firestore (private).');
    } catch (error) {
        console.error('Erro ao salvar rascunho no Firestore (private):', error);
    }
}

function collectFormData(requireFull) {
    const dataRef = document.getElementById('data-ref')?.value;
    const turnoRef = document.getElementById('turno-ref')?.value;
    if (requireFull && (!dataRef || !turnoRef)) return null;
    const setoresData = SECTORS.map(nome => {
        const id = nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
        const statusEl = document.getElementById(`status-${id}`);
        const priorityEl = document.getElementById(`priority-${id}`);
        const status = statusEl ? statusEl.value.trim() : '';
        const prioridade = priorityEl ? priorityEl.value.toUpperCase() : 'NORMAL';
        if (requireFull && !status) return null;
        return { id, nome, status, prioridade };
    }).filter(item => item !== null);
    if (requireFull && setoresData.length === 0) return null;
    return { timestamp: Date.now(), data: dataRef, turno: turnoRef, setores: setoresData };
}

export async function handleTransmission(event) {
    event?.preventDefault?.();
    const formData = collectFormData(true);
    if (!formData) { showFeedback('⚠ Por favor, preencha a Data, o Turno e pelo menos um Status de Setor.', true); return; }
    try {
        await saveStatusPrivate();
        if (db) await setDoc(getPlanningDocRefPublic(), formData);
        showFeedback('🚀 Planejamento salvo e Dashboard COI atualizado com sucesso!', false);
    } catch (error) {
        showFeedback(`❌ Erro ao salvar/atualizar o planejamento: ${error?.message || error}`, true);
        console.error('Erro na transmissão (salvar público):', error);
    } finally {
        try { localStorage.setItem('planning_public', JSON.stringify(formData)); console.log('Mock: planning_public escrito no localStorage para testes locais.'); } catch (e) { console.warn('Não foi possível escrever planning_public no localStorage:', e); }
    }
}

export function clearForm() {
    SECTORS.forEach(nome => {
        const id = nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
        const statusEl = document.getElementById(`status-${id}`);
        const priorityEl = document.getElementById(`priority-${id}`);
        if (statusEl) statusEl.value = '';
        if (priorityEl) priorityEl.value = 'NORMAL';
    });
    document.getElementById('data-ref').value = getCurrentDateString();
    document.getElementById('turno-ref').value = 'TURNO 1';
    showFeedback('Formulário limpo e pronto para um novo preenchimento.', false);
    saveStatusPrivate();
}

// Inicialização e wiring
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('data-ref').value = getCurrentDateString();
        document.getElementById('transmission-form').addEventListener('submit', handleTransmission);
        document.getElementById('clear-form-btn').addEventListener('click', clearForm);
        SECTORS.forEach(nome => {
            const id = nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
            document.getElementById(`status-${id}`)?.addEventListener('input', saveStatusPrivate);
            document.getElementById(`priority-${id}`)?.addEventListener('change', saveStatusPrivate);
        });
        document.getElementById('data-ref')?.addEventListener('change', saveStatusPrivate);
        document.getElementById('turno-ref')?.addEventListener('change', saveStatusPrivate);

        // Inicializa formulário a partir de mock no localStorage, se existir
        try {
            const raw = localStorage.getItem('planning_public');
            if (raw) {
                const publicData = JSON.parse(raw);
                if (publicData.data) document.getElementById('data-ref').value = publicData.data;
                if (publicData.turno) document.getElementById('turno-ref').value = publicData.turno;
                (publicData.setores || []).forEach(setor => {
                    const statusEl = document.getElementById(`status-${setor.id}`);
                    const priorityEl = document.getElementById(`priority-${setor.id}`);
                    if (statusEl) statusEl.value = setor.status || '';
                    if (priorityEl) priorityEl.value = setor.prioridade || 'NORMAL';
                });
                console.log('Mock: formulário inicializado a partir de planning_public no localStorage.');
            }
        } catch (e) { console.warn('Erro ao inicializar formulário a partir de mock localStorage:', e); }

        initializeFirebaseForm();
    });
}
