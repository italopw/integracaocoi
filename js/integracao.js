// Arquivo: js/integracao.js
// Módulo exportado do script que estava inline em integracao.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

setLogLevel('debug'); // Ativa logs de debug para o Firestore

// Variáveis Globais (fornecidas pelo ambiente Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
let isAuthReady = false;

// Inicialização e Autenticação Firebase
export async function initializeFirebaseDashboard() {
    if (!firebaseConfig) {
        console.error("Firebase Config não encontrada.");
        // mesmo sem firebase, chamamos listenToPlanningData para ativar mock
        listenToPlanningData();
        return;
    }

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Tenta autenticar com token ou anonimamente
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
        console.log("✅ Autenticação Firebase bem-sucedida.");
    } catch (error) {
        console.error("❌ Falha na autenticação Firebase:", error);
    }
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log(`Usuário autenticado: ${user.uid}`);
        } else {
            console.log("Usuário desautenticado.");
        }
        isAuthReady = true;
        listenToPlanningData(); // Começa a escutar após a autenticação
    });
}

// Obtém a referência do documento público
function getPlanningDocRef() {
    return doc(db, `artifacts/${appId}/public/data/planning_data/current_status`);
}

// Função para escutar mudanças nos dados do planejamento (Firestore ou fallback localStorage)
function listenToPlanningData() {
    const statusIndicator = document.getElementById('status-conexao');

    if (db && isAuthReady) {
        try {
            const docRef = getPlanningDocRef();
            // onSnapshot: Atualiza em tempo real sempre que os dados mudam no Firestore
            onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    statusIndicator.textContent = "CONECTADO: Dados atualizados.";
                    statusIndicator.className = 'text-green-500 font-bold';
                    updateDashboard(data);
                } else {
                    statusIndicator.textContent = "CONECTADO: Aguardando primeira transmissão...";
                    statusIndicator.className = 'text-yellow-500 font-bold';
                    document.getElementById('dashboard-content').innerHTML = '<p class="text-center text-gray-500 p-8">Nenhum dado de planejamento encontrado. Por favor, utilize a Interface de Entrada (A) para transmitir o primeiro status operacional.</p>';
                }
            }, (error) => {
                console.error("Erro ao escutar dados do Firestore:", error);
                statusIndicator.textContent = "ERRO: Falha na conexão Firestore.";
                statusIndicator.className = 'text-red-500 font-bold';
                // Se houver erro, ativa o modo local
                startLocalMockListener();
            });
            return;
        } catch (e) {
            console.warn('Falha ao configurar listener Firestore, usando modo local.', e);
        }
    }

    // Se não houver Firestore configurado ou autenticação, usa listener localStorage (mock)
    startLocalMockListener();
}

// Fallback: listener que usa localStorage para testes locais (funciona entre abas no mesmo host)
function startLocalMockListener() {
    const statusIndicator = document.getElementById('status-conexao');
    if (statusIndicator) {
        statusIndicator.textContent = "MODO MOCK: ouvindo localStorage.";
        statusIndicator.className = 'text-indigo-400 font-bold';
    }

    try {
        const raw = localStorage.getItem('planning_public');
        if (raw) {
            const data = JSON.parse(raw);
            updateDashboard(data);
        }
    } catch (e) {
        console.warn('Erro ao ler mock localStorage:', e);
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'planning_public') {
            try {
                const data = JSON.parse(e.newValue);
                const indicator = document.getElementById('status-conexao');
                if (indicator) {
                    indicator.textContent = 'MODO MOCK: Dados atualizados via localStorage.';
                    indicator.className = 'text-green-500 font-bold';
                }
                updateDashboard(data);
            } catch (err) {
                console.error('Erro ao parsear planning_public do localStorage:', err);
            }
        }
    });
}

// Mapeia prioridades para classes Tailwind (para cores)
function getPriorityClass(priority) {
    const normalizedPriority = priority ? priority.toLowerCase() : 'normal';
    switch (normalizedPriority) {
        case 'alta': return 'priority-alta bg-white';
        case 'média': return 'priority-media bg-white';
        case 'baixa': return 'priority-baixa bg-white';
        default: return 'priority-normal bg-white';
    }
}

// Função principal para atualizar o Dashboard com novos dados
export function updateDashboard(data) {
    const contentContainer = document.getElementById('dashboard-content');
    
    // 1. Atualizar Header
    if (document.getElementById('data-planejamento')) document.getElementById('data-planejamento').textContent = data.data || 'N/A';
    if (document.getElementById('turno-planejamento')) document.getElementById('turno-planejamento').textContent = data.turno || 'N/A';
    if (document.getElementById('ultima-atualizacao')) document.getElementById('ultima-atualizacao').textContent = new Date(data.timestamp).toLocaleString('pt-BR') || 'N/A';
    
    // 2. Processar e Ordenar Setores
    const setores = data.setores || [];

    // A alta gestão sempre visualiza a prioridade mais alta primeiro
    const orderMap = { 'ALTA': 1, 'MÉDIA': 2, 'BAIXA': 3, 'NORMAL': 4 };
    setores.sort((a, b) => {
        const priorityA = orderMap[(a.prioridade || '').toUpperCase()] || 99;
        const priorityB = orderMap[(b.prioridade || '').toUpperCase()] || 99;
        return priorityA - priorityB;
    });

    // 3. Renderizar Setores
    let htmlContent = '';
    setores.forEach(setor => {
        htmlContent += `
            <div class="card p-6 ${getPriorityClass(setor.prioridade)}">
                <div class="status-header flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-[#0d2545]">${setor.nome}</h3>
                    <span class="text-lg font-bold">
                        Prioridade: ${String(setor.prioridade || '').toUpperCase()}
                    </span>
                </div>
                <p class="whitespace-pre-wrap text-gray-700 leading-relaxed min-h-[100px]">${setor.status}</p>
            </div>
        `;
    });

    if (contentContainer) contentContainer.innerHTML = htmlContent;
}

// Inicia o processo automaticamente ao importar
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        initializeFirebaseDashboard();
    });
}
