// Arquivo: js/entrada.js
// Módulo que contém a lógica do formulário de entrada de dados

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Estado global da aplicação
let db, auth, userId;
let isConnected = false;
let lastSavePromise = Promise.resolve();

// Constantes
const SECTORS = [
    'MOEGAS/RECEPÇÃO', 'SILOS E PRÉ-SECAGENS', 'SILO PULMÃO',
    'SILOS DE REPASSE', 'BENEFICIAMENTO', 'ENSAQUE', 'MARCOLD',
    'GRANELEIRO ADRIANA'
];

const STATUS_MESSAGES = {
    CONNECTING: { text: '🔄 Conectando ao servidor...', isError: false },
    CONNECTED: { text: '✅ Conectado ao servidor', isError: false },
    CONNECTION_ERROR: { text: '❌ Erro de conexão. Tentando reconectar...', isError: true },
    SAVE_ERROR: { text: '❌ Erro ao salvar. Suas alterações serão salvas quando reconectar.', isError: true },
    SAVED: { text: '✅ Alterações salvas com sucesso!', isError: false },
    VALIDATION_ERROR: { text: '⚠️ Por favor, preencha todos os campos obrigatórios.', isError: true }
};

// Inicialização Firebase com reconexão automática
async function initializeFirebaseForm() {
    showStatus('CONNECTING');
    
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        await signInAnonymously(auth);
        userId = auth.currentUser?.uid || crypto.randomUUID();
        
        isConnected = true;
        showStatus('CONNECTED');
        
        // Carregar último estado
        await loadLastStatusFromFirestore();
        
        // Reconexão automática a cada 30s se desconectado
        setInterval(async () => {
            if (!isConnected) {
                try {
                    await signInAnonymously(auth);
                    isConnected = true;
                    showStatus('CONNECTED');
                } catch (error) {
                    console.error('Erro na reconexão:', error);
                }
            }
        }, 30000);
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showStatus('CONNECTION_ERROR');
        isConnected = false;
    }
}

function getPlanningDocRefPrivate() {
    return doc(db, `users/${userId}/planning_data/current_status`);
}
function getPlanningDocRefPublic() {
    return doc(db, `public/planning_data/current_status`);
}

function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showStatus(statusKey, timeout = 5000) {
    const status = STATUS_MESSAGES[statusKey];
    const msgEl = document.getElementById('feedback-message');
    if (!msgEl || !status) return;
    
    msgEl.textContent = status.text;
    msgEl.className = `p-3 rounded-md mt-4 font-semibold text-center fade-in ${
        status.isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
    }`;
    msgEl.style.opacity = '1';
    
    if (timeout > 0) {
        setTimeout(() => {
            msgEl.className = 'fade-out';
            setTimeout(() => {
                msgEl.textContent = '';
                msgEl.style.opacity = '0';
            }, 500);
        }, timeout);
    }
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
    if (!db) return;
    
    const formData = collectFormData(false);
    if (!formData) return;
    
    // Usar Promise para garantir ordem das operações
    lastSavePromise = lastSavePromise.then(async () => {
        try {
            await setDoc(getPlanningDocRefPrivate(), formData);
            if (isConnected) {
                showStatus('SAVED');
            }
        } catch (error) {
            console.error('Erro ao salvar rascunho:', error);
            if (error.code === 'unavailable') {
                isConnected = false;
                showStatus('SAVE_ERROR');
            }
        }
    });
    
    return lastSavePromise;
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
    if (!formData) {
        showStatus('VALIDATION_ERROR');
        return;
    }
    
    try {
        // Primeiro salva private
        await saveStatusPrivate();
        
        // Depois atualiza público
        if (db && isConnected) {
            await setDoc(getPlanningDocRefPublic(), formData);
            showStatus('SAVED');
        } else {
            showStatus('SAVE_ERROR');
        }
    } catch (error) {
        console.error('Erro na transmissão:', error);
        showStatus('SAVE_ERROR');
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
